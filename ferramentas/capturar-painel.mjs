#!/usr/bin/env node
/* capturar-painel.mjs — enche o banco de teste e fotografa as telas dos dois
   painéis, para conferir o visual sem precisar de login de verdade.
   Antes: node ferramentas/supabase-falso.mjs
   Uso:   node ferramentas/capturar-painel.mjs                */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPS = join(RAIZ, 'caps');
const SITE = 'http://localhost:8803';
const API = 'http://localhost:8810';
const CHAVE = 'chave-publishable-de-teste';
// CHROME_PATH deixa a mesma bateria rodar no Linux do GitHub Actions
const CHROME = [process.env.CHROME_PATH,
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
               ].filter(Boolean).find(existsSync);
const dorme = ms => new Promise(r => setTimeout(r, ms));
await mkdir(CAPS, { recursive: true });

/* --------------------------------- semeia dados bonitos direto pela API */
await fetch(API + '/reset', { method: 'POST', headers: { apikey: CHAVE } });
const tok = await (await fetch(API + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'guilherme@gdstudiox.com.br', password: 'teste1234' }),
})).json();

const post = (tabela, dado) => fetch(API + '/rest/v1/' + tabela, {
  method: 'POST',
  headers: { apikey: CHAVE, Authorization: 'Bearer ' + tok.access_token,
             'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify(dado),
});

const dia = (n, h, m = 0) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0);
  return d.toISOString();
};

for (const e of [
  { titulo: 'Caminhada no Centro', tipo: 'caminhada', inicio: dia(1, 9), local: 'Praça Dr. Cândido Motta', bairro: 'Centro', publicado: true, destaque: true },
  { titulo: 'Reunião de bairro no Massaguaçu', tipo: 'reuniao', inicio: dia(2, 19), local: 'Salão da igreja', bairro: 'Massaguaçu', publicado: true },
  { titulo: 'Visita à UBS do Perequê-Mirim', tipo: 'visita', inicio: dia(4, 14, 30), local: 'UBS', bairro: 'Perequê-Mirim', publicado: true },
  { titulo: 'Live com a Regina Nunes', tipo: 'live', inicio: dia(6, 20), local: 'Instagram @vereadoravilma', publicado: true },
  { titulo: 'Comício de encerramento', tipo: 'comicio', inicio: dia(9, 18), local: 'Praça da Cultura', bairro: 'Centro', publicado: true, destaque: true },
  { titulo: 'Alinhamento interno da equipe', tipo: 'reuniao', inicio: dia(3, 8), local: 'Gabinete', interno: true },
  { titulo: 'Panfletagem no Travessão', tipo: 'caminhada', inicio: dia(7, 8), bairro: 'Travessão', publicado: false },
]) await post('eventos', e);

for (const a of [
  { nome: 'Joana Ribeiro dos Santos', whatsapp: '12977778888', bairro: 'Massaguaçu', ajuda: ['panfletar', 'divulgar'], apoio: ['15115', '2223'], consente: true, consente_apoio: true, status: 'novo' },
  { nome: 'Carlos Eduardo Prado', whatsapp: '12988776655', bairro: 'Centro', email: 'carlos@exemplo.com', ajuda: ['adesivo'], apoio: ['2223'], consente: true, consente_apoio: true, status: 'contatado' },
  { nome: 'Marlene Souza Lima', whatsapp: '12996655443', bairro: 'Perequê-Mirim', ajuda: ['reuniao', 'levar'], consente: true, status: 'engajado', recado: 'A UBS do bairro precisa de mais médico à tarde.' },
  { nome: 'Antônio Ferreira', whatsapp: '12981112233', bairro: 'Travessão', ajuda: ['acompanhar'], consente: true, status: 'novo' },
  { nome: 'Rita de Cássia Alves', whatsapp: '12994443322', bairro: 'Sumaré', ajuda: ['evento', 'panfletar'], apoio: ['15115'], consente: true, consente_apoio: true, status: 'voluntario' },
]) await post('apoiadores', a);

for (const c of [
  { titulo: 'Reel da caminhada no Centro', formato: 'reel', status: 'ideia', responsavel: 'Lucas' },
  { titulo: 'Carrossel: 141 proposições', formato: 'carrossel', status: 'roteiro', responsavel: 'Lucas', data_prevista: dia(2, 10) },
  { titulo: 'Story do bastidor da reunião', formato: 'story', status: 'producao', responsavel: 'Vilma' },
  { titulo: 'Vídeo apoio à Regina 15115', formato: 'reel', status: 'aprovacao', responsavel: 'Lucas', data_prevista: dia(3, 18) },
  { titulo: 'Post do comício', formato: 'foto', status: 'agendado', responsavel: 'Lucas', data_prevista: dia(9, 21) },
  { titulo: 'Live com o Cezinha 2223', formato: 'live', status: 'publicado', responsavel: 'Vilma' },
]) await post('conteudos', c);

/* ------------------------------------------------------------ fotografa */
const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 1440, height: 900 },
});

async function comoUsuario(email, telas) {
  const pg = await nav.newPage();
  await pg.evaluateOnNewDocument((url, chave) => { window.VT_CONFIG = { url, chave }; }, API, CHAVE);
  await pg.goto(SITE + '/painel/', { waitUntil: 'networkidle2' });
  await pg.evaluate(() => { try { localStorage.clear(); } catch {} });
  await pg.reload({ waitUntil: 'networkidle2' });
  await pg.evaluate(m => {
    document.querySelector('input[name=email]').value = m;
    document.querySelector('input[name=senha]').value = 'teste1234';
    document.getElementById('btn-entrar').click();
  }, email);
  await dorme(2000);
  for (const [rota, nome] of telas) {
    await pg.goto(SITE + '/painel/#' + rota, { waitUntil: 'networkidle2' });
    await dorme(1500);
    await pg.screenshot({ path: join(CAPS, 'painel-' + nome + '.png') });
    console.log('  ✓ ' + nome);
  }
  await pg.close();
}

console.log('\n▸ painel da assessoria (Mariana)');
await comoUsuario('mariana@vilmateixeira.com.br',
  [['agenda', 'agenda'], ['apoiadores', 'apoiadores'], ['ajuda', 'ajuda-mariana']]);

console.log('\n▸ painel do social media');
await comoUsuario('lucas@vilmateixeira.com.br',
  [['conteudo', 'conteudo'], ['site', 'site']]);

console.log('\n▸ site público com a agenda cheia');
{
  const pg = await nav.newPage();
  await pg.evaluateOnNewDocument((url, chave) => { window.VT_CONFIG = { url, chave }; }, API, CHAVE);
  await pg.goto(SITE + '/', { waitUntil: 'networkidle2' });
  await dorme(3000);
  await pg.evaluate(() => {
    const el = document.getElementById('agenda');
    const y = el.getBoundingClientRect().top + scrollY - 10;
    if (window.VT?.lenis) window.VT.lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y);
    window.ScrollTrigger?.update();
  });
  await dorme(1800);
  await pg.screenshot({ path: join(CAPS, 'site-agenda-cheia.png') });
  console.log('  ✓ site-agenda-cheia');
  await pg.close();
}

await nav.close();
console.log('\n✓ capturas em caps/');
