#!/usr/bin/env node
/* ============================================================================
   auditar-responsivo.mjs — mede o site e os painéis em várias larguras e diz
   O QUE exatamente quebra, com seletor e número.

   Existe porque "olhar no celular" não escala: são 2 telas públicas, 2 painéis
   com 4 abas e 6 larguras — 30 e poucas combinações que ninguém confere à mão
   toda vez. E porque layout só se prova medindo: ler o CSS não basta.

   O que ele procura, em ordem de gravidade:
     1. ESTOURO HORIZONTAL — a página rola para o lado. Mata a leitura no
        celular e é sempre culpa de UM elemento; o auditor aponta qual.
     2. ALVO PEQUENO — botão ou link com menos de 44×44 CSS px, que é o
        mínimo que dedo acerta (WCAG 2.5.5 / guia da Apple).
     3. TEXTO CORTADO — caixa com overflow escondido e conteúdo maior que ela.
     4. SOBREPOSIÇÃO — barra fixa cobrindo conteúdo que devia estar clicável.

   Uso: node ferramentas/auditar-responsivo.mjs
        node ferramentas/auditar-responsivo.mjs --url=http://localhost:8803
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const arg = (n, p) => {
  const a = process.argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.split('=')[1] : p;
};
const RAIZ = arg('url', 'http://localhost:8803').replace(/\/+$/, '');
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome não encontrado (defina CHROME_PATH).'); process.exit(1); }

/* 360 é o Android barato que mais aparece no Brasil; 390 é o iPhone comum;
   768 é o tablet em pé, onde layouts de duas colunas costumam se atropelar. */
const LARGURAS = [360, 390, 414, 768, 1024, 1366];
const ALTURA = 780;

const achados = [];
const anota = (pagina, largura, tipo, detalhe) => achados.push({ pagina, largura, tipo, detalhe });

/* ── a medição, dentro do navegador ─────────────────────────────────── */
const MEDIR = (comDedo) => {
  const res = { estouro: null, culpados: [], alvos: [], cortados: [] };
  const doc = document.documentElement;
  const larg = doc.clientWidth;

  if (doc.scrollWidth > larg + 1) {
    res.estouro = { scroll: doc.scrollWidth, tela: larg };
    // quem passa da borda direita? o primeiro da lista é quase sempre a causa
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const est = getComputedStyle(el);
      if (est.position === 'fixed' || est.visibility === 'hidden' || est.display === 'none') continue;
      if (r.right > larg + 1 || r.left < -1) {
        res.culpados.push({
          sel: el.tagName.toLowerCase()
             + (el.id ? '#' + el.id : '')
             + (el.className && typeof el.className === 'string'
                 ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        });
      }
      if (res.culpados.length >= 6) break;
    }
  }

  /* Piso de 44px e regra de DEDO, nao de mouse. Em 1024 e 1366 com mouse,
     alvo de 35px e a densidade que se quer no desktop — acusar ali e pedir
     para engordar um painel que ninguem toca. O CSS ja trata isso com
     pointer:coarse; aqui o auditor so olha as larguras que ele emula como
     toque, que e o que o CSS vai pegar de verdade. */
  if (comDedo) for (const el of document.querySelectorAll('a[href], button, input[type=button], input[type=submit], [role=button], label.envio__bt')) {
    const r = el.getBoundingClientRect();
    const est = getComputedStyle(el);
    if (r.width === 0 || r.height === 0) continue;
    if (est.visibility === 'hidden' || est.display === 'none' || Number(est.opacity) === 0) continue;
    if (r.bottom < 0 || r.top > innerHeight * 4) continue;      // fora de alcance agora

    /* Link no meio de uma frase é EXCEÇÃO na própria norma (WCAG 2.5.8,
       "Inline"): o tamanho dele é ditado pela entrelinha do texto em volta, e
       engordar link de parágrafo estraga a leitura sem ajudar ninguém. Sem
       esta exceção a ferramenta acusa cada "saiba mais" do site e vira ruído —
       e ferramenta que grita demais é ferramenta que se ignora. */
    const dentroDeTexto = est.display.startsWith('inline')
      && el.parentElement
      && /^(P|LI|SPAN|EM|STRONG|SMALL|TD|DD|FIGCAPTION|BLOCKQUOTE)$/.test(el.parentElement.tagName)
      && (el.parentElement.textContent || '').trim().length > (el.textContent || '').trim().length + 12;
    if (dentroDeTexto) continue;

    if (r.width < 43.5 || r.height < 43.5) {   // meio pixel não é defeito
      res.alvos.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
           + (el.className && typeof el.className === 'string'
               ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        txt: (el.textContent || '').trim().slice(0, 24),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
  }

  /* Rolagem horizontal de PROPÓSITO existe: marquise de bairros, linha do
     tempo que anda com o scroll, kanban. Esses têm conteúdo maior que a
     caixa por desenho, e acusá-los enche o relatório de barulho que faz o
     relatório inteiro ser ignorado. Quem é intencional está marcado aqui. */
  const DE_PROPOSITO = /marquee|historia__palco|kanban|urna__|carrossel|faixa-bairros/;

  for (const el of document.querySelectorAll('body *')) {
    const est = getComputedStyle(el);
    if (est.overflow !== 'hidden' && est.overflowX !== 'hidden') continue;
    if (el.scrollWidth <= el.clientWidth + 2 || el.clientWidth <= 0) continue;
    const classe = typeof el.className === 'string' ? el.className : '';
    if (DE_PROPOSITO.test(classe) || DE_PROPOSITO.test(el.id || '')) continue;
    if (el.closest('.marquee, #historia-palco, .kanban')) continue;
    const txt = (el.textContent || '').trim();
    if (!txt) continue;

    /* "sobra 72px" não conserta nada. O que conserta é saber QUAL filho está
       passando da borda — por isso o culpado vai junto. */
    /* Só interessa o que o usuário PERDE: texto que some e botão que não dá
       para tocar. Brilho de fundo, halo e faixa decorativa são maiores que a
       caixa DE PROPÓSITO — é assim que se faz um degradê que sangra na borda.
       Sem este filtro o relatório vira uma lista de decoração funcionando. */
    let culpado = null;
    const borda = el.getBoundingClientRect().right;
    for (const f of el.querySelectorAll('*')) {
      const fr = f.getBoundingClientRect();
      if (fr.width === 0 || fr.height === 0) continue;
      const fe = getComputedStyle(f);
      if (fe.position === 'fixed') continue;
      // invisível não corta nada que alguém veja: o deslocamento inicial de uma
      // animação de entrada (opacity 0, translateX) some assim que ela toca
      if (Number(fe.opacity) === 0 || f.closest('[style*="opacity: 0"]')) continue;
      if (fe.visibility === 'hidden') continue;
      if (f.getAttribute('aria-hidden') === 'true') continue;
      const ehTexto = (f.textContent || '').trim().length > 0
        && !f.querySelector('*');                       // folha com texto
      const ehBotao = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|IMG)$/.test(f.tagName);
      if (!ehTexto && !ehBotao) continue;
      if (fr.right > borda + 1 && (!culpado || fr.right > culpado.right)) {
        culpado = {
          sel: f.tagName.toLowerCase() + (f.id ? '#' + f.id : '')
             + (typeof f.className === 'string' && f.className.trim()
                 ? '.' + f.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          right: Math.round(fr.right), w: Math.round(fr.width),
        };
      }
    }

    // sem culpado com texto ou botão, o que sobrou da caixa é decoração
    if (!culpado) continue;

    res.cortados.push({
      sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
         + (classe ? '.' + classe.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      sobra: el.scrollWidth - el.clientWidth,
      culpado: `${culpado.sel} (${culpado.w}px, borda em ${culpado.right})`,
      txt: txt.replace(/\s+/g, ' ').slice(0, 26),
    });
    if (res.cortados.length >= 6) break;
  }
  return res;
};

const navegador = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function auditar(nome, url, preparar) {
  for (const w of LARGURAS) {
    const pg = await navegador.newPage();
    await pg.setViewport({ width: w, height: ALTURA, deviceScaleFactor: 1,
                           // 768 é iPad em pé — dedo, não mouse. Emular como
                           // desktop faria o auditor acusar alvo que na vida
                           // real recebe a regra de pointer:coarse.
                           isMobile: w <= 768, hasTouch: w <= 768 });
    try {
      await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      if (preparar) await preparar(pg);
      await new Promise(r => setTimeout(r, 900));   // deixa animação assentar
      const r = await pg.evaluate(MEDIR, w <= 768);

      if (r.estouro) anota(nome, w, 'ESTOURO',
        `rola ${r.estouro.scroll}px numa tela de ${r.estouro.tela}px · ` +
        r.culpados.slice(0, 3).map(c => `${c.sel} (${c.left}→${c.right})`).join(' | '));
      for (const a of r.alvos.slice(0, 8))
        anota(nome, w, 'ALVO', `${a.sel} "${a.txt}" — ${a.w}×${a.h}px`);
      for (const c of r.cortados)
        anota(nome, w, 'CORTADO', `${c.sel} corta ${c.sobra}px → culpa de ${c.culpado}`);
    } catch (e) {
      anota(nome, w, 'ERRO', String(e.message).slice(0, 110));
    }
    await pg.close();
  }
}

/* ── o site público ─────────────────────────────────────────────────── */
await auditar('site', RAIZ + '/');
await auditar('privacidade', RAIZ + '/privacidade.html');

/* ── os painéis (entra com o supabase-falso) ────────────────────────── */
async function entrar(email) {
  return async (pg) => {
    await pg.evaluate(() => { try { localStorage.clear(); } catch {} });
    await pg.reload({ waitUntil: 'networkidle2' });
    await pg.waitForSelector('#btn-entrar', { visible: true, timeout: 15000 });
    await pg.evaluate((e) => {
      const p = (s, v) => { const el = document.querySelector(s); el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true })); };
      p('input[name=email]', e); p('input[name=senha]', 'teste1234');
      document.getElementById('btn-entrar').click();
    }, email);
    await pg.waitForFunction(() => {
      const app = document.getElementById('app');
      return app && !app.hidden;
    }, { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 700));
  };
}

await auditar('painel (login)', RAIZ + '/painel/');
await auditar('painel assessora', RAIZ + '/painel/', await entrar('mariana@vilmateixeira.com.br'));
await auditar('painel social',    RAIZ + '/painel/', await entrar('lucas@vilmateixeira.com.br'));

await navegador.close();

/* ── relatório ──────────────────────────────────────────────────────── */
const ordem = { ERRO: 0, ESTOURO: 1, CORTADO: 2, ALVO: 3 };
achados.sort((a, b) => (ordem[a.tipo] - ordem[b.tipo]) || (a.largura - b.largura));

console.log('\n═══ RESPONSIVIDADE ═══\n');
if (!achados.length) {
  console.log(' ✓ nada a corrigir em ' + LARGURAS.join(', ') + ' px de largura\n');
} else {
  let atual = '';
  for (const a of achados) {
    if (a.tipo !== atual) { console.log(` ── ${a.tipo} ──`); atual = a.tipo; }
    console.log(`  ${String(a.largura).padStart(4)}px · ${a.pagina.padEnd(17)} ${a.detalhe}`);
  }
  const porTipo = achados.reduce((m, a) => (m[a.tipo] = (m[a.tipo] || 0) + 1, m), {});
  console.log('\n' + Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(' · '));
}
process.exitCode = achados.some(a => a.tipo === 'ESTOURO' || a.tipo === 'ERRO') ? 1 : 0;
