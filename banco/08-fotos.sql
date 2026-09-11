-- ============================================================================
--  VILMA TEIXEIRA — 08 · FOTOS PELO PAINEL (Supabase Storage)
--  Rodar DEPOIS de 07-entrada-chat.sql. Idempotente.
--
--  Até aqui, foto no painel era "cole o link da imagem". Só que o Lucas não
--  tem onde hospedar: o Instagram bloqueia hotlink, e pedir para ele subir
--  arquivo no repositório é pedir para ele aprender git. Na prática, o campo
--  de foto não seria usado.
--
--  Este arquivo cria o balde onde ele SOBE o arquivo direto do painel.
--
--  ── AS TRÊS DECISÕES QUE IMPORTAM ───────────────────────────────────────
--  1. **Balde público de leitura.** São fotos de campanha, feitas para
--     aparecer num site aberto. Privado exigiria URL assinada, que vence — e
--     foto de candidato sumindo do ar três dias depois é um defeito pior que
--     qualquer coisa que o "público" resolva.
--  2. **Escrita só de admin e social.** A assessora não precisa (a agenda não
--     tem imagem) e cada papel a mais é uma conta a mais para vazar. Vale a
--     mesma regra das tabelas: quem pode é decidido por `public.pode()`.
--  3. **Só PNG, JPEG e WEBP.** SVG fica DE FORA de propósito: SVG é XML e
--     aceita `<script>`. Como o arquivo é servido pelo domínio do Supabase e
--     não pelo do site, um SVG hostil não roda no vilmateixeira.com — mas roda
--     em cima da sessão do Supabase de quem abrir o link direto, e não há
--     motivo nenhum para aceitar esse formato num campo de foto.
-- ============================================================================


-- ════════ 1 · O BALDE ═══════════════════════════════════════════════════
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('site', 'site', true, 5242880,
          array['image/png','image/jpeg','image/webp'])
  on conflict (id) do update
     set public            = excluded.public,
         file_size_limit   = excluded.file_size_limit,
         allowed_mime_types = excluded.allowed_mime_types;
exception when insufficient_privilege then
  raise notice 'Sem permissão para criar o balde por SQL. Crie à mão em '
               'Storage → New bucket: nome "site", Public ligado, limite 5 MB, '
               'tipos image/png, image/jpeg, image/webp.';
end $$;


-- ════════ 2 · QUEM PODE SUBIR ═══════════════════════════════════════════
-- As policies moram em storage.objects, que pertence a `supabase_storage_admin`.
-- O SQL Editor roda como `postgres` e normalmente CONSEGUE criá-las — mas é a
-- mesma família de armadilha do gatilho em auth.users (ver schema.sql), então
-- aqui também se avisa e segue em vez de derrubar o resto do script.
do $$
begin
  -- leitura: o site é público, e o balde também
  drop policy if exists p_site_ler on storage.objects;
  create policy p_site_ler on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'site');

  -- escrita: só quem cuida do conteúdo do site
  drop policy if exists p_site_subir on storage.objects;
  create policy p_site_subir on storage.objects
    for insert to authenticated
    with check (bucket_id = 'site'
                and public.pode(array['admin','social']::papel_equipe[]));

  drop policy if exists p_site_trocar on storage.objects;
  create policy p_site_trocar on storage.objects
    for update to authenticated
    using (bucket_id = 'site'
           and public.pode(array['admin','social']::papel_equipe[]))
    with check (bucket_id = 'site'
                and public.pode(array['admin','social']::papel_equipe[]));

  drop policy if exists p_site_apagar on storage.objects;
  create policy p_site_apagar on storage.objects
    for delete to authenticated
    using (bucket_id = 'site'
           and public.pode(array['admin','social']::papel_equipe[]));

exception when insufficient_privilege then
  raise notice 'Sem permissão para criar as policies de storage por SQL. '
               'Faça em Storage → Policies, no balde "site": leitura para '
               'anon e authenticated; insert/update/delete só para '
               'authenticated com public.pode(array[''admin'',''social'']).';
end $$;

-- ============================================================================
-- O CAMINHO DOS ARQUIVOS, e por que ele tem carimbo de tempo:
--   balde "site", objeto <chave>-<timestamp>.<ext>
--   ex.: heroi.foto-1757620000.png
--   URL pública: <projeto>/storage/v1/object/public/site/<objeto>
--
-- Trocar a foto gravando por cima do mesmo nome parece mais limpo, e é uma
-- armadilha: CDN e navegador continuam servindo a imagem antiga por horas, e
-- a pessoa jura que o upload não funcionou — reenvia, reclama, desiste. Nome
-- novo a cada envio faz a troca aparecer na hora.
--
-- O arquivo antigo fica no balde. É de propósito: ocupa quase nada, e serve de
-- desfazer quando alguém sobe a foto errada cinco minutos antes do comício.
-- ============================================================================
