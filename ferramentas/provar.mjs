#!/usr/bin/env node
/* ============================================================================
   provar.mjs — E2E do site, como um eleitor usaria.
   Prova de verdade (não "deve funcionar"): urna, formulário, LGPD e agenda.
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
pg.on('request', r => {
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

await pg.goto(URL, { waitUntil: 'networkidle2' });
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
  (cta.dentro && cta.alto && /apoiar/i.test(cta.texto))
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

/* ══════════════════════════════════════════════════ 1 · URNA ELETRÔNICA */
await irPara('urna');
const tecla = async t => {
  await pg.click(`.tecla[data-t="${t}"]`);
  await new Promise(r => setTimeout(r, 90));
};
const acao = async a => {
  await pg.click(`[data-a="${a}"]`);
  await new Promise(r => setTimeout(r, 420));
};
const lcd = () => pg.evaluate(() => ({
  cargo: document.getElementById('lcd-cargo').textContent.trim(),
  passo: document.getElementById('lcd-passo').textContent.trim(),
  digitos: [...document.querySelectorAll('.lcd__cx')].map(c => c.textContent).join(''),
  nome: document.getElementById('lcd-nome').textContent.trim(),
  partido: document.getElementById('lcd-partido').textContent.trim(),
  fichaVisivel: !document.getElementById('lcd-ficha').hidden,
  avisoVisivel: !document.getElementById('lcd-aviso').hidden,
  aviso: document.getElementById('lcd-aviso').textContent.trim().slice(0, 60),
  fimVisivel: !document.getElementById('lcd-fim').hidden,
  fimTexto: document.getElementById('lcd-fim').textContent.trim().slice(0, 220),
}));

/* A nav é FIXA. Se a máquina não couber, a fileira de cima do teclado fica
   atrás dela e o clique vai para o cabeçalho — a tecla 1 chegou a cair em
   y=57 (09/09). Aqui o teste rola como o site rola (VT.irPara) e mede. */
{
  await pg.evaluate(() => window.VT.irPara('#urna-maquina'));
  await new Promise(r => setTimeout(r, 1200));
  const m = await pg.evaluate(() => {
    const nav = document.querySelector('.nav').getBoundingClientRect().height;
    const teclas = [...document.querySelectorAll('.tecla:not([disabled])')].map(t => {
      const r = t.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const alvo = document.elementFromPoint(cx, cy);
      return { rot: t.dataset.t || t.dataset.a, topo: Math.round(r.top),
               recebe: Boolean(alvo && (alvo === t || t.contains(alvo))) };
    });
    const maq = document.getElementById('urna-maquina').getBoundingClientRect();
    return { nav: Math.round(nav), alturaMaquina: Math.round(maq.height), alturaJanela: innerHeight,
             sobPorNav: teclas.filter(t => t.topo < nav).map(t => t.rot),
             semReceber: teclas.filter(t => !t.recebe).map(t => t.rot) };
  });
  m.sobPorNav.length === 0
    ? ok('nenhuma tecla da urna fica atrás da nav fixa')
    : bad('teclas escondidas atrás da nav', m.sobPorNav.join(','));
  m.semReceber.length === 0
    ? ok('toda tecla recebe o próprio clique', m.alturaMaquina + 'px de máquina em ' + m.alturaJanela + 'px de janela')
    : bad('tecla que não recebe o clique', m.semReceber.join(','));
}

let e = await lcd();
e.cargo === 'DEPUTADO FEDERAL' ? ok('urna abre no Deputado Federal') : bad('urna abre no cargo certo', e.cargo);
e.digitos === '' ? ok('urna começa vazia') : bad('urna começa vazia', e.digitos);

// número errado tem que ser recusado
for (const d of '9999') await tecla(d);
e = await lcd();
e.avisoVisivel ? ok('número não apoiado é recusado com aviso') : bad('número errado deveria avisar');
await acao('confirma');
e = await lcd();
e.cargo === 'DEPUTADO FEDERAL'
  ? ok('CONFIRMA não avança com número inválido')
  : bad('CONFIRMA avançou com número inválido!', e.cargo);

// corrige e vota certo
await acao('corrige');
e = await lcd();
e.digitos === '' ? ok('CORRIGE limpa os dígitos') : bad('CORRIGE não limpou', e.digitos);

for (const d of '2223') await tecla(d);
e = await lcd();
e.fichaVisivel && /Cezinha/.test(e.nome)
  ? ok('2223 mostra a ficha do Cezinha de Madureira', e.nome + ' · ' + e.partido)
  : bad('2223 não mostrou a ficha', JSON.stringify(e));
e.partido === 'PL' ? ok('partido do Cezinha correto (PL)') : bad('partido errado', e.partido);

await acao('confirma');
e = await lcd();
// o rótulo sai do cargo cadastrado ("Deputada Estadual" para a Regina),
// por isso aceita as duas formas
/^DEPUTAD[AO] ESTADUAL$/.test(e.cargo) && e.digitos === ''
  ? ok('passa para a 2ª fase com a tela limpa', e.cargo)
  : bad('não passou para a 2ª fase', JSON.stringify(e));

for (const d of '15115') await tecla(d);
e = await lcd();
e.fichaVisivel && /Regina/.test(e.nome)
  ? ok('15115 mostra a ficha da Regina Nunes', e.nome + ' · ' + e.partido)
  : bad('15115 não mostrou a ficha', JSON.stringify(e));

await acao('confirma');
await new Promise(r => setTimeout(r, 700));
e = await lcd();
e.fimVisivel ? ok('urna chega no FIM') : bad('urna não chegou no FIM');
/2223/.test(e.fimTexto) && /15115/.test(e.fimTexto)
  ? ok('resumo do FIM traz os dois votos')
  : bad('resumo incompleto', e.fimTexto);

// teclado físico
const temDenovo = await pg.$('.urna__denovo');
if (temDenovo) {
  await temDenovo.click();
  await new Promise(r => setTimeout(r, 350));
  await pg.keyboard.press('2'); await pg.keyboard.press('2');
  await new Promise(r => setTimeout(r, 200));
  e = await lcd();
  e.digitos === '22' ? ok('teclado físico digita na urna') : bad('teclado físico não digitou', e.digitos);
} else bad('botão "treinar de novo" não apareceu');

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

await pg.click('input[name=ajuda][value=divulgar]');
await pg.click('input[name=ajuda][value=panfletar]');
await pg.click('[data-ir="3"]');
await new Promise(r => setTimeout(r, 450));
tela = await pg.evaluate(() => document.querySelector('.form__tela.on')?.dataset.tela);
tela === '3' ? ok('passo 2 → 3') : bad('não avançou para o passo 3', tela);

// LGPD: consentimento específico só aparece ao marcar apoio
let sensivelEscondido = await pg.$eval('#aceite-sensivel', el => el.hidden);
sensivelEscondido ? ok('consentimento sensível nasce escondido') : bad('consentimento sensível já aparecia');

await pg.click('input[name=apoio][value="15115"]');
await new Promise(r => setTimeout(r, 250));
sensivelEscondido = await pg.$eval('#aceite-sensivel', el => el.hidden);
!sensivelEscondido
  ? ok('marcar apoio revela o consentimento específico (LGPD art. 11, I)')
  : bad('consentimento específico não apareceu');

// tenta enviar com apoio marcado e sem o consentimento específico
await pg.click('input[name=consente]');
await pg.click('#form-enviar');
await new Promise(r => setTimeout(r, 600));
const okVisivel1 = await pg.$eval('#form-ok', el => !el.hidden);
const erroTxt = await pg.$eval('#form-erro', el => el.hidden ? '' : el.textContent.trim());
!okVisivel1 && /consentimento/i.test(erroTxt)
  ? ok('sem consentimento específico o apoio NÃO é enviado')
  : bad('enviou dado sensível sem consentimento!', erroTxt || 'enviou');

// agora com o consentimento
await pg.click('#aceite-sensivel input');
await pg.click('#form-enviar');
await new Promise(r => setTimeout(r, 900));
const okVisivel2 = await pg.$eval('#form-ok', el => !el.hidden);
okVisivel2 ? ok('envio conclui e mostra a tela de sucesso') : bad('não concluiu o envio');

const fila = await pg.evaluate(() => JSON.parse(localStorage.getItem('vt_fila_apoio') || '[]'));
fila.length === 1 ? ok('sem banco, o cadastro cai na fila local (não se perde)')
                  : bad('fila local com ' + fila.length + ' item(ns)');
if (fila[0]) {
  fila[0].apoio?.includes('15115') ? ok('apoio consentido foi gravado') : bad('apoio não gravado');
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
  numerosOk: /15115/.test(document.body.textContent) && /2223/.test(document.body.textContent),
  privacidade: Boolean(document.querySelector('a[href="privacidade.html"]')),
}));
geral.h1 === 1 ? ok('exatamente um <h1>') : bad('h1', geral.h1);
geral.semAlt === 0 ? ok('toda imagem tem alt') : bad('imagens sem alt', geral.semAlt);
geral.overflowX <= 0 ? ok('sem vazamento horizontal') : bad('overflowX', geral.overflowX);
geral.rodapeResp ? ok('rodapé identifica o responsável (art. 57-B)') : bad('rodapé sem identificação');
geral.privacidade ? ok('link de privacidade presente') : bad('sem link de privacidade');
geral.numerosOk ? ok('números 15115 e 2223 na página') : bad('faltou número na página');
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
