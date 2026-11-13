-- ============================================================================
--  VILMA TEIXEIRA — 09 · O SITE PASSA A SER SÓ DA VILMA (13/11/2026)
--  Rodar DEPOIS de 08-fotos.sql. Idempotente: pode rodar mais de uma vez.
--
--  A eleição de 4/10/2026 passou e o site deixou de falar de Regina Nunes
--  (15115) e Cezinha de Madureira (2223). Este arquivo acerta as LACUNAS
--  EDITÁVEIS do painel (tabela site_conteudo) para o site novo:
--
--  SAEM  · regina.*, cezinha.*  — candidatos que não estão mais no site
--        · video.*              — o "vídeo em destaque" era o reel de apoio à
--                                 Regina; quem faz esse papel agora são os
--                                 posts do Instagram (abaixo)
--        · heroi.lead           — o texto gravado no banco ainda dizia "está
--                                 pedindo dois votos". Ele é trocado por uma
--                                 chave NOVA (heroi.texto), e não só editado,
--                                 para que um valor velho esquecido no banco
--                                 nunca mais volte a aparecer no site.
--
--  ENTRAM · heroi.texto          — texto de abertura do herói
--         · instagram.post1…4    — links de posts/reels do Instagram dela
--         · galeria.1…6          — fotos da Vilma (sobem pelo painel)
--
--  Regra da casa mantida: chave que existe aqui TEM campo no painel E é lida
--  pelo site (assets/js/conteudo.js). Nenhuma chave sem efeito.
--
--  NÃO mexe em apoiadores: quem declarou apoio a 15115/2223 antes da eleição
--  continua com o registro e o consentimento que deu (LGPD). O site só parou
--  de PERGUNTAR. A função registrar_apoio segue aceitando `apoio` vazio.
-- ============================================================================

begin;

-- ════════ 1 · O QUE SAI ════════════════════════════════════════════════
delete from public.site_conteudo
 where grupo in ('regina', 'cezinha', 'video')
    or chave like 'regina.%'
    or chave like 'cezinha.%'
    or chave like 'video.%'
    or chave = 'heroi.lead';

-- ════════ 2 · O QUE ENTRA ══════════════════════════════════════════════
insert into public.site_conteudo (chave, grupo, rotulo, tipo, dica, ordem) values
  ('instagram.post1', 'instagram', 'Post em destaque 1 (o primeiro da grade)', 'url',
   'Cole o link do post ou reel. Ex.: https://www.instagram.com/p/XXXXXXXX/ — link de PERFIL não vale.', 10),
  ('instagram.post2', 'instagram', 'Post em destaque 2', 'url',
   'Link de post ou reel da @vereadoravilma.', 20),
  ('instagram.post3', 'instagram', 'Post em destaque 3', 'url',
   'Link de post ou reel da @vereadoravilma.', 30),
  ('instagram.post4', 'instagram', 'Post em destaque 4', 'url',
   'Link de post ou reel da @vereadoravilma.', 40),

  ('galeria.1', 'galeria', 'Foto 1 (a grande, abre a galeria)', 'imagem',
   'Foto da Vilma em ação: agenda, bairro, sessão. Paisagem, de preferência. JPG/PNG/WEBP até 5 MB.', 10),
  ('galeria.2', 'galeria', 'Foto 2', 'imagem', null, 20),
  ('galeria.3', 'galeria', 'Foto 3', 'imagem', null, 30),
  ('galeria.4', 'galeria', 'Foto 4', 'imagem', null, 40),
  ('galeria.5', 'galeria', 'Foto 5', 'imagem', null, 50),
  ('galeria.6', 'galeria', 'Foto 6', 'imagem', null, 60)
on conflict (chave) do nothing;

-- heroi.texto nasce VAZIO, como toda lacuna (o site usa o padrão do código).
-- Para o painel mostrar o texto que está no ar em vez de um campo em branco,
-- rode depois o SQL que `node ferramentas/semear-site-conteudo.mjs` imprime.
insert into public.site_conteudo (chave, grupo, rotulo, tipo, dica, ordem) values
  ('heroi.texto', 'heroi', 'Texto de abertura do herói', 'texto_longo',
   'O parágrafo embaixo do nome "Vilma Teixeira". Em branco, o site usa o texto padrão.', 20)
on conflict (chave) do nothing;

-- ════════ 3 · TEXTOS QUE MUDARAM DE SENTIDO ════════════════════════════
-- O WhatsApp agora é o número PRÓPRIO da Vilma (não existe mais "campanha"),
-- e a foto do herói pode ser recorte OU retrato.
update public.site_conteudo
   set rotulo = 'WhatsApp próprio da Vilma (NÃO o do gabinete)',
       dica   = 'Usar o número do mandato aqui é usar estrutura da Câmara numa página pessoal — '
             || 'o que o rodapé do site jura não fazer. Só dígitos, com 55 e DDD: 5512XXXXXXXXX.'
 where chave = 'geral.whatsapp';

update public.site_conteudo
   set rotulo = 'Foto da Vilma no herói',
       dica   = 'PNG sem fundo fica melhor (recorte). JPG comum também serve: entra emoldurado. '
             || 'Nunca foto com brasão ou fundo oficial da Câmara.'
 where chave = 'heroi.foto';

update public.site_conteudo
   set dica = 'Ex.: Reunião no bairro neste sábado, 19h!'
 where chave = 'geral.aviso';

commit;
