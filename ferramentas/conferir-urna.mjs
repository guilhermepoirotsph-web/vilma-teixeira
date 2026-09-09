#!/usr/bin/env node
/* conferir-urna.mjs — mede quantas casas o simulador pede em cada cargo e
   confirma que o número apoiado tem exatamente esse tamanho.               */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);
const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 1440, height: 900 },
});
const pg = await nav.newPage();
const dorme = ms => new Promise(r => setTimeout(r, ms));
await pg.goto('http://localhost:8803/', { waitUntil: 'networkidle2' });
await dorme(3500);
await pg.evaluate(() => {
  const y = document.getElementById('urna').getBoundingClientRect().top + scrollY - 60;
  if (window.VT?.lenis) window.VT.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y);
});
await dorme(900);

const ler = () => pg.evaluate(() => ({
  cargo: document.getElementById('lcd-cargo').textContent.trim(),
  passo: document.getElementById('lcd-passo').textContent.trim(),
  casas: document.querySelectorAll('.lcd__cx').length,
  digitado: [...document.querySelectorAll('.lcd__cx')].map(c => c.textContent).join(''),
  nome: document.getElementById('lcd-nome').textContent.trim(),
  fichaVisivel: !document.getElementById('lcd-ficha').hidden,
  avisoVisivel: !document.getElementById('lcd-aviso').hidden,
  aviso: document.getElementById('lcd-aviso').textContent.trim().slice(0, 70),
}));
const tecla = async t => { await pg.click(`.tecla[data-t="${t}"]`); await dorme(220); };
const acao = async a => { await pg.click(`[data-a="${a}"]`); await dorme(450); };

const f1 = await ler();
console.log('FASE 1:', JSON.stringify(f1));
for (const d of '2223') await tecla(d);
const f1c = await ler();
console.log('  depois de 2223:', JSON.stringify(f1c));

await acao('confirma');
const f2 = await ler();
console.log('FASE 2:', JSON.stringify(f2));
for (const d of '15115') await tecla(d);
const f2c = await ler();
console.log('  depois de 15115:', JSON.stringify(f2c));

const D = await pg.evaluate(() => ({
  cezinha: window.VT_DADOS?.cezinha?.numero,
  regina: window.VT_DADOS?.regina?.numero,
}));
console.log('\nDADOS:', JSON.stringify(D));
console.log('CONFERE:',
  `federal ${f1.casas} casas x numero ${String(D.cezinha).length} digitos ->`,
  f1.casas === String(D.cezinha).length ? 'OK' : 'DIVERGENTE',
  `| estadual ${f2.casas} casas x numero ${String(D.regina).length} digitos ->`,
  f2.casas === String(D.regina).length ? 'OK' : 'DIVERGENTE');

await nav.close();
