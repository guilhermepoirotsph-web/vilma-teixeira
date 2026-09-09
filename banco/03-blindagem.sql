-- ============================================================================
--  VILMA TEIXEIRA — 03 · BLINDAGEM DE COLUNA
--  Rodar DEPOIS de schema.sql e 02-contato.sql. Idempotente.
--  Provado com PGlite: node banco/provar-sql.mjs
--
--  POR QUE ESTE ARQUIVO EXISTE
--  --------------------------
--  RLS é ROW-level, nunca COLUMN-level. O schema.sql dizia, em comentário:
--    "Não há policy que permita o próprio usuário mudar `papel` ou `ativo`".
--  Não há mesmo — e era justamente esse o problema: a policy
--  `p_perfis_editar_o_meu` libera UPDATE na LINHA do próprio usuário, e o
--  GRANT era da tabela inteira. Somando as duas coisas, qualquer conta logada
--  — inclusive a conta INERTE, recém-criada, sem papel — conseguia:
--
--     PATCH /rest/v1/perfis?id=eq.<o próprio id>   {"papel":"admin","ativo":true}
--
--  e virava admin. Reproduzido em Postgres antes de corrigir:
--     antes:  {"papel":null,"ativo":false}
--     depois: {"papel":"admin","ativo":true}   erro: (nenhum)
--
--  A tela de "aguardando liberação" continuava aparecendo bonitinha. A trava
--  era decorativa. As provas não pegavam porque testavam INSERT nas outras
--  tabelas e a função promover() — nunca o UPDATE na própria linha de perfis.
-- ============================================================================


-- ══════════ 1 · PERFIS — papel e ativo saem do alcance de quem loga ══════
revoke update on public.perfis from authenticated;
grant  update (nome) on public.perfis to authenticated;
-- `papel`, `ativo`, `email` e `id` deixam de ser graváveis por quem loga.
-- `email` fica de fora porque quem manda nele é o auth.users: editável aqui
-- criaria duas verdades sobre a mesma pessoa.

-- Segunda linha, independente do GRANT: um gatilho. Vale mesmo se alguém
-- reconceder o UPDATE sem pensar, e vale para a service_role — que passa por
-- cima de toda policy, mas não pula gatilho.
create or replace function public.travar_papel()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.papel is distinct from old.papel) or (new.ativo is distinct from old.ativo) then
    -- a tranca só abre por dentro de promover() / revogar(), e só durante a
    -- transação delas. Nenhum caminho de fora do banco consegue abrir.
    if coalesce(current_setting('perfis.promocao', true), '') <> 'sim' then
      raise exception 'papel e ativo só mudam por public.promover() ou public.revogar()'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tg_perfis_travar_papel on public.perfis;
create trigger tg_perfis_travar_papel before update on public.perfis
  for each row execute function public.travar_papel();

comment on function public.travar_papel() is
  'Segunda linha da defesa contra auto-promoção. A primeira é o GRANT de '
  'coluna acima; este gatilho existe porque GRANT some quando alguém roda '
  '"grant update on public.perfis to authenticated" de novo sem pensar.';

-- promover() passa a abrir a tranca — e só dentro da própria transação
create or replace function public.promover(p_email text, p_papel papel_equipe)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then return 'Usuário não encontrado: ' || p_email; end if;
  perform set_config('perfis.promocao', 'sim', true);   -- true = local à transação
  update public.perfis set papel = p_papel, ativo = true where id = v_id;
  perform set_config('perfis.promocao', '', true);
  return p_email || ' agora é ' || p_papel || ' (ativo).';
end $$;
revoke all on function public.promover(text, papel_equipe) from public, anon, authenticated;

-- e o contrário, que faltava: quem sai da campanha precisa perder o painel no
-- mesmo minuto, e apagar a conta no Auth é lento e destrutivo.
create or replace function public.revogar(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then return 'Usuário não encontrado: ' || p_email; end if;
  perform set_config('perfis.promocao', 'sim', true);
  update public.perfis set papel = null, ativo = false where id = v_id;
  perform set_config('perfis.promocao', '', true);
  return p_email || ' perdeu o acesso ao painel.';
end $$;
revoke all on function public.revogar(text) from public, anon, authenticated;


-- ══════════ 2 · SITE_CONTEUDO — renomear a chave apagava a lacuna ═══════
-- O schema jura que "ninguém inventa chave que o site não lê, nem apaga chave
-- que o site espera" — verdade para INSERT e DELETE. Mas UPDATE da chave
-- primária faz as duas coisas de uma vez: renomear `video.url` para
-- `video.urlx` apaga a chave que o site lê e cria uma que ele ignora, sem
-- erro nenhum na tela. O social media quebraria o site sem saber.
revoke update on public.site_conteudo from authenticated;
grant  update (valor) on public.site_conteudo to authenticated;


-- ══════════ 3 · APOIADORES — a prova de consentimento é do titular ══════
-- A assessora precisa mexer em situação, anotação e contato. Não precisa — e
-- não deve — reescrever por PATCH a prova de consentimento de outra pessoa.
revoke update on public.apoiadores from authenticated;
grant  update (nome, bairro, email, status, obs_equipe,
               contatado_em, contatado_por, optout, optout_origem)
  on public.apoiadores to authenticated;
-- `consente`, `consente_apoio`, `consentimento_em`, `consentimento_texto`,
-- `apoio`, `whatsapp` e `origem` só mudam pela RPC registrar_apoio (ou seja,
-- pelo próprio titular) ou por SQL do admin.
-- `optout` fica editável de propósito: a assessora precisa poder atender um
-- "não me manda mais mensagem" na hora em que ouvir.


-- ══════════ 4 · A MESMA PESSOA DUAS VEZES — e o opt-out furado ══════════
-- O CHECK aceita de 10 a 13 dígitos e o índice único era sobre o TEXTO CRU.
-- Então "12988887777" e "5512988887777" convivem como duas pessoas. Efeito
-- prático: quem se descadastrou por um dos formatos continuava sendo
-- procurado pelo outro — o opt-out virava teatro.

-- 4.1 · junta o que já está duplicado, mantendo a linha mais antiga
do $$
declare r record;
begin
  for r in
    select public.zap_e164(whatsapp) canonico,
           array_agg(id order by criado_em) ids,
           bool_or(optout) algum_saiu
      from public.apoiadores
     group by 1 having count(*) > 1
  loop
    -- o opt-out de QUALQUER das cópias vale para a pessoa inteira
    if r.algum_saiu then
      update public.apoiadores set optout = true where id = r.ids[1];
    end if;
    delete from public.apoiadores where id = any(r.ids[2:]);
  end loop;
end $$;

-- 4.2 · normaliza o resto
update public.apoiadores
   set whatsapp = public.zap_e164(whatsapp)
 where whatsapp is distinct from public.zap_e164(whatsapp);

-- 4.3 · e a coluna passa a guardar SEMPRE a forma canônica, venha de onde vier
-- (site, painel, importação, SQL na mão). Com isto o índice único que já
-- existe em schema.sql — `ux_apoiadores_whatsapp`, sobre a própria coluna —
-- volta a significar "uma linha por pessoa", que era o que ele prometia.
-- Um índice sobre expressão resolveria a unicidade, mas deixaria a coluna com
-- dois formatos convivendo: toda consulta escrita depois teria que lembrar de
-- normalizar, e uma hora alguém esquece.
create or replace function public.normalizar_zap()
returns trigger language plpgsql set search_path = public as $$
begin
  new.whatsapp := public.zap_e164(new.whatsapp);
  return new;
end $$;

-- BEFORE INSERT roda antes da checagem de conflito, então o ON CONFLICT da
-- registrar_apoio passa a comparar o número já normalizado.
drop trigger if exists tg_apoiadores_zap on public.apoiadores;
create trigger tg_apoiadores_zap before insert or update on public.apoiadores
  for each row execute function public.normalizar_zap();


-- ══════════ 5 · TABELA NOVA NÃO NASCE ABERTA ════════════════════════════
-- No Supabase, tabela criada em `public` já vem com GRANT para anon por
-- default privilege. RLS ligada e sem policy resolve hoje, mas basta alguém
-- esquecer o `enable row level security` numa migração futura para expor
-- tudo. Fechar o padrão é uma linha e vale para sempre.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
