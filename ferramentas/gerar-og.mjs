#!/usr/bin/env node
/* ============================================================================
   gerar-og.mjs — desenha o cartão de compartilhamento (Open Graph, 1200×630)
   com a própria identidade do site e salva em assets/img/og.jpg.

   É o que aparece quando alguém cola o link no WhatsApp, no Facebook ou no
   Telegram. Sem ele o link vira uma linha de texto sem imagem — metade da
   divulgação perdida.

   Uso: node ferramentas/gerar-og.mjs
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'assets', 'img');
// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);
await mkdir(SAIDA, { recursive: true });

/* a foto entra embutida: o Chrome headless não tem a pasta servida.
   Recorte PNG > retrato JPG > sem foto (aí o lado direito vira os números). */
const dataUri = (arq, mime) => {
  const p = join(RAIZ, 'fotos', arq);
  return existsSync(p) ? `data:${mime};base64,` + readFileSync(p).toString('base64') : '';
};
const RECORTE = dataUri('vilma.png', 'image/png');
const RETRATO = RECORTE ? '' : dataUri('vilma-retrato.jpg', 'image/jpeg');

const direita = RECORTE
  ? `<div class="foto foto--recorte"><span class="arco"></span><img src="${RECORTE}" alt=""></div>`
  : RETRATO
    ? `<div class="foto foto--retrato"><img src="${RETRATO}" alt=""></div>`
    : `<div class="nums">
         <div class="n" style="--c:#069233"><i>Desde 2008</i><b>4</b><span>mandatos como vereadora</span></div>
         <div class="n" style="--c:#ffcd00"><i>2025 e 2026</i><b>141</b><span>proposições protocoladas</span></div>
         <div class="n" style="--c:#e30016"><i>Virou lei</i><b>2.832</b><span>jardins terapêuticos</span></div>
       </div>`;

const HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:ital,wght@0,600;0,800;0,900;1,900&family=Great+Vibes&family=Manrope:wght@500;700;800&display=swap">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;
       background:#03140a;color:#f3f7f2;font-family:'Manrope',system-ui;
       position:relative;display:flex;align-items:center}
  /* paleta do MDB, medida no logotipo do partido */
  .ceu{position:absolute;inset:0;
       background:
         radial-gradient(110% 90% at 8% 0%, rgba(6,146,51,.6) 0%, transparent 58%),
         radial-gradient(80% 70% at 96% 100%, rgba(255,205,0,.28) 0%, transparent 62%),
         linear-gradient(160deg,#0a2d18 0%,#03140a 58%,#062012 100%)}
  .luzes{position:absolute;inset:0;opacity:.55}
  .luzes i{position:absolute;width:5px;height:5px;border-radius:50%}
  .faixa{position:absolute;left:0;right:0;bottom:0;height:14px;
         background:linear-gradient(90deg,#f39200 0%,#ffcd00 20%,#069233 62%,#a1c405 100%)}

  .grade{position:relative;display:grid;grid-template-columns:1fr auto;
         gap:40px;align-items:center;padding:0 0 26px 72px;width:100%;height:100%}
  .esq{align-self:center}
  .selo{display:inline-flex;align-items:center;gap:12px;margin-bottom:40px;
        font:800 18px/1 'Manrope';letter-spacing:.16em;text-transform:uppercase;color:#ffcd00}
  .selo::before{content:'';width:44px;height:4px;border-radius:4px;
        background:linear-gradient(90deg,#f39200,#ffcd00,#069233,#a1c405)}
  .assina{font-family:'Great Vibes',cursive;font-size:150px;line-height:.9;color:#fbfaf5;
          text-shadow:0 0 60px rgba(255,205,0,.3)}
  h1{font-family:'Anton',Impact,sans-serif;font-weight:400;font-size:74px;line-height:1;
     letter-spacing:.14em;text-transform:uppercase;color:transparent;
     -webkit-text-stroke:2px #ffcd00;margin:-8px 0 0 8px}
  .lead{margin-top:22px;font:700 26px/1.32 'Archivo',sans-serif;color:rgba(243,247,242,.92);max-width:24ch}
  .lead em{font-style:normal;color:#ffcd00}
  .mdb{display:inline-flex;align-items:center;gap:8px;margin-top:26px;padding:6px 16px 9px 12px;border-radius:9px;
       background:#fff;color:#0a0a0a;font:italic 900 30px/1 'Archivo';letter-spacing:-1px;position:relative}
  .mdb::before{content:'';width:13px;height:21px;border-radius:60% 60% 50% 50% / 75% 75% 35% 35%;
       transform:rotate(14deg);background:linear-gradient(170deg,#e30016 30%,#f39200 75%,#ffcd00)}
  .mdb::after{content:'';position:absolute;left:12px;right:12px;bottom:4px;height:4px;border-radius:4px;
       background:linear-gradient(90deg,#f39200,#ffcd00,#069233,#a1c405)}

  .foto{position:relative;width:460px;height:604px;align-self:end}
  .foto img{position:absolute;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:contain;object-position:bottom center;
            filter:drop-shadow(0 24px 40px rgba(0,0,0,.6))}
  .foto--retrato{width:400px;height:500px;align-self:center;margin-right:64px;border-radius:26px;overflow:hidden;
                 box-shadow:0 30px 70px -24px #000,inset 0 0 0 2px rgba(255,205,0,.6)}
  .foto--retrato img{object-fit:cover;object-position:50% 12%;filter:none}
  .arco{position:absolute;left:50%;top:40px;width:430px;height:430px;transform:translateX(-50%) rotate(-18deg);border-radius:50%;
        background:conic-gradient(from 200deg,transparent 0 8%,#f39200 14%,#ffcd00 26%,#069233 44%,#a1c405 58%,transparent 66%);
        -webkit-mask:radial-gradient(circle,transparent 63%,#000 63.6%,#000 68%,transparent 68.6%)}

  .nums{display:grid;gap:14px;margin-right:72px}
  .n{position:relative;width:330px;padding:14px 22px 16px 30px;border-radius:18px;background:#fbfaf5;color:#0a0a0a;
     box-shadow:0 22px 50px -22px #000}
  .n::before{content:'';position:absolute;left:0;top:0;bottom:0;width:8px;border-radius:18px 0 0 18px;background:var(--c)}
  .n i{display:block;font:800 13px/1 'Manrope';letter-spacing:.16em;text-transform:uppercase;font-style:normal;color:#3f4a42}
  .n b{display:block;font-family:'Anton',sans-serif;font-weight:400;font-size:60px;line-height:1;margin-top:4px}
  .n span{font:700 17px/1.2 'Archivo';color:#3f4a42}
</style></head><body>
  <div class="ceu"></div>
  <div class="luzes">${Array.from({ length: 52 }, (_, i) => {
    const x = (i * 37 % 100), y = (i * 61 % 100), o = .25 + (i % 5) * .15;
    const c = ['#ffcd00', '#069233', '#a1c405', '#fbfaf5', '#ffcd00'][i % 5];
    return `<i style="left:${x}%;top:${y}%;opacity:${o.toFixed(2)};background:${c};box-shadow:0 0 14px 3px ${c}88"></i>`;
  }).join('')}</div>

  <div class="grade">
    <div class="esq">
      <span class="selo">Vereadora · Caraguatatuba</span>
      <p class="assina">Vilma</p>
      <h1>Teixeira</h1>
      <p class="lead">4º mandato · 141 proposições<br>e a <em>lei dos jardins terapêuticos</em></p>
      <span class="mdb">MDB</span>
    </div>
    ${direita}
  </div>
  <div class="faixa"></div>
</body></html>`;

const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
});
const pg = await nav.newPage();
await pg.setContent(HTML, { waitUntil: 'networkidle0' });
await pg.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 400));
/* JPEG, não PNG: o WhatsApp descarta prévia de imagem pesada, e este cartão é
   fotográfico (degradê + foto) — PNG aqui custa 5× o tamanho por nada. */
await pg.screenshot({ path: join(SAIDA, 'og.jpg'), type: 'jpeg', quality: 86 });
await pg.close();
await nav.close();

const { statSync, rmSync } = await import('node:fs');
try { rmSync(join(SAIDA, 'og.png')); } catch {}
const kb = statSync(join(SAIDA, 'og.jpg')).size / 1024;
console.log('✓ assets/img/og.jpg  —', kb.toFixed(0) + ' KB, 1200×630',
  '\n  foto da Vilma:', RECORTE ? 'recorte (fotos/vilma.png)' : RETRATO ? 'retrato (fotos/vilma-retrato.jpg)' : 'nenhuma — usando os números');
if (kb > 300) console.warn('⚠ acima de 300 KB — alguns clientes de mensagem descartam a prévia');
