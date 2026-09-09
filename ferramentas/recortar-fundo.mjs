#!/usr/bin/env node
/* ============================================================================
   recortar-fundo.mjs — tira o fundo liso de um retrato e devolve PNG transparente.

   Sem sharp e sem ONNX: usa o próprio Chrome (canvas) para decodificar
   (inclusive WebP, que o System.Drawing do Windows não abre) e processar.

   Não é threshold global — isso abriria buracos em camisa branca e renda clara.
   O fundo é achado por PREENCHIMENTO A PARTIR DAS BORDAS: só sai o que está
   ligado à moldura da foto. Depois a borda ganha suavização e um leve encolhimento
   para não deixar franja clara em volta do cabelo.

   Uso: node ferramentas/recortar-fundo.mjs <entrada> <saida.png> [--tol=42] [--largura=1000]
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const [, , entradaArg, saidaArg] = process.argv;
if (!entradaArg || !saidaArg) {
  console.error('uso: node ferramentas/recortar-fundo.mjs <entrada> <saida.png> [--tol=42] [--largura=1000]');
  process.exit(1);
}
const arg = (n, p) => {
  const a = process.argv.find(x => x.startsWith('--' + n + '='));
  return a ? Number(a.split('=')[1]) : p;
};
const TOL = arg('tol', 42);
const LARGURA = arg('largura', 1000);
// Fundo liso é acinzentado (r≈g≈b). Pele iluminada, por mais clara que fique,
// mantém dominante quente. Sem este limite o preenchimento entra pela testa.
const DOM = arg('dominante', 26);

const entrada = resolve(entradaArg);
const saida = resolve(saidaArg);
if (!existsSync(entrada)) { console.error('não achei ' + entrada); process.exit(1); }

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const dataUri = 'data:' + (MIME[extname(entrada).toLowerCase()] || 'image/jpeg') +
                ';base64,' + readFileSync(entrada).toString('base64');

// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);

const nav = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const pg = await nav.newPage();
await pg.setContent('<!doctype html><body></body>');

const png = await pg.evaluate(async (uri, tol, larguraAlvo, domMax) => {
  const img = new Image();
  img.src = uri;
  await img.decode();

  const esc = Math.min(1, larguraAlvo / img.naturalWidth);
  const L = Math.round(img.naturalWidth * esc);
  const A = Math.round(img.naturalHeight * esc);

  const cv = document.createElement('canvas');
  cv.width = L; cv.height = A;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, L, A);

  const dados = cx.getImageData(0, 0, L, A);
  const p = dados.data;
  const em = (x, y) => (y * L + x) * 4;

  // cor de referência: média das quatro bordas
  let sr = 0, sg = 0, sb = 0, n = 0;
  const amostrar = (x, y) => { const i = em(x, y); sr += p[i]; sg += p[i + 1]; sb += p[i + 2]; n++; };
  for (let x = 0; x < L; x++) { amostrar(x, 0); amostrar(x, A - 1); }
  for (let y = 0; y < A; y++) { amostrar(0, y); amostrar(L - 1, y); }
  const fr = sr / n, fg = sg / n, fb = sb / n;

  const dist = i => Math.hypot(p[i] - fr, p[i + 1] - fg, p[i + 2] - fb);
  // dominante de cor do pixel: alta em pele, baixa em parede branca/cinza
  const dominante = i => Math.max(p[i], p[i + 1], p[i + 2]) - Math.min(p[i], p[i + 1], p[i + 2]);
  const ehFundo = i => dist(i) <= tol && dominante(i) <= domMax;

  // preenchimento a partir das bordas: só é fundo o que está LIGADO à moldura
  const fundo = new Uint8Array(L * A);
  const fila = [];
  const empurrar = (x, y) => {
    if (x < 0 || y < 0 || x >= L || y >= A) return;
    const k = y * L + x;
    if (fundo[k]) return;
    if (!ehFundo(k * 4)) return;
    fundo[k] = 1; fila.push(k);
  };
  for (let x = 0; x < L; x++) { empurrar(x, 0); empurrar(x, A - 1); }
  for (let y = 0; y < A; y++) { empurrar(0, y); empurrar(L - 1, y); }
  while (fila.length) {
    const k = fila.pop(), x = k % L, y = (k / L) | 0;
    empurrar(x + 1, y); empurrar(x - 1, y); empurrar(x, y + 1); empurrar(x, y - 1);
  }

  // alfa: fundo=0, resto=255, com rampa suave perto do limiar
  for (let k = 0; k < L * A; k++) {
    const i = k * 4;
    if (fundo[k]) { p[i + 3] = 0; continue; }
    const d = dist(i);
    if (d < tol * 1.6 && dominante(i) <= domMax * 1.4)
      p[i + 3] = Math.round(255 * Math.min(1, d / (tol * 1.6)));
  }

  // encolhe 1px na fronteira para matar a franja clara do fundo
  const copia = new Uint8Array(L * A);
  for (let k = 0; k < L * A; k++) copia[k] = p[k * 4 + 3];
  for (let y = 1; y < A - 1; y++) for (let x = 1; x < L - 1; x++) {
    const k = y * L + x;
    if (copia[k] === 0) continue;
    const menor = Math.min(copia[k - 1], copia[k + 1], copia[k - L], copia[k + L]);
    if (menor === 0) p[k * 4 + 3] = Math.min(copia[k], 160);
  }

  cx.putImageData(dados, 0, 0);

  // recorta a moldura vazia em volta
  let x0 = L, y0 = A, x1 = 0, y1 = 0;
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) {
    if (p[em(x, y) + 3] > 12) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 <= x0 || y1 <= y0) return { erro: 'nada sobrou depois do recorte — tolerância alta demais' };

  const m = 4;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(L - 1, x1 + m); y1 = Math.min(A - 1, y1 + m);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  const cv2 = document.createElement('canvas');
  cv2.width = cw; cv2.height = ch;
  cv2.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);

  const fundoPct = Math.round(100 * fundo.reduce((a, b) => a + b, 0) / (L * A));
  return { png: cv2.toDataURL('image/png'), w: cw, h: ch, fundoPct };
}, dataUri, TOL, LARGURA, DOM);

await nav.close();

if (png.erro) { console.error('✗ ' + png.erro); process.exit(1); }

writeFileSync(saida, Buffer.from(png.png.split(',')[1], 'base64'));
const kb = Math.round(readFileSync(saida).length / 1024);
console.log(`✓ ${saida.split(/[\\/]/).pop()} — ${png.w}×${png.h}, ${kb} KB, ` +
            `${png.fundoPct}% da imagem era fundo`);
if (png.fundoPct < 8) console.log('  ⚠ tirou pouco fundo: talvez o fundo não seja liso. Tente --tol maior.');
if (png.fundoPct > 75) console.log('  ⚠ tirou fundo demais: confira se não comeu a pessoa. Tente --tol menor.');
