#!/usr/bin/env node
/* ============================================================================
   diagnosticar-scroll.mjs — procura buraco em branco e salto no scroll.

   Varre a página inteira de 200 em 200px e, em cada parada, mede quanto
   conteúdo VISÍVEL existe dentro da janela. Faixa longa sem nada = o buraco
   que o usuário vê (barra de rolagem andando e tela vazia).
   Também lista os ScrollTriggers pinados e o tamanho do espaçador de cada pin,
   que é a causa mais comum tanto do buraco quanto do "volta pra cima".

   Uso: node ferramentas/diagnosticar-scroll.mjs [--largura=1440 --altura=900]
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const arg = (n, p) => {
  const a = process.argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.split('=')[1] : p;
};
const L = Number(arg('largura', 1440)), A = Number(arg('altura', 900));
const URL = arg('url', 'http://localhost:8803/');
// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);

const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: L, height: A },
});
const pg = await nav.newPage();
const erros = [];
pg.on('pageerror', e => erros.push(String(e).slice(0, 160)));
await pg.goto(URL, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 4500));

/* ---------------------------------------------------- pins e espaçadores */
const pins = await pg.evaluate(() => {
  const ST = window.ScrollTrigger;
  if (!ST) return { erro: 'ScrollTrigger não existe' };
  return {
    total: ST.getAll().length,
    pinados: ST.getAll().filter(s => s.pin).map(s => {
      const esp = s.spacer || (s.pin && s.pin.parentNode);
      return {
        gatilho: (s.trigger?.id || s.trigger?.className || '?').toString().slice(0, 40),
        start: Math.round(s.start), end: Math.round(s.end),
        curso: Math.round(s.end - s.start),
        alturaPin: s.pin ? Math.round(s.pin.getBoundingClientRect().height) : null,
        alturaEspacador: esp ? Math.round(esp.getBoundingClientRect().height) : null,
      };
    }),
  };
});

/* -------------------------------------------- varredura por faixas vazias */
const alturaDoc = await pg.evaluate(() => document.documentElement.scrollHeight);
const passo = 200;
const paradas = [];
for (let y = 0; y < alturaDoc - A * .5; y += passo) {
  await pg.evaluate(yy => {
    if (window.VT?.lenis) window.VT.lenis.scrollTo(yy, { immediate: true });
    else scrollTo(0, yy);
    window.ScrollTrigger?.update();
  }, y);
  await new Promise(r => setTimeout(r, 90));
  const m = await pg.evaluate(() => {
    // quanto de conteúdo real (texto/imagem/canvas) está visível na janela
    let area = 0, itens = 0;
    document.querySelectorAll('h1,h2,h3,h4,p,img,canvas,button,a,input,select,article,figure,li')
      .forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || r.width < 4 || r.height < 4) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || Number(cs.opacity) < .06) return;
        const alt = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
        area += Math.max(0, alt) * Math.min(r.width, innerWidth);
        itens++;
      });
    return { itens, cobertura: +(area / (innerWidth * innerHeight)).toFixed(2),
             y: Math.round(scrollY) };
  });
  paradas.push({ alvo: y, ...m });
}

/* --------------------------------------------------- faixas problemáticas */
const vazias = paradas.filter(p => p.itens <= 2 || p.cobertura < .05);
const faixas = [];
vazias.forEach(p => {
  const ult = faixas[faixas.length - 1];
  if (ult && p.alvo - ult.fim <= passo) ult.fim = p.alvo;
  else faixas.push({ ini: p.alvo, fim: p.alvo });
});

/* ------------------------------------- o scroll "volta pra cima" sozinho? */
await pg.evaluate(() => {
  if (window.VT?.lenis) window.VT.lenis.scrollTo(0, { immediate: true }); else scrollTo(0, 0);
});
await new Promise(r => setTimeout(r, 400));
const alvoTeste = Math.round(alturaDoc * .45);
await pg.evaluate(y => {
  if (window.VT?.lenis) window.VT.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y);
}, alvoTeste);
await new Promise(r => setTimeout(r, 2500));
const depois = await pg.evaluate(() => Math.round(scrollY));
const pulou = Math.abs(depois - alvoTeste);

console.log(`\n▸ ${L}×${A} · documento ${alturaDoc}px · ${pins.total} ScrollTriggers`);
console.log('\nPINS:');
(pins.pinados || []).forEach(p =>
  console.log(`  ${p.gatilho}\n     start ${p.start} → end ${p.end}  (curso ${p.curso}px)` +
              `  pin ${p.alturaPin}px · espaçador ${p.alturaEspacador}px`));

console.log('\nFAIXAS SEM CONTEÚDO VISÍVEL:');
if (!faixas.length) console.log('  nenhuma 🎉');
else faixas.forEach(f => console.log(`  ✗ ${f.ini}px → ${f.fim + passo}px  (${f.fim + passo - f.ini}px de vazio)`));

console.log(`\nSALTO: pedi ${alvoTeste}px, parou em ${depois}px → ${pulou > 40 ? '✗ pulou ' + pulou + 'px' : '✓ ficou'}`);
if (erros.length) console.log('\nERROS JS:\n  ' + [...new Set(erros)].join('\n  '));

await nav.close();
