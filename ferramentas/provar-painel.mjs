#!/usr/bin/env node
/* ============================================================================
   provar-painel.mjs — E2E dos DOIS painéis, cada um com o login do seu papel,
   contra o Supabase falso (Postgres de verdade + RLS de verdade).

   Antes: node ferramentas/supabase-falso.mjs     (porta 8810)
          node preview-server.mjs                 (porta 8803)
   Uso:   node ferramentas/provar-painel.mjs
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const SITE = 'http://localhost:8803';
const API  = 'http://localhost:8810';
const CHAVE = 'chave-publishable-de-teste';
// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);

const provas = [];
const ok  = (n, d = '') => provas.push({ ok: true,  n, d });
const bad = (n, d = '') => provas.push({ ok: false, n, d });
const dorme = ms => new Promise(r => setTimeout(r, ms));

// banco limpo a cada execução: a bateria tem que dar o mesmo resultado sempre
try {
  const r = await fetch(API + '/reset', { method: 'POST', headers: { apikey: CHAVE } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
} catch (e) {
  console.error('✗ Supabase falso não respondeu em ' + API + ' (' + e.message + ').');
  console.error('  Suba antes:  node ferramentas/supabase-falso.mjs');
  process.exit(1);
}

const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 1440, height: 900 },
});

async function novaAba() {
  const pg = await nav.newPage();
  await pg.evaluateOnNewDocument((url, chave) => {
    window.VT_CONFIG = { url, chave };
  }, API, CHAVE);
  pg.on('pageerror', e => bad('erro de JS no painel', String(e).slice(0, 160)));
  return pg;
}

/* Clicar pelo DOM em vez do mouse: elemento dentro de modal com scroll
   próprio faz o puppeteer reclamar de "not clickable" mesmo estando visível. */
const clique = (pg, sel) => pg.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) throw new Error('elemento não existe: ' + s);
  el.click();
}, sel);

const digitar = (pg, sel, txt) => pg.evaluate((s, t) => {
  const el = document.querySelector(s);
  if (!el) throw new Error('campo não existe: ' + s);
  el.value = t;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, sel, txt);

async function entrar(pg, email, senha = 'teste1234') {
  await pg.goto(SITE + '/painel/', { waitUntil: 'networkidle2' });
  await pg.evaluate(() => { try { localStorage.clear(); } catch {} });
  await pg.reload({ waitUntil: 'networkidle2' });
  await pg.waitForSelector('#btn-entrar', { visible: true });
  await digitar(pg, 'input[name=email]', email);
  await digitar(pg, 'input[name=senha]', senha);
  await clique(pg, '#btn-entrar');
  await dorme(1600);
}

/* ══════════════════════════ 1 · LOGIN E TRAVAS ═══════════════════════ */
{
  const pg = await novaAba();
  await entrar(pg, 'mariana@vilmateixeira.com.br', 'senha-errada');
  const erro = await pg.$eval('#login-erro', e => e.hidden ? '' : e.textContent.trim());
  /não conferem/i.test(erro) ? ok('senha errada é recusada', erro) : bad('login com senha errada', erro);
  const appVisivel = await pg.$eval('#app', e => !e.hidden);
  !appVisivel ? ok('painel não abre sem login válido') : bad('painel abriu sem login!');
  await pg.close();
}

/* ═══════════════════ 2 · CONTA NOVA NASCE SEM ACESSO ════════════════ */
{
  const pg = await novaAba();
  await entrar(pg, 'novato@vilmateixeira.com.br');
  const rota = await pg.evaluate(() =>
    [...document.querySelectorAll('.rota')].find(s => !s.hidden)?.dataset.rota);
  rota === 'inativo' ? ok('conta nova cai na tela "sem acesso" (anti-takeover)')
                     : bad('conta inerte entrou', rota);
  const menus = await pg.evaluate(() =>
    [...document.querySelectorAll('.lado__it')].filter(a => !a.hidden).length);
  menus === 0 ? ok('conta sem acesso não vê nenhum menu') : bad('menus visíveis', menus);
  await pg.close();
}

/* ═════════════════ 3 · PAINEL DA MARIANA (assessora) ════════════════ */
{
  const pg = await novaAba();
  await entrar(pg, 'mariana@vilmateixeira.com.br');

  const cab = await pg.evaluate(() => ({
    papel: document.getElementById('topo-papel').textContent.trim(),
    quem: document.getElementById('topo-quem').textContent.trim(),
    rota: [...document.querySelectorAll('.rota')].find(s => !s.hidden)?.dataset.rota,
    menus: [...document.querySelectorAll('.lado__it')].filter(a => !a.hidden).map(a => a.dataset.rota),
  }));
  cab.papel === 'Assessoria' ? ok('entra como Assessoria') : bad('papel', cab.papel);
  /Mariana/.test(cab.quem) ? ok('painel cumprimenta a Mariana pelo nome', cab.quem) : bad('nome', cab.quem);
  cab.rota === 'agenda' ? ok('assessora abre direto na Agenda') : bad('rota inicial', cab.rota);
  (!cab.menus.includes('conteudo') && !cab.menus.includes('site'))
    ? ok('assessora não vê os menus do social media', cab.menus.join(','))
    : bad('menu indevido', cab.menus.join(','));

  // criar compromisso publicado
  await clique(pg, '#novo-evento');
  await dorme(400);
  await digitar(pg, '#f-ev input[name=titulo]', 'Caminhada no Centro');
  await digitar(pg, '#f-ev select[name=tipo]', 'caminhada');
  await pg.evaluate(() => {
    const d = new Date(Date.now() + 3 * 864e5);
    d.setHours(18, 30, 0, 0);
    const p = n => String(n).padStart(2, '0');
    document.querySelector('#f-ev input[name=inicio]').value =
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T18:30`;
  });
  await digitar(pg, '#f-ev input[name=local]', 'Praça Dr. Cândido Motta');
  await digitar(pg, '#f-ev input[name=bairro]', 'Centro');
  await clique(pg, '#f-ev input[name=publicado]');
  await clique(pg, '#f-ev button[type=submit]');
  await dorme(1200);

  const criou = await pg.evaluate(() => document.querySelectorAll('.pilula').length);
  criou >= 1 ? ok('assessora cria compromisso e ele aparece no calendário')
             : bad('compromisso não apareceu', criou);

  // interno desmarca publicado
  await clique(pg, '#novo-evento'); await dorme(400);
  await clique(pg, '#f-ev input[name=publicado]');
  await clique(pg, '#f-ev input[name=interno]');
  const excl = await pg.evaluate(() => ({
    pub: document.querySelector('#f-ev input[name=publicado]').checked,
    int: document.querySelector('#f-ev input[name=interno]').checked,
  }));
  (!excl.pub && excl.int) ? ok('marcar "interno" desliga "publicar no site" sozinho')
                          : bad('exclusão mútua falhou', JSON.stringify(excl));
  await digitar(pg, '#f-ev input[name=titulo]', 'Reunião fechada com lideranças');
  await pg.evaluate(() => {
    const d = new Date(Date.now() + 4 * 864e5);
    const p = n => String(n).padStart(2, '0');
    document.querySelector('#f-ev input[name=inicio]').value =
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
  });
  await clique(pg, '#f-ev button[type=submit]');
  await dorme(1100);

  // visão de lista
  await clique(pg, '#agenda-visao .segm__b[data-v=lista]');
  await dorme(500);
  const lista = await pg.evaluate(() => ({
    n: document.querySelectorAll('.ev-l').length,
    tags: [...document.querySelectorAll('.ev-l .tag')].map(t => t.textContent.trim()),
  }));
  lista.n === 2 ? ok('lista mostra os dois compromissos') : bad('lista', lista.n);
  (lista.tags.includes('No site') && lista.tags.includes('Agenda interna'))
    ? ok('lista distingue a agenda pública da interna', lista.tags.join(' · '))
    : bad('etiquetas', lista.tags.join(','));

  // apoiadores
  await pg.goto(SITE + '/painel/#apoiadores', { waitUntil: 'networkidle2' });
  await dorme(1200);
  const rotaAp = await pg.evaluate(() =>
    [...document.querySelectorAll('.rota')].find(s => !s.hidden)?.dataset.rota);
  rotaAp === 'apoiadores' ? ok('assessora acessa os Apoiadores') : bad('rota', rotaAp);

  // social media é área proibida para ela
  await pg.goto(SITE + '/painel/#site', { waitUntil: 'networkidle2' });
  await dorme(900);
  const negado = await pg.evaluate(() =>
    [...document.querySelectorAll('.rota')].find(s => !s.hidden)?.dataset.rota);
  negado === 'negado' ? ok('assessora digitando #site cai em "acesso negado"')
                      : bad('entrou onde não devia', negado);
  await pg.close();
}

/* ═════════════ 4 · O SITE PÚBLICO ENXERGA A AGENDA PUBLICADA ════════ */
{
  const pg = await novaAba();
  await pg.goto(SITE + '/?anim=0', { waitUntil: 'networkidle2' });
  await dorme(2000);
  const ag = await pg.evaluate(() => ({
    cartoes: [...document.querySelectorAll('.ev')].map(e =>
      e.querySelector('.ev__titulo')?.textContent.trim()),
    vazio: !document.getElementById('agenda-vazio').hidden,
  }));
  (ag.cartoes.length === 1 && /Caminhada/.test(ag.cartoes[0]))
    ? ok('site publica só o compromisso liberado', ag.cartoes[0])
    : bad('agenda pública errada', JSON.stringify(ag));
  !ag.cartoes.some(t => /Reunião fechada/.test(t || ''))
    ? ok('reunião INTERNA não vazou para o site')
    : bad('reunião interna apareceu no site!');
  await pg.close();
}

/* ═══════════════ 5 · PAINEL DO SOCIAL MEDIA (o rapaz) ═══════════════ */
{
  const pg = await novaAba();
  await entrar(pg, 'lucas@vilmateixeira.com.br');

  const cab = await pg.evaluate(() => ({
    papel: document.getElementById('topo-papel').textContent.trim(),
    rota: [...document.querySelectorAll('.rota')].find(s => !s.hidden)?.dataset.rota,
    menus: [...document.querySelectorAll('.lado__it')].filter(a => !a.hidden).map(a => a.dataset.rota),
  }));
  cab.papel === 'Social media' ? ok('entra como Social media') : bad('papel', cab.papel);
  cab.rota === 'conteudo' ? ok('social media abre direto no Conteúdo') : bad('rota inicial', cab.rota);
  !cab.menus.includes('apoiadores')
    ? ok('social media NÃO vê o menu de Apoiadores', cab.menus.join(','))
    : bad('viu apoiadores no menu');

  await pg.goto(SITE + '/painel/#apoiadores', { waitUntil: 'networkidle2' });
  await dorme(900);
  const neg = await pg.evaluate(() =>
    [...document.querySelectorAll('.rota')].find(s => !s.hidden)?.dataset.rota);
  neg === 'negado' ? ok('social media digitando #apoiadores é barrado') : bad('entrou', neg);

  // kanban
  await pg.goto(SITE + '/painel/#conteudo', { waitUntil: 'networkidle2' });
  await dorme(1000);
  const cols = await pg.evaluate(() => document.querySelectorAll('.col').length);
  cols === 6 ? ok('calendário editorial com as 6 etapas') : bad('colunas', cols);

  await clique(pg, '#novo-conteudo'); await dorme(400);
  await digitar(pg, '#f-ct input[name=titulo]', 'Reel da caminhada no Centro');
  await digitar(pg, '#f-ct select[name=formato]', 'reel');
  await digitar(pg, '#f-ct select[name=status]', 'roteiro');
  await digitar(pg, '#f-ct input[name=responsavel]', 'Lucas');
  await clique(pg, '#f-ct button[type=submit]');
  await dorme(1100);
  const card = await pg.evaluate(() => {
    const c = document.querySelector('.col[data-col=roteiro] .card');
    return c ? c.querySelector('.card__t').textContent.trim() : null;
  });
  /Reel da caminhada/.test(card || '') ? ok('social media cria pauta na coluna certa', card)
                                       : bad('pauta não apareceu', card);

  // ---- SITE: trocar o vídeo em destaque (o pedido do Guilherme)
  await pg.goto(SITE + '/painel/#site', { waitUntil: 'networkidle2' });
  await dorme(1100);
  const grupos = await pg.evaluate(() => document.querySelectorAll('.grupo').length);
  grupos >= 4 ? ok('painel do site mostra os grupos de lacunas', grupos + ' grupos')
              : bad('grupos', grupos);

  await pg.evaluate(() => {
    const el = document.querySelector('[data-chave="video.url"]');
    el.value = 'https://www.instagram.com/p/VIDEONOVO123/';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await dorme(900);
  await pg.evaluate(() => {
    const el = document.querySelector('[data-chave="regina.nome"]');
    el.value = 'Regina Carnovale Nunes';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await dorme(900);

  // número da urna só aceita dígito
  await pg.evaluate(() => {
    const el = document.querySelector('[data-chave="regina.numero"]');
    el.value = 'quinze mil';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await dorme(700);
  const revertido = await pg.$eval('[data-chave="regina.numero"]', e => e.value);
  revertido === '' ? ok('painel recusa número de urna com letra (não quebra o simulador)')
                   : bad('aceitou número inválido', revertido);

  await pg.evaluate(() => {
    const el = document.querySelector('[data-chave="regina.numero"]');
    el.value = '15115';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await dorme(800);
  await pg.close();
}

/* ═══════════ 6 · O SITE MUDA DE VERDADE COM O QUE FOI EDITADO ══════ */
{
  const pg = await novaAba();
  await pg.goto(SITE + '/?anim=0', { waitUntil: 'networkidle2' });
  await dorme(2200);
  const r = await pg.evaluate(() => ({
    linkVideo: document.querySelector('[data-vt-href="video.url"]')?.href,
    dadosVideo: window.VT_DADOS?.video?.url,
    nomeRegina: [...document.querySelectorAll('[data-vt="regina.nome"]')].map(e => e.textContent.trim()),
    numeros: [...document.querySelectorAll('[data-num="regina"]')].map(e => e.textContent.trim()),
  }));
  /VIDEONOVO123/.test(r.linkVideo || '') && /VIDEONOVO123/.test(r.dadosVideo || '')
    ? ok('o vídeo trocado no painel aparece no site')
    : bad('vídeo não trocou no site', JSON.stringify(r));
  r.nomeRegina.every(n => n === 'Regina Carnovale Nunes') && r.nomeRegina.length > 0
    ? ok('nome editado no painel aparece no site', r.nomeRegina[0])
    : bad('nome não trocou', JSON.stringify(r.nomeRegina));
  r.numeros.every(n => n === '15115')
    ? ok('número 15115 consistente em todos os lugares do site', r.numeros.length + ' lugares')
    : bad('números divergentes', JSON.stringify(r.numeros));
  await pg.close();
}

/* ══════════════ 7 · CADASTRO DO SITE CHEGA NO PAINEL ═══════════════ */
{
  const pg = await novaAba();
  await pg.goto(SITE + '/?anim=0', { waitUntil: 'networkidle2' });
  await dorme(1800);
  await pg.evaluate(() => document.getElementById('apoie').scrollIntoView());
  await dorme(500);
  await digitar(pg, 'input[name=nome]', 'Joana Ribeiro dos Santos');
  await digitar(pg, 'input[name=whatsapp]', '12977778888');
  await digitar(pg, 'select[name=bairro]', 'Massaguaçu');
  await clique(pg, '[data-ir="2"]'); await dorme(500);
  await clique(pg, 'input[name=ajuda][value=panfletar]');
  await clique(pg, '[data-ir="3"]'); await dorme(500);
  await clique(pg, 'input[name=apoio][value="15115"]'); await dorme(300);
  await clique(pg, '#aceite-sensivel input');
  await clique(pg, 'input[name=consente]');
  await clique(pg, '#form-enviar');
  await dorme(1400);
  const sucesso = await pg.$eval('#form-ok', e => !e.hidden);
  sucesso ? ok('cadastro pelo site conclui com o banco ligado') : bad('cadastro não concluiu');
  const fila = await pg.evaluate(() => JSON.parse(localStorage.getItem('vt_fila_apoio') || '[]'));
  fila.length === 0 ? ok('com banco ligado, nada sobra na fila local (foi mesmo para o banco)')
                    : bad('caiu na fila local', fila.length);
  await pg.close();

  const pg2 = await novaAba();
  await entrar(pg2, 'mariana@vilmateixeira.com.br');
  await pg2.goto(SITE + '/painel/#apoiadores', { waitUntil: 'networkidle2' });
  await dorme(1300);
  const t = await pg2.evaluate(() => ({
    linhas: document.querySelectorAll('#corpo-apoio tr').length,
    nome: document.querySelector('#corpo-apoio .td-nome')?.textContent.trim(),
    apoio: document.querySelector('#corpo-apoio .mini--magenta')?.textContent.trim(),
    kpiTotal: document.querySelector('.kpi b')?.textContent.trim(),
  }));
  t.linhas === 1 && /Joana/.test(t.nome || '')
    ? ok('a Mariana vê no painel quem se cadastrou no site', t.nome)
    : bad('apoiador não chegou no painel', JSON.stringify(t));
  t.apoio === '15115' ? ok('apoio declarado com consentimento aparece para a equipe')
                      : bad('apoio', t.apoio);

  // mudar situação
  await digitar(pg2, '[data-status]', 'contatado');
  await dorme(900);
  const badge = await pg2.$eval('#badge-apoiadores', e => e.textContent.trim());
  badge === '' ? ok('mudar a situação some com o aviso de "novo"') : bad('badge', badge);
  await pg2.close();
}

/* ══════════ 9 · CADA PAPEL SÓ BAIXA O DADO DA ABA QUE ELE ABRE ══════ */
{
  // não basta esconder o menu: se o painel baixa a tabela mesmo assim, o dado
  // trafega para um navegador que não devia recebê-lo.
  const espiar = async email => {
    const pg = await novaAba();
    /* as abas dividem o localStorage da mesma origem: sem esta limpeza ANTES
       de escutar, o painel sobe com a sessão do teste anterior e as buscas
       daquele papel contaminam a medição deste. */
    await pg.goto(SITE + '/painel/', { waitUntil: 'networkidle2' });
    await pg.evaluate(() => { try { localStorage.clear(); } catch {} });
    const pedidos = new Set();
    pg.on('request', r => {
      const u = r.url();
      if (r.method() === 'GET' && u.includes('/rest/v1/'))
        pedidos.add(u.split('/rest/v1/')[1].split('?')[0]);
    });
    await entrar(pg, email);
    await dorme(1200);
    await pg.close();
    pedidos.delete('perfis');            // todo mundo lê o próprio perfil
    return [...pedidos].sort();
  };

  const daMariana = await espiar('mariana@vilmateixeira.com.br');
  !daMariana.includes('conteudos') && !daMariana.includes('site_conteudo')
    ? ok('assessora não baixa as tabelas do social media', daMariana.join(','))
    : bad('assessora baixou tabela que não usa', daMariana.join(','));
  daMariana.includes('apoiadores') && daMariana.includes('eventos')
    ? ok('assessora baixa agenda e apoiadores, que são dela')
    : bad('faltou dado para a assessora', daMariana.join(','));

  const doLucas = await espiar('lucas@vilmateixeira.com.br');
  !doLucas.includes('apoiadores')
    ? ok('social media nunca baixa a lista de apoiadores (dado pessoal)', doLucas.join(','))
    : bad('social media baixou apoiadores!', doLucas.join(','));
  doLucas.includes('conteudos') && doLucas.includes('site_conteudo')
    ? ok('social media baixa conteúdo e textos do site, que são dele')
    : bad('faltou dado para o social media', doLucas.join(','));

  const doNovato = await espiar('novato@vilmateixeira.com.br');
  doNovato.length === 0
    ? ok('conta sem papel não baixa tabela nenhuma')
    : bad('conta inerte baixou dado', doNovato.join(','));
}

/* ═══════════════════════════════════════════════════════ RELATÓRIO */
const bons = provas.filter(p => p.ok).length;
console.log('\n═══ PROVAS DOS PAINÉIS ═══\n');
provas.forEach(p => console.log(` ${p.ok ? '✓' : '✗'} ${p.n}${p.d ? '  → ' + p.d : ''}`));
console.log(`\n${bons}/${provas.length} passaram` + (bons === provas.length ? '  🎉' : '  ⚠ VER ACIMA'));

await nav.close();
process.exitCode = bons === provas.length ? 0 : 1;
