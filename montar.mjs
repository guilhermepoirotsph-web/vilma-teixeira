#!/usr/bin/env node
/* ============================================================================
   montar.mjs — junta partes/_molde.html + partes/NN-*.html  →  index.html
   Uso:  node montar.mjs
   Padrão da casa (vitrine estática sem build): editar as PARTES, nunca o
   index.html gerado.
   ========================================================================== */
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const dirPartes = join(raiz, 'partes');

const existe = async p => { try { await access(p); return true; } catch { return false; } };

const arquivos = (await readdir(dirPartes))
  .filter(f => /^\d\d-.+\.html$/.test(f))
  .sort();

if (!arquivos.length) {
  console.error('✗ Nenhuma parte encontrada em partes/');
  process.exitCode = 1;
} else {
  const molde = await readFile(join(dirPartes, '_molde.html'), 'utf8');

  const blocos = [];
  const scripts = [];

  for (const f of arquivos) {
    const html = await readFile(join(dirPartes, f), 'utf8');
    blocos.push(`\n<!-- ============ ${f} ============ -->\n` + html.trimEnd());

    // se existe assets/js/secoes/<mesmo-nome>.js, entra no rodapé
    const nome = f.replace(/^\d\d-/, '').replace(/\.html$/, '');
    const js = join(raiz, 'assets', 'js', 'secoes', nome + '.js');
    // defer aqui também: é tudo ou nada. Se o vendor for deferido e as seções
    // não, elas rodam antes do gsap existir e todo .revelar fica invisível.
    if (await existe(js)) scripts.push(`<script defer src="assets/js/secoes/${nome}.js"></script>`);
  }

  let saida = molde
    .replace('<!--SECOES-->', blocos.join('\n'))
    .replace('<!--SCRIPTS-->', scripts.join('\n'));

  await writeFile(join(raiz, 'index.html'), saida, 'utf8');

  // ---------------------------------------------------------- conferências
  const avisos = [];
  const h1 = (saida.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) avisos.push(`há ${h1} <h1> na página (o certo é 1)`);

  const ids = [...saida.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) avisos.push('ids repetidos: ' + [...new Set(dup)].join(', '));

  for (const href of [...saida.matchAll(/href="#([^"]+)"/g)].map(m => m[1])) {
    if (href && !ids.includes(href)) avisos.push(`âncora #${href} não existe`);
  }

  const kb = Math.round(Buffer.byteLength(saida) / 1024);
  console.log(`✓ index.html montado — ${arquivos.length} seções, ${scripts.length} scripts, ${kb} KB`);
  arquivos.forEach(f => console.log('  · ' + f));
  if (avisos.length) {
    console.log('\n⚠ conferir:');
    [...new Set(avisos)].forEach(a => console.log('  ! ' + a));
  }
}
