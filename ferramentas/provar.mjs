#!/usr/bin/env node
/* ============================================================================
   provar.mjs — E2E do site, como um morador de Caraguá usaria.
   Prova de verdade (não "deve funcionar"): o site é só da Vilma, nas cores do
   MDB; Instagram, galeria, formulário, LGPD e agenda.
   Uso: node ferramentas/provar.mjs [--url=http://localhost:8803/]
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
/* ⚠ Esta constante SOMBREIA a URL global — `new URL(...)` estoura com
   "URL is not a constructor" em qualquer ponto deste arquivo. Use RAIZ. */
const URL = (process.argv.find(a => a.startsWith('--url=')) || '').split('=')[1]
          || 'http://localhost:8803/';
// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);

const provas = [];
const ok  = (n, d = '') => provas.push({ ok: true,  n, d });
const bad = (n, d = '') => provas.push({ ok: false, n, d });

const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 900 },
});
const pg = await nav.newPage();

/* Esta bateria prova o caminho SEM BANCO (fila local, agenda honesta vazia) e
   NUNCA pode encostar num banco de verdade. Duas coisas são cortadas aqui:

   1. `config.local.js`, que ligaria o site ao banco de teste local e mudaria
      justamente o que está sendo medido.
   2. **Qualquer chamada ao Supabase.** Desde que `assets/js/banco.js` passou a
      trazer a URL e a chave de produção (10/09), rodar esta bateria mandava
      cadastro de teste — inclusive o do teste de robô — para o banco REAL da
      campanha. Prova que suja produção não é prova, é incidente. */
const EH_SUPABASE = /supabase\.(co|in)\//;
const pedidosBloqueados = [];
const respostasSupabase = [];   // tem que ficar vazio: nada pode CHEGAR ao banco
await pg.setRequestInterception(true);
// o Instagram também é cortado: a prova confere QUE o site pede o embed
// oficial certo, sem depender do Instagram estar no ar (nem gerar visita lá)
const EH_INSTAGRAM = /^https:\/\/(www\.)?instagram\.com\//;
pg.on('request', r => {
  if (EH_INSTAGRAM.test(r.url())) return r.abort();
  if (/config\.local\.js$/.test(r.url()) || EH_SUPABASE.test(r.url())) {
    pedidosBloqueados.push(r.url());
    r.abort();
  } else r.continue();
});

pg.on('response', r => { if (EH_SUPABASE.test(r.url())) respostasSupabase.push(r.url()); });

const errosJS = [];
pg.on('pageerror', e => errosJS.push(String(e).slice(0, 200)));
// 404 de foto que a campanha ainda não mandou é esperado; ERR_FAILED é o
// config.local.js que ESTA bateria bloqueia de propósito, logo acima.
pg.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !/404|ERR_FAILED/.test(t)) errosJS.push(t.slice(0, 200));
});

/* 'load' + fontes prontas, e não 'networkidle2': o evento de rede ociosa do
   Chrome às vezes nunca chega quando as fontes do Google atrasam no caminho
   (medido em 13/11/2026: mesma página, 2 s numa rodada e 30 s de timeout na
   seguinte). A prova mede o SITE, não a rede de quem roda a bateria. */
await pg.goto(URL, { waitUntil: 'load', timeout: 60000 });
await pg.evaluate(() => document.fonts?.ready).catch(() => {});
await new Promise(r => setTimeout(r, 2800));

const irPara = async id => {
  await pg.evaluate(s => {
    const el = document.getElementById(s);
    const y = el.getBoundingClientRect().top + scrollY - 10;
    if (window.VT?.lenis) window.VT.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y);
    window.ScrollTrigger?.update();
  }, id);
  await new Promise(r => setTimeout(r, 700));
};

/* ═══════════════ 0 · O HERÓI APARECE (nada preso em opacity 0) ══════ */
{
  /* Espera a abertura TERMINAR antes de medir: o que esta prova caça é
     elemento PRESO invisível, não elemento ainda entrando. Medir num relógio
     fixo dava falso vermelho quando a máquina estava ocupada (WebGL + embed). */
  await pg.waitForFunction(() => !window.VT?.debug?.heroi || window.VT.debug.heroi.progress() === 1,
    { timeout: 10000 }).catch(() => {});
  const invisiveis = await pg.evaluate(() => {
    const alvos = ['.heroi__olho', '.heroi__assina', '.heroi__sobrenome', '.heroi__lead',
                   '.heroi__acoes .btn', '.placa', '.heroi__marca-mesa'];
    const ruins = [];
    alvos.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;            // escondido por CSS de propósito
      if (Number(getComputedStyle(el).opacity) < .9)
        ruins.push(sel + ' → opacity ' + getComputedStyle(el).opacity);
    }));
    return ruins;
  });
  invisiveis.length === 0
    ? ok('herói inteiro visível depois da abertura (nada preso em opacity 0)')
    : bad('elemento do herói invisível', invisiveis.join(' | '));

  const cta = await pg.evaluate(() => {
    const b = document.querySelector('.heroi__acoes .btn');
    const r = b.getBoundingClientRect();
    return { texto: b.textContent.trim(), dentro: r.top >= 0 && r.bottom <= innerHeight,
             alto: r.height >= 44 };
  });
  (cta.dentro && cta.alto && /projetos/i.test(cta.texto))
    ? ok('CTA principal visível na primeira tela', cta.texto)
    : bad('CTA do herói', JSON.stringify(cta));
}

/* ═══════ 0-B · REDIMENSIONAR NÃO PODE QUEBRAR A LINHA DO TEMPO ═════════
   Foi o defeito relatado em 09/09: o resize matava e recriava o pin, o
   documento encolhia ~2.100px (o scroll "voltava pra cima") e os marcos
   ficavam invisíveis — 2.000px de tela vazia com a barra andando. */
{
  const irPara = async y => {
    await pg.evaluate(yy => {
      if (window.VT?.lenis) window.VT.lenis.scrollTo(yy, { immediate: true });
      else scrollTo(0, yy);
      window.ScrollTrigger?.update();
    }, y);
    await new Promise(r => setTimeout(r, 400));
  };

  const alvo = await pg.evaluate(() => {
    const p = document.getElementById('historia-palco');
    return Math.round(p.getBoundingClientRect().top + scrollY + 300);
  });
  await irPara(alvo);

  const antes = await pg.evaluate(() => Math.round(scrollY));
  const gatilhosAntes = await pg.evaluate(() => window.ScrollTrigger?.getAll().length || 0);

  // três redimensionamentos seguidos, como quem arrasta a janela ou dá zoom
  for (const [w, h] of [[1200, 860], [1024, 800], [1440, 900]]) {
    await pg.setViewport({ width: w, height: h });
    await new Promise(r => setTimeout(r, 700));
  }
  await new Promise(r => setTimeout(r, 900));

  const depois = await pg.evaluate(() => Math.round(scrollY));
  const gatilhosDepois = await pg.evaluate(() => window.ScrollTrigger?.getAll().length || 0);

  const marcos = await pg.evaluate(() =>
    [...document.querySelectorAll('.marco')]
      .map(m => Number(getComputedStyle(m).opacity))
      .filter(o => o < .9).length);

  marcos === 0
    ? ok('marcos da linha do tempo sobrevivem a redimensionar')
    : bad('marcos invisíveis depois do resize', marcos + ' de 8 em opacity < 0.9');

  gatilhosDepois <= gatilhosAntes + 2
    ? ok('resize não vaza ScrollTrigger', gatilhosAntes + ' → ' + gatilhosDepois)
    : bad('vazou ScrollTrigger no resize', gatilhosAntes + ' → ' + gatilhosDepois);

  // a página muda de altura ao redimensionar, então a tolerância é generosa;
  // o que não pode é voltar para perto do topo
  depois > alvo * .5
    ? ok('scroll não volta pro topo depois do resize', antes + 'px → ' + depois + 'px')
    : bad('o scroll voltou pra cima', antes + 'px → ' + depois + 'px');

  await irPara(0);
  await new Promise(r => setTimeout(r, 600));
}

/* ════════════════════════════════ 1 · SÓ A VILMA, NAS CORES DO MDB ══ */
{
  /* Desde 13/11/2026 o site é só dela. Nenhum outro político, número de urna
     ou simulador pode sobrar — nem no texto, nem no <head> (o card do WhatsApp
     e o Google leem o <head>, não a tela). */
  const sobra = await pg.evaluate(() => {
    const txt = document.body.textContent + ' ' + document.title + ' ' +
      [...document.querySelectorAll('meta[content]')].map(m => m.content).join(' ');
    const achados = txt.match(/Regina|Cezinha|Madureira|15115|\b2223\b|simulador de urna|Deputad[ao]/gi) || [];
    return [...new Set(achados)];
  });
  sobra.length === 0
    ? ok('nenhum outro político, número de urna ou simulador no site')
    : bad('sobrou referência a outra candidatura', sobra.join(', '));

  const secoes = await pg.evaluate(() =>
    ['uniao', 'regina', 'cezinha', 'urna', 'video'].filter(id => document.getElementById(id)));
  secoes.length === 0 ? ok('seções antigas (união, Regina, Cezinha, urna, vídeo) saíram')
                      : bad('seção antiga ainda no HTML', secoes.join(', '));

  // a paleta: os tokens do MDB e o CTA principal em amarelo MDB com texto preto
  const cor = await pg.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const cta = getComputedStyle(document.querySelector('.heroi__acoes .btn'));
    return {
      verde: css.getPropertyValue('--mdb-verde').trim().toLowerCase(),
      amarelo: css.getPropertyValue('--mdb-amarelo').trim().toLowerCase(),
      vermelho: css.getPropertyValue('--mdb-vermelho').trim().toLowerCase(),
      ctaFundo: cta.backgroundColor, ctaTexto: cta.color,
      tema: document.querySelector('meta[name=theme-color]')?.content,
    };
  });
  (cor.verde === '#069233' && cor.amarelo === '#ffcd00' && cor.vermelho === '#e30016')
    ? ok('paleta do MDB nos tokens (verde #069233, amarelo #ffcd00, chama #e30016)')
    : bad('tokens de cor fora da paleta do MDB', JSON.stringify(cor));
  (cor.ctaFundo === 'rgb(255, 205, 0)' && cor.ctaTexto === 'rgb(10, 10, 10)')
    ? ok('CTA do herói em amarelo MDB com texto preto (contraste 13:1)')
    : bad('CTA do herói fora da paleta', cor.ctaFundo + ' / ' + cor.ctaTexto);

  // a lei dela, com número e fonte
  const lei = await pg.evaluate(() => {
    const el = document.getElementById('lei');
    return el ? { num: /2\.832/.test(el.textContent), fonte: /Diário Oficial/.test(el.textContent),
                  autora: /Vilma Teixeira/.test(el.textContent) } : null;
  });
  lei && lei.num && lei.fonte && lei.autora
    ? ok('Lei 2.832/2026 em destaque, com autora e fonte (Diário Oficial)')
    : bad('bloco da lei incompleto', JSON.stringify(lei));
}

/* ════════════════════════════════════════════ 1-B · INSTAGRAM E FOTOS ══ */
{
  /* Sem foto subida, as imagens dela entram pelo embed OFICIAL do perfil do
     Instagram num celular no herói: ninguém copia foto, o Instagram serve. */
  await pg.evaluate(() => scrollTo(0, 0));
  await pg.waitForFunction(() =>
    document.querySelector('.heroi__celular iframe')?.getAttribute('src'), { timeout: 12000 }).catch(() => {});
  const feed = await pg.evaluate(() => {
    const cel = document.querySelector('.heroi__celular');
    const f = cel?.querySelector('iframe');
    return { visivel: Boolean(cel && cel.offsetParent), src: f?.getAttribute('src'),
             sandbox: f?.getAttribute('sandbox') || '', titulo: f?.title || '',
             classe: document.documentElement.classList.contains('feed-no-heroi') };
  });
  (feed.visivel && feed.src === 'https://www.instagram.com/vereadoravilma/embed' && feed.classe)
    ? ok('sem foto subida, o herói mostra o Instagram dela ao vivo (embed oficial do perfil)', feed.src)
    : bad('herói sem o Instagram dela', JSON.stringify(feed));
  (/allow-scripts/.test(feed.sandbox) && !/allow-top-navigation/.test(feed.sandbox) && /Vilma/.test(feed.titulo))
    ? ok('o embed roda em sandbox (não navega a página) e tem título para leitor de tela')
    : bad('iframe do Instagram sem sandbox/título', JSON.stringify(feed));

  await irPara('instagram');
  await new Promise(r => setTimeout(r, 900));
  const ig = await pg.evaluate(() => ({
    links: [...document.querySelectorAll('[data-ig-link]')].map(a => a.getAttribute('href')),
    perfil: Boolean(document.querySelector('#instagram .perfil')),
    gradeEscondida: document.getElementById('insta-grade')?.hidden,
    posts: document.querySelectorAll('#insta-grade .insta__post').length,
  }));
  (ig.links.length >= 4 && ig.links.every(h => h === 'https://www.instagram.com/vereadoravilma/'))
    ? ok('todo botão de Instagram leva ao @vereadoravilma', ig.links.length + ' links')
    : bad('link de Instagram errado', JSON.stringify(ig.links));
  ig.perfil ? ok('cartão de perfil do Instagram na seção') : bad('sem cartão de perfil');
  const repete = await pg.evaluate(() => ({
    celularSecao: Boolean(document.querySelector('.insta__celular')?.offsetParent),
    perfilVisivel: Boolean(document.querySelector('#instagram .perfil')?.offsetParent),
  }));
  (!repete.celularSecao && repete.perfilVisivel)
    ? ok('a seção do Instagram não repete o feed que o herói já mostra (entra o cartão)')
    : bad('feed do Instagram repetido ou cartão sumido', JSON.stringify(repete));
  (ig.gradeEscondida && ig.posts === 0)
    ? ok('sem post escolhido no painel, nenhum post aparece (nada inventado)')
    : bad('grade de posts apareceu sem post escolhido', JSON.stringify(ig));

  const fotos = await pg.evaluate(() => ({
    secao: document.getElementById('fotos')?.hidden,
    menu: [...document.querySelectorAll('[data-so-com-fotos]')].every(a => a.hidden),
  }));
  (fotos.secao && fotos.menu)
    ? ok('sem foto, a galeria e o link "Fotos" do menu ficam escondidos (nunca buraco)')
    : bad('galeria vazia apareceu', JSON.stringify(fotos));
}

/* Numa aba à parte: um post escolhido vira o embed oficial — e o que não é
   link de post (perfil, encurtador, texto) é descartado pela peneira do
   conteudo.js. O embed.js é barrado aqui: a prova não depende do Instagram
   estar no ar, e o cartão de reserva é o que fica se ele for bloqueado. */
{
  const pg2 = await nav.newPage();
  await pg2.setRequestInterception(true);
  pg2.on('request', r => (/config\.local\.js$|instagram\.com\/embed\.js/.test(r.url()) || EH_SUPABASE.test(r.url()))
    ? r.abort() : r.continue());
  pg2.on('pageerror', e => errosJS.push('[aba 2] ' + String(e).slice(0, 200)));
  await pg2.goto(URL + '?anim=0', { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await pg2.evaluate(() => {
    window.VT_DADOS.instagram.posts = ['https://www.instagram.com/p/TESTE12345/'];
    document.getElementById('instagram').scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 1500));
  const post = await pg2.evaluate(() => ({
    n: document.querySelectorAll('#insta-grade .insta__post').length,
    permalink: document.querySelector('#insta-grade .instagram-media')?.dataset.instgrmPermalink,
    reserva: document.querySelector('#insta-grade .insta__reserva')?.getAttribute('href'),
  }));
  (post.n === 1 && post.permalink === 'https://www.instagram.com/p/TESTE12345/' && post.reserva === post.permalink)
    ? ok('post escolhido vira embed oficial, com cartão "ver no Instagram" de reserva')
    : bad('post do Instagram não montou', JSON.stringify(post));
  await pg2.close();
}

/* ═══════════════════════════════════════════════════ 2 · FORMULÁRIO */
await irPara('apoie');

// passo 1 vazio não avança
await pg.click('[data-ir="2"]');
await new Promise(r => setTimeout(r, 350));
let tela = await pg.evaluate(() =>
  document.querySelector('.form__tela.on')?.dataset.tela);
tela === '1' ? ok('formulário barra o passo 1 vazio') : bad('avançou com campos vazios', tela);

const ruins = await pg.evaluate(() => document.querySelectorAll('.campo.ruim').length);
ruins >= 3 ? ok('marca os campos obrigatórios em erro', ruins + ' campos') : bad('não marcou erros', ruins);

// preenche
await pg.type('input[name=nome]', 'Maria Aparecida de Souza');
await pg.type('input[name=whatsapp]', '12988887777');
const mascara = await pg.$eval('input[name=whatsapp]', i => i.value);
mascara === '(12) 98888-7777' ? ok('máscara do WhatsApp', mascara) : bad('máscara errada', mascara);

await pg.select('select[name=bairro]', 'Massaguaçu');
await pg.type('input[name=email]', 'maria@exemplo.com');
await pg.click('[data-ir="2"]');
await new Promise(r => setTimeout(r, 450));
tela = await pg.evaluate(() => document.querySelector('.form__tela.on')?.dataset.tela);
tela === '2' ? ok('passo 1 → 2 com dados válidos') : bad('não avançou para o passo 2', tela);

await pg.click('input[name=ajuda][value=bairro]');
await pg.click('input[name=ajuda][value=divulgar]');
await pg.click('[data-ir="3"]');
await new Promise(r => setTimeout(r, 450));
tela = await pg.evaluate(() => document.querySelector('.form__tela.on')?.dataset.tela);
tela === '3' ? ok('passo 2 → 3') : bad('não avançou para o passo 3', tela);

// o formulário não pergunta mais nada sobre voto ou candidatura
const pedeApoio = await pg.evaluate(() =>
  document.querySelectorAll('input[name=apoio], #aceite-sensivel, input[name=consente_apoio]').length);
pedeApoio === 0 ? ok('formulário não pede declaração de apoio a candidatura (dado sensível fora)')
                : bad('formulário ainda pede declaração de apoio', pedeApoio + ' campo(s)');

// sem consentimento não envia
await pg.click('#form-enviar');
await new Promise(r => setTimeout(r, 500));
const okVisivel1 = await pg.$eval('#form-ok', el => !el.hidden);
!okVisivel1 ? ok('sem marcar a autorização, nada é enviado (LGPD)') : bad('enviou sem consentimento!');

// com consentimento
await pg.click('input[name=consente]');
await pg.click('#form-enviar');
await new Promise(r => setTimeout(r, 900));
const okVisivel2 = await pg.$eval('#form-ok', el => !el.hidden);
okVisivel2 ? ok('envio conclui e mostra a tela de sucesso') : bad('não concluiu o envio');

const fila = await pg.evaluate(() => JSON.parse(localStorage.getItem('vt_fila_apoio') || '[]'));
fila.length === 1 ? ok('sem banco, o cadastro cai na fila local (não se perde)')
                  : bad('fila local com ' + fila.length + ' item(ns)');
if (fila[0]) {
  (Array.isArray(fila[0].apoio) && fila[0].apoio.length === 0 && fila[0].consente_apoio === false)
    ? ok('nenhuma declaração de apoio sai do site') : bad('saiu declaração de apoio', JSON.stringify(fila[0].apoio));
  /texto que a pessoa LEU|Vilma Teixeira/.test(fila[0].texto_consent || '')
    ? ok('o texto da autorização que a pessoa leu vai junto (prova de consentimento)')
    : bad('sem o texto do consentimento', fila[0].texto_consent);
  !('cpf' in fila[0]) && !('titulo' in fila[0]) ? ok('nenhum CPF/título coletado') : bad('coletou documento!');
  fila[0].whatsapp === '12988887777' ? ok('WhatsApp normalizado (só dígitos)') : bad('whatsapp', fila[0].whatsapp);
}

// O botão de resgate depende de haver número de CAMPANHA. Sem número, ele tem
// que virar Instagram — e nunca cair no número do gabinete.
const nZap = await pg.evaluate(() => (window.VT_DADOS?.campanha?.whatsapp || '').replace(/\D/g, ''));
const gab = await pg.evaluate(() => (window.VT_DADOS?.campanha?.whatsappGabinete || '').replace(/\D/g, ''));
// getAttribute, nunca a.href: atributo vazio resolve para a URL da página e o teste passaria por engano
const resgate = await pg.$eval('#form-ok-wa', a => a.getAttribute('href') || '');
if (nZap) {
  resgate.includes('wa.me/' + nZap) && /Maria/.test(decodeURIComponent(resgate))
    ? ok('WhatsApp de resgate já vai com os dados preenchidos')
    : bad('link de resgate do WhatsApp', resgate.slice(0, 120));
} else {
  /instagram\.com/.test(resgate)
    ? ok('sem número de campanha, o resgate manda para o Instagram', resgate)
    : bad('resgate sem número de campanha', resgate.slice(0, 120));
}
const vazouGabinete = await pg.evaluate(g => !g ? false :
  document.documentElement.innerHTML.includes(g) ||
  [...document.querySelectorAll('a[href]')].some(a => (a.getAttribute('href') || '').includes(g)), gab);
!vazouGabinete
  ? ok('o WhatsApp do gabinete NÃO aparece em lugar nenhum do site')
  : bad('número do gabinete vazou para o site (é estrutura de mandato)');

// honeypot
await pg.click('#form-outro');
await new Promise(r => setTimeout(r, 400));
await pg.evaluate(() => {
  document.querySelector('input[name=nome]').value = 'Robo';
  document.querySelector('input[name=whatsapp]').value = '(12) 91111-1111';
  document.querySelector('select[name=bairro]').value = 'Centro';
  document.querySelector('input[name=apelido_site]').value = 'sou-um-robo';
  document.querySelector('input[name=consente]').checked = true;
  document.querySelector('.form__tela[data-tela="3"]').classList.add('on');
  document.querySelector('.form__tela[data-tela="1"]').classList.remove('on');
});
await pg.click('#form-enviar');
await new Promise(r => setTimeout(r, 700));
const filaDepois = await pg.evaluate(() => JSON.parse(localStorage.getItem('vt_fila_apoio') || '[]'));
filaDepois.length === 1 ? ok('honeypot barra o robô sem gravar nada')
                        : bad('robô entrou na fila', filaDepois.length);

/* ═════════════════════════════════════════════════════ 3 · AGENDA */
await irPara('agenda');
const ag = await pg.evaluate(() => ({
  vazioVisivel: !document.getElementById('agenda-vazio').hidden,
  titulo: document.querySelector('#agenda-vazio h3')?.textContent.trim(),
  cartoes: document.querySelectorAll('.ev').length,
}));
ag.vazioVisivel && ag.cartoes === 0
  ? ok('sem banco, agenda mostra estado honesto (nenhum evento falso)', ag.titulo)
  : bad('agenda inventou evento', JSON.stringify(ag));

/* ═════════════════════════════════════════════════ 4 · GERAL/A11Y */
const geral = await pg.evaluate(() => ({
  h1: document.querySelectorAll('h1').length,
  semAlt: [...document.images].filter(i => !i.alt && !i.getAttribute('aria-hidden')).length,
  overflowX: document.documentElement.scrollWidth - innerWidth,
  noindex: document.querySelector('meta[name=robots]')?.content || '',
  canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') || '',
  ogImagem: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
  rodapeResp: /Vilma Teixeira de Oliveira Santos/.test(document.querySelector('.rodape__legal')?.textContent || ''),
  mdb: /MDB/.test(document.querySelector('.rodape')?.textContent || ''),
  privacidade: Boolean(document.querySelector('a[href="privacidade.html"]')),
}));
geral.h1 === 1 ? ok('exatamente um <h1>') : bad('h1', geral.h1);
geral.semAlt === 0 ? ok('toda imagem tem alt') : bad('imagens sem alt', geral.semAlt);
geral.overflowX <= 0 ? ok('sem vazamento horizontal') : bad('overflowX', geral.overflowX);
geral.rodapeResp ? ok('rodapé identifica o responsável (art. 57-B)') : bad('rodapé sem identificação');
geral.privacidade ? ok('link de privacidade presente') : bad('sem link de privacidade');
geral.mdb ? ok('rodapé identifica o partido (MDB)') : bad('rodapé sem o partido');
/* O site tem DOIS estados legítimos — prévia e publicado — e a prova precisa
   medir em qual ele está, não supor um deles. Exigir `noindex` sempre fazia a
   bateria ficar vermelha no minuto seguinte à virada, bloqueando a Action
   justamente na publicação que a virada existe para fazer. O sinal de estado é
   o arquivo CNAME, que só existe depois de `node virar-dominio.mjs`. */
{
  const publicado = existsSync(join(RAIZ, 'CNAME'));
  if (publicado) {
    !/noindex/.test(geral.noindex)
      ? ok('publicado: sem noindex, o Google pode indexar')
      : bad('publicado mas ainda com noindex — o site fica invisível', geral.noindex);
    /^https?:\/\//.test(geral.canonical)
      ? ok('publicado: canonical absoluto', geral.canonical)
      : bad('publicado sem canonical absoluto', geral.canonical || '(vazio)');
    /* WhatsApp e Facebook descartam caminho relativo: o link vai sem card */
    /^https?:\/\//.test(geral.ogImagem)
      ? ok('publicado: og:image absoluta (o card aparece ao compartilhar)')
      : bad('og:image relativa — link compartilhado fica sem card', geral.ogImagem || '(vazio)');
  } else {
    /noindex/.test(geral.noindex)
      ? ok('prévia com noindex (ainda fora dos buscadores)')
      : bad('prévia SEM noindex — o Google pode indexar o rascunho', geral.noindex || '(vazio)');
  }
}

errosJS.length === 0 ? ok('zero erro de JavaScript') : bad('erros de JS', errosJS.join(' | ').slice(0, 300));

/* A bateria não pode escrever no banco da campanha. O que vale medir NÃO é o
   que o site acha que é (`VT_BANCO.ligado` fica true, porque o código traz a
   URL de produção): é se alguma chamada chegou mesmo à rede. Toda tentativa
   foi interceptada e abortada lá em cima — aqui só se confirma o número. */
{
  const tentou = pedidosBloqueados.filter(u => EH_SUPABASE.test(u));
  const chegou = respostasSupabase.length;
  chegou === 0
    ? ok('nenhuma chamada da bateria chegou ao Supabase de produção',
         tentou.length ? tentou.length + ' tentativa(s) barrada(s) na saída' : 'nem tentou')
    : bad('🔴 a bateria falou com o banco de verdade', chegou + ' resposta(s)');
}

/* ══════════════════════════════════════════════════════ RELATÓRIO */
const bons = provas.filter(p => p.ok).length;
console.log('\n═══ PROVAS ═══\n');
provas.forEach(p => console.log(` ${p.ok ? '✓' : '✗'} ${p.n}${p.d ? '  → ' + p.d : ''}`));
console.log(`\n${bons}/${provas.length} passaram` + (bons === provas.length ? '  🎉' : '  ⚠ VER ACIMA'));

await nav.close();
process.exitCode = bons === provas.length ? 0 : 1;
