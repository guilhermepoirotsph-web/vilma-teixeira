# Vilma Teixeira — site de campanha + 2 painéis

Site institucional e de campanha da **Vereadora Vilma Teixeira (MDB, Caraguatatuba)**,
com ênfase nas candidaturas de **Regina Nunes — 15115** (Deputada Estadual) e
**Cezinha de Madureira — 2223** (Deputado Federal).

Domínio de destino: **www.vilmateixeira.com** (registrado na Locaweb em 07/09/2026, vence 07/09/2027).

---

## O que está pronto

| Peça | Situação |
|---|---|
| Site público, 12 seções imersivas | ✅ pronto, provado |
| Simulador de urna eletrônica | ✅ pronto, provado |
| Contagem regressiva para 4 de outubro | ✅ pronta |
| Recado da Vilma com **som e legenda** | ✅ player pronto — ⛔ falta o MP4 |
| Bloco do **hospital veterinário** (proposta) | ✅ pronto — ⚠️ ver ressalva abaixo |
| Formulário de apoio (controle de possíveis votos) | ✅ pronto, provado, LGPD ok |
| Painel da **Mariana** — agenda **pública + interna** | ✅ pronto, provado |
| Painel do **social media** (conteúdo + alimentar o site) | ✅ pronto, provado |
| Banco (schema, RLS, RPC) | ✅ escrito e provado em PGlite |
| Política de privacidade | ✅ pronta |
| Foto da **Regina** | ✅ no ar (foto de campanha do TSE) |
| Foto do **Cezinha** | ⚠️ provisória (retrato da Câmara) |
| Foto da **Vilma** | ⛔ **não existe uma que sirva** — ver abaixo |
| Supabase real criado | ⛔ **falta você** (5 min) |
| DNS do domínio | ⛔ **falta você** |

**Nada foi publicado. Nada foi commitado. Nenhuma senha foi digitada por mim.**

### 🚨 O MAIS IMPORTANTE: o WhatsApp saiu do site, e foi de propósito

O rodapé jura que o site **"não utiliza recursos, identidade visual ou estrutura da
Câmara Municipal"** — e, quatro linhas abaixo, publicava o **WhatsApp e o endereço do
gabinete**, além de usar o **retrato oficial da Câmara dos Deputados** do Cezinha.
É o print que o adversário faz. Isso é o que separa "página pessoal de manifestação"
de "propaganda feita com estrutura de mandato".

**O que eu fiz:**
- `campanha.whatsapp` agora nasce **vazio**. Sem número, todos os botões de WhatsApp
  (rodapé, flutuante, fecho, agenda e a tela de sucesso do formulário) **somem sozinhos**
  e o contato vira **formulário + Instagram**. Não existe caminho no código que caia no
  número do gabinete — e tem prova automática garantindo isso.
- O endereço e o CEP do gabinete saíram do rodapé.
- A foto do Cezinha passou a ser o **santinho de campanha dele** (`cezinha-santinho.webp`).
  O retrato da Câmara virou `_cezinha-camara-referencia.jpg`, só referência interna.

**O que você precisa fazer:** peça um **chip de campanha** para a Vilma e ponha o número
em `assets/js/dados.js` → `campanha.whatsapp: '5512999999999'`. No mesmo segundo todos os
botões voltam. Enquanto isso não acontece, o site funciona — só sem CTA de WhatsApp.

### ⚠️ Três coisas que você precisa ler antes de mostrar para a Vilma

**1. O vídeo que você mandou não fala de hospital veterinário.**
Conferi o post `instagram.com/p/Dcuqygpua5b/`: a legenda e o texto na tela são só o apoio à
Regina ("Vote 15115"). Não consigo ouvir o áudio. Então ou é outro vídeo, ou o hospital está
só na fala. Por isso o hospital veterinário entrou como **bloco próprio, marcado como
proposta de campanha**, e não como conteúdo daquele vídeo. Me diga qual é o caso.

**2. Vídeo com som exige um toque — é regra do navegador, não escolha minha.**
Nenhum navegador deixa vídeo tocar com áudio sem um gesto da pessoa. Se forçar, ele bloqueia
o vídeo inteiro. O que fiz é o melhor possível: o vídeo entra rodando **mudo em laço** (como
um pôster vivo) e um botão grande **"Ouvir o recado"** liga o som e volta ao começo. E a
legenda fica na tela do lado — quem não puder ouvir, **lê tudo**, que era o seu pedido.

**3. Não existe foto da Vilma que possa ir ao ar.**
A única pública é a do site da Câmara: 204×250 (minúscula) e **com o brasão da cidade atrás
dela**. Num site de campanha isso dá cara de comunicação oficial da Câmara — é o que a regra
manda evitar. Guardei em `fotos/_referencia-vilma-camara.jpg` só como referência.
Achei uma "Vilma Teixeira" com foto no TSE, **mas era outra pessoa** (PT, Vitória da
Conquista/BA) — apaguei na hora. **Peça uma foto para ela pelo WhatsApp**, de preferência
recorte PNG sem fundo. Enquanto não chega, o herói usa layout de pôster e fica bonito.

### Provas (rode quando quiser, tudo passa)
```
node banco/provar-sql.mjs          → 47/47   banco: RLS, papéis, LGPD
node ferramentas/provar.mjs        → 36/36   site sem banco: urna, form, agenda
node ferramentas/provar-painel.mjs → 32/32   painéis com banco de verdade
```

---

## Ver o site agora (nada a instalar)

No Terminal do Claude Code, **um comando por vez**:

```bash
node "C:\Users\sandr\OneDrive\Área de Trabalho\Clientes\Vilma Teixeira\site\preview-server.mjs"
```

Depois abra <http://localhost:8803> no navegador.
Para ver o painel: <http://localhost:8803/painel/>

**Parâmetros úteis na URL:**
- `?anim=0` — desliga todas as animações (para conferir texto e layout)
- `?3d=0` — desliga só o palco 3D do herói (WebGL)

---

## As 3 coisas que faltam

### 1. Fotos (peça para a assessoria hoje)

Coloque em `site/fotos/` com **estes nomes exatos**:

| Arquivo | O que é |
|---|---|
| `vilma.png` | Recorte da Vilma, **fundo transparente**, altura ≥ 1600px |
| `regina.png` | Recorte da Regina Nunes, fundo transparente |
| `cezinha.png` | Recorte do Cezinha, fundo transparente |

Enquanto não chegarem, o site mostra uma **moldura elegante escrita o que falta** —
nunca imagem quebrada. A arte de campanha que você me mandou já tem os três recortados;
se ela vier em alta, dá para extrair com o pipeline do Odonto Vitallis (sharp + ONNX).

> Baixei a foto institucional do Cezinha do site da Câmara dos Deputados
> (`fotos/cezinha-oficial.jpg`) só como referência interna. **Não use no ar:**
> é foto institucional, o site é de campanha. Peça a de campanha.

### 2. Supabase (5 minutos, só você pode fazer)

1. Criar projeto novo no Supabase (**dedicado desta campanha**, nunca o do Lovable Cloud).
2. SQL Editor → colar `banco/schema.sql` inteiro → **Run**.
3. Copiar a **URL** e a **publishable key** (Settings → API).
4. Colar nos **dois** arquivos (é o mesmo par de valores):
   - `assets/js/banco.js` → `const CONFIG = { url: '…', chave: '…' }`
   - `painel/painel.js` → `const CONFIG = { url: '…', chave: '…' }`
5. Authentication → Sign In/Providers → **"Allow new users to sign up" OFF**
   (clicar em **Save changes** — o toggle não salva sozinho).
6. Criar os usuários por convite e promover no SQL Editor:
   ```sql
   select public.promover('email-da-mariana@…','assessora');
   select public.promover('email-do-social@…','social');
   select public.promover('seu-email@…','admin');
   ```

> **Por que os dois arquivos:** o site público usa `banco.js`, o painel usa `painel.js`.
> Chave publishable é pública por natureza — quem protege é a RLS, e ela está provada.
> **Nunca** cole a `service_role` em nenhum dos dois.

### 3. Domínio — você tem `vilmateixeira.com`, **sem** o `.br`

Conferido em 09/09/2026 direto no DNS e no RDAP:

| | |
|---|---|
| Domínio | **vilmateixeira.com** |
| Registrado em | 07/09/2026 · **vence 07/09/2027** |
| Registrador | eNom (revenda da Locaweb) |
| Nameservers | `ns1/ns2/ns3.locaweb.com.br` |
| Aponta para | **nada ainda** — sem registro A |

**`.br` não é obrigatório.** A lei eleitoral não fala em terminação de domínio. O que o
art. 57-B, I e II exige — e só para **site de candidato ou de partido** — é hospedagem em
provedor **estabelecido no País** e comunicação do endereço à Justiça Eleitoral.
A Vilma **não é candidata em 2026**: a página dela cai no inciso IV, "b" (manifestação de
pessoa natural), sem exigência de domínio nem de hospedagem. `vilmateixeira.com` serve.
Se quiser cinto e suspensório, hospede na própria **Locaweb**, que é empresa brasileira.

⚠️ **`vilmateixeira.com.br` não é seu.** A API do Registro.br devolve **status 5** e o RDAP
volta sem titular, sem datas e sem nameserver — é o estado de **domínio em processo de
liberação**. Quase certamente é o endereço do site dela de 2024, que ainda aparece no
Google. Isso significa que **quem digitar `.com.br` não chega no site novo**, e que quando
liberar **qualquer um pode registrar, inclusive adversário**. Vale acompanhar em
`registro.br/busca-dominio` e pegar quando abrir — custa ~R$40/ano.

**Como apontar o `.com` (painel da Locaweb → Domínios → Zona DNS):**

- **GitHub Pages** (grátis, o site é estático):
  apex `@` → quatro registros **A**: `185.199.108.153`, `185.199.109.153`,
  `185.199.110.153`, `185.199.111.153`
  `www` → **CNAME** `guilhermepoirotsph-web.github.io.` (com o ponto no fim)
  **Ordem que importa:** DNS primeiro, arquivo `CNAME` no repo depois — se inverter, o
  Pages passa a atender só no domínio novo e o `github.io` sai do ar até propagar.
- **Hospedagem da própria Locaweb**: se você já tem plano lá, é só subir a pasta por FTP —
  o site é estático, não precisa de PHP nem de banco para o front.

Na virada, ainda falta: tirar o `noindex` do `partes/_molde.html`, liberar o
`robots.txt` (já tem o texto pronto comentado dentro) e remontar com `node montar.mjs`.

---

## Como o site é feito

Vitrine estática por partes (o molde da casa), sem bundler:

```
partes/_molde.html      cabeça, nav, rodapé
partes/01..12-*.html    as 12 seções
        ↓  node montar.mjs
index.html              gerado — NÃO editar à mão
```

Cada parte pode ter CSS em `assets/css/secoes.css` e JS em
`assets/js/secoes/<nome>.js` (o `montar.mjs` inclui sozinho pelo nome).

**Stack:** GSAP 3.15 + ScrollTrigger + SplitText + Lenis + Three.js 0.185,
tudo local em `vendor/` (nada de CDN). Supabase por cima.

### As 12 seções
1. **Herói** — palco de comício em WebGL (mar de luzes + feixes), nome em assinatura,
   as duas placas de número como na arte de campanha
2. **União** — a frase "duas lideranças que trabalham por Caraguá e pelo Brasil"
3. **História** — linha do tempo **horizontal pinada** (1995 → 2024)
4. **Mandato** — as **141 proposições** contadas na tela + PL 15/26 + bandeiras
5. **Vídeo** — o Reel dela em destaque, embed oficial do Instagram
6. **Regina Nunes 15115** — palco magenta
7. **Cezinha de Madureira 2223** — palco azul + votação crescente animada
8. **Urna** — simulador de urna eletrônica funcionando
9. **Caraguá** — faixas infinitas com os 20 bairros
10. **Agenda** — puxa do banco, filtro por tipo, "como chegar", salvar no calendário
11. **Apoie** — formulário em 3 passos
12. **Fecho** — "Juntos por Caraguá e pelo Brasil"

### O simulador de urna
É a peça que ninguém esquece. Funciona igual à urna de verdade:
Deputado Federal (2223) → CONFIRMA → Deputada Estadual (15115) → CONFIRMA → FIM.
Tem som de tecla gerado no navegador (Web Audio, sem arquivo, sem direito autoral),
aceita **teclado físico**, recusa número que não é dos apoiados, tem BRANCO e CORRIGE,
e solta confete no fim. **Nada é enviado nem gravado** — está escrito na tela.

---

## Os dois painéis

Um login só (`/painel/`), duas experiências separadas pelo **papel** da pessoa.
Quem manda é a RLS do banco; esconder menu é só conforto.

### Painel da Mariana (`assessora`)
- **Agenda**: calendário do mês + visão de lista. Criar clicando no dia.
  `Publicar no site` liga/desliga a aparição pública; `Interno` **nunca** vai ao site
  (marcar um desmarca o outro sozinho).
- **Apoiadores**: quem se cadastrou, com busca, filtro por bairro e situação,
  WhatsApp com mensagem pronta em um clique, anotação da equipe, exportar CSV
  e **excluir** (direito do titular, LGPD art. 18).
- **Não vê** conteúdo nem o editor do site.

### Painel do social media (`social`)
- **Conteúdo**: calendário editorial em kanban de 6 etapas (ideia → publicado),
  arrastando o card. Roteiro, legenda, hashtags e link do post.
- **Site**: as **lacunas editáveis** — é aqui que ele alimenta o site sem código.
  Trocar o **vídeo em destaque** (cola o link do Instagram e pronto), textos, nomes,
  números, fotos e a faixa de aviso do topo. Salva sozinho ao sair do campo.
- **Não vê nenhum contato de apoiador.** Provado no `provar-painel.mjs`.

### Admin (você)
Vê tudo.

> **Conta nova nasce inerte** (sem papel, `ativo=false`) e cai numa tela dizendo
> que precisa ser liberada. Promover é ação manual sua, por SQL.

---

## Decisões que tomei enquanto você dormia

1. **Estático + Supabase, não Lovable.** O site é 100% estático; só a agenda,
   o formulário e os painéis falam com banco. Roda em qualquer hospedagem, inclusive
   GitHub Pages de graça, e o domínio é seu.
2. **Vídeo por embed, não baixado.** Re-hospedar o Reel esbarra em direito autoral e
   nos termos do Instagram — e a visualização não contaria para ela. O embed oficial
   resolve os três. Se ele for bloqueado, a moldura vira um convite "Assistir no
   Instagram", nunca um buraco.
3. **Efeitos ficam ligados mesmo com "reduzir movimento"** (sua decisão de 06/09).
   Só `?anim=0` desliga.
4. **Nenhum número inventado.** As 141 proposições saíram do sistema da Câmara,
   conferidas uma a uma (75 requerimentos + 25 moções + 15 indicações + 11 resoluções
   + 9 PLs + 5 decretos + 1 emenda = 141). Tudo com fonte em `docs/DADOS.md`.
5. **Intenção de voto é dado sensível.** Você pediu "controle de possíveis votos" —
   está feito, mas com consentimento **específico e destacado**, separado do comum
   (LGPD art. 11, I). Sem ele, o site **não envia** a declaração e o banco **recusa**
   por constraint. Nome, WhatsApp e bairro seguem no consentimento normal.
6. **Zero documento.** Não existe campo nem coluna de CPF/título. Está escrito no site.
7. **Sem banco, ninguém se perde.** Se o Supabase cair (ou antes de existir), o
   cadastro vai para uma fila local e o WhatsApp abre com tudo preenchido.

---

## Alertas que eu preciso deixar registrados

**São pessoas politicamente expostas e é ano de eleição.** Não é opinião jurídica —
é o checklist que apliquei. **A campanha deve validar com o advogado dela:**

1. **Identificação obrigatória** (art. 57-B da Lei 9.504/97): o rodapé identifica a
   responsável. Vedado o anonimato.
2. **Nada de "cara de órgão oficial":** não usei brasão, logo, foto institucional nem
   identidade da Câmara. Site pessoal, recursos próprios.
3. **Sem propaganda paga:** impulsionamento só é permitido a partido/coligação/candidato
   registrado. Este site não compra nem vende espaço.
4. **Reconferir os números antes de publicar.** Em 08/09/2026, 15115 (Regina Nunes/MDB)
   e 2223 (Cezinha de Madureira/PL) estavam com registro **deferido** no TSE.
   Registro pode mudar — confira no DivulgaCand antes de subir.
5. **Dia da eleição** tem restrição de propaganda. O painel permite despublicar a agenda
   e você pode tirar o formulário do ar rapidamente se o advogado pedir.
6. **A frase "primeira mulher a se reeleger por três mandatos consecutivos"** está no
   site **atribuída** à biografia oficial da Câmara — não como afirmação nossa.

---

## Onde estão as coisas

```
site/
  index.html            GERADO — não editar
  montar.mjs            junta as partes
  preview-server.mjs    servidor local (porta 8803)
  privacidade.html      política de privacidade (LGPD)
  partes/               as 12 seções + _molde.html
  assets/css/           base.css (design system) + secoes.css
  assets/js/            dados.js · nucleo.js · banco.js · conteudo.js
  assets/js/secoes/     um arquivo por seção
  painel/               index.html · painel.css · painel.js
  banco/                schema.sql · provar-sql.mjs
  ferramentas/          capturar.mjs · provar.mjs · provar-painel.mjs
                        capturar-painel.mjs · supabase-falso.mjs
  docs/DADOS.md         FONTE ÚNICA DE VERDADE (tudo com procedência)
  caps/                 capturas de tela de todas as seções e painéis
  fotos/                ← as fotos entram aqui
  vendor/               GSAP, Lenis, Three (locais)
```

**Segredos:** nenhum neste projeto ainda. Quando o Supabase existir, a URL e a chave
publishable ficam hardcodadas nos dois arquivos (são públicas). A `service_role`
e as senhas da equipe vão para `SENHAS-NAO-COMITAR.txt` — **nunca no cofre, nunca no git**.

---

## Ferramentas que deixei prontas

| Comando | O que faz |
|---|---|
| `node montar.mjs` | remonta o `index.html` a partir das partes |
| `node preview-server.mjs` | servidor local na porta 8803 |
| `node ferramentas/capturar.mjs` | fotografa as 12 seções (Chrome headless) |
| `node ferramentas/capturar.mjs --largura=390 --altura=844` | as mesmas no celular |
| `node ferramentas/provar.mjs` | 36 provas do site |
| `node banco/provar-sql.mjs` | 47 provas do banco em Postgres real (PGlite) |
| `node ferramentas/supabase-falso.mjs` | Supabase de mentira para testar os painéis |
| `node ferramentas/provar-painel.mjs` | 32 provas dos dois painéis |
| `node ferramentas/capturar-painel.mjs` | fotografa os painéis com dados de exemplo |

> O **Browser pane do Claude Code devolve captura preta depois de qualquer scroll**
> (defeito já registrado no cofre). Por isso a conferência visual é pelo
> `capturar.mjs`, não pelo painel do navegador.

---

## Fica para depois (você já disse)

- Automações n8n e disparo de mensagem depois de algumas perguntas
- API oficial do WhatsApp
- Agente com modelo de linguagem
- Responsividade fina (fiz o básico: tudo responde, zero vazamento horizontal,
  input 16px no mobile — mas não passei em aparelho real)
- Upload de foto direto pelo painel (hoje é por link; o campo já existe)
