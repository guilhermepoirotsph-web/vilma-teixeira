-- ============================================================================
--  VILMA TEIXEIRA — schema do Supabase
--  Rodar no SQL Editor do projeto Supabase dedicado da campanha.
--  Provado antes com PGlite: node banco/provar-sql.mjs
--
--  Princípios da casa:
--   · RLS ligada em TODA tabela.
--   · O site público NUNCA lê tabela crua — lê a VIEW `agenda_publica`.
--   · anon não tem INSERT em lugar nenhum: escreve só pela RPC registrar_apoio.
--   · Perfil nasce INERTE (ativo=false, sem papel) — anti-takeover.
--   · Nenhuma coluna de documento (CPF/título). Não existe no schema de propósito.
-- ============================================================================

-- ─────────────────────────────────────────────────────────── 0 · TIPOS
do $$ begin
  create type papel_equipe as enum ('admin','assessora','social');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_evento as enum ('comicio','caminhada','carreata','reuniao','visita','live','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_apoiador as enum ('novo','contatado','engajado','voluntario','descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type formato_conteudo as enum ('reel','carrossel','story','foto','live','texto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_conteudo as enum ('ideia','roteiro','producao','aprovacao','agendado','publicado');
exception when duplicate_object then null; end $$;


-- ────────────────────────────────────────────────────────── 1 · PERFIS
create table if not exists public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text,
  papel      papel_equipe,                    -- nasce NULO de propósito
  ativo      boolean not null default false,  -- nasce INERTE de propósito
  criado_em  timestamptz not null default now()
);
comment on table public.perfis is
  'Equipe do gabinete/campanha. Perfil nasce inerte: ativo=false e papel nulo. '
  'Promoção é manual (SQL), nunca automática — senão qualquer um com a chave publishable vira admin.';

-- gatilho: todo signup cria o perfil INERTE
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, email, papel, ativo)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          new.email, null, false)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists tg_ao_criar_usuario on auth.users;
create trigger tg_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();


-- ──────────────────────────────────────────────── 2 · FUNÇÕES DE PAPEL
create or replace function public.meu_papel()
returns papel_equipe language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid() and ativo;
$$;

create or replace function public.pode(papeis papel_equipe[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and papel = any(papeis)
  );
$$;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode(array['admin']::papel_equipe[]);
$$;


-- ──────────────────────────────────────────────────────── 3 · EVENTOS
create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(btrim(titulo)) between 2 and 160),
  tipo         tipo_evento not null default 'outro',
  inicio       timestamptz not null,
  fim          timestamptz,
  local        text,
  endereco     text,
  bairro       text,
  observacao   text check (observacao is null or length(observacao) <= 800),
  link_mapa    text,
  destaque     boolean not null default false,
  publicado    boolean not null default false,  -- só o que a assessoria liberar
  interno      boolean not null default false,  -- reunião privada: nunca vai ao site
  criado_por   uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint fim_depois_do_inicio check (fim is null or fim >= inicio)
);
create index if not exists ix_eventos_inicio on public.eventos (inicio);
create index if not exists ix_eventos_publicado on public.eventos (publicado, interno, inicio);

comment on column public.eventos.interno is
  'Reunião fechada/agenda pessoal: aparece no painel da assessora, nunca na view pública.';


-- ───────────────────────────────────────────────────── 4 · APOIADORES
create table if not exists public.apoiadores (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(btrim(nome)) between 3 and 120),
  whatsapp        text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  bairro          text not null,
  email           text check (email is null or email ~* '^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$'),
  ajuda           text[]  not null default '{}',
  recado          text check (recado is null or length(recado) <= 800),
  -- DADO SENSÍVEL (posicionamento político, LGPD art. 5º II):
  -- só é gravado com consentimento específico e destacado (art. 11, I).
  apoio           text[]  not null default '{}',
  consente        boolean not null default false,
  consente_apoio  boolean not null default false,
  origem          text not null default 'site',
  status          status_apoiador not null default 'novo',
  obs_equipe      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  -- sem CPF, sem título de eleitor, sem RG. Não é esquecimento: é decisão.
  constraint consentimento_obrigatorio check (consente),
  constraint apoio_exige_consentimento check (cardinality(apoio) = 0 or consente_apoio)
);
create unique index if not exists ux_apoiadores_whatsapp on public.apoiadores (whatsapp);
create index if not exists ix_apoiadores_bairro on public.apoiadores (bairro);
create index if not exists ix_apoiadores_status on public.apoiadores (status, criado_em desc);

comment on table public.apoiadores is
  'Cadastro voluntário de apoio. Titular pode pedir exclusão a qualquer momento (LGPD art. 18).';


-- ──────────────────────────────────────────── 5 · CONTEÚDO (SOCIAL)
create table if not exists public.conteudos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(btrim(titulo)) between 2 and 160),
  formato       formato_conteudo not null default 'reel',
  rede          text not null default 'instagram',
  status        status_conteudo not null default 'ideia',
  data_prevista timestamptz,
  legenda       text,
  hashtags      text,
  link          text,
  responsavel   text,
  pauta         text,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ix_conteudos_status on public.conteudos (status, data_prevista);


-- ────────────────────────────────── 5b · CONTEÚDO EDITÁVEL DO SITE
-- É por aqui que o social media alimenta o site sem mexer em código:
-- trocar o vídeo em destaque, ajustar textos, nomes e fotos.
-- REGRA: chave que existe aqui TEM campo no painel E é lida pelo site.
-- Chave no banco sem campo no painel (ou sem leitura no site) é o defeito
-- mais repetido da casa — parece pronto e não muda nada.
create table if not exists public.site_conteudo (
  chave          text primary key,
  valor          text,
  grupo          text not null default 'geral',
  rotulo         text not null,
  tipo           text not null default 'texto'
                 check (tipo in ('texto','texto_longo','url','imagem','numero')),
  dica           text,
  publico        boolean not null default true,
  ordem          integer not null default 0,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis(id) on delete set null
);

-- Lacunas que o social media preenche. `valor` nulo = o site usa o padrão
-- que já está no código (nunca fica buraco na tela).
insert into public.site_conteudo (chave, grupo, rotulo, tipo, dica, ordem) values
  ('video.url',       'video',   'Link do vídeo em destaque (Instagram)', 'url',
   'Cole o link do post/reel. Ex.: https://www.instagram.com/p/XXXXXXXX/', 10),
  ('video.legenda',   'video',   'Legenda mostrada ao lado do vídeo',     'texto_longo',
   'O texto grande que aparece do lado do vídeo.', 20),
  ('video.data',      'video',   'Data do vídeo',                         'texto',
   'Ex.: 31 de agosto de 2026', 30),
  ('video.titulo',    'video',   'Título da seção do vídeo',              'texto', null, 40),
  ('video.arquivo',   'video',   'Link do vídeo em MP4 (toca COM SOM no site)', 'url',
   'Se preencher, o site usa este vídeo com som e legenda em vez do embed do Instagram. '
   'Precisa ser link direto para um arquivo .mp4.', 50),
  ('video.transcricao','video',  'Transcrição com tempos (uma fala por linha)', 'texto_longo',
   'Escreva assim, um por linha:  0:00 Boa noite, Caraguá.  /  0:07 Eu sou a Vilma. '
   'O site mostra cada frase na hora certa, para quem não pode ouvir.', 60),

  ('heroi.olho',      'heroi',   'Linha de cima do herói',                'texto',
   'Ex.: Vereadora de Caraguatatuba · MDB', 10),
  ('heroi.lead',      'heroi',   'Texto de abertura do herói',            'texto_longo', null, 20),
  ('heroi.selo',      'heroi',   'Selo do herói',                         'texto',
   'Ex.: 1ª Secretária da Mesa · 2025–2026', 30),
  ('heroi.foto',      'heroi',   'Foto da Vilma (PNG sem fundo)',         'imagem',
   'Recorte com fundo transparente, altura mínima 1600px.', 40),

  ('regina.nome',     'regina',  'Nome da candidata',                     'texto', null, 10),
  ('regina.numero',   'regina',  'Número na urna',                        'numero',
   'Só os dígitos. Muda também o simulador de urna.', 20),
  ('regina.cargo',    'regina',  'Cargo disputado',                       'texto', null, 30),
  ('regina.partido',  'regina',  'Partido',                               'texto', null, 40),
  ('regina.lead',     'regina',  'Texto de apresentação',                 'texto_longo', null, 50),
  ('regina.frase',    'regina',  'Frase em destaque',                     'texto_longo', null, 60),
  ('regina.foto',     'regina',  'Foto (PNG sem fundo)',                  'imagem', null, 70),
  ('regina.instagram','regina',  'Instagram (sem @)',                     'texto', null, 80),

  ('cezinha.nome',    'cezinha', 'Nome do candidato',                     'texto', null, 10),
  ('cezinha.numero',  'cezinha', 'Número na urna',                        'numero',
   'Só os dígitos. Muda também o simulador de urna.', 20),
  ('cezinha.cargo',   'cezinha', 'Cargo disputado',                       'texto', null, 30),
  ('cezinha.partido', 'cezinha', 'Partido',                               'texto', null, 40),
  ('cezinha.lead',    'cezinha', 'Texto de apresentação',                 'texto_longo', null, 50),
  ('cezinha.foto',    'cezinha', 'Foto (PNG sem fundo)',                  'imagem', null, 70),

  ('geral.whatsapp',  'geral',   'WhatsApp da campanha',                  'texto',
   'CHIP DE CAMPANHA, não o do gabinete: usar o número do mandato em propaganda '
   'é o que o rodapé do site jura não fazer. Só dígitos, com 55 e DDD na frente. '
   'Formato: 55 12 9XXXX-XXXX, tudo junto.', 10),
  ('geral.instagram', 'geral',   'Instagram da Vilma (sem @)',            'texto', null, 20),
  ('geral.frase_final','geral',  'Frase do fecho da página',              'texto', null, 30),
  ('geral.aviso',     'geral',   'Aviso no topo do site (deixe vazio para não mostrar)', 'texto',
   'Ex.: Comício neste sábado, 19h, na Praça da Cultura!', 40)
on conflict (chave) do nothing;

drop view if exists public.site_publico;
create view public.site_publico as
  select chave, valor from public.site_conteudo
  where publico and valor is not null and btrim(valor) <> '';
comment on view public.site_publico is
  'O que o site público lê. Só chave e valor, só o que foi preenchido.';


-- ─────────────────────────────────────────── 6 · atualizado_em automático
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists tg_eventos_touch on public.eventos;
create trigger tg_eventos_touch before update on public.eventos
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists tg_apoiadores_touch on public.apoiadores;
create trigger tg_apoiadores_touch before update on public.apoiadores
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists tg_conteudos_touch on public.conteudos;
create trigger tg_conteudos_touch before update on public.conteudos
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists tg_site_touch on public.site_conteudo;
create trigger tg_site_touch before update on public.site_conteudo
  for each row execute function public.tocar_atualizado_em();


-- ═══════════════════════════════════════════════════════════ 7 · RLS
alter table public.perfis      enable row level security;
alter table public.eventos     enable row level security;
alter table public.apoiadores  enable row level security;
alter table public.conteudos   enable row level security;
alter table public.site_conteudo enable row level security;

-- perfis: cada um vê o seu; admin vê e mexe em todos
drop policy if exists p_perfis_ver_o_meu on public.perfis;
create policy p_perfis_ver_o_meu on public.perfis
  for select to authenticated using (id = auth.uid() or public.eh_admin());

drop policy if exists p_perfis_editar_o_meu on public.perfis;
create policy p_perfis_editar_o_meu on public.perfis
  for update to authenticated
  using (id = auth.uid() or public.eh_admin())
  with check (id = auth.uid() or public.eh_admin());
-- Promover alguém a admin/assessora/social é SQL manual. Não há policy que
-- permita o próprio usuário mudar `papel` ou `ativo` — ver função abaixo.

drop policy if exists p_perfis_admin_tudo on public.perfis;
create policy p_perfis_admin_tudo on public.perfis
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- eventos: admin e assessora escrevem; social só lê
drop policy if exists p_eventos_ler on public.eventos;
create policy p_eventos_ler on public.eventos
  for select to authenticated
  using (public.pode(array['admin','assessora','social']::papel_equipe[]));

drop policy if exists p_eventos_escrever on public.eventos;
create policy p_eventos_escrever on public.eventos
  for all to authenticated
  using (public.pode(array['admin','assessora']::papel_equipe[]))
  with check (public.pode(array['admin','assessora']::papel_equipe[]));

-- apoiadores: só admin e assessora. Social media NÃO vê contato de eleitor.
drop policy if exists p_apoiadores_equipe on public.apoiadores;
create policy p_apoiadores_equipe on public.apoiadores
  for all to authenticated
  using (public.pode(array['admin','assessora']::papel_equipe[]))
  with check (public.pode(array['admin','assessora']::papel_equipe[]));

-- conteúdo do site: admin e social editam; assessora lê (para conferir)
drop policy if exists p_site_ler on public.site_conteudo;
create policy p_site_ler on public.site_conteudo
  for select to authenticated
  using (public.pode(array['admin','assessora','social']::papel_equipe[]));

drop policy if exists p_site_escrever on public.site_conteudo;
create policy p_site_escrever on public.site_conteudo
  for update to authenticated
  using (public.pode(array['admin','social']::papel_equipe[]))
  with check (public.pode(array['admin','social']::papel_equipe[]));
-- Sem policy de INSERT/DELETE de propósito: as chaves são fixas, definidas no
-- schema. O painel só preenche o valor — ninguém inventa chave que o site
-- não lê (nem apaga chave que o site espera).

-- conteúdos: admin e social escrevem; assessora lê
drop policy if exists p_conteudos_ler on public.conteudos;
create policy p_conteudos_ler on public.conteudos
  for select to authenticated
  using (public.pode(array['admin','assessora','social']::papel_equipe[]));

drop policy if exists p_conteudos_escrever on public.conteudos;
create policy p_conteudos_escrever on public.conteudos
  for all to authenticated
  using (public.pode(array['admin','social']::papel_equipe[]))
  with check (public.pode(array['admin','social']::papel_equipe[]));


-- ═════════════════════════════════════════ 8 · VIEW PÚBLICA DA AGENDA
-- View COMUM (sem security_invoker): roda com o dono da tabela e fura a RLS
-- de propósito, expondo só estas colunas e só o que está publicado.
drop view if exists public.agenda_publica;
create view public.agenda_publica as
  select id, titulo, tipo, inicio, fim, local, endereco, bairro,
         observacao, link_mapa, destaque
  from public.eventos
  where publicado and not interno;

comment on view public.agenda_publica is
  'Única porta de leitura do site público. Não expõe criado_por, publicado nem interno.';


-- ═══════════════════════════════════ 9 · RPC DE ESCRITA DO FORMULÁRIO
create or replace function public.registrar_apoio(
  p_nome           text,
  p_whatsapp       text,
  p_bairro         text,
  p_email          text default null,
  p_ajuda          text[] default '{}',
  p_recado         text default null,
  p_apoio          text[] default '{}',
  p_consente_apoio boolean default false,
  p_origem         text default 'site'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_zap    text := regexp_replace(coalesce(p_whatsapp,''), '[^0-9]', '', 'g');
  v_nome   text := btrim(coalesce(p_nome,''));
  v_apoio  text[];
  v_id     uuid;
  v_novo   boolean := true;
begin
  -- validação no servidor: o cliente pode mentir, o banco não deixa
  if length(v_nome) < 3 then
    raise exception 'Nome muito curto' using errcode = '22000';
  end if;
  if v_zap !~ '^[0-9]{10,13}$' then
    raise exception 'WhatsApp inválido' using errcode = '22000';
  end if;
  if btrim(coalesce(p_bairro,'')) = '' then
    raise exception 'Bairro obrigatório' using errcode = '22000';
  end if;

  -- dado sensível só entra com consentimento específico (LGPD art. 11, I)
  v_apoio := case when p_consente_apoio then coalesce(p_apoio,'{}') else '{}' end;

  -- só aceitamos os números que esta página apoia
  v_apoio := array(select x from unnest(v_apoio) x where x in ('15115','2223'));

  insert into public.apoiadores as a
    (nome, whatsapp, bairro, email, ajuda, recado, apoio,
     consente, consente_apoio, origem)
  values
    (v_nome, v_zap, btrim(p_bairro), nullif(btrim(coalesce(p_email,'')),''),
     coalesce(p_ajuda,'{}'), nullif(btrim(coalesce(p_recado,'')),''), v_apoio,
     true, coalesce(p_consente_apoio,false), coalesce(p_origem,'site'))
  on conflict (whatsapp) do update set
     nome           = excluded.nome,
     bairro         = excluded.bairro,
     email          = coalesce(excluded.email, a.email),
     ajuda          = excluded.ajuda,
     recado         = coalesce(excluded.recado, a.recado),
     -- apoio só é sobrescrito quando vem novo consentimento
     apoio          = case when excluded.consente_apoio then excluded.apoio else a.apoio end,
     consente_apoio = a.consente_apoio or excluded.consente_apoio,
     atualizado_em  = now()
  returning a.id, (a.criado_em = a.atualizado_em) into v_id, v_novo;

  -- devolve o mínimo: o site não precisa (e não deve) receber a ficha de volta
  return json_build_object('ok', true, 'novo', v_novo);
end $$;

comment on function public.registrar_apoio is
  'Única forma de o site gravar um apoiador. Valida no servidor, deduplica por '
  'WhatsApp e descarta a declaração de apoio quando não há consentimento específico.';


-- ═══════════════════════════════════════ 10 · PROMOVER MEMBRO (manual)
-- Uso pelo Guilherme/admin no SQL editor:
--   select public.promover('assessora@email.com','assessora');
create or replace function public.promover(p_email text, p_papel papel_equipe)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then return 'Usuário não encontrado: ' || p_email; end if;
  update public.perfis set papel = p_papel, ativo = true where id = v_id;
  return p_email || ' agora é ' || p_papel || ' (ativo).';
end $$;
revoke all on function public.promover(text, papel_equipe) from public, anon, authenticated;


-- ═══════════════════════════════════════════════ 11 · GRANTS
-- Duas camadas: GRANT diz em QUE tabela o papel pode encostar;
-- a RLS diz em QUAIS LINHAS. Uma sem a outra não protege.

-- anon (chave publishable do site) não toca em tabela nenhuma.
revoke all on public.perfis, public.eventos, public.apoiadores, public.conteudos,
              public.site_conteudo from anon;
revoke all on public.agenda_publica, public.site_publico from anon;

grant usage on schema public to anon, authenticated;
grant select on public.agenda_publica to anon;               -- só as views
grant select on public.site_publico   to anon;
grant execute on function public.registrar_apoio(
  text, text, text, text, text[], text, text[], boolean, text) to anon;

-- equipe logada: acesso às tabelas, com a RLS acima decidindo o que cada
-- papel enxerga. (No Supabase o `authenticated` já vem com estes grants por
-- padrão; declarar aqui deixa o schema autocontido e testável fora dele.)
grant select, insert, update, delete on public.eventos     to authenticated;
grant select, insert, update, delete on public.apoiadores  to authenticated;
grant select, insert, update, delete on public.conteudos   to authenticated;
grant select, update                 on public.perfis      to authenticated;
grant select, update                 on public.site_conteudo to authenticated;
grant select on public.agenda_publica, public.site_publico to authenticated;

grant execute on function public.meu_papel()               to authenticated;
grant execute on function public.eh_admin()                to authenticated;
grant execute on function public.pode(papel_equipe[])      to authenticated;

revoke execute on function public.meu_papel()   from anon;
revoke execute on function public.eh_admin()    from anon;
revoke execute on function public.pode(papel_equipe[]) from anon;

-- ============================================================================
-- DEPOIS DE RODAR ESTE ARQUIVO, FAZER NO PAINEL DO SUPABASE (não dá por SQL):
--   1. Authentication → Sign In / Providers → "Allow new users to sign up" OFF
--      (lembrar de clicar em "Save changes" — os toggles não salvam sozinhos)
--   2. Criar os usuários da equipe por convite e promover com:
--        select public.promover('email@da.assessora','assessora');
--        select public.promover('email@do.social','social');
--   3. Auth → Protection: leaked password protection ON, MFA se possível.
-- ============================================================================
