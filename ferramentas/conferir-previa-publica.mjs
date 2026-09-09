#!/usr/bin/env node
/* conferir-previa-publica.mjs — abre o SITE e o PAINEL pela URL pública do
   cloudflared, num viewport de celular, exatamente como o Guilherme vai abrir.
   Uso: node ferramentas/conferir-previa-publica.mjs --site=https://... */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const arg = (n, p) => {
  const a = process.argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : p;
};
const SITE = arg('site', '');
if (!SITE) { console.error('faltou --site=https://...'); process.exit(1); }

// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);
const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
});
const dorme = ms => new Promise(r => setTimeout(r, ms));
const falhas = [];

/* ------------------------------------------------------------- SITE */
{
  const pg = await nav.newPage();
  await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  const err = [];
  pg.on('pageerror', e => err.push(String(e).slice(0, 140)));
  await pg.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await dorme(5000);

  const m = await pg.evaluate(() => ({
    config: Boolean(window.VT_CONFIG),
    banco: Boolean(window.VT_BANCO?.ligado),
    agenda: document.querySelectorAll('.ev').length,
    heroiOk: [...document.querySelectorAll('.heroi__acoes .btn')]
      .every(b => Number(getComputedStyle(b).opacity) > .9),
    overflowX: document.documentElement.scrollWidth - innerWidth,
    urna: document.querySelectorAll('.tecla').length,
  }));
  console.log('SITE  ', JSON.stringify(m));
  if (!m.banco) falhas.push('site não conectou no banco de prévia');
  if (m.agenda === 0) falhas.push('agenda vazia no site');
  if (!m.heroiOk) falhas.push('botões do herói invisíveis');
  if (m.overflowX > 0) falhas.push('vazamento horizontal: ' + m.overflowX);
  if (err.length) falhas.push('erro JS no site: ' + err[0]);
  await pg.screenshot({ path: 'caps/previa-site-celular.png' });
  await pg.close();
}

/* ----------------------------------------------------------- PAINÉIS */
async function painel({ email, rotulo, papel, nome, arquivo, conta }) {
  const pg = await nav.newPage();
  const err = [];
  pg.on('pageerror', e => err.push(String(e).slice(0, 140)));
  await pg.goto(SITE.replace(/\/?$/, '/') + 'painel/', { waitUntil: 'networkidle2', timeout: 60000 });
  await dorme(2500);
  const temConfig = await pg.evaluate(() => Boolean(window.VT_CONFIG));

  await pg.evaluate(e => {
    document.querySelector('input[name=email]').value = e;
    document.querySelector('input[name=senha]').value = 'teste1234';
    document.getElementById('btn-entrar').click();
  }, email);
  await dorme(3500);

  const m = await pg.evaluate(sel => ({
    entrou: !document.getElementById('app').hidden,
    papel: document.getElementById('topo-papel').textContent.trim(),
    quem: document.getElementById('topo-quem').textContent.trim(),
    erroLogin: document.getElementById('login-erro').hidden ? '' :
               document.getElementById('login-erro').textContent.trim(),
    itens: document.querySelectorAll(sel).length,
    abas: [...document.querySelectorAll('#menu a, .menu a, [data-rota]')]
      .map(a => a.textContent.trim()).filter(Boolean).slice(0, 8),
  }), conta);
  console.log(rotulo, JSON.stringify({ temConfig, ...m }));
  if (!m.entrou) falhas.push(rotulo + ' não abriu: ' + (m.erroLogin || 'sem erro visível'));
  if (!m.papel.includes(papel)) falhas.push(rotulo + ' com papel errado: ' + m.papel);
  if (!m.quem.includes(nome)) falhas.push(rotulo + ' não cumprimenta pelo nome: ' + m.quem);
  if (m.itens === 0) falhas.push(rotulo + ' abriu vazio');
  if (err.length) falhas.push('erro JS em ' + rotulo + ': ' + err[0]);
  await pg.screenshot({ path: 'caps/' + arquivo });
  await pg.close();
}

await painel({ email: 'mariana@vilmateixeira.com.br', rotulo: 'MARIANA',
               papel: 'Assessoria', nome: 'Mariana', conta: '.pilula',
               arquivo: 'previa-painel-celular.png' });
await painel({ email: 'lucas@vilmateixeira.com.br', rotulo: 'LUCAS  ',
               papel: 'Social', nome: 'Lucas', conta: '#kanban .card',
               arquivo: 'previa-painel-lucas-celular.png' });

await nav.close();
console.log(falhas.length ? '\n✗ ' + falhas.join('\n✗ ')
  : '\n✓ site, painel da Mariana e painel do Lucas abrindo pela URL pública, no celular');
process.exitCode = falhas.length ? 1 : 0;
