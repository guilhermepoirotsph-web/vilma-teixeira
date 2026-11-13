# fotos/ — as imagens da Vilma

Arquivos com `_` no começo do nome **não vão ao ar** (o `publicar.mjs` pula), e este
LEIA-ME também não (`.md` nunca é publicado).

| Arquivo | Onde aparece | Observação |
|---|---|---|
| `vilma.png` | herói, avatar do Instagram, formulário, card do WhatsApp | **recorte sem fundo**, altura ≥ 1600px — o ideal |
| `vilma-retrato.jpg` | os mesmos lugares, emoldurado | usado só se não houver `vilma.png` |
| `galeria-*.jpg` | seção "Vilma em Caraguá" | liste em `assets/js/dados.js → galeriaArquivos` |

O caminho normal é o **painel** (Site → Abertura / Galeria / Instagram): a foto
sobe direto, sem mexer em código. Arquivo aqui é para quem mexe no repositório.

Depois de pôr a foto da Vilma, rode `npm run og` para o card de compartilhamento
usar a foto dela.

Nunca: foto do site da Câmara (tem o brasão do município atrás), foto de outro
político, arte de campanha de outra candidatura.

**Foto vinda do Instagram dela:** até 13/11/2026 a regra era "só pelo embed
oficial, nunca por cópia". O Guilherme mudou isso nesse dia: pode copiar foto do
perfil **dela** (@vereadoravilma) quando não houver arquivo melhor. Continua
valendo: só foto em que ela aparece sozinha — nada de terceiros, criança,
outro político ou arte da Câmara — e a origem fica anotada abaixo.

| Arquivo | Origem |
|---|---|
| `vilma-retrato.jpg` | post dela, instagram.com/p/DEWANHZOpTa/ (1080×1080), copiado em 13/11/2026 |
