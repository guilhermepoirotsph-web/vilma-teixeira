#!/usr/bin/env node
/* conferir-painel-vivo.mjs — abre o painel como um navegador COMUM abriria
   (sem injeção de configuração pelo teste) e confirma que o config.local.js
   está sendo carregado e que o login da assessora funciona de verdade.
   Antes: node ferramentas/supabase-falso.mjs  +  node preview-server.mjs    */
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
pg.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 160)));

await pg.goto('http://localhost:8803/painel/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
console.log('config.local.js carregou:', await pg.evaluate(() => Boolean(window.VT_CONFIG)));

await pg.evaluate(() => {
  document.querySelector('input[name=email]').value = 'mariana@vilmateixeira.com.br';
  document.querySelector('input[name=senha]').value = 'teste1234';
  document.getElementById('btn-entrar').click();
});
await new Promise(r => setTimeout(r, 2600));

console.log(JSON.stringify(await pg.evaluate(() => ({
  entrou: !document.getElementById('app').hidden,
  papel: document.getElementById('topo-papel').textContent.trim(),
  quem: document.getElementById('topo-quem').textContent.trim(),
  compromissos: document.querySelectorAll('.pilula').length,
  nota: (document.getElementById('agenda-nota') || {}).textContent?.trim().slice(0, 90),
})), null, 1));

await pg.screenshot({ path: 'caps/painel-vivo.png' });
console.log('captura: caps/painel-vivo.png');
await nav.close();
