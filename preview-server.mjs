#!/usr/bin/env node
/* preview-server.mjs — servidor estático local para conferir o site.
   Uso: node preview-server.mjs [porta]      (padrão 8803)
   Não vai para produção; é só para desenvolvimento e para a prévia via cloudflared. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.argv[2]) || 8803;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

// arquivos que nunca devem ser servidos numa prévia pública
const BLOQUEADOS = /(\.md$|\.ps1$|^\/docs\/|^\/banco\/|^\/partes\/|^\/node_modules\/|montar\.mjs|preview-server\.mjs)/i;

createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (BLOQUEADOS.test(caminho)) { res.writeHead(403).end('403'); return; }
    if (caminho.endsWith('/')) caminho += 'index.html';

    const arquivo = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end('403'); return; }

    const s = await stat(arquivo).catch(() => null);
    const alvo = s?.isDirectory() ? join(arquivo, 'index.html') : arquivo;
    const dados = await readFile(alvo);

    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
       .end('<h1 style="font:600 20px system-ui;padding:40px">404 — não encontrado</h1>');
  }
}).listen(PORTA, () => console.log('▸ prévia em http://localhost:' + PORTA));
