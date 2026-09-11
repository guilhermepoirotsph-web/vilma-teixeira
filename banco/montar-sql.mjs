#!/usr/bin/env node
/* ============================================================================
   montar-sql.mjs — junta as migrações na ordem certa num arquivo só.

   Colar seis arquivos no SQL Editor é seis chances de pular um ou trocar a
   ordem — e a ordem importa (03 depende de zap_e164, que nasce no 02; 05
   fecha o privilégio do que veio antes; 06 conta com o 05 já ter rodado).
   Uma colagem só elimina a classe inteira de erro.

   Também é a FONTE ÚNICA da ordem: as baterias e o supabase-falso importam
   ORDEM daqui. Lista duplicada é lista que diverge, e arquivo que sai da
   bateria sem ninguém notar é exatamente como os furos de privilégio
   sobreviveram.

   Uso: node banco/montar-sql.mjs      → gera banco/TUDO.sql
   ========================================================================== */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

export const ORDEM = [
  'schema.sql',          // estrutura, RLS, funções de papel
  '02-contato.sql',      // opt-out, lista de contato, backup
  '03-blindagem.sql',    // trava de coluna: ninguém se autopromove
  '04-automacao.sql',    // log, resumo do dia, papel n8n_bot
  '05-privilegios.sql',  // fecha EXECUTE em PUBLIC e escrita nas views
  '06-agenda-bot.sql',   // a agenda pelo chat: identidade, código, limites
  '07-entrada-chat.sql', // porta de entrada: equipe, SAIR, boas-vindas, ignorar
  '08-fotos.sql',        // balde do Storage: o social media sobe foto pelo painel
];

export async function montar() {
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
--  É idempotente: colar de novo não quebra nada — provado das duas maneiras
--  que importam, rodando tudo DUAS vezes num Postgres limpo e também com o
--  dono de auth.users sendo outro papel, que é a situação real do Supabase.
--
--  ⚠ O SQL Editor PARA NO PRIMEIRO ERRO e não avisa o que ficou para trás.
--  Se aparecer vermelho, corrija e cole tudo de novo: senão a blindagem e os
--  privilégios não rodam, e o banco fica aberto com cara de pronto.
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
--   3. Ligar o telefone de quem vai mandar na agenda pelo chat. Sem isto o
--      agente responde "nao_autorizado" para todo mundo — que é o estado
--      certo para começar:
--        select public.vincular_zap('email-da-mariana@…','12988887777');
--   4. Database → Extensions → habilitar pg_cron, e então:
--        select cron.schedule('backup-diario','0 6 * * *',
--                             $$select public.gerar_backup()$$);
--   5. Settings → API → copiar URL e a chave publishable (anon) e colar em
--      assets/js/banco.js E painel/painel.js. NUNCA a service_role.
-- ============================================================================

`;

  const saida = join(AQUI, 'TUDO.sql');
  await writeFile(saida, cabeca + partes.join('\n\n'), 'utf8');
  return saida;
}

/* só gera quando chamado direto: quem importa ORDEM não quer efeito colateral */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const saida = await montar();
  const { statSync } = await import('node:fs');
  console.log('✓ banco/TUDO.sql —', (statSync(saida).size / 1024).toFixed(0) + ' KB,',
              ORDEM.length, 'migrações na ordem:', ORDEM.join(' → '));
}
