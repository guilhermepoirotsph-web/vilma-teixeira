#!/usr/bin/env node
/* ============================================================================
   provar-sql.mjs — roda banco/schema.sql inteiro num Postgres de verdade
   (PGlite, em WASM) e prova a cadeia de segurança ANTES de tocar no Supabase.

   Uso: node banco/provar-sql.mjs
   ========================================================================== */
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const provas = [];
const ok  = (n, d = '') => provas.push({ ok: true,  n, d });
const bad = (n, d = '') => provas.push({ ok: false, n, d });

const db = new PGlite();

/* ─────────────────────── remendo do que o Supabase dá de graça ───────── */
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('req.uid', true), '')::uuid
    $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
`);

/* ───────────────────────────── roda o schema de produção ─────────────── */
const sql = await readFile(join(AQUI, 'schema.sql'), 'utf8');
try { await db.exec(sql); ok('schema.sql roda inteiro sem erro'); }
catch (e) { bad('schema.sql falhou', e.message); imprimir(); process.exit(1); }

// PGlite roda como dono das tabelas; o dono pula RLS. FORCE faz a RLS valer
// também para ele, para o teste medir a policy de verdade.
await db.exec(`
  alter table public.perfis     force row level security;
  alter table public.eventos    force row level security;
  alter table public.apoiadores force row level security;
  alter table public.conteudos  force row level security;
`);

const como = async (uid, fn) => {
  await db.exec(`set role none; select set_config('req.uid', '${uid || ''}', false);`);
  if (uid === null) await db.exec(`set role anon;`);
  else if (uid) await db.exec(`set role authenticated;`);
  try { return await fn(); } finally { await db.exec('set role none;'); }
};
const falha = async (nome, fn, esperado = '') => {
  try { await fn(); bad(nome + ' (deveria ter sido barrado)'); }
  catch (e) {
    const m = String(e.message || e);
    if (!esperado || new RegExp(esperado, 'i').test(m)) ok(nome, m.split('\n')[0].slice(0, 78));
    else bad(nome + ' — erro inesperado', m.slice(0, 120));
  }
};

/* ════════════════════════════ 1 · PERFIL NASCE INERTE ════════════════ */
const u = {};
for (const [k, mail] of Object.entries({
  admin: 'guilherme@gdstudiox.com.br', assessora: 'assessora@vilma.com.br',
  social: 'social@vilma.com.br', intruso: 'intruso@qualquer.com',
})) {
  const r = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1,'{}'::jsonb) returning id`, [mail]);
  u[k] = r.rows[0].id;
}

const inerte = await db.query(
  `select papel, ativo from public.perfis where id = $1`, [u.intruso]);
(inerte.rows[0] && inerte.rows[0].ativo === false && inerte.rows[0].papel === null)
  ? ok('perfil nasce INERTE (ativo=false, papel nulo) — anti-takeover')
  : bad('perfil não nasceu inerte', JSON.stringify(inerte.rows[0]));

await db.query(`select public.promover($1,'admin')`,     [ 'guilherme@gdstudiox.com.br' ]);
await db.query(`select public.promover($1,'assessora')`, [ 'assessora@vilma.com.br' ]);
await db.query(`select public.promover($1,'social')`,    [ 'social@vilma.com.br' ]);
ok('promover() ativa e dá papel (ação manual do admin)');

/* ════════════════════════════ 2 · ANON NÃO LÊ NADA ═══════════════════ */
await como(null, async () => {
  for (const t of ['apoiadores', 'eventos', 'conteudos', 'perfis']) {
    await falha('anon não lê public.' + t, () => db.query(`select * from public.${t}`), 'permission denied');
  }
  await falha('anon não insere em apoiadores',
    () => db.query(`insert into public.apoiadores (nome,whatsapp,bairro,consente)
                    values ('Fulano','12999999999','Centro',true)`), 'permission denied');
});

/* ════════════════════════════ 3 · RPC É A ÚNICA PORTA ════════════════ */
await como(null, async () => {
  const r = await db.query(
    `select public.registrar_apoio('Maria Aparecida de Souza','(12) 98888-7777','Massaguaçu',
       'maria@exemplo.com', array['divulgar','panfletar'], 'Bom trabalho!',
       array['15115','2223'], true, 'site') as j`);
  const j = r.rows[0].j;
  (j.ok && j.novo) ? ok('anon grava apoiador pela RPC registrar_apoio') : bad('RPC não gravou', JSON.stringify(j));
});

const grav = await db.query(`select * from public.apoiadores where whatsapp='12988887777'`);
const a = grav.rows[0];
a ? ok('apoiador gravado', a.nome) : bad('apoiador não encontrado');
a && a.whatsapp === '12988887777' ? ok('WhatsApp normalizado no servidor', a.whatsapp) : bad('whatsapp cru');
a && a.apoio.length === 2 ? ok('apoio consentido gravado', a.apoio.join('+')) : bad('apoio', JSON.stringify(a?.apoio));

/* apoio SEM consentimento específico tem que ser descartado */
await como(null, () => db.query(
  `select public.registrar_apoio('Joao da Silva Teste','12977776666','Centro',null,
     array['acompanhar'], null, array['15115'], false, 'site')`));
const semC = (await db.query(`select apoio, consente_apoio from public.apoiadores where whatsapp='12977776666'`)).rows[0];
(semC && semC.apoio.length === 0 && semC.consente_apoio === false)
  ? ok('sem consentimento específico, a declaração de apoio é DESCARTADA (LGPD art. 11, I)')
  : bad('gravou dado sensível sem consentimento!', JSON.stringify(semC));

/* número que a página não apoia não entra */
await como(null, () => db.query(
  `select public.registrar_apoio('Ana Paula Teste','12966665555','Tinga',null,
     '{}', null, array['9999','15115'], true, 'site')`));
const filtrado = (await db.query(`select apoio from public.apoiadores where whatsapp='12966665555'`)).rows[0];
(filtrado && filtrado.apoio.length === 1 && filtrado.apoio[0] === '15115')
  ? ok('RPC filtra número que a página não apoia', filtrado.apoio.join(','))
  : bad('número estranho entrou', JSON.stringify(filtrado?.apoio));

/* validação no servidor */
await como(null, () => falha('RPC recusa nome curto',
  () => db.query(`select public.registrar_apoio('Jo','12955554444','Centro')`), 'Nome muito curto'));
await como(null, () => falha('RPC recusa WhatsApp inválido',
  () => db.query(`select public.registrar_apoio('Nome Completo Ok','123','Centro')`), 'WhatsApp inválido'));

/* deduplicação */
await como(null, () => db.query(
  `select public.registrar_apoio('Maria Aparecida de Souza','12988887777','Porto Novo',
     null,'{}',null,'{}',false,'site')`));
const dup = await db.query(`select count(*)::int n, max(bairro) b from public.apoiadores where whatsapp='12988887777'`);
dup.rows[0].n === 1 ? ok('cadastro repetido atualiza em vez de duplicar', 'bairro agora: ' + dup.rows[0].b)
                    : bad('duplicou', dup.rows[0].n);
const manteve = (await db.query(`select apoio from public.apoiadores where whatsapp='12988887777'`)).rows[0];
manteve.apoio.length === 2 ? ok('reenvio sem consentimento NÃO apaga o apoio já consentido')
                           : bad('apagou o apoio', JSON.stringify(manteve.apoio));

/* constraint do banco (última linha de defesa) */
await falha('CHECK do banco barra apoio sem consentimento (mesmo por SQL direto)',
  () => db.query(`insert into public.apoiadores (nome,whatsapp,bairro,consente,apoio,consente_apoio)
                  values ('Teste Direto','12911112222','Centro',true,array['15115'],false)`),
  'apoio_exige_consentimento');
await falha('CHECK do banco exige consentimento geral',
  () => db.query(`insert into public.apoiadores (nome,whatsapp,bairro,consente)
                  values ('Teste Sem Consent','12911113333','Centro',false)`),
  'consentimento_obrigatorio');
await falha('não existe coluna de CPF no schema',
  () => db.query(`select cpf from public.apoiadores`), 'does not exist');

/* ════════════════════════════ 4 · VIEW PÚBLICA DA AGENDA ═════════════ */
await db.query(`insert into public.eventos (titulo,tipo,inicio,local,bairro,publicado,interno)
  values ('Caminhada no Centro','caminhada', now() + interval '3 days','Praça Dr. Cândido Motta','Centro', true,false),
         ('Reunião com lideranças','reuniao', now() + interval '5 days','Escritório','Massaguaçu', true, true),
         ('Rascunho não publicado','comicio', now() + interval '7 days','A definir','Sumaré', false,false)`);

await como(null, async () => {
  const v = await db.query(`select * from public.agenda_publica order by inicio`);
  v.rows.length === 1 && v.rows[0].titulo === 'Caminhada no Centro'
    ? ok('agenda_publica mostra só o publicado e não-interno', v.rows[0].titulo)
    : bad('view expôs demais', JSON.stringify(v.rows.map(r => r.titulo)));
  const cols = Object.keys(v.rows[0] || {});
  (!cols.includes('publicado') && !cols.includes('interno') && !cols.includes('criado_por'))
    ? ok('view não expõe publicado/interno/criado_por')
    : bad('view expôs coluna interna', cols.join(','));
});

/* ════════════════════════════ 5 · PAPÉIS DA EQUIPE ═══════════════════ */
await como(u.social, async () => {
  // Sob RLS, SELECT sem policy não estoura: devolve ZERO linhas. É assim que
  // o Postgres protege leitura — medir linhas, não exceção.
  const vaz = await db.query(`select * from public.apoiadores`);
  vaz.rows.length === 0
    ? ok('social media NÃO enxerga nenhum apoiador (contato de eleitor)')
    : bad('social media viu apoiadores!', vaz.rows.length + ' linhas');
  // UPDATE segue a mesma regra: linha invisível não é alterada (0 linhas).
  await db.query(`update public.apoiadores set nome='Invadido'`);
  const ev = await db.query(`select count(*)::int n from public.eventos`);
  ev.rows[0].n === 3 ? ok('social media LÊ a agenda (para produzir conteúdo)') : bad('social não leu agenda');
  await falha('social media não cria evento na agenda',
    () => db.query(`insert into public.eventos (titulo,inicio) values ('Invadindo', now())`),
    'row-level|permission');
  await db.query(`insert into public.conteudos (titulo,formato,status)
                  values ('Reel do comício','reel','ideia')`);
  ok('social media cria conteúdo no calendário editorial');
});

// o UPDATE do social media não pode ter encostado em ninguém
const intacto = await db.query(`select count(*)::int n from public.apoiadores where nome = 'Invadido'`);
intacto.rows[0].n === 0
  ? ok('UPDATE do social media não alterou nenhum apoiador (0 linhas)')
  : bad('social media alterou apoiador!', intacto.rows[0].n + ' linhas');

await como(u.assessora, async () => {
  const ap = await db.query(`select count(*)::int n from public.apoiadores`);
  ap.rows[0].n >= 3 ? ok('assessora lê os apoiadores', ap.rows[0].n + ' cadastros') : bad('assessora não leu');
  await db.query(`insert into public.eventos (titulo,tipo,inicio,bairro,publicado)
                  values ('Visita ao Perequê-Mirim','visita', now() + interval '9 days','Perequê-Mirim', true)`);
  ok('assessora cria evento na agenda');
  const c = await db.query(`select count(*)::int n from public.conteudos`);
  c.rows[0].n === 1 ? ok('assessora lê o calendário editorial') : bad('assessora não leu conteúdos');
  await falha('assessora não edita o calendário editorial',
    () => db.query(`insert into public.conteudos (titulo) values ('Não deveria')`), 'row-level|permission');
});

await como(u.intruso, async () => {
  const r1 = await db.query(`select count(*)::int n from public.eventos`);
  const r2 = await db.query(`select count(*)::int n from public.apoiadores`);
  const r3 = await db.query(`select count(*)::int n from public.conteudos`);
  (r1.rows[0].n === 0 && r2.rows[0].n === 0 && r3.rows[0].n === 0)
    ? ok('conta nova (inerte) enxerga ZERO — nem agenda, nem apoiador, nem conteúdo')
    : bad('perfil inerte viu dados!', `${r1.rows[0].n}/${r2.rows[0].n}/${r3.rows[0].n}`);
  await falha('conta inerte não escreve nada',
    () => db.query(`insert into public.eventos (titulo,inicio) values ('Hack', now())`), 'row-level|permission');
});

/* conta inerte não consegue se auto-promover */
await como(u.intruso, () => falha('conta inerte não roda promover()',
  () => db.query(`select public.promover('intruso@qualquer.com','admin')`), 'permission denied'));

/* ═══════════════════ 5b · CONTEÚDO DO SITE (o painel do social) ══════ */
const chaves = await db.query(`select count(*)::int n from public.site_conteudo`);
chaves.rows[0].n >= 20 ? ok('lacunas do site criadas no banco', chaves.rows[0].n + ' campos editáveis')
                       : bad('poucas chaves', chaves.rows[0].n);

await como(null, async () => {
  await falha('anon não lê a tabela site_conteudo',
    () => db.query(`select * from public.site_conteudo`), 'permission denied');
  const v = await db.query(`select * from public.site_publico`);
  v.rows.length === 0
    ? ok('site_publico só mostra o que foi PREENCHIDO (vazio não vira buraco)')
    : bad('view expôs valor vazio', v.rows.length);
});

await como(u.social, async () => {
  await db.query(`update public.site_conteudo
                  set valor='https://www.instagram.com/p/NOVOVIDEO/'
                  where chave='video.url'`);
  const r = await db.query(`select valor from public.site_conteudo where chave='video.url'`);
  /NOVOVIDEO/.test(r.rows[0].valor)
    ? ok('social media TROCA o vídeo em destaque pelo painel')
    : bad('social não conseguiu trocar o vídeo');

  await db.query(`update public.site_conteudo set valor='Regina Nunes' where chave='regina.nome'`);
  ok('social media edita nome/texto do site');

  await falha('social media não cria chave nova (só preenche as que o site lê)',
    () => db.query(`insert into public.site_conteudo (chave,rotulo) values ('inventada','x')`),
    'row-level|permission');
  await falha('social media não apaga chave que o site espera',
    () => db.query(`delete from public.site_conteudo where chave='video.url'`),
    'row-level|permission');
});

await como(null, async () => {
  const v = await db.query(`select * from public.site_publico order by chave`);
  v.rows.length === 2 ? ok('site público passa a enxergar as duas chaves preenchidas')
                      : bad('view pública', JSON.stringify(v.rows));
  const cols = Object.keys(v.rows[0] || {});
  (cols.length === 2 && cols.includes('chave') && cols.includes('valor'))
    ? ok('site_publico expõe só chave e valor') : bad('view expôs demais', cols.join(','));
});

await como(u.assessora, async () => {
  const r = await db.query(`select count(*)::int n from public.site_conteudo`);
  r.rows[0].n >= 20 ? ok('assessora LÊ o conteúdo do site (para conferir)') : bad('assessora não leu');
  await db.query(`update public.site_conteudo set valor='hackeado' where chave='heroi.lead'`);
});
const naoMexeu = await db.query(
  `select count(*)::int n from public.site_conteudo where valor='hackeado'`);
naoMexeu.rows[0].n === 0
  ? ok('assessora NÃO edita o conteúdo do site (0 linhas alteradas)')
  : bad('assessora editou o site!', naoMexeu.rows[0].n);

/* ════════════════════════════ 6 · ADMIN VÊ TUDO ══════════════════════ */
await como(u.admin, async () => {
  const t = await db.query(`select
    (select count(*)::int from public.eventos) e,
    (select count(*)::int from public.apoiadores) a,
    (select count(*)::int from public.conteudos) c`);
  const r = t.rows[0];
  (r.e === 4 && r.a === 3 && r.c === 1)
    ? ok('admin enxerga tudo', `${r.e} eventos · ${r.a} apoiadores · ${r.c} conteúdos`)
    : bad('admin não viu tudo', JSON.stringify(r));
});

/* ══════════════════════════════════════════════════════ RELATÓRIO */
function imprimir() {
  const bons = provas.filter(p => p.ok).length;
  console.log('\n═══ PROVAS DO BANCO (PGlite) ═══\n');
  provas.forEach(p => console.log(` ${p.ok ? '✓' : '✗'} ${p.n}${p.d ? '  → ' + p.d : ''}`));
  console.log(`\n${bons}/${provas.length} passaram` + (bons === provas.length ? '  🎉' : '  ⚠ VER ACIMA'));
  process.exitCode = bons === provas.length ? 0 : 1;
}
imprimir();
await db.close();
