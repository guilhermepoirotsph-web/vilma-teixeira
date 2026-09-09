#!/usr/bin/env node
/* medir.mjs — mede elementos no navegador de verdade.
   Layout só se prova medindo; ler o CSS não basta.
   Uso: node ferramentas/medir.mjs "<seletor>" [--largura=390 --altura=844] */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const arg = (n, p) => {
  const a = process.argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.split('=')[1] : p;
};
const SEL = process.argv[2] || '.btn';
const L = Number(arg('largura', 390)), A = Number(arg('altura', 844));
const URL = arg('url', 'http://localhost:8803/');
// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);

const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: L, height: A, isMobile: L < 700, hasTouch: L < 700 },
});
const pg = await nav.newPage();
await pg.goto(URL, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, Number(arg('espera', 3200))));

const r = await pg.evaluate(sel => [...document.querySelectorAll(sel)].map(el => {
  const b = el.getBoundingClientRect();
  const c = getComputedStyle(el);
  return {
    texto: (el.textContent || '').trim().slice(0, 34),
    classe: el.className,
    x: Math.round(b.x), y: Math.round(b.y),
    w: Math.round(b.width), h: Math.round(b.height),
    opacity: c.opacity, display: c.display, visibility: c.visibility,
    transform: c.transform === 'none' ? 'none' : c.transform.slice(0, 46),
    bg: c.backgroundColor, cor: c.color,
    foraDaTela: b.right > innerWidth + 1 || b.left < -1,
  };
}), SEL);

console.log('\nviewport ' + L + '×' + A + '  ·  ' + SEL + '  ·  ' + r.length + ' elemento(s)\n');
console.table(r);
await nav.close();
