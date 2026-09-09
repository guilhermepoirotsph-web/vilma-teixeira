-- ============================================================================
--  VILMA TEIXEIRA — 02 · CONTATO, DESCADASTRAMENTO E BACKUP
--  Rodar DEPOIS de schema.sql, no mesmo projeto Supabase.
--  Provado antes com PGlite: node banco/provar-sql.mjs
--
--  POR QUE ESTE ARQUIVO EXISTE
--  --------------------------
--  O pedido original era "API do WhatsApp + disparo pelo n8n". Isso não pode
--  ser feito, e a razão é dupla:
--
--   1. A Meta PROÍBE campanha política na WhatsApp Business Platform. Texto
--      literal da política oficial (whatsappbusiness.com/pt-br/policy,
--      conferido em 09/09/2026): "Proibimos o uso da Plataforma do WhatsApp
--      Business por políticos ou partidos, candidatos e campanhas políticas."
--      Não há exceção nem via de aprovação, e a proibição alcança também
--      "entidades que prestam serviços relacionados à política" — ou seja, a
--      própria agência não pode mandar em nome da campanha pela conta dela.
--      Consequência de tentar: conta reprovada no cadastro ou derrubada
--      depois, com o banimento podendo escalar para o portfólio inteiro do
--      Meta Business — levando junto os clientes comerciais que estiverem lá.
--
--   2. A Justiça Eleitoral veda o disparo em massa de conteúdo
--      político-eleitoral (Res. TSE 23.610/2019, art. 34, II). São DUAS
--      vedações ligadas por "ou": sem consentimento da destinatária, OU com
--      ferramenta fora dos termos do provedor. A mesma norma proíbe ceder,
--      doar ou vender cadastro eletrônico a candidato, partido ou coligação.
--
--  ⚠️ E AS DUAS SÃO INDEPENDENTES — a confusão que custa caro
--  --------------------------------------------------------
--  O aplicativo WhatsApp Business (o da lojinha) É liberado pela Meta para
--  político. Isso resolve o item 1, e SÓ ele. A definição legal de disparo em
--  massa é NEUTRA quanto à tecnologia (art. 37, XXI: "um mesmo conteúdo, ou
--  variações deste, para um grande volume de usuárias e usuários por meio de
--  aplicativos de mensagem instantânea" — não diz "via API"). Ou seja:
--  LISTA DE TRANSMISSÃO DO APP GRÁTIS PARA CENTENAS DE ELEITORES CONTINUA
--  SENDO DISPARO EM MASSA. E não adianta alegar que a lista "só entrega a quem
--  salvou o número": salvar contato é ato unilateral de quem recebe, e o
--  art. 37, XXVII exige "manifestação livre, informada e inequívoca".
--
--  O QUE ESTE ARQUIVO SUSTENTA, ENTÃO
--  ----------------------------------
--  O porto seguro expresso do art. 33, §2º: mensagem CONSENTIDA, enviada por
--  PESSOA NATURAL, de forma PRIVADA. Na prática: a pessoa fala primeiro (link
--  wa.me no site), a equipe responde UMA A UMA pelo aplicativo, e o banco
--  guarda a prova de consentimento, quem já foi contatado e quem pediu para
--  sair. Automação continua existindo — só não é ela que fala com o eleitor.
--
--  E quem pedir para sair tem que ser atendido em 48 HORAS, com descadastro
--  E eliminação dos dados (art. 33, caput). Depois do prazo, multa de R$ 100
--  POR MENSAGEM (art. 33, §1º; Lei 9.504/97, art. 57-G, parágrafo único).
--  Por isso a função descadastrar() abaixo atende na hora, não em 48h: a
--  única prova boa é a que não depende de alguém lembrar.
-- ============================================================================


-- ────────────────────────────────── 1 · NÚMERO EM FORMATO DE LINK
-- O check da coluna aceita de 10 a 13 dígitos, então cabe tanto "12981222349"
-- quanto "5512981222349". Link wa.me exige país+DDD, sempre.
create or replace function public.zap_e164(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p,'[^0-9]','','g')) between 10 and 11
      then '55' || regexp_replace(p,'[^0-9]','','g')
    else regexp_replace(p,'[^0-9]','','g')
  end;
$$;
comment on function public.zap_e164(text) is
  'Normaliza para país+DDD+número. Sem isto o link wa.me abre conversa vazia '
  'ou, pior, com outra pessoa.';


-- ───────────────────────── 2 · QUEM PODE SER CONTATADO, HOJE
-- A regra de quem pode receber mensagem vira UMA view. Deixar essa regra
-- espalhada em filtro de tela é como o opt-out acaba ignorado sem ninguém
-- perceber: basta alguém abrir a tabela crua e exportar.
drop view if exists public.apoiadores_contactaveis;
create view public.apoiadores_contactaveis
  with (security_invoker = true) as
  select id, nome, public.zap_e164(whatsapp) as zap, bairro, ajuda, apoio,
         status, recado, criado_em, contatado_em,
         (contatado_em is null)                   as nunca_contatado,
         date_part('day', now() - criado_em)::int as dias_desde_cadastro
  from public.apoiadores
  where consente and not optout;

comment on view public.apoiadores_contactaveis is
  'Única lista de onde a equipe deve tirar contato. security_invoker=true: a '
  'RLS continua valendo, então o social media não vê nada aqui — diferente da '
  'agenda_publica, que fura a RLS de propósito por ser pública.';


-- ─────────────────────────── 3 · DESCADASTRAMENTO PELA PRÓPRIA PESSOA
-- Chamada pelo site, sem login. Marca opt-out; NUNCA apaga.
create or replace function public.descadastrar(p_whatsapp text, p_origem text default 'site')
returns json language plpgsql security definer set search_path = public as $$
declare v_zap text := regexp_replace(coalesce(p_whatsapp,''), '[^0-9]', '', 'g');
begin
  if v_zap !~ '^[0-9]{10,13}$' then
    raise exception 'WhatsApp inválido' using errcode = '22000';
  end if;

  update public.apoiadores
     set optout = true, optout_origem = coalesce(p_origem,'site')
   where public.zap_e164(whatsapp) = public.zap_e164(v_zap)
     and not optout;

  -- Resposta IGUAL para número cadastrado e não cadastrado, de propósito.
  -- Devolver "não encontrei" transformaria esta função num consultor de quem
  -- apoia quem: bastaria testar números para mapear a base da campanha.
  return json_build_object('ok', true);
end $$;

comment on function public.descadastrar(text, text) is
  'Auto-atendimento de "não quero mais ser contatado" (LGPD art. 18, e o '
  'descadastramento que a lei eleitoral exige de quem envia mensagem). '
  'Idempotente e sem oráculo de existência.';


-- ──────────────────────────────── 4 · COFRE DE BACKUP NO PRÓPRIO BANCO
-- O n8n do VPS é redundância, não a rede principal: se o container cair, o
-- backup para de existir sem ninguém notar. Agendado por pg_cron, o backup
-- mora dentro do próprio banco e não depende de máquina nenhuma.
create table if not exists public.backups (
  id        bigserial primary key,
  feito_em  timestamptz not null default now(),
  tabelas   int,
  linhas    int,
  conteudo  jsonb not null
);
alter table public.backups enable row level security;
drop policy if exists p_backups_admin on public.backups;
create policy p_backups_admin on public.backups
  for select to authenticated using (public.eh_admin());

create or replace function public.gerar_backup()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tab   text;
  v_json  jsonb := '{}'::jsonb;
  v_dados jsonb;
  v_n     int := 0;
  v_lin   int := 0;
begin
  -- varre o catálogo em vez de lista fixa: tabela nova entra sozinha no
  -- backup. Lista de tabelas digitada à mão apodrece calada.
  for v_tab in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname <> 'backups'
     order by c.relname
  loop
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from public.%I t', v_tab)
      into v_dados;
    v_json := v_json || jsonb_build_object(v_tab, v_dados);
    v_n := v_n + 1;
    v_lin := v_lin + jsonb_array_length(v_dados);
  end loop;

  insert into public.backups (tabelas, linhas, conteudo) values (v_n, v_lin, v_json);
  delete from public.backups where feito_em < now() - interval '30 days';
  return json_build_object('ok', true, 'tabelas', v_n, 'linhas', v_lin);
end $$;

comment on function public.gerar_backup() is
  'Snapshot JSON de todas as tabelas, guardado na própria tabela backups, com '
  '30 dias de retenção. Agendar com pg_cron (ver o rodapé deste arquivo).';


-- ──────────────────────────────────────────────────────── 5 · GRANTS
grant execute on function public.descadastrar(text, text) to anon, authenticated;
grant execute on function public.zap_e164(text)           to anon, authenticated;
grant select  on public.apoiadores_contactaveis           to authenticated;
revoke all    on public.apoiadores_contactaveis           from anon;
grant select  on public.backups                           to authenticated;
revoke all    on public.backups                           from anon;
-- gerar_backup roda pelo pg_cron (dono do banco) ou pelo n8n com service_role;
-- ninguém logado no painel precisa disso.
revoke all on function public.gerar_backup() from public, anon, authenticated;


-- ============================================================================
-- DEPOIS DE RODAR ESTE ARQUIVO, NO PAINEL DO SUPABASE:
--
--   1. Database → Extensions → habilitar  pg_cron
--   2. SQL Editor:
--        select cron.schedule('backup-diario', '0 6 * * *',
--                             $$select public.gerar_backup()$$);
--      (06:00 UTC = 03:00 em Brasília)
--   3. Conferir depois:
--        select feito_em, tabelas, linhas from public.backups
--         order by feito_em desc limit 5;
--
-- O QUE **NÃO** FAZER, POR MAIS TENTADOR QUE PAREÇA:
--   · abrir conta na WhatsApp Business Platform (Cloud API) para esta campanha
--     — é proibido pela política da Meta e o banimento pode arrastar o
--     portfólio inteiro, levando junto os clientes comerciais da agência;
--   · usar "API não oficial" por QR Code (Evolution, Baileys, Z-API e afins)
--     — viola os Termos do WhatsApp, foi o alvo das ondas de banimento de 2026
--     e é exatamente o disparo em massa que a Justiça Eleitoral veda;
--   · exportar a lista de apoiadores para fora da campanha — a norma eleitoral
--     proíbe cessão, doação e venda de cadastro a candidato ou partido.
-- ============================================================================
