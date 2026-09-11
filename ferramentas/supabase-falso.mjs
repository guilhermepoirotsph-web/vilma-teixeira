#!/usr/bin/env node
/* ============================================================================
   supabase-falso.mjs — Supabase de mentira em cima de um Postgres de verdade.

   Sobe o banco/schema.sql num PGlite e responde no formato do Supabase
   (auth/v1 + rest/v1), para provar os PAINÉIS de ponta a ponta sem depender
   de um projeto real na nuvem. É ferramenta de teste — nunca vai para o ar.

   Uso: node ferramentas/supabase-falso.mjs [porta]      (padrão 8810)
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { ORDEM } from '../banco/montar-sql.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.argv[2]) || 8810;
const CHAVE = 'chave-publishable-de-teste';

const db = new PGlite();

/* ─────────────────────── o que o Supabase dá pronto ─────────────────── */
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    senha text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('req.uid', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
`);

/* as migrações, na mesma ordem em que vão ser coladas no SQL Editor — a
   lista vem do montar-sql.mjs para não existir em dois lugares */
for (const arq of ORDEM)
  await db.exec(await readFile(join(RAIZ, 'banco', arq), 'utf8'));
await db.exec(`
  alter table public.perfis        force row level security;
  alter table public.eventos       force row level security;
  alter table public.apoiadores    force row level security;
  alter table public.conteudos     force row level security;
  alter table public.site_conteudo force row level security;
`);

/* ───────────────────────────── equipe de teste ──────────────────────── */
const EQUIPE = [
  { email: 'mariana@vilmateixeira.com.br', senha: 'teste1234', nome: 'Mariana Barbosa', papel: 'assessora' },
  { email: 'lucas@vilmateixeira.com.br',   senha: 'teste1234', nome: 'Lucas',           papel: 'social' },
  { email: 'guilherme@gdstudiox.com.br',   senha: 'teste1234', nome: 'Guilherme',       papel: 'admin' },
  { email: 'novato@vilmateixeira.com.br',  senha: 'teste1234', nome: 'Novato',          papel: null },
];
for (const p of EQUIPE) {
  await db.query(`insert into auth.users (email, senha, raw_user_meta_data)
                  values ($1::text,$2::text,jsonb_build_object('nome',$3::text))`,
                 [p.email, p.senha, p.nome]);
  if (p.papel) await db.query(`select public.promover($1,$2::papel_equipe)`, [p.email, p.papel]);
}

/* ──────────────────────────── sessões em memória ────────────────────── */
const sessoes = new Map();   // token -> uid
const novoToken = () => 'tk_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ─────────────────────── tradutor PostgREST → SQL ───────────────────── */
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', is: 'is' };

function montarWhere(params, vals) {
  const partes = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = String(v).match(/^([a-z]+)\.(.*)$/s);
    if (!m || !OPS[m[1]]) continue;
    if (m[1] === 'is') { partes.push(`"${k}" is ${m[2] === 'null' ? 'null' : 'not null'}`); continue; }
    vals.push(m[2]);
    partes.push(`"${k}" ${OPS[m[1]]} $${vals.length}`);
  }
  return partes.length ? ' where ' + partes.join(' and ') : '';
}

function montarOrder(params) {
  const o = params.get('order');
  if (!o) return '';
  const cols = o.split(',').map(x => {
    const [c, ...mods] = x.split('.');
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulls = mods.includes('nullslast') ? ' nulls last'
                : mods.includes('nullsfirst') ? ' nulls first' : '';
    return `"${c}" ${dir}${nulls}`;
  });
  return ' order by ' + cols.join(', ');
}

const selecao = params => {
  const s = params.get('select');
  if (!s || s === '*') return '*';
  return s.split(',').map(c => `"${c.trim()}"`).join(', ');
};

async function comoUsuario(uid, fn) {
  await db.exec(`set role none; select set_config('req.uid', '${uid || ''}', false);`);
  await db.exec(uid ? 'set role authenticated;' : 'set role anon;');
  try { return await fn(); } finally { await db.exec('set role none;'); }
}

/* ──────────────────────────────── servidor ──────────────────────────── */
const json = (res, code, dado, extra = {}) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...extra,
  });
  res.end(dado === null ? '' : JSON.stringify(dado));
};

const corpo = req => new Promise(r => {
  let s = ''; req.on('data', c => { s += c; }); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } });
});

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (req.method === 'OPTIONS') return json(res, 204, null);

    if ((req.headers.apikey || '') !== CHAVE) return json(res, 401, { message: 'apikey inválida' });

    /* Só do servidor de teste: volta o banco ao estado inicial para a bateria
       de provas poder rodar quantas vezes quiser e dar sempre o mesmo resultado. */
    if (p === '/reset' && req.method === 'POST') {
      await db.exec(`
        set role none;
        truncate public.eventos, public.apoiadores, public.conteudos restart identity cascade;
        update public.site_conteudo set valor = null;
      `);
      return json(res, 200, { ok: true });
    }

    /* ---------------------------------------------------------- AUTH */
    if (p === '/auth/v1/token') {
      const b = await corpo(req);
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const uid = sessoes.get(b.refresh_token);
        if (!uid) return json(res, 401, { message: 'refresh inválido' });
        const t = novoToken(); sessoes.set(t, uid);
        return json(res, 200, { access_token: t, refresh_token: b.refresh_token });
      }
      const r = await db.query(
        `select id, email from auth.users where lower(email)=lower($1) and senha=$2`,
        [String(b.email || '').trim(), String(b.password || '')]);
      if (!r.rows.length) return json(res, 400, { message: 'Invalid login credentials' });
      const t = novoToken(), rt = novoToken();
      sessoes.set(t, r.rows[0].id); sessoes.set(rt, r.rows[0].id);
      return json(res, 200, {
        access_token: t, refresh_token: rt,
        user: { id: r.rows[0].id, email: r.rows[0].email },
      });
    }
    if (p === '/auth/v1/logout') { return json(res, 204, null); }
    if (p === '/auth/v1/recover') { return json(res, 200, {}); }

    /* ---------------------------------------------------------- REST */
    if (p.startsWith('/rest/v1/')) {
      const auth = (req.headers.authorization || '').replace('Bearer ', '');
      const uid = sessoes.get(auth) || null;      // sem sessão = anon
      const alvo = p.slice('/rest/v1/'.length);

      // RPC
      if (alvo.startsWith('rpc/')) {
        const fn = alvo.slice(4);
        const args = await corpo(req);
        const nomes = Object.keys(args);
        const sql = `select public.${fn}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
        try {
          const r = await comoUsuario(uid, () => db.query(sql, nomes.map(n => args[n])));
          return json(res, 200, r.rows[0].r);
        } catch (e) { return json(res, 400, { message: e.message }); }
      }

      const params = [...url.searchParams.entries()];
      const minimal = /return=minimal/.test(req.headers.prefer || '');

      try {
        if (req.method === 'GET') {
          const vals = [];
          const sql = `select ${selecao(url.searchParams)} from public."${alvo}"` +
            montarWhere(params, vals) + montarOrder(url.searchParams) +
            (url.searchParams.get('limit') ? ` limit ${Number(url.searchParams.get('limit'))}` : '');
          const r = await comoUsuario(uid, () => db.query(sql, vals));
          return json(res, 200, r.rows);
        }
        if (req.method === 'POST') {
          const b = await corpo(req);
          const cols = Object.keys(b);
          const sql = `insert into public."${alvo}" (${cols.map(c => `"${c}"`).join(',')})
                       values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`;
          const r = await comoUsuario(uid, () => db.query(sql, cols.map(c => b[c])));
          return json(res, 201, minimal ? null : r.rows);
        }
        if (req.method === 'PATCH') {
          const b = await corpo(req);
          const cols = Object.keys(b);
          const vals = cols.map(c => b[c]);
          const sets = cols.map((c, i) => `"${c}"=$${i + 1}`).join(',');
          const sql = `update public."${alvo}" set ${sets}` +
                      montarWhere(params, vals) + ' returning *';
          const r = await comoUsuario(uid, () => db.query(sql, vals));
          return json(res, minimal ? 204 : 200, minimal ? null : r.rows);
        }
        if (req.method === 'DELETE') {
          const vals = [];
          const sql = `delete from public."${alvo}"` + montarWhere(params, vals) + ' returning *';
          const r = await comoUsuario(uid, () => db.query(sql, vals));
          return json(res, 204, null);
        }
      } catch (e) {
        const perm = /permission denied|row-level/i.test(e.message);
        return json(res, perm ? 403 : 400, { message: e.message });
      }
    }

    json(res, 404, { message: 'rota não existe no Supabase falso' });
  } catch (e) {
    json(res, 500, { message: e.message });
  }
}).listen(PORTA, () => {
  console.log('▸ Supabase falso em http://localhost:' + PORTA);
  console.log('  chave: ' + CHAVE);
  EQUIPE.forEach(p => console.log(`  ${(p.papel || 'sem papel').padEnd(10)} ${p.email} / ${p.senha}`));
});
