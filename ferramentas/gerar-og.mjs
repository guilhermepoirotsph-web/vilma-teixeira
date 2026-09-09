#!/usr/bin/env node
/* ============================================================================
   gerar-og.mjs — desenha o cartão de compartilhamento (Open Graph, 1200×630)
   com a própria identidade do site e salva em assets/img/og.jpg.

   É o que aparece quando alguém cola o link no WhatsApp, no Facebook ou no
   Telegram. Sem ele o link vira uma linha de texto sem imagem — num site de
   campanha, isso é metade da divulgação perdida.

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

/* as fotos entram embutidas: o Chrome headless não tem a pasta servida */
const dataUri = (arq, mime) => {
  const p = join(RAIZ, 'fotos', arq);
  return existsSync(p) ? `data:${mime};base64,` + readFileSync(p).toString('base64') : '';
};
const REGINA = dataUri('regina-retrato.webp', 'image/webp');
const CEZINHA = dataUri('cezinha-santinho.webp', 'image/webp');

const retrato = (src, nome, numero, cor) => src ? `
  <figure class="p" style="--c:${cor}">
    <span class="p__moldura"><img src="${src}" alt=""></span>
    <figcaption><b>${numero}</b><i>${nome}</i></figcaption>
  </figure>` : '';

const HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@600;800;900&family=Great+Vibes&family=Manrope:wght@500;700&display=swap">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;
       background:#04122b;color:#eef3fb;font-family:'Manrope',system-ui;
       position:relative;display:flex;align-items:center}

  /* mesmo mar de luzes do herói, em versão estática */
  .ceu{position:absolute;inset:0;
       background:
         radial-gradient(120% 90% at 12% 8%, rgba(27,79,160,.55) 0%, transparent 60%),
         radial-gradient(90% 80% at 92% 88%, rgba(228,24,95,.38) 0%, transparent 62%),
         linear-gradient(160deg,#061733 0%,#04122b 55%,#0a2a5e 100%)}
  .luzes{position:absolute;inset:0;opacity:.5}
  .luzes i{position:absolute;width:5px;height:5px;border-radius:50%;
           background:#e9b949;box-shadow:0 0 14px 3px rgba(233,185,73,.55)}
  .feixe{position:absolute;left:-10%;top:-40%;width:52%;height:190%;
         background:linear-gradient(96deg,rgba(233,185,73,.16),transparent 62%);
         transform:rotate(-7deg);filter:blur(2px)}

  .grade{position:relative;display:grid;grid-template-columns:1fr auto;
         gap:56px;align-items:center;padding:0 68px;width:100%}

  .selo{display:inline-flex;align-items:center;gap:10px;
        border:1.5px solid rgba(233,185,73,.55);border-radius:999px;
        padding:8px 18px;font:700 17px/1 'Manrope';letter-spacing:.14em;
        text-transform:uppercase;color:#e9b949;margin-bottom:22px}
  .selo::before{content:'';width:9px;height:9px;border-radius:50%;background:#e9b949}

  .assina{font-family:'Great Vibes',cursive;font-size:46px;color:#e9b949;
          line-height:1;margin-bottom:2px;opacity:.95}
  h1{font-family:'Anton',Impact,sans-serif;font-size:92px;line-height:.92;
     letter-spacing:-.5px;text-transform:uppercase}
  h1 span{display:block;color:#fff}
  .lead{margin-top:20px;font:700 27px/1.32 'Archivo',sans-serif;
        color:rgba(238,243,251,.9);max-width:20ch}
  .lead em{font-style:normal;color:#e9b949}

  .duplas{display:flex;gap:26px}
  .p{width:222px;text-align:center}
  .p__moldura{display:block;width:222px;height:290px;border-radius:20px;
              overflow:hidden;position:relative;
              background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.02));
              border:2px solid var(--c);box-shadow:0 24px 60px -22px var(--c)}
  .p__moldura img{width:100%;height:100%;object-fit:cover;object-position:top center}
  figcaption{margin-top:14px;display:flex;flex-direction:column;gap:3px}
  figcaption b{font-family:'Anton',sans-serif;font-size:42px;line-height:1;
               color:var(--c);letter-spacing:1px}
  figcaption i{font-style:normal;font:700 16px/1.2 'Manrope';
               color:rgba(238,243,251,.82)}

  .rodape{position:absolute;left:68px;right:68px;bottom:26px;
          display:flex;justify-content:space-between;align-items:center;
          font:700 17px/1 'Manrope';color:rgba(238,243,251,.6);
          border-top:1px solid rgba(247,244,238,.16);padding-top:18px}
  .rodape b{color:#eef3fb}
</style></head><body>
  <div class="ceu"></div><div class="feixe"></div>
  <div class="luzes">${Array.from({ length: 46 }, (_, i) => {
    const x = (i * 37 % 100), y = (i * 61 % 100), o = .25 + (i % 5) * .15;
    return `<i style="left:${x}%;top:${y}%;opacity:${o.toFixed(2)}"></i>`;
  }).join('')}</div>

  <div class="grade">
    <div>
      <span class="selo">Caraguatatuba · SP</span>
      <p class="assina">Vereadora</p>
      <h1>Vilma<span>Teixeira</span></h1>
      <p class="lead">Juntos por Caraguá<br>e <em>pelo Brasil</em></p>
    </div>
    <div class="duplas">
      ${retrato(REGINA, 'Regina Nunes', '15115', '#e4185f')}
      ${retrato(CEZINHA, 'Cezinha de Madureira', '2223', '#3d78d1')}
    </div>
  </div>

  <div class="rodape">
    <span>Deputada Estadual <b>15115</b> · Deputado Federal <b>2223</b></span>
    <span><b>vilmateixeira.com</b></span>
  </div>
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
   fotográfico (degradê + retratos) — PNG aqui custa 5× o tamanho por nada. */
await pg.screenshot({ path: join(SAIDA, 'og.jpg'), type: 'jpeg', quality: 86 });
await pg.close();
await nav.close();

const { statSync, rmSync } = await import('node:fs');
try { rmSync(join(SAIDA, 'og.png')); } catch {}
const kb = statSync(join(SAIDA, 'og.jpg')).size / 1024;
console.log('✓ assets/img/og.jpg  —', kb.toFixed(0) + ' KB, 1200×630',
  '\n  retratos embutidos:', [REGINA && 'Regina', CEZINHA && 'Cezinha'].filter(Boolean).join(' + ') || 'nenhum');
if (kb > 300) console.warn('⚠ acima de 300 KB — alguns clientes de mensagem descartam a prévia');
