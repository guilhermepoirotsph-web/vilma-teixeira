-- ============================================================================
--  VILMA TEIXEIRA — 07 · A PORTA DE ENTRADA DO CHAT
--  Rodar DEPOIS de 06-agenda-bot.sql. Idempotente.
--
--  O 06 deu ao agente o poder de mexer na agenda. Este arquivo resolve a
--  pergunta anterior a essa: **quando chega uma mensagem, o que é isto?**
--
--  São quatro coisas possíveis, e só quatro:
--    · equipe      → é a Mariana (ou o Guilherme). Vai para o agente.
--    · sair        → alguém pedindo para não receber mais. Resolve na hora.
--    · boas-vindas → quem acabou de se cadastrar no site, falando pela
--                    primeira vez. Recebe UMA confirmação, nunca duas.
--    · ignorar     → qualquer outra coisa. O robô fica calado e uma PESSOA
--                    responde pelo WhatsApp, como sempre foi o desenho.
--
--  ── POR QUE O ROTEAMENTO MORA NO BANCO, E NÃO EM NÓS DE `IF` DO n8n ──────
--  Porque é decisão de segurança, e decisão de segurança precisa de teste.
--  Em nó de `if` no n8n ela não é testável, não é versionada e ninguém revisa.
--  Aqui ela tem prova em PGlite e cabe numa função só: o n8n chama
--  `bot_entrada()` e recebe a resposta pronta — inclusive a frase para mandar.
--
--  ── AS DUAS GARANTIAS QUE NÃO PODEM CAIR ────────────────────────────────
--  1. **No máximo uma** mensagem de boas-vindas por pessoa, para sempre.
--     Por isso a função que entrega a lista JÁ MARCA que entregou. Se o envio
--     falhar depois, aquela pessoa fica sem a mensagem — e é esse o erro que
--     se prefere: mandar duas vezes para um eleitor é pior que mandar zero.
--  2. **Quem pediu para sair, sai.** Em qualquer caminho, e antes de tudo:
--     `optout` é checado antes de qualquer envio, e a palavra SAIR funciona
--     mesmo vindo de número que não está em lugar nenhum.
--     Art. 33 da Res. TSE 23.610/2019: 48h para descadastrar, R$ 100 de multa
--     por mensagem enviada depois do prazo.
-- ============================================================================


-- ════════ 1 · A MARCA DE "JÁ FALEI COM ESSA PESSOA UMA VEZ" ═════════════
alter table public.apoiadores add column if not exists boas_vindas_em timestamptz;

comment on column public.apoiadores.boas_vindas_em is
  'Quando a confirmação automática foi entregue ao robô para envio. É a trava '
  'de "uma vez só": marcada NA ENTREGA, não na confirmação de leitura.';

create index if not exists ix_apoiadores_boas_vindas
  on public.apoiadores (criado_em) where boas_vindas_em is null and not optout;


-- ════════ 2 · O TEXTO DA CONFIRMAÇÃO ════════════════════════════════════
-- Em função à parte para poder ser lida, conferida por um advogado e trocada
-- sem mexer na lógica. Três coisas são obrigatórias aqui e não podem sumir
-- numa reescrita: quem está falando, por que está falando com esta pessoa,
-- e como parar de receber.
create or replace function public.texto_boas_vindas(p_nome text)
returns text language sql immutable as $$
  select 'Oi, ' || split_part(btrim(coalesce(p_nome, '')), ' ', 1) || '! ' ||
         'Aqui é da campanha da Vilma Teixeira (MDB), vereadora em Caraguatatuba. ' ||
         'Recebemos o seu cadastro no site — obrigado por caminhar com a gente. ' ||
         'Em breve alguém da equipe fala com você. ' ||
         'Se não quiser mais receber mensagens, é só responder SAIR.';
$$;


-- ════════ 3 · "SAIR" EM PORTUGUÊS DE VERDADE ════════════════════════════
-- Casa a mensagem INTEIRA, não um pedaço. "vou parar na praça do Jetuba" não
-- pode descadastrar ninguém — e casaria, se a regra fosse "contém parar".
create or replace function public.eh_pedido_de_saida(p_texto text)
returns boolean language sql immutable as $$
  select translate(
           lower(btrim(regexp_replace(coalesce(p_texto,''), '[^[:alnum:][:space:]]', '', 'g'))),
           'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
         ~ ('^(quero |por favor |favor |pode )?'
         || '(sair|sai|parar|pare|stop|cancelar|descadastrar|remover|me remove|'
         || 'me remover|me tira|me tire|nao quero|nao quero mais|'
         || 'nao quero mais receber|nao quero receber)$');
$$;

comment on function public.eh_pedido_de_saida(text) is
  'Reconhece o pedido de descadastramento. Casa a mensagem inteira de '
  'propósito: descadastrar alguém por engano é perder um apoiador de vez.';


-- ════════ 4 · A PORTA: uma função, quatro respostas ═════════════════════
create or replace function public.bot_entrada(p_zap text, p_texto text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_p   public.perfis;
  v_zap text := public.zap_e164(p_zap);
  v_a   public.apoiadores;
begin
  if v_zap is null or length(v_zap) < 10 then
    return json_build_object('tipo', 'ignorar', 'porque', 'telefone ilegível');
  end if;

  -- 1 · é da equipe? então é conversa de agenda, e o 06 assume daqui
  v_p := public.equipe_por_zap(v_zap);
  if v_p.id is not null then
    return json_build_object('tipo', 'equipe', 'nome', v_p.nome, 'papel', v_p.papel);
  end if;

  -- 2 · pediu para sair? antes de qualquer outra coisa, e mesmo que o número
  --     não esteja na base — responder igual para os dois casos é o que
  --     impede a função de virar consultor de quem apoia quem
  if public.eh_pedido_de_saida(p_texto) then
    perform public.descadastrar(v_zap, 'whatsapp');
    perform public.registrar_log('entrada-chat', 'aviso', 'pedido de saída atendido',
      json_build_object('acao', 'sair')::jsonb);   -- sem o número: log não é lista
    return json_build_object('tipo', 'sair',
      'fala', 'Pronto! Você não vai mais receber mensagens da campanha. '
           || 'Obrigado pelo tempo que nos deu. 🙏');
  end if;

  -- 3 · acabou de se cadastrar e está falando pela primeira vez?
  select * into v_a from public.apoiadores
   where public.zap_e164(whatsapp) = v_zap
     and consente and not optout and boas_vindas_em is null
   limit 1;

  if v_a.id is not null then
    update public.apoiadores set boas_vindas_em = now() where id = v_a.id;
    perform public.registrar_log('entrada-chat', 'info', 'boas-vindas por mensagem recebida',
      json_build_object('acao', 'boas-vindas', 'origem', 'inbound')::jsonb);
    return json_build_object('tipo', 'boas-vindas', 'nome', v_a.nome,
                             'fala', public.texto_boas_vindas(v_a.nome));
  end if;

  -- 4 · qualquer outra coisa: o robô se cala e uma pessoa responde
  return json_build_object('tipo', 'ignorar');
end $$;

comment on function public.bot_entrada(text, text) is
  'Porta única do chat. O n8n chama isto e recebe o que fazer, já com a frase '
  'pronta. Mensagem de estranho cai em "ignorar": robô não puxa conversa.';


-- ════════ 5 · A CONFIRMAÇÃO EMPURRADA (o pedido do Guilherme) ═══════════
-- "quando a pessoa preencher o formulário, disparar uma mensagem pra ela."
--
-- ⚠ ESTE É O CAMINHO DE RISCO, e o risco não é de código:
--   · para o WhatsApp, mandar mensagem para quem NUNCA te mandou mensagem, em
--     sequência, por API não oficial, é o padrão que mais derruba número;
--   · para a lei eleitoral, o art. 34, II liga duas vedações por "ou" — sem
--     consentimento **ou** com ferramenta fora dos termos do provedor. O
--     consentimento aqui é impecável; a segunda metade continua de pé sozinha.
--   · e o porto seguro do art. 33, §2º fala em mensagem enviada por **pessoa
--     natural**. Robô não é pessoa natural.
--
-- O caminho de baixo risco que entrega a MESMA experiência já existe no
-- projeto: o formulário abre o WhatsApp com o texto pronto, ela toca em
-- enviar, e aí o `bot_entrada` responde as boas-vindas — conversa que ELA
-- começou. Nesse desenho o envio automático abaixo nem é usado.
--
-- Fica pronto porque a escolha é do Guilherme, não minha. O que o banco
-- garante nos dois casos: uma vez por pessoa, nunca para quem saiu, e com
-- teto por hora.
create or replace function public.bot_boas_vindas_pendentes(p_limite int default 20)
returns json language plpgsql security definer set search_path = public as $$
declare v_feitos_na_hora int; v_teto constant int := 60; v_lista json;
begin
  select count(*) into v_feitos_na_hora
    from public.apoiadores
   where boas_vindas_em >= now() - interval '1 hour';

  if v_feitos_na_hora >= v_teto then
    perform public.registrar_log('boas-vindas', 'aviso',
      'teto horário atingido: ' || v_feitos_na_hora || ' envios na última hora',
      json_build_object('acao', 'teto')::jsonb);
    return json_build_object('ok', false, 'erro', 'teto_por_hora',
                             'feitos_na_hora', v_feitos_na_hora, 'itens', '[]'::json);
  end if;

  -- claim-and-return: marca ao entregar. Ver a garantia 1 no cabeçalho —
  -- no máximo uma, e se o envio falhar a pessoa fica sem, de propósito.
  with alvo as (
    select id from public.apoiadores
     where consente and not optout and boas_vindas_em is null
     order by criado_em
     limit greatest(1, least(coalesce(p_limite, 20), v_teto - v_feitos_na_hora))
     for update skip locked
  ), marcados as (
    update public.apoiadores a set boas_vindas_em = now()
      from alvo where a.id = alvo.id
    returning a.nome, public.zap_e164(a.whatsapp) as zap
  )
  select coalesce(json_agg(json_build_object(
           'zap', zap, 'nome', nome, 'fala', public.texto_boas_vindas(nome))), '[]'::json)
    into v_lista from marcados;

  return json_build_object('ok', true, 'itens', v_lista);
end $$;


-- ════════ 6 · PRIVILÉGIO: o mesmo laço do 06 ════════════════════════════
-- Função nova nasce com EXECUTE para PUBLIC. O laço pega qualquer `bot_*`,
-- inclusive as duas criadas aqui, e qualquer outra que venha depois.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'bot\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to n8n_bot', f.assinatura);
  end loop;
end $$;

-- internas: nem o robô alcança. Ele chama `bot_entrada`, que as usa por dentro.
revoke all on function public.texto_boas_vindas(text)  from public, anon, authenticated, n8n_bot;
revoke all on function public.eh_pedido_de_saida(text) from public, anon, authenticated, n8n_bot;

-- o painel passa a enxergar quem já recebeu a confirmação (a coluna nova entra
-- no GRANT de tabela que já existe); e pode corrigir à mão se precisar
grant update (boas_vindas_em) on public.apoiadores to authenticated;

-- ============================================================================
-- DECIDIR ANTES DE LIGAR (só um dos dois fluxos deve existir no n8n):
--   A) INBOUND  — o site abre o wa.me preenchido, ela envia, `bot_entrada`
--                 responde. Conversa iniciada por ela. É o recomendado.
--   B) OUTBOUND — o n8n varre `bot_boas_vindas_pendentes()` e empurra. Entrega
--                 a mesma frase sem ela precisar tocar em nada, e é onde mora
--                 o risco de banimento do número e o art. 34, II.
-- Os dois usam a MESMA frase e a MESMA trava de uma-vez-só.
-- ============================================================================
