#!/usr/bin/env node
/* ============================================================================
   montar-sql.mjs — junta as migrações na ordem certa num arquivo só.

   Colar quatro arquivos no SQL Editor é quatro chances de pular um ou trocar a
   ordem — e a ordem importa (03 depende de zap_e164, que nasce no 02). Uma
   colagem só elimina a classe inteira de erro.

   Uso: node banco/montar-sql.mjs      → gera banco/TUDO.sql
   ========================================================================== */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const ORDEM = ['schema.sql', '02-contato.sql', '03-blindagem.sql', '04-automacao.sql'];

const partes = [];
for (const arq of ORDEM) {
  const sql = await readFile(join(AQUI, arq), 'utf8');
  partes.push(
    `-- ${'═'.repeat(74)}\n` +
    `-- ▼▼▼  ${arq}\n` +
    `-- ${'═'.repeat(74)}\n\n${sql.trimEnd()}\n`);
}

const hoje = new Date().toISOString().slice(0, 10);
const cabeca =
`-- ============================================================================
--  VILMA TEIXEIRA — TODAS AS MIGRAÇÕES, NA ORDEM
--  GERADO por banco/montar-sql.mjs em ${hoje}. Não edite este arquivo:
--  edite os originais e rode o script de novo.
--
--  COMO USAR: Supabase → SQL Editor → cole tudo → Run. Uma vez só.
--  É idempotente: rodar de novo não quebra nada (a suíte prova isso rodando
--  cada arquivo DUAS vezes). Se você já rodou antes, pode colar de novo —
--  é exatamente o que precisa fazer quando uma policy muda.
--
--  DEPOIS DISTO, no painel do Supabase:
--   1. Authentication → Sign In/Providers → "Allow new users to sign up" OFF
--      (clicar em "Save changes" — o toggle não salva sozinho)
--   2. Dar papel a cada pessoa da equipe (elas já podem existir no Auth):
--        select public.promover('email-da-mariana@…','assessora');
--        select public.promover('email-do-lucas@…','social');
--        select public.promover('guilhermepoirotsph@gmail.com','admin');
--      Antes disso a conta NASCE INERTE e cai em "aguardando liberação".
--      Para tirar acesso depois: select public.revogar('email@…');
--   3. Database → Extensions → habilitar pg_cron, e então:
--        select cron.schedule('backup-diario','0 6 * * *',
--                             $$select public.gerar_backup()$$);
--   4. Settings → API → copiar URL e a chave publishable (anon) e colar em
--      assets/js/banco.js E painel/painel.js. NUNCA a service_role.
-- ============================================================================

`;

const saida = join(AQUI, 'TUDO.sql');
await writeFile(saida, cabeca + partes.join('\n\n'), 'utf8');

const { statSync } = await import('node:fs');
console.log('✓ banco/TUDO.sql —', (statSync(saida).size / 1024).toFixed(0) + ' KB,',
            ORDEM.length, 'migrações na ordem:', ORDEM.join(' → '));
