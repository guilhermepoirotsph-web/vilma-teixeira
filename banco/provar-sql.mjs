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
/* Na ordem em que o Guilherme vai colar no SQL Editor. Rodar os dois aqui é
   o que garante que o segundo não conflita com o primeiro. */
for (const arq of ['schema.sql', '02-contato.sql', '03-blindagem.sql', '04-automacao.sql']) {
  const sql = await readFile(join(AQUI, arq), 'utf8');
  try { await db.exec(sql); ok(arq + ' roda inteiro sem erro'); }
  catch (e) { bad(arq + ' falhou', e.message); imprimir(); process.exit(1); }
}

/* e roda DE NOVO: migração que não é idempotente quebra na segunda mão, e a
   segunda mão sempre acontece (colou duas vezes, refez o banco, restaurou). */
for (const arq of ['schema.sql', '02-contato.sql', '03-blindagem.sql', '04-automacao.sql']) {
  const sql = await readFile(join(AQUI, arq), 'utf8');
  try { await db.exec(sql); ok(arq + ' é idempotente (roda 2× sem erro)'); }
  catch (e) { bad(arq + ' não é idempotente', String(e.message).slice(0, 120)); }
}

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
  j.ok ? ok('anon grava apoiador pela RPC registrar_apoio')
       : bad('RPC não gravou', JSON.stringify(j));
});

const grav = await db.query(`select * from public.apoiadores where public.zap_e164(whatsapp)=public.zap_e164('12988887777')`);
const a = grav.rows[0];
a ? ok('apoiador gravado', a.nome) : bad('apoiador não encontrado');
/* "(12) 98888-7777" digitado vira "5512988887777" guardado: o servidor tira a
   pontuação E põe o código do país. Sem o 55 o link wa.me abre conversa vazia,
   e o mesmo eleitor entra duas vezes por dois formatos. */
a && a.whatsapp === '5512988887777'
  ? ok('WhatsApp normalizado no servidor, com código do país', a.whatsapp)
  : bad('whatsapp fora da forma canônica', a?.whatsapp);
a && a.apoio.length === 2 ? ok('apoio consentido gravado', a.apoio.join('+')) : bad('apoio', JSON.stringify(a?.apoio));

/* apoio SEM consentimento específico tem que ser descartado */
await como(null, () => db.query(
  `select public.registrar_apoio('Joao da Silva Teste','12977776666','Centro',null,
     array['acompanhar'], null, array['15115'], false, 'site')`));
const semC = (await db.query(`select apoio, consente_apoio from public.apoiadores where public.zap_e164(whatsapp)=public.zap_e164('12977776666')`)).rows[0];
(semC && semC.apoio.length === 0 && semC.consente_apoio === false)
  ? ok('sem consentimento específico, a declaração de apoio é DESCARTADA (LGPD art. 11, I)')
  : bad('gravou dado sensível sem consentimento!', JSON.stringify(semC));

/* número que a página não apoia não entra */
await como(null, () => db.query(
  `select public.registrar_apoio('Ana Paula Teste','12966665555','Tinga',null,
     '{}', null, array['9999','15115'], true, 'site')`));
const filtrado = (await db.query(`select apoio from public.apoiadores where public.zap_e164(whatsapp)=public.zap_e164('12966665555')`)).rows[0];
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
const dup = await db.query(`select count(*)::int n, max(bairro) b from public.apoiadores where public.zap_e164(whatsapp)=public.zap_e164('12988887777')`);
dup.rows[0].n === 1 ? ok('cadastro repetido atualiza em vez de duplicar', 'bairro agora: ' + dup.rows[0].b)
                    : bad('duplicou', dup.rows[0].n);
/* Esta prova já afirmou o CONTRÁRIO — "reenvio sem consentimento não apaga o
   apoio já consentido" — e com isso carimbava um defeito como se fosse regra:
   quem quisesse retirar a declaração de posicionamento político não conseguia
   por conta própria. Revogar tem que ser tão fácil quanto consentir. */
const revogado = (await db.query(
  `select apoio, consente_apoio from public.apoiadores where public.zap_e164(whatsapp)=public.zap_e164('12988887777')`)).rows[0];
(revogado.apoio.length === 0 && revogado.consente_apoio === false)
  ? ok('reenviar sem marcar o consentimento específico REVOGA e limpa o dado sensível')
  : bad('dado sensível ficou preso no banco', JSON.stringify(revogado));

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
  /* A agenda saiu do escopo do social media (pedido do Guilherme, 10/09):
     ela é da assessoria, e a agenda interna guarda reunião fechada.
     RLS filtra em vez de dar erro — o que se mede é ZERO linha. */
  const ev = await db.query(`select count(*)::int n from public.eventos`);
  ev.rows[0].n === 0 ? ok('social media NÃO lê a agenda (nem a pública, nem a interna)')
                     : bad('social ainda enxerga a agenda', ev.rows[0].n + ' linhas');
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

/* ══════════ 7 · CONSENTIMENTO, DESCADASTRAMENTO E CONTATO ═══════════ */
{
  const zap = '12977776666';
  const TEXTO = 'Autorizo a equipe da Vilma a me chamar no WhatsApp sobre a campanha.';

  // cadastro pelo site, guardando a PROVA do consentimento
  await como(null, () => db.query(
    `select public.registrar_apoio('Joana Ribeiro',$1,'Massaguaçu',null,
       array['panfletar'],null,array['15115'],true,'site',$2)`, [zap, TEXTO]));

  const p = (await db.query(
    `select consentimento_texto, consentimento_em is not null tem_data, optout
       from public.apoiadores where public.zap_e164(whatsapp) = public.zap_e164($1)`, [zap])).rows[0];
  (p.consentimento_texto === TEXTO && p.tem_data)
    ? ok('o texto exato do consentimento fica gravado com data (prova, não promessa)')
    : bad('consentimento sem prova', JSON.stringify(p));

  // a pessoa se descadastra sozinha, sem login
  await como(null, () => db.query(`select public.descadastrar($1,'site')`, [zap]));
  const d = (await db.query(
    `select optout, optout_em is not null tem_data, optout_origem
       from public.apoiadores where public.zap_e164(whatsapp) = public.zap_e164($1)`, [zap])).rows[0];
  (d.optout && d.tem_data && d.optout_origem === 'site')
    ? ok('qualquer pessoa se descadastra sozinha, e a data é gravada pelo gatilho')
    : bad('descadastramento falhou', JSON.stringify(d));

  // e some da lista de contato, sem sumir do banco
  await como(u.assessora, async () => {
    const na = (await db.query(
      `select count(*)::int n from public.apoiadores_contactaveis where zap = $1`,
      ['55' + zap])).rows[0].n;
    const total = (await db.query(
      `select count(*)::int n from public.apoiadores where public.zap_e164(whatsapp) = public.zap_e164($1)`, [zap])).rows[0].n;
    (na === 0 && total === 1)
      ? ok('quem pediu para sair some da lista de contato mas NÃO é apagado do banco')
      : bad('opt-out inconsistente', `contactaveis=${na} tabela=${total}`);
  });

  // resposta idêntica para número que não existe: sem oráculo de existência
  const r = await como(null, () => db.query(
    `select public.descadastrar('11888887777') as r`));
  JSON.stringify(r.rows[0].r) === JSON.stringify({ ok: true })
    ? ok('descadastrar não revela se o número está na base (sem oráculo)')
    : bad('descadastrar vazou existência', JSON.stringify(r.rows[0].r));

  // cadastrar-se de novo é voltar a aceitar — e SEM marcar o consentimento
  // específico, o que precisa RETIRAR a declaração de apoio (revogação)
  await como(null, () => db.query(
    `select public.registrar_apoio('Joana Ribeiro',$1,'Massaguaçu',null,
       array['panfletar'],null,array[]::text[],false,'site',$2)`, [zap, TEXTO]));
  const v = (await db.query(
    `select optout, optout_em, consente_apoio, apoio
       from public.apoiadores where public.zap_e164(whatsapp) = public.zap_e164($1)`, [zap])).rows[0];
  (v.optout === false && v.optout_em === null)
    ? ok('cadastrar-se de novo reabre o contato e limpa a data do opt-out')
    : bad('opt-out não foi reaberto', JSON.stringify(v));
  (v.consente_apoio === false && (v.apoio || []).length === 0)
    ? ok('reenviar SEM o consentimento específico retira a declaração de apoio (revogação funciona)')
    : bad('consentimento específico ficou preso ligado', JSON.stringify(v));

  // a resposta pública não pode contar se a pessoa já era cadastrada
  const r1 = (await como(null, () => db.query(
    `select public.registrar_apoio('Alguem Novo','12955554444','Centro') r`))).rows[0].r;
  const r2 = (await como(null, () => db.query(
    `select public.registrar_apoio('Alguem Novo','12955554444','Centro') r`))).rows[0].r;
  JSON.stringify(r1) === JSON.stringify(r2) && !('novo' in r1)
    ? ok('registrar_apoio responde igual para cadastro novo e repetido (sem oráculo de base)')
    : bad('a RPC revela quem já é apoiador', JSON.stringify(r1) + ' vs ' + JSON.stringify(r2));

  // o social media continua sem ver ninguém, nem pela view nova
  await como(u.social, async () => {
    const n = (await db.query(`select count(*)::int n from public.apoiadores_contactaveis`)).rows[0].n;
    n === 0 ? ok('a view de contato respeita a RLS: social media vê ZERO')
            : bad('view de contato vazou para o social media', n);
  });

  // o número sai pronto para virar link wa.me
  const e164 = (await db.query(`select public.zap_e164('(12) 97777-6666') z`)).rows[0].z;
  e164 === '5512977776666'
    ? ok('zap_e164 monta o número com país e DDD para o link wa.me', e164)
    : bad('zap_e164 errado', e164);
}

/* ═══════════════════════ 8 · BACKUP DENTRO DO BANCO ══════════════════ */
{
  const r = (await db.query(`select public.gerar_backup() b`)).rows[0].b;
  (r.ok && r.tabelas >= 5 && r.linhas > 0)
    ? ok('backup varre o catálogo e grava JSON na própria tabela',
         `${r.tabelas} tabelas · ${r.linhas} linhas`)
    : bad('backup falhou', JSON.stringify(r));

  // tabela nova entra sozinha: é o ponto de varrer pg_class em vez de lista fixa
  await db.exec(`create table if not exists public.tabela_futura (id int primary key);
                 insert into public.tabela_futura values (1) on conflict do nothing;`);
  const r2 = (await db.query(`select public.gerar_backup() b`)).rows[0].b;
  r2.tabelas === r.tabelas + 1
    ? ok('tabela criada depois entra no backup sozinha (sem lista para apodrecer)')
    : bad('backup não pegou a tabela nova', `${r.tabelas} → ${r2.tabelas}`);
  await db.exec(`drop table public.tabela_futura;`);

  /* RLS não dá erro: ela filtra. O social media consegue CONSULTAR a tabela e
     recebe zero linha — que é o comportamento certo e o que precisa ser
     medido. Esperar exceção aqui testaria o GRANT, não a policy. */
  await como(u.social, async () => {
    const n = (await db.query(`select count(*)::int n from public.backups`)).rows[0].n;
    n === 0 ? ok('social media consulta backups e recebe ZERO linha (policy filtra)')
            : bad('social media leu backup!', n);
  });
  await como(u.admin, async () => {
    const n = (await db.query(`select count(*)::int n from public.backups`)).rows[0].n;
    n >= 2 ? ok('admin lê os backups guardados', n + ' snapshots')
           : bad('admin não viu backup', n);
  });
}

/* ═════ 9 · ESCALADA DE PAPEL — a falha que quase foi ao ar ═══════════ */
{
  /* Antes do 03-blindagem.sql isto PASSAVA, sem erro nenhum:
       antes:  {"papel":null,"ativo":false}
       depois: {"papel":"admin","ativo":true}
     RLS decide QUAIS LINHAS, nunca QUAIS COLUNAS — e o GRANT era da tabela
     inteira. A tela de "aguardando liberação" continuava aparecendo. */
  await como(u.intruso, () => falha(
    'conta INERTE não se promove a admin pela própria linha (escalada fechada)',
    () => db.query(`update public.perfis set papel='admin', ativo=true where id=$1`, [u.intruso]),
    'permission denied|papel e ativo'));

  const ainda = (await db.query(
    `select papel, ativo from public.perfis where id=$1`, [u.intruso])).rows[0];
  (ainda.papel === null && ainda.ativo === false)
    ? ok('a conta inerte continua inerte depois da tentativa')
    : bad('a conta se promoveu!', JSON.stringify(ainda));

  // nem o social media, que é conta legítima, consegue virar admin
  await como(u.social, () => falha(
    'conta com papel legítimo também não se promove',
    () => db.query(`update public.perfis set papel='admin' where id=$1`, [u.social]),
    'permission denied|papel e ativo'));

  /* O caso que quebrou de verdade ao criar o banco de produção: usuário criado
     no painel do Supabase ANTES do schema não tem perfil (o gatilho só dispara
     no INSERT), e promover() atualizava 0 linhas devolvendo sucesso. */
  {
    const r = await db.query(
      `insert into auth.users (email, raw_user_meta_data)
       values ('anterior@vilma.com.br','{}'::jsonb) returning id`);
    const uid = r.rows[0].id;
    await db.query(`delete from public.perfis where id = $1`, [uid]);   // simula o "antes"
    const sem = (await db.query(
      `select count(*)::int n from public.perfis where id=$1`, [uid])).rows[0].n;
    sem === 0 ? ok('cenário reproduzido: usuário no Auth sem perfil')
              : bad('não consegui reproduzir o cenário');

    const m = (await db.query(`select public.promover($1,'assessora') m`,
      ['anterior@vilma.com.br'])).rows[0].m;
    const dep = (await db.query(
      `select papel, ativo from public.perfis where id=$1`, [uid])).rows[0];
    (dep && dep.papel === 'assessora' && dep.ativo)
      ? ok('promover() cria o perfil que faltava em vez de falhar calado', m)
      : bad('promover() não criou o perfil', JSON.stringify(dep) + ' → ' + m);

    const inexistente = (await db.query(
      `select public.promover('ninguem@lugar.nenhum','social') m`)).rows[0].m;
    /NAO ENCONTRADO/.test(inexistente)
      ? ok('promover() diz claramente quando o e-mail não existe no Auth')
      : bad('promover() mentiu sobre e-mail inexistente', inexistente);
  }

  // o caminho legítimo continua funcionando
  const msg = (await db.query(`select public.promover($1,'social') m`,
    ['social@vilma.com.br'])).rows[0].m;
  /agora é social/.test(msg) ? ok('promover() continua funcionando (a tranca abre por dentro)', msg)
                             : bad('promover() quebrou', msg);
  const rev = (await db.query(`select public.revogar($1) m`, ['intruso@qualquer.com'])).rows[0].m;
  /perdeu o acesso/.test(rev) ? ok('revogar() tira o acesso de quem saiu da campanha')
                              : bad('revogar() falhou', rev);

  // e o próprio nome continua editável — a pessoa precisa poder se corrigir
  await como(u.social, () => db.query(
    `update public.perfis set nome='Lucas Social' where id=$1`, [u.social]));
  const nome = (await db.query(`select nome from public.perfis where id=$1`, [u.social])).rows[0].nome;
  nome === 'Lucas Social' ? ok('cada um continua podendo corrigir o próprio nome')
                          : bad('não consegue editar o nome', nome);

  /* renomear a chave do site apagava a lacuna que o site lê */
  await como(u.social, () => falha(
    'social media não RENOMEIA chave do site (renomear = apagar + criar)',
    () => db.query(`update public.site_conteudo set chave='video.urlx' where chave='video.url'`),
    'permission denied'));

  /* e a prova de consentimento de outra pessoa não é editável por PATCH */
  await como(u.assessora, () => falha(
    'assessora não reescreve a prova de consentimento do titular',
    () => db.query(`update public.apoiadores set consentimento_texto='eu autorizei tudo'`),
    'permission denied'));
  await como(u.assessora, () => db.query(
    `update public.apoiadores set status='contatado', contatado_em=now()`));
  ok('assessora continua podendo trabalhar a lista (situação e contato)');
}

/* ═════ 10 · O MESMO ELEITOR NÃO ENTRA DUAS VEZES ════════════════════ */
{
  const A = '12933332222', B = '5512933332222';   // a mesma pessoa, dois formatos
  await como(null, () => db.query(
    `select public.registrar_apoio('Pessoa Repetida',$1,'Centro')`, [A]));
  await como(null, () => db.query(
    `select public.registrar_apoio('Pessoa Repetida',$1,'Centro')`, [B]));
  const n = (await db.query(
    `select count(*)::int n from public.apoiadores
      where public.zap_e164(whatsapp) = '5512933332222'`)).rows[0].n;
  n === 1 ? ok('11 dígitos e 13 dígitos são a MESMA pessoa (opt-out não fura)')
          : bad('a mesma pessoa entrou duas vezes', n);

  await como(null, () => db.query(`select public.descadastrar($1)`, [A]));
  const saiu = (await db.query(
    `select optout from public.apoiadores
      where public.zap_e164(whatsapp)='5512933332222'`)).rows[0].optout;
  saiu ? ok('descadastrar por qualquer um dos formatos alcança a pessoa')
       : bad('opt-out não pegou');

  await falha('INSERT direto com o outro formato também é barrado pelo índice',
    () => db.query(`insert into public.apoiadores (nome,whatsapp,bairro,consente)
                    values ('Clone','12933332222','Centro',true)`),
    'duplicate key|ux_apoiadores');

  const guardado = (await db.query(
    `select whatsapp from public.apoiadores
      where public.zap_e164(whatsapp)='5512933332222'`)).rows[0].whatsapp;
  guardado === '5512933332222'
    ? ok('a coluna guarda sempre a forma canônica, não o que a pessoa digitou', guardado)
    : bad('número guardado em formato cru', guardado);
}

/* ═════ 10-B · O ARQUIVO ÚNICO É O MESMO BANCO ═══════════════════════ */
{
  /* Ele vai colar `TUDO.sql` no SQL Editor, não os quatro arquivos. Se o
     concatenado divergir do que esta suíte prova, o banco de produção fica
     diferente do banco testado — e ninguém descobre até dar errado em cima
     da hora. Aqui o gerado é rodado num Postgres limpo e comparado. */
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', [join(AQUI, 'montar-sql.mjs')], { stdio: 'pipe' });
  const tudo = await readFile(join(AQUI, 'TUDO.sql'), 'utf8');

  const db2 = new PGlite();
  await db2.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(), email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb);
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('req.uid', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema auth to anon, authenticated;
  `);
  try {
    await db2.exec(tudo);
    ok('TUDO.sql roda inteiro num banco limpo, numa colagem só');
    await db2.exec(tudo);
    ok('TUDO.sql é idempotente (colar duas vezes não quebra)');

    const objetos = q => db2.query(q).then(r => r.rows.map(x => Object.values(x)[0]).sort().join(','));
    const alvo = `select tablename from pg_tables where schemaname='public'`;
    const t1 = await objetos(alvo);
    const t2 = await db.query(alvo).then(r => r.rows.map(x => Object.values(x)[0]).sort().join(','));
    t1 === t2 ? ok('o banco do arquivo único é igual ao dos arquivos separados', t1)
              : bad('TUDO.sql divergiu dos originais', `único: ${t1}\n      separados: ${t2}`);
  } catch (e) {
    bad('TUDO.sql falhou', String(e.message).slice(0, 160));
  }
  await db2.close();
}

/* ═════ 11 · O n8n SÓ ALCANÇA O QUE PRECISA ══════════════════════════ */
{
  /* A promessa em 04-automacao.sql é forte: "se o VPS for comprometido, o que
     vaza é o resumo do dia". Promessa forte pede prova. */
  const comoBot = async fn => {
    await db.exec('set role none; set role n8n_bot;');
    try { return await fn(); } finally { await db.exec('set role none;'); }
  };

  for (const t of ['apoiadores', 'perfis', 'eventos', 'conteudos', 'backups', 'log_automacao']) {
    await comoBot(() => falha('n8n não lê a tabela ' + t,
      () => db.query(`select * from public.${t}`), 'permission denied'));
  }

  const resumo = await comoBot(() =>
    db.query(`select public.resumo_do_dia(1) r`).then(r => r.rows[0].r));
  (resumo && Array.isArray(resumo.agenda) && typeof resumo.a_contatar === 'number')
    ? ok('n8n lê o resumo do dia pela função',
         `${resumo.agenda.length} na agenda · ${resumo.a_contatar} a contatar`)
    : bad('resumo_do_dia não respondeu', JSON.stringify(resumo));

  /* o resumo traz o link pronto — é o que a Mariana clica, um por vez */
  const comLink = (resumo.novos_apoiadores || []).every(p => /^https:\/\/wa\.me\/55\d+$/.test(p.link));
  comLink ? ok('cada apoiador do resumo vem com o link wa.me pronto para clicar')
          : bad('link wa.me malformado', JSON.stringify(resumo.novos_apoiadores?.[0]));

  const log = await comoBot(() =>
    db.query(`select public.registrar_log('teste','info','rodou') id`).then(r => r.rows[0].id));
  log > 0 ? ok('n8n grava no log de automação pela RPC (sem GRANT em tabela)')
          : bad('log falhou', log);

  await comoBot(() => falha('n8n não escreve direto no log',
    () => db.query(`insert into public.log_automacao (fluxo) values ('na marra')`),
    'permission denied'));
  await comoBot(() => falha('n8n não promove ninguém',
    () => db.query(`select public.promover('intruso@qualquer.com','admin')`),
    'permission denied'));
  await comoBot(() => falha('n8n não lê a lista de contato',
    () => db.query(`select * from public.apoiadores_contactaveis`), 'permission denied'));

  const bk = await comoBot(() => db.query(`select public.gerar_backup() b`).then(r => r.rows[0].b));
  bk.ok ? ok('n8n dispara o backup redundante (a única escrita que ele faz)')
        : bad('backup pelo n8n falhou', JSON.stringify(bk));

  /* e o admin vê o log no painel */
  await como(u.admin, async () => {
    const n = (await db.query(`select count(*)::int n from public.log_automacao`)).rows[0].n;
    n >= 1 ? ok('admin vê o log da automação', n + ' linhas') : bad('log vazio para o admin');
  });
  await como(u.social, async () => {
    const n = (await db.query(`select count(*)::int n from public.log_automacao`)).rows[0].n;
    n === 0 ? ok('social media não vê o log da automação') : bad('log vazou', n);
  });
}

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
