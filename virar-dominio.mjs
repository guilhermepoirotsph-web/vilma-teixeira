/**
 * virar-dominio.mjs — troca o site de "prévia" para "produção no domínio próprio".
 *
 * Faz de uma vez o checklist que está comentado no topo de partes/_molde.html:
 *   1. tira a <meta name="robots" content="noindex,nofollow">
 *   2. ativa <link rel="canonical"> e <meta property="og:url">
 *   3. deixa og:image e twitter:image em URL ABSOLUTA
 *   4. acrescenta "url" ao JSON-LD da Person
 *   5. libera o robots.txt (mantendo /painel/ fora dos buscadores)
 *   6. gera o sitemap.xml
 *   7. escreve o arquivo CNAME (ver a ressalva abaixo)
 *   8. roda o montar.mjs (regenera o index.html)
 *
 *   node virar-dominio.mjs                     → www.vilmateixeira.com
 *   node virar-dominio.mjs vilmateixeira.com   → outro domínio
 *   node virar-dominio.mjs --reverter          → volta para prévia (noindex)
 *
 * ⚠ O ARQUIVO CNAME NÃO É O QUE AMARRA O DOMÍNIO — não neste projeto.
 * Isso vale para o Pages publicando direto de uma branch. Aqui a publicação é
 * por GitHub Actions, e a documentação do GitHub é explícita: "If you are
 * publishing from a custom GitHub Actions workflow, no CNAME file is created,
 * and any existing CNAME file is ignored and is not required."
 * Quem amarra é **Settings → Pages → Custom domain**. O arquivo continua sendo
 * escrito porque não atrapalha e documenta a intenção — mas não substitui o
 * clique.
 *
 * ⚠ ORDEM CERTA (a documentação do GitHub inverte o que parece intuitivo):
 *   1º  Settings → Pages → Source = "GitHub Actions" e Custom domain preenchido
 *   2º  DNS na Locaweb (A no apex + CNAME do www)
 *   3º  este script, quando o domínio já responder
 *   4º  Settings → Pages → "Enforce HTTPS" (o certificado leva alguns minutos)
 * Colocar o DNS antes de reivindicar o domínio no GitHub abre uma janela em
 * que outra pessoa pode hospedar um site nesse subdomínio — é o próprio GitHub
 * que avisa: "Configuring your custom domain with the DNS provider without
 * adding it to GitHub could result in someone else being able to host a site
 * on one of your subdomains."
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = import.meta.dirname;
const MOLDE = path.join(RAIZ, 'partes', '_molde.html');
const PADRAO = 'www.vilmateixeira.com';
const args = process.argv.slice(2);
const REVERTER = args.includes('--reverter');
const DOMINIO = (args.find(a => !a.startsWith('--')) || PADRAO)
  .replace(/^https?:\/\//, '').replace(/\/$/, '');
const BASE = `https://${DOMINIO}`;

const feito = [];
const ler = p => fs.readFileSync(p, 'utf8');
const gravar = (p, s) => fs.writeFileSync(p, s, 'utf8');

/* o painel nunca entra em buscador: é tela de trabalho da equipe, e um índice
   do Google nele é convite para tentativa de login de estranho */
const robotsPublicado = base =>
  `User-agent: *\nAllow: /\nDisallow: /painel/\n\nSitemap: ${base}/sitemap.xml\n`;
/* o de prévia repete o de produção em comentário: quem abrir o arquivo entende
   o que muda na virada sem precisar achar este script */
const robotsPrevia =
  `# PRÉVIA — o site ainda não está no domínio definitivo.\n` +
  `# Na virada para vilmateixeira.com (registrado na Locaweb), trocar por:\n#\n` +
  robotsPublicado(`https://${PADRAO}`).trimEnd()
    .split('\n').map(l => (l ? '#   ' + l : '#')).join('\n') +
  `\n#\nUser-agent: *\nDisallow: /\n`;

const CHECKLIST =
`<!-- ============ CHECKLIST DE PUBLICAÇÃO (tudo isto ao subir no domínio) ============
     1. apagar a <meta name="robots" content="noindex,nofollow"> abaixo
     2. ativar o <link rel="canonical"> e a <meta property="og:url">
     3. og:image e twitter:image precisam de URL ABSOLUTA — WhatsApp, Facebook e
        Google não aceitam caminho relativo (o card de compartilhamento não aparece)
     4. robots.txt: trocar "Disallow: /" por "Allow: /", mantendo /painel/ fora
     Atalho: node virar-dominio.mjs   faz os quatro de uma vez.
     ============================================================================== -->
<meta name="robots" content="noindex,nofollow">
<!-- <link rel="canonical" href="https://${PADRAO}/"> ← ativar com o domínio definitivo -->`;

/* ---------------------------------------------------------------- reverter */
if (REVERTER) {
  let m = ler(MOLDE);
  /* o bloco "Publicado em …" + canonical volta a ser o checklist + noindex,
     numa substituição só — assim as linhas voltam na ORDEM original e o
     ciclo virar→reverter não deixa diff cosmético no git */
  m = m.replace(/<!-- Publicado em [\s\S]*?--reverter -->\n<link rel="canonical"[^>]*>/, CHECKLIST);
  m = m.replace(/^<link rel="canonical"[^>]*>$/m,
    `<!-- <link rel="canonical" href="https://${PADRAO}/"> ← ativar com o domínio definitivo -->`);
  m = m.replace(/^<meta property="og:url"[^>]*>$/m,
    `<!-- <meta property="og:url" content="https://${PADRAO}/"> -->`);
  m = m.replace(/(<meta property="og:image" content=")https?:\/\/[^/]+\//, '$1');
  m = m.replace(/(<meta name="twitter:image" content=")https?:\/\/[^/]+\//, '$1');
  m = m.replace(/\n\s*"url":\s*"[^"]*",/, '');
  if (!/name="robots"/.test(m)) {   // rede: se o casamento acima falhar
    m = m.replace('<meta property="og:type"',
      '<meta name="robots" content="noindex,nofollow">\n<meta property="og:type"');
  }
  gravar(MOLDE, m);
  gravar(path.join(RAIZ, 'robots.txt'), robotsPrevia);
  for (const f of ['CNAME', 'sitemap.xml']) {
    const alvo = path.join(RAIZ, f);
    if (fs.existsSync(alvo)) { fs.unlinkSync(alvo); feito.push(`apagado ${f}`); }
  }
  feito.push('molde de volta para prévia (noindex, tags relativas)',
             'robots.txt bloqueando tudo');
  execFileSync('node', [path.join(RAIZ, 'montar.mjs')], { stdio: 'inherit' });
  console.log('\n↩  Revertido para prévia:\n   ' + feito.join('\n   '));
  process.exit(0);
}

/* ------------------------------------------------------------------ virada */
let m = ler(MOLDE);

// 1. tira o noindex e o checklist já cumprido
const antesRobots = m;
m = m.replace(/\s*<meta name="robots" content="noindex,nofollow">\s*\n/, '\n');
if (m !== antesRobots) feito.push('noindex removido');

// 2. canonical e og:url
if (/<!-- <link rel="canonical"/.test(m)) {
  m = m.replace(/<!-- <link rel="canonical"[^>]*?> ← ativar com o domínio definitivo -->/,
    `<link rel="canonical" href="${BASE}/">`);
  feito.push('canonical ativado');
} else {
  m = m.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${BASE}/">`);
}
if (/<!-- <meta property="og:url"/.test(m)) {
  m = m.replace(/<!-- <meta property="og:url"[^>]*?> -->/,
    `<meta property="og:url" content="${BASE}/">`);
  feito.push('og:url ativado');
} else {
  m = m.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${BASE}/">`);
}

// 3. imagens em URL absoluta — sem isto o card de compartilhamento não aparece
const absoluto = (s, re) => s.replace(re, (_t, ini, caminho) =>
  `${ini}${BASE}/${caminho.replace(/^https?:\/\/[^/]+\//, '')}"`);
m = absoluto(m, /(<meta property="og:image" content=")([^"]+)"/);
m = absoluto(m, /(<meta name="twitter:image" content=")([^"]+)"/);
feito.push('og:image e twitter:image em URL absoluta');

// 4. "url" no JSON-LD (liga a ficha da pessoa ao site, no Google)
if (!/"url":\s*"https/.test(m)) {
  m = m.replace(/("@type"\s*:\s*"Person",)/, `$1\n  "url":"${BASE}/",`);
  feito.push('"url" adicionada ao JSON-LD');
} else {
  m = m.replace(/"url":\s*"https?:\/\/[^"]*"/, `"url":"${BASE}/"`);
}

// 5. o checklist virou histórico
m = m.replace(/<!-- ============ CHECKLIST DE PUBLICAÇÃO[\s\S]*?============================================================================== -->/,
  `<!-- Publicado em ${BASE}/ — virada feita por virar-dominio.mjs.
     Para voltar a ser prévia (noindex, sem CNAME): node virar-dominio.mjs --reverter -->`);

gravar(MOLDE, m);

// 6. CNAME — documenta a intenção; quem amarra é Settings → Pages (ver o topo)
gravar(path.join(RAIZ, 'CNAME'), DOMINIO + '\n');
feito.push(`CNAME escrito (${DOMINIO}) — lembrando: com Actions ele é ignorado`);

// 7. robots.txt liberado, /painel/ fora
gravar(path.join(RAIZ, 'robots.txt'), robotsPublicado(BASE));
feito.push('robots.txt liberado (com /painel/ bloqueado)');

// 8. sitemap: a home e a política de privacidade (as duas páginas indexáveis)
const hoje = new Date().toISOString().slice(0, 10);
const url = (loc, prio, freq) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${hoje}</lastmod>\n` +
  `    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
gravar(path.join(RAIZ, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  url(`${BASE}/`, '1.0', 'weekly') + '\n' +
  url(`${BASE}/privacidade.html`, '0.3', 'yearly') + '\n</urlset>\n');
feito.push('sitemap.xml gerado (home + privacidade)');

// 9. regenera o index.html
execFileSync('node', [path.join(RAIZ, 'montar.mjs')], { stdio: 'inherit' });

console.log(`\n✓ Site preparado para ${BASE}/\n   ` + feito.join('\n   '));
console.log('\nAgora:  git add -A && git commit -m "virada para o domínio" && git push');
console.log('Depois, no GitHub → Settings → Pages:');
console.log('   · Source = "GitHub Actions"');
console.log(`   · Custom domain = ${DOMINIO}`);
console.log('   · "Enforce HTTPS" quando o certificado sair (leva alguns minutos)');
console.log('\nDNS na Locaweb — apex em A, www em CNAME:');
console.log('   @    A      185.199.108.153 · 185.199.109.153 · 185.199.110.153 · 185.199.111.153');
console.log('   www  CNAME  guilhermepoirotsph-web.github.io.   (com o ponto no fim)');
