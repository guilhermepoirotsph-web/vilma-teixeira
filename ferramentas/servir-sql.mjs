#!/usr/bin/env node
/* ============================================================================
   servir-sql.mjs — serve banco/TUDO.sql em http://localhost:8811 com CORS,
   para o SQL Editor do Supabase buscar o arquivo em vez de alguém colar 55 mil
   caracteres à mão (ou eu despejá-los numa chamada de ferramenta).

   O Chrome trata http://localhost como origem confiável, então a página HTTPS
   do Supabase consegue fazer fetch aqui sem cair no bloqueio de conteúdo misto.

   É ferramenta de operação, roda por alguns minutos e morre. Nunca vai ao ar.
   Uso: node ferramentas/servir-sql.mjs [porta]        (padrão 8811)
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.argv[2]) || 8811;

/* Só estes arquivos, e só leitura: um servidor aberto na máquina dele não vai
   virar um caminho para ler o disco inteiro por causa de um `..` na URL. */
const PERMITIDOS = new Map([
  ['/TUDO.sql',   join(RAIZ, 'banco', 'TUDO.sql')],
  ['/schema.sql', join(RAIZ, 'banco', 'schema.sql')],
]);

createServer(async (req, res) => {
  const cabecalhos = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cabecalhos); return res.end(); }

  const alvo = PERMITIDOS.get(req.url.split('?')[0]);
  if (!alvo) { res.writeHead(404, cabecalhos); return res.end('não servido aqui'); }

  try {
    const conteudo = await readFile(alvo, 'utf8');
    res.writeHead(200, cabecalhos);
    res.end(conteudo);
    console.log(`  → ${basename(alvo)} entregue (${(conteudo.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    res.writeHead(500, cabecalhos);
    res.end(String(e.message));
  }
}).listen(PORTA, () => {
  console.log(`▸ SQL servido em http://localhost:${PORTA}/TUDO.sql`);
  console.log('  Ctrl+C para encerrar quando terminar.');
});
