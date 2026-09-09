# Vilma Teixeira — site de campanha + painéis da equipe

Site da **Vereadora Vilma Teixeira (MDB, Caraguatatuba-SP)**, com ênfase nas
candidaturas de **Regina Nunes — 15115** (Deputada Estadual) e
**Cezinha de Madureira — 2223** (Deputado Federal).

Domínio: **www.vilmateixeira.com** · Feito por [GD Studio X](https://github.com/guilhermepoirotsph-web)

> 📖 **O manual completo está em [LEIA-ME.md](LEIA-ME.md)** — o que está pronto,
> o que falta, e o passo a passo de cada pendência.
> 🗂️ **Os fatos do site têm procedência em [docs/DADOS.md](docs/DADOS.md)**, que é a
> fonte única de verdade. Nada no site é afirmado sem estar lá.

---

## Como isto é feito

Vitrine estática montada por partes, **sem bundler**:

```
partes/_molde.html  +  partes/01..12-*.html
        ↓  node montar.mjs
index.html                     ← GERADO. Não editar à mão.
        ↓  node publicar.mjs
_site/                         ← o que a hospedagem recebe
```

O repositório guarda **tudo**: schema do banco, provas, ferramentas e documentação.
A hospedagem recebe só `_site/`. Sem essa separação, `banco/schema.sql` e
`docs/DADOS.md` ficariam acessíveis por URL.

**Stack:** GSAP 3.15 + ScrollTrigger + SplitText + Lenis + Three.js 0.185,
tudo local em `vendor/`. Supabase (Postgres + Auth + RLS) por trás da agenda,
do formulário e dos painéis.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run montar` | remonta o `index.html` a partir das partes |
| `npm run previa` | servidor local na porta 8803 |
| `npm run publicar` | monta `_site/` e recusa publicar se achar segredo |
| `npm run og` | redesenha o cartão de compartilhamento (`assets/img/og.jpg`) |
| `npm run virar` | prepara o site para o domínio (CNAME, canonical, sitemap, robots) |
| `npm run banco:falso` | Supabase de mentira em PGlite, para testar os painéis |
| `npm run semear` | enche o banco de prévia com dados de demonstração |

## Provas

Nada é dado como pronto sem prova que roda. **158 no total**, e elas rodam
sozinhas na Action antes de qualquer publicação:

| Bateria | Quantas | O que garante |
|---|---|---|
| `npm run provar:banco` | 47 | RLS, papéis, consentimento LGPD, anti-takeover — em Postgres real (PGlite) |
| `npm run provar:site` | 44 | urna, formulário, agenda, herói, scroll, WhatsApp do gabinete nunca vaza |
| `npm run provar:painel` | 37 | os dois painéis com login de verdade; cada papel só baixa o que pode ver |
| `npm run provar:publicacao` | 30 | o pacote leva o certo, e a rede contra segredo é testada com chave plantada |

As provas de painel precisam do banco falso e do servidor de prévia no ar:

```bash
npm run banco:falso    # porta 8810, numa aba
npm run previa         # porta 8803, noutra
npm run provar:painel
```

## Publicação

Todo push na `main` dispara [`.github/workflows/publicar.yml`](.github/workflows/publicar.yml):
roda as provas, monta `_site/` e publica no GitHub Pages. Prova vermelha
não vai ao ar.

## O que nunca entra aqui

Chave `service_role`, senha, token, connection string. A chave *publishable* do
Supabase é pública por natureza e pode ficar no código — quem protege é a RLS,
e ela é provada. Segredo de verdade mora em `SENHAS-NAO-COMITAR.txt`, que está
no `.gitignore`. O `publicar.mjs` também **aborta** se encontrar um JWT de papel
diferente de `anon` no material que iria ao ar.

## Aviso eleitoral

Página de manifestação pessoal, mantida com recursos próprios. Não utiliza
recursos, identidade visual ou estrutura da Câmara Municipal de Caraguatatuba.
O checklist aplicado está em [LEIA-ME.md](LEIA-ME.md) e **deve ser validado pelo
advogado da campanha** antes da publicação.
