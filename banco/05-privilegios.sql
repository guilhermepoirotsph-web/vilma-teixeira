-- ============================================================================
--  VILMA TEIXEIRA — 05 · PRIVILÉGIOS (fecha o que GRANT/REVOKE deixou aberto)
--  Rodar DEPOIS de 04-automacao.sql. Idempotente.
--
--  DOIS VAZAMENTOS REAIS, MEDIDOS NO BANCO DE PRODUÇÃO EM 10/09/2026.
--  As 98 provas passavam verdes com os dois dentro, porque o harness de teste
--  cria os papéis do zero e não reproduz os DEFAULT PRIVILEGES do Supabase.
--
--  ── 1 · REVOKE ... FROM anon NÃO TIRA O QUE VEIO DE PUBLIC ────────────────
--  Toda função nasce com EXECUTE para PUBLIC, e `anon` é membro de PUBLIC.
--  Revogar de anon não desfaz o que foi herdado. Então isto, do 04:
--      revoke execute on function public.resumo_do_dia(int) from anon;
--  não fazia nada. Medido contra o projeto real, com a chave publishable:
--      POST /rest/v1/rpc/resumo_do_dia   → 200, devolve a agenda INTERNA e
--                                          nome, telefone e recado dos apoiadores
--      POST /rest/v1/rpc/marcar_contato  → 200 {"atualizados":1|0} — o oráculo
--                                          de base que registrar_apoio e
--                                          descadastrar foram desenhadas para
--                                          NÃO ser
--      POST /rest/v1/rpc/registrar_log   → 200, gravou a linha 1: escrita no
--                                          banco sem autenticação nenhuma
--  A regra que fica: **sempre `revoke ... from public`**, e só depois conceder
--  a quem precisa. Revogar de anon é remendo que parece funcionar.
--
--  ── 2 · GRANT SELECT NUMA VIEW NÃO IMPEDE ESCRITA ─────────────────────────
--  O default privilege do Supabase já concede ALL nas views novas para
--  `authenticated`, e GRANT só SOMA — o `grant select` do schema não retira
--  nada. Pior: view simples sem `security_invoker` é auto-atualizável e a
--  escrita roda como o DONO, furando a RLS. Ou seja, o social media e até uma
--  conta inerte podiam **editar e APAGAR** a agenda pública e os textos do
--  site pelas views, sem passar por policy nenhuma.
-- ============================================================================


-- ══════════ 1 · FUNÇÕES: fechar em PUBLIC, abrir por papel ══════════════
-- Fecha tudo de uma vez, inclusive o que for criado no futuro por descuido.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end $$;

-- e agora, um a um, só quem precisa de verdade:

-- o site público escreve por estas duas, e só por elas
grant execute on function public.registrar_apoio(
  text, text, text, text, text[], text, text[], boolean, text, text) to anon, authenticated;
grant execute on function public.descadastrar(text, text) to anon, authenticated;

-- as policies chamam estas; quem loga precisa poder executá-las
grant execute on function public.meu_papel()          to authenticated;
grant execute on function public.pode(papel_equipe[]) to authenticated;
grant execute on function public.eh_admin()           to authenticated;
grant execute on function public.zap_e164(text)       to authenticated;

-- o painel usa estas duas; o eleitor não
grant execute on function public.resumo_do_dia(int)          to authenticated;
grant execute on function public.marcar_contato(text, text)  to authenticated;

-- o robô do n8n: as quatro do contrato dele, e nada além
grant execute on function public.resumo_do_dia(int)                      to n8n_bot;
grant execute on function public.marcar_contato(text, text)              to n8n_bot;
grant execute on function public.registrar_log(text, text, text, jsonb)  to n8n_bot;
grant execute on function public.gerar_backup()                          to n8n_bot;

-- promover/revogar/gerar_backup NÃO são concedidas a anon nem a authenticated:
-- promoção é ação de quem tem acesso ao SQL Editor, de propósito.


-- ══════════ 2 · VIEWS: leitura, nunca escrita ═══════════════════════════
revoke all on public.agenda_publica          from public, anon, authenticated;
revoke all on public.site_publico            from public, anon, authenticated;
revoke all on public.apoiadores_contactaveis from public, anon, authenticated;

grant select on public.agenda_publica to anon, authenticated;
grant select on public.site_publico   to anon, authenticated;
-- esta tem security_invoker=true: a RLS ainda filtra por papel
grant select on public.apoiadores_contactaveis to authenticated;


-- ══════════ 3 · TABELAS: tirar o excedente que o default privilege deu ══
-- O schema fazia GRANT sem REVOKE antes, e GRANT soma em cima do ALL que a
-- tabela ganhou ao nascer. Resultado medido: `authenticated` tinha INSERT e
-- DELETE em perfis, site_conteudo, backups e log_automacao — objetos que
-- ninguém do painel cria nem apaga.
revoke all on public.perfis        from anon, authenticated;
revoke all on public.eventos       from anon, authenticated;
revoke all on public.apoiadores    from anon, authenticated;
revoke all on public.conteudos     from anon, authenticated;
revoke all on public.site_conteudo from anon, authenticated;
revoke all on public.backups       from anon, authenticated;
revoke all on public.log_automacao from anon, authenticated;

-- perfil: cada um lê o seu (RLS) e corrige o próprio nome. Nada mais.
grant select         on public.perfis to authenticated;
grant update (nome)  on public.perfis to authenticated;

-- agenda: admin e assessora mexem (a RLS decide); ninguém mais alcança
grant select, insert, update, delete on public.eventos   to authenticated;
grant select, insert, update, delete on public.conteudos to authenticated;

-- apoiadores: a equipe trabalha a lista e pode APAGAR (LGPD art. 18), mas
-- não INSERE — quem cadastra é a RPC, com consentimento
grant select, delete on public.apoiadores to authenticated;
grant update (nome, bairro, email, status, obs_equipe,
              contatado_em, contatado_por, optout, optout_origem)
  on public.apoiadores to authenticated;

-- site: o social preenche o valor das chaves fixas. Não cria nem apaga chave.
grant select        on public.site_conteudo to authenticated;
grant update (valor) on public.site_conteudo to authenticated;

-- log e backups: leitura, e só o admin passa pela RLS
grant select on public.backups       to authenticated;
grant select on public.log_automacao to authenticated;


-- ══════════ 4 · SEQUÊNCIAS: as criadas antes do 03 ficaram abertas ══════
-- O `alter default privileges` do 03 só vale dali para frente. `backups_id_seq`
-- nasceu no 02, antes dele, e continuava com usage+select para anon.
do $$
declare s record;
begin
  for s in
    select c.oid::regclass as seq
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'S'
  loop
    execute format('revoke all on sequence %s from public, anon', s.seq);
  end loop;
end $$;


-- ══════════ 5 · LIMPEZA DO QUE O TESTE DE INVASÃO DEIXOU ════════════════
-- O ataque que provou o furo gravou uma linha de verdade no log.
delete from public.log_automacao where fluxo = 'teste-de-invasao';
