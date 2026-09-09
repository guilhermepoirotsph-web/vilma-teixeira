#!/usr/bin/env node
/* ============================================================================
   capturar.mjs — olha o próprio trabalho com Chrome headless.

   O Browser pane do Claude Code devolve captura preta depois de qualquer
   scroll (defeito conhecido, registrado no Segundo Cérebro). Esta ferramenta
   é a que vale para conferir seção por seção.

   Uso:
     node ferramentas/capturar.mjs                      # desktop, todas as seções
     node ferramentas/capturar.mjs --largura=390 --altura=844   # celular
     node ferramentas/capturar.mjs --secao=urna         # só uma seção
     node ferramentas/capturar.mjs --url=".../?anim=0"  # sem animação
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPS = join(RAIZ, 'caps');

const arg = (n, p) => {
  const a = process.argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : p;
};

const LARGURA = Number(arg('largura', 1440));
const ALTURA  = Number(arg('altura', 900));
const URL     = arg('url', 'http://localhost:8803/');
const SO      = arg('secao', '');
const PREFIXO = arg('prefixo', LARGURA < 700 ? 'm' : 'd');

// CHROME_PATH deixa a mesma ferramenta rodar no Linux do GitHub Actions
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
].filter(Boolean)
 .find(p => { try { return require('node:fs').existsSync(p); } catch { return false; } })
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SECOES = ['topo', 'uniao', 'historia', 'mandato', 'video', 'regina',
                'cezinha', 'urna', 'caragua', 'agenda', 'apoie', 'final'];

await mkdir(CAPS, { recursive: true });

const nav = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb',
         '--window-size=' + LARGURA + ',' + ALTURA],
  defaultViewport: { width: LARGURA, height: ALTURA, deviceScaleFactor: 1,
                     isMobile: LARGURA < 700, hasTouch: LARGURA < 700 },
});

const pg = await nav.newPage();

// --api=http://localhost:8810 aponta a página para o Supabase falso, só para
// conferir as telas com dado dentro (o gancho VT_CONFIG só vale em localhost).
const APIF = arg('api', '');
if (APIF) {
  await pg.evaluateOnNewDocument((url, chave) => {
    window.VT_CONFIG = { url, chave };
  }, APIF, arg('apikey', 'chave-publishable-de-teste'));
}

if (LARGURA < 700) {
  await pg.setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 ' +
                        '(KHTML, like Gecko) Chrome/128 Mobile Safari/537.36');
}

const erros = [];
pg.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 220)); });
pg.on('pageerror', e => erros.push('pageerror: ' + String(e).slice(0, 220)));
pg.on('requestfailed', r => {
  const u = r.url();
  if (!/instagram|fonts\.g/.test(u)) erros.push('rede: ' + u.replace(URL, '') + ' — ' + r.failure()?.errorText);
});

await pg.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 2600)); // preloader + entrada

const alvos = SO ? [SO] : SECOES;
const relatorio = [];

for (const id of alvos) {
  const ok = await pg.evaluate(async sec => {
    const el = sec === 'topo' ? document.body : document.getElementById(sec);
    if (!el) return false;
    const y = sec === 'topo' ? 0 : el.getBoundingClientRect().top + scrollY - 10;
    // Lenis é quem manda no scroll quando a animação está ligada
    if (window.VT?.lenis) window.VT.lenis.scrollTo(y, { immediate: true });
    else scrollTo(0, y);
    await new Promise(r => setTimeout(r, 60));
    window.ScrollTrigger?.update();
    return true;
  }, id);

  if (!ok) { relatorio.push(`  ✗ ${id} — seção não existe`); continue; }
  await new Promise(r => setTimeout(r, 1500)); // deixa a revelação acontecer

  const arq = join(CAPS, `${PREFIXO}-${id}.png`);
  await pg.screenshot({ path: arq });

  const m = await pg.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - innerWidth,
    invisiveis: [...document.querySelectorAll('.revelar')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0 && Number(getComputedStyle(e).opacity) < .1;
    }).length,
  }));
  relatorio.push(`  ✓ ${id}${m.overflowX > 0 ? '  ⚠ overflowX ' + m.overflowX : ''}` +
                 `${m.invisiveis ? '  ⚠ ' + m.invisiveis + ' elemento(s) invisível(is) na dobra' : ''}`);
}

console.log(`\n▸ ${LARGURA}×${ALTURA}  ${URL}`);
relatorio.forEach(l => console.log(l));
console.log(erros.length ? '\n⚠ erros:\n  ' + [...new Set(erros)].join('\n  ') : '\n✓ zero erro de console/rede');

await writeFile(join(CAPS, `_relatorio-${PREFIXO}.txt`),
  relatorio.join('\n') + '\n\n' + (erros.join('\n') || 'sem erros'), 'utf8');

await nav.close();
