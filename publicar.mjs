#!/usr/bin/env node
/* ============================================================================
   publicar.mjs — monta a pasta `_site/`, que é EXATAMENTE o que vai ao ar.

   O repositório guarda tudo (schema, provas, ferramentas, documentação).
   A hospedagem recebe só o que o navegador precisa. Sem esta separação,
   publicar o repositório inteiro deixaria `banco/schema.sql` e `docs/DADOS.md`
   acessíveis por URL — as regras de segurança e a fonte de dados do site
   servidas como arquivo estático.

   Uso:  node publicar.mjs            → gera _site/
         node publicar.mjs --listar   → só mostra o que entraria
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = import.meta.dirname;
const SAIDA = path.join(RAIZ, '_site');
const LISTAR = process.argv.includes('--listar');

/* ---------------------------------------------------------------- o que vai */
const ARQUIVOS = ['index.html', 'privacidade.html', 'robots.txt', 'sitemap.xml', 'CNAME'];
const PASTAS = ['assets', 'painel', 'vendor', 'fotos', 'midia', 'marca', '.well-known'];

/* o que NUNCA vai, mesmo estando dentro de uma pasta publicada:
   · `_qualquer-coisa` é convenção da casa para material de referência interna
     (a página copiada da Câmara, o retrato oficial que não pode ir ao ar)
   · config.local.js aponta para o banco de teste
   · .md dentro de pasta publicada é documentação, não conteúdo */
const NAO = [
  /(^|[\\/])_[^\\/]*$/,        // fotos/_referencia-vilma-camara.jpg
  /config\.local\.js$/,
  /\.map$/,
  /\.md$/i,
  /(^|[\\/])\.DS_Store$/,
];
const proibido = rel => NAO.some(re => re.test(rel));

/* ------------------------------------------------------------------ montar */
if (!LISTAR) {
  execFileSync('node', [path.join(RAIZ, 'montar.mjs')], { stdio: 'inherit' });
  fs.rmSync(SAIDA, { recursive: true, force: true });
  fs.mkdirSync(SAIDA, { recursive: true });
}

let n = 0, bytes = 0;
const incluidos = [];

function copiar(rel) {
  const de = path.join(RAIZ, rel);
  if (!fs.existsSync(de)) return;
  const st = fs.statSync(de);
  if (st.isDirectory()) {
    for (const filho of fs.readdirSync(de)) copiar(path.join(rel, filho));
    return;
  }
  if (proibido(rel)) return;
  n++; bytes += st.size; incluidos.push(rel);
  if (LISTAR) return;
  const para = path.join(SAIDA, rel);
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.copyFileSync(de, para);
}

for (const a of ARQUIVOS) copiar(a);
for (const p of PASTAS) copiar(p);

/* -------------------------------------------------- rede de segurança final */
/* Se um segredo escapar para dentro de _site/, ele vai para a web. Este teste
   roda em toda publicação, inclusive na Action: é a última porta antes do ar. */
/* Procura a CHAVE, não a palavra: os dois arquivos do front trazem o comentário
   "nunca service_role aqui", e um detector ingênuo barraria justo o aviso que
   existe para impedir o problema. */
const SUSPEITO = [
  { re: /\bsb_secret_[A-Za-z0-9_-]{10,}/,         o: 'chave secreta do Supabase (sb_secret_)' },
  { re: /\bsk-[A-Za-z0-9]{20,}/,                  o: 'chave de API (sk-)' },
  { re: /\bghp_[A-Za-z0-9]{30,}/,                 o: 'token do GitHub' },
  { re: /postgres(ql)?:\/\/[^\s"']+:[^\s"'@]+@/i, o: 'connection string com senha' },
  { re: /\bEAA[A-Za-z0-9]{80,}/,                  o: 'token da Meta/WhatsApp' },
];
const TEXTO = /\.(html?|js|mjs|css|json|txt|xml|svg|webmanifest)$/i;
const achados = [];

/* JWT do Supabase: o que decide é o PAPEL dentro do payload.
   anon/publishable pode ir ao ar; service_role, nunca. */
const jwtPerigoso = txt => {
  for (const [, payload] of txt.matchAll(/\beyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{20,})\./g)) {
    try {
      const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (p.role && p.role !== 'anon') return p.role;
    } catch { /* não era JWT legível — segue */ }
  }
  return null;
};

for (const rel of incluidos) {
  if (!TEXTO.test(rel)) continue;
  const conteudo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  for (const s of SUSPEITO) if (s.re.test(conteudo)) achados.push(`${rel} → ${s.o}`);
  const papel = jwtPerigoso(conteudo);
  if (papel) achados.push(`${rel} → JWT do Supabase com papel "${papel}" (só anon pode ir ao ar)`);
}

console.log(LISTAR ? '\nEntrariam em _site/:' : `\n✓ _site/ montado`);
console.log(`  ${n} arquivos · ${(bytes / 1024 / 1024).toFixed(2)} MB`);
const porPasta = {};
for (const rel of incluidos) {
  const k = rel.includes(path.sep) ? rel.split(path.sep)[0] : '(raiz)';
  porPasta[k] = (porPasta[k] || 0) + 1;
}
for (const [k, v] of Object.entries(porPasta).sort()) console.log(`    ${String(v).padStart(4)}  ${k}`);

if (achados.length) {
  console.error('\n✗ SEGREDO NO QUE IRIA AO AR — publicação abortada:');
  achados.forEach(a => console.error('  ' + a));
  process.exit(1);
}
console.log('\n✓ nenhum segredo no material publicável');
