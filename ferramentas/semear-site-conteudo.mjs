#!/usr/bin/env node
/* ============================================================================
   semear-site-conteudo.mjs — gera o SQL que enche as 28 chaves de
   `site_conteudo` com o que o site JÁ MOSTRA hoje.

   Por que isto precisa existir: as chaves nascem VAZIAS, e o site cai no que
   está no código quando a chave está vazia — então a tela fica certa e nada
   parece errado. Mas o painel do social media mostra `value=""`, ou seja, o
   Lucas abre a aba "Site" e vê 28 campos em branco. Ele não consegue EDITAR o
   texto que está no ar: só substituir às cegas, redigitando tudo.

   Semear resolve isso sem mudar uma linha do site: o valor semeado é
   idêntico ao padrão, então nada muda na tela — muda o que ele enxerga.

   Uso:  node ferramentas/semear-site-conteudo.mjs        → imprime o SQL
         node ferramentas/semear-site-conteudo.mjs --ver  → só confere
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SO_CONFERIR = process.argv.includes('--ver');

/* ── 1 · os padrões que o site usa hoje ─────────────────────────────── */
const janela = { VT_DADOS: null };
const fonte = fs.readFileSync(path.join(RAIZ, 'assets/js/dados.js'), 'utf8');
new Function('window', fonte)(janela);
const D = janela.VT_DADOS;
if (!D) { console.error('não consegui ler VT_DADOS de assets/js/dados.js'); process.exit(1); }

/* ── 2 · as chaves que existem no banco ─────────────────────────────── */
const schema = fs.readFileSync(path.join(RAIZ, 'banco/schema.sql'), 'utf8');
const bloco = schema.slice(schema.indexOf('insert into public.site_conteudo'));
const chaves = [...bloco.matchAll(/^\s*\('([a-z0-9_.-]+)'/gm)].map(m => m[1]);

/* ── 3 · o HTML, para as chaves que vivem em data-vt ────────────────── */
const html = fs.readdirSync(path.join(RAIZ, 'partes'))
  .filter(f => f.endsWith('.html'))
  .map(f => fs.readFileSync(path.join(RAIZ, 'partes', f), 'utf8'))
  .join('\n');

function doHtml(chave) {
  const re = new RegExp(`data-vt="${chave.replace(/\./g, '\\.')}"[^>]*>([\\s\\S]*?)<\\/`, 'i');
  const m = html.match(re);
  if (!m) return null;
  const txt = m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return txt || null;
}

/* Nem toda chave tem o nome do objeto onde o valor mora: `geral.*` e `heroi.*`
   vivem dentro de `vilma` e `campanha`. Sem este apelido o semeador dá por
   "sem padrão" justamente as chaves que têm padrão. */
const APELIDO = {
  'geral.instagram': () => D.vilma && D.vilma.instagram,
  'geral.whatsapp':  () => D.campanha && D.campanha.whatsapp,
  'heroi.foto':      () => D.vilma && D.vilma.foto,
  // 'video.titulo' NÃO recebe apelido de propósito: o candidato óbvio seria
  // `video.legenda`, mas legenda é o texto longo do reel e título é o <h2> da
  // seção. Semear errado é pior que deixar em branco — o campo em branco a
  // pessoa preenche; o campo com a coisa errada ela publica sem olhar.
  'video.titulo':    () => 'O recado da Vilma para Caraguá',
};

function doDados(chave) {
  const ap = APELIDO[chave];
  if (ap) {
    const a = ap();
    if (a != null && String(a).length) return String(a);
  }
  let v = D;
  for (const parte of chave.split('.')) {
    if (v == null || typeof v !== 'object') return null;
    v = v[parte];
  }
  if (v == null) return null;
  if (Array.isArray(v)) return null;              // transcrição já parseada, etc.
  if (typeof v === 'object') return null;
  return String(v);
}

const achados = [], faltando = [];
for (const chave of chaves) {
  const v = doDados(chave) ?? doHtml(chave);
  if (v && v.length) achados.push([chave, v]); else faltando.push(chave);
}

console.error(`${achados.length}/${chaves.length} chaves com valor no código`);
if (faltando.length) console.error('sem padrão (ficam em branco, e tudo bem):', faltando.join(', '));
if (SO_CONFERIR) process.exit(0);

/* ── 4 · o SQL ──────────────────────────────────────────────────────── */
const aspas = s => "'" + String(s).replace(/'/g, "''") + "'";
console.log(`-- Gerado por ferramentas/semear-site-conteudo.mjs
-- Enche as chaves VAZIAS com o texto que o site já mostra, para o social
-- media EDITAR em vez de redigitar no escuro. Não toca em chave já
-- preenchida: rodar de novo não desfaz o trabalho de ninguém.
`);
for (const [chave, valor] of achados) {
  console.log(`update public.site_conteudo set valor = ${aspas(valor)}
 where chave = ${aspas(chave)} and coalesce(btrim(valor),'') = '';`);
}
console.log(`
select count(*) filter (where coalesce(btrim(valor),'') = '') as ainda_vazias,
       count(*) as total
  from public.site_conteudo;`);
