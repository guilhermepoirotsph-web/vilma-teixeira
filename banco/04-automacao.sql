-- ============================================================================
--  VILMA TEIXEIRA — 04 · APOIO À AUTOMAÇÃO (n8n)
--  Rodar DEPOIS de schema.sql, 02-contato.sql e 03-blindagem.sql.
--  Provado com PGlite: node banco/provar-sql.mjs
--
--  O n8n desta campanha é COPILOTO DA EQUIPE, nunca remetente. Ele avisa,
--  prepara texto e monta o link — quem aperta o botão é uma pessoa. A razão
--  está no cabeçalho de 02-contato.sql: a Plataforma WhatsApp Business proíbe
--  campanha política, e a lei eleitoral veda disparo em massa.
--
--  Este arquivo dá ao n8n três coisas e nada além disso:
--   · uma função que devolve o resumo do dia (agenda + quem cadastrou);
--   · uma função que marca "a Mariana já falou com esta pessoa";
--   · uma tabela de log, porque execução do n8n some em 7 dias e sucesso
--     nem é guardado — automação que ninguém vê é automação que morre calada.
-- ============================================================================


-- ────────────────────────────────────────────── 1 · LOG DA AUTOMAÇÃO
create table if not exists public.log_automacao (
  id        bigserial primary key,
  quando    timestamptz not null default now(),
  fluxo     text not null,
  nivel     text not null default 'info' check (nivel in ('info','aviso','erro')),
  mensagem  text,
  detalhe   jsonb
);
create index if not exists ix_log_automacao_quando on public.log_automacao (quando desc);
alter table public.log_automacao enable row level security;

drop policy if exists p_log_admin on public.log_automacao;
create policy p_log_admin on public.log_automacao
  for select to authenticated using (public.eh_admin());
grant select on public.log_automacao to authenticated;
revoke all   on public.log_automacao from anon;

-- o n8n escreve por RPC, não por INSERT direto: assim ele não precisa de
-- GRANT em tabela nenhuma, e o que ele pode fazer cabe numa linha de leitura
create or replace function public.registrar_log(
  p_fluxo text, p_nivel text default 'info',
  p_mensagem text default null, p_detalhe jsonb default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.log_automacao (fluxo, nivel, mensagem, detalhe)
  values (btrim(p_fluxo),
          case when p_nivel in ('info','aviso','erro') then p_nivel else 'info' end,
          p_mensagem, p_detalhe)
  returning id into v_id;
  delete from public.log_automacao where quando < now() - interval '90 days';
  return v_id;
end $$;


-- ──────────────────────────────────── 2 · O RESUMO QUE O n8n MANDA
-- Uma chamada só, para o fluxo não precisar de três consultas e de lógica
-- espalhada em nó de Code. A regra de quem pode ser contatado mora no banco.
create or replace function public.resumo_do_dia(p_dias int default 1)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'gerado_em', now(),
    'agenda', (
      select coalesce(json_agg(json_build_object(
               'titulo', titulo, 'tipo', tipo, 'inicio', inicio,
               'local', local, 'bairro', bairro,
               'onde', case when interno then 'interna'
                            when publicado then 'no site' else 'rascunho' end
             ) order by inicio), '[]'::json)
        from public.eventos
       where inicio >= date_trunc('day', now() + make_interval(days => p_dias))
         and inicio <  date_trunc('day', now() + make_interval(days => p_dias + 1))
    ),
    'novos_apoiadores', (
      select coalesce(json_agg(json_build_object(
               'nome', nome, 'bairro', bairro, 'zap', zap,
               'ajuda', ajuda, 'recado', recado,
               'link', 'https://wa.me/' || zap
             ) order by criado_em), '[]'::json)
        from public.apoiadores_contactaveis
       where nunca_contatado and criado_em >= now() - interval '7 days'
    ),
    'a_contatar', (select count(*) from public.apoiadores_contactaveis where nunca_contatado),
    'sairam_7d',  (select count(*) from public.apoiadores
                    where optout and optout_em >= now() - interval '7 days')
  );
$$;

comment on function public.resumo_do_dia(int) is
  'O que o n8n manda para a equipe: a agenda do dia seguinte e quem se '
  'cadastrou e ainda não foi contatado, já com o link wa.me pronto para a '
  'Mariana CLICAR. O envio é dela, uma conversa por vez — automação nenhuma '
  'fala com eleitor neste projeto.';


-- ────────────────────────────── 3 · MARCAR QUE JÁ FALOU COM A PESSOA
create or replace function public.marcar_contato(p_whatsapp text, p_quem text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.apoiadores
     set contatado_em = now(),
         obs_equipe = case when p_quem is null then obs_equipe
                           else coalesce(obs_equipe || E'\n', '') ||
                                to_char(now(),'DD/MM HH24:MI') || ' — contato por ' || p_quem end
   where public.zap_e164(whatsapp) = public.zap_e164(p_whatsapp)
     and not optout;
  get diagnostics v_n = row_count;
  return json_build_object('ok', true, 'atualizados', v_n);
end $$;


-- ──────────────────────────────────────── 4 · O PAPEL DO n8n NO BANCO
-- O n8n NÃO recebe a service_role. Aquela chave tem BYPASSRLS: quem a tiver lê
-- nome, telefone, bairro, recado e OPINIÃO POLÍTICA da base inteira — dado
-- sensível do art. 11 da LGPD — e ela moraria num n8n exposto num IP público.
-- Este papel só executa as três funções acima, e não tem GRANT em tabela
-- nenhuma: se o VPS for comprometido, o que vaza é o resumo do dia.
do $$ begin
  create role n8n_bot nologin;
exception when duplicate_object then null; end $$;

grant usage on schema public to n8n_bot;
revoke all on all tables in schema public from n8n_bot;
grant execute on function public.registrar_log(text, text, text, jsonb) to n8n_bot;
grant execute on function public.resumo_do_dia(int)                     to n8n_bot;
grant execute on function public.marcar_contato(text, text)             to n8n_bot;
grant execute on function public.gerar_backup()                         to n8n_bot;

-- ⚠ Os `revoke ... from anon` que ficavam aqui NÃO FUNCIONAVAM: toda função
-- nasce com EXECUTE para PUBLIC, e anon é membro de PUBLIC — revogar de anon
-- não desfaz o que veio por herança. As três ficaram abertas para a internet
-- até 10/09/2026 (medido no projeto real). E havia um `grant … to
-- authenticated` em resumo_do_dia que entregava a base de apoiadores ao social
-- media. Quem fecha isso agora é o 05-privilegios.sql, que revoga de
-- `public, anon, authenticated` de uma vez e reconcede um a um.
-- Não reintroduza revoke/grant destas funções aqui: o 05 é a fonte única.

-- ============================================================================
-- NO SUPABASE, DEPOIS DE RODAR ESTE ARQUIVO:
--   1. criar a senha do papel do n8n (troque por uma senha forte, e guarde-a
--      em SENHAS-NAO-COMITAR.txt — nunca aqui, nunca no cofre):
--        alter role n8n_bot login password 'ESCOLHA-UMA-SENHA-FORTE';
--   2. no n8n, credencial Postgres apontando para o POOLER (o host direto do
--      Supabase é só IPv6 e o VPS é IPv4):
--        host  aws-0-sa-east-1.pooler.supabase.com
--        porta 5432
--        user  postgres.<ref-do-projeto>     database  postgres
--        SSL: "require" + "Ignore SSL Issues" ligado
--      e, na primeira consulta de cada fluxo:  set role n8n_bot;
-- ============================================================================
