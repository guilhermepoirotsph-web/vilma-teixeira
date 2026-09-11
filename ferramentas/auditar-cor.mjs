#!/usr/bin/env node
/* ============================================================================
   auditar-cor.mjs — le todo hex e rgb() do projeto, converte para HSL e lista
   o que estiver FORA da paleta (verde, amarelo e neutros).

   Existe porque trocar paleta no olho nao funciona: na primeira passada eu
   deixei o gerar-og.mjs inteiro na cor antiga, e o card do WhatsApp continuou
   azul e rosa sem ninguem ver. Cor tem que ser conferida por maquina.

   Uso: node ferramentas/auditar-cor.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = /\.(css|js|html|mjs)$/;
// o próprio auditor entra na lista de pulados: a exceção combinada lá embaixo
// tem os hexes escritos, e sem isto ele se acusa
const PULA = /node_modules|_site|\.git|index\.html$|auditar-cor/;

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function anda(dir, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (PULA.test(p)) continue;
    if (e.isDirectory()) anda(p, saida);
    else if (EXT.test(e.name)) saida.push(p);
  }
  return saida;
}

const achados = new Map();
for (const f of anda(RAIZ)) {
  const t = fs.readFileSync(f, 'utf8');
  const linhas = t.split('\n');
  linhas.forEach((linha, i) => {
    for (const m of linha.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
      const x = m[1];
      const c = hsl(parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16));
      registra('#' + x.toLowerCase(), c, f, i + 1, linha);
    }
    for (const m of linha.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      registra(`${r},${g},${b}`, hsl(r, g, b), f, i + 1, linha);
    }
  });
}

function registra(chave, c, f, ln, linha) {
  // cinza/preto/branco não tem hue que importe
  if (c.s < 12) return;
  const rotulo =
    c.h >= 255 && c.h < 345 ? 'ROXO/ROSA' :
    c.h >= 345 || c.h < 18  ? 'vermelho'  :
    c.h < 38                ? 'laranja'   :
    c.h < 70                ? 'amarelo'   :
    c.h < 170               ? 'verde'     :
    c.h < 255               ? 'AZUL/CIANO' : '?';
  if (rotulo === 'amarelo' || rotulo === 'verde') return;   // esses ficam
  const k = rotulo + ' ' + chave;
  if (!achados.has(k)) achados.set(k, { c, onde: [] });
  achados.get(k).onde.push(`${f}:${ln}`);
}

/* A única exceção combinada: o aviso de ERRO do painel é vermelho porque
   vermelho ali é SIGNIFICADO, não decoração. Se ele virasse verde junto com o
   resto, o aviso de falha ficaria da cor do botão de salvar. */
const COMBINADO = [['vermelho #e8112d', 'painel.css'], ['vermelho #b80d23', 'painel.css']];
for (const [k, v] of [...achados]) {
  if (COMBINADO.some(([c, f]) => k === c && v.onde.every(o => o.includes(f)))) achados.delete(k);
}

const ordem = ['ROXO/ROSA', 'AZUL/CIANO', 'vermelho', 'laranja'];
for (const rot of ordem) {
  const itens = [...achados].filter(([k]) => k.startsWith(rot));
  if (!itens.length) continue;
  console.log(`\n── ${rot} (${itens.length}) ──`);
  for (const [k, v] of itens.sort((a, b) => b[1].onde.length - a[1].onde.length)) {
    console.log(`  ${k.replace(rot + ' ', '').padEnd(14)} h${String(v.c.h).padStart(3)} s${v.c.s} l${v.c.l}  ×${v.onde.length}  ${v.onde.slice(0, 2).join(' ')}`);
  }
}

if (!achados.size)
  console.log(String.fromCharCode(10) + String.fromCharCode(10003) + " nada fora da paleta: so verde, amarelo e neutros.");
