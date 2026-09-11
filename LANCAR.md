# Lançar — o que só você pode fazer

Tudo o que dava para fazer daqui está feito e provado. O que sobrou depende de
uma conta que é sua: GitHub, Supabase, Locaweb, n8n.

São **quatro blocos**, na ordem. Cada um funciona sozinho — se parar no meio,
nada quebra.

---

## 1 · GitHub (10 minutos) — põe o site no ar num endereço de teste

O repositório local já existe, com dois commits. Falta o do GitHub.

**1.1** Crie o repositório em <https://github.com/new>, na conta
`guilhermepoirotsph-web`:

| Campo | Valor |
|---|---|
| Nome | `vilma-teixeira` |
| Visibilidade | **Público** — Pages em repo privado exige GitHub Pro |
| Inicializar com README | **não marque nada** |

> **Sobre ser público:** o repositório guarda `banco/`, `docs/` e as provas —
> e nada disso vai ao ar (quem decide é o `publicar.mjs`), mas fica legível no
> github.com. Já varri: não há chave, senha nem token. Os contatos do gabinete
> saíram do `dados.js` **e** do `DADOS.md`, e o material de referência interna
> (`fotos/_*`) está no `.gitignore`. Se preferir privado, assine o Pro e o
> mesmo YAML roda sem mudar uma linha.

**1.2** No terminal, dentro da pasta do projeto:

```bash
git remote add origin https://github.com/guilhermepoirotsph-web/vilma-teixeira.git
git push -u origin main
```

**1.3** No repositório → **Settings → Pages**:
- **Source: GitHub Actions** ← sem isto o deploy falha
- deixe **Custom domain vazio por enquanto** (bloco 4)

**1.4** Aba **Actions**: a publicação roda sozinha. Ela primeiro **prova**
(banco, site, publicação, n8n) e só depois publica. Prova vermelha não vai ao
ar. Em 2–3 minutos o site está em
`https://guilhermepoirotsph-web.github.io/vilma-teixeira/`.

> Ele sobe com `noindex` e `robots.txt` bloqueando — é prévia. O Google só entra
> no bloco 4.

---

## 2 · Supabase (15 minutos) — liga a agenda, o formulário e os painéis

**2.1** Crie um projeto **dedicado desta campanha** em <https://supabase.com>.
Nunca reaproveite o de outro cliente. Região: `South America (São Paulo)`.

**2.2** Gere o arquivo único e cole ele no **SQL Editor**, numa colagem só:

```bash
node banco/montar-sql.mjs
```

Isso escreve `banco/TUDO.sql`, que é a concatenação **nesta ordem** de:

```
banco/schema.sql          estrutura, RLS e as funções de papel
banco/02-contato.sql      opt-out, lista de contato e backup
banco/03-blindagem.sql    trava de coluna (ninguém se autopromove)
banco/04-automacao.sql    log, resumo do dia e o papel n8n_bot
banco/05-privilegios.sql  fecha EXECUTE em PUBLIC e escrita nas views
```

Rodar os cinco separados dá no mesmo — mas colar o `TUDO.sql` evita ordem
trocada e arquivo esquecido, e é o que a suíte testa. Os cinco são
idempotentes: colar de novo não quebra nada.

> ⚠ **Confira que a colagem terminou.** O SQL Editor **para no primeiro
> erro** e não diz o que ficou para trás. Se ele morrer no meio, a estrutura
> entra mas a blindagem e os privilégios não — e o banco fica aberto
> parecendo pronto. O fim da saída tem que ser `Success`, não vermelho.
>
> A idempotência é provada de duas maneiras, porque uma só enganava:
> `node banco/provar-sql.mjs` roda o `TUDO.sql` **duas vezes** num Postgres
> limpo **e** reconstrói a condição real do Supabase — `auth.users`
> pertencendo a outro papel, o script rodando por quem não é dono dela.
> Foi a segunda prova que pegou um `drop trigger` que passava na primeira
> colagem e matava a segunda.

**2.3** **Settings → API**: copie a **URL** e a **publishable key** (`anon`).
Cole o mesmo par nos dois arquivos:

- `assets/js/banco.js` → `const CONFIG = { url: '…', chave: '…' }`
- `painel/painel.js` → `const CONFIG = { url: '…', chave: '…' }`

> A `anon` é pública por natureza — quem protege é a RLS, e ela está provada.
> A **`service_role` nunca entra em nenhum dos dois**, e o `publicar.mjs`
> **aborta a publicação** se encontrar um JWT de papel diferente de `anon` no
> material. Já testei plantando uma chave falsa: ele barra.

**2.4** **Authentication → Sign In / Providers**: desligue
**"Allow new users to sign up"** e clique em **Save changes** (o toggle não
salva sozinho).

**2.5** Convide a equipe (**Authentication → Users → Invite**) usando o e-mail
real de cada um. Cada pessoa **define a própria senha** pelo convite — você
nunca digita nem vê senha de ninguém. Depois, no SQL Editor:

```sql
select public.promover('email-da-mariana@…','assessora');
select public.promover('email-do-lucas@…','social');
select public.promover('guilhermepoirotsph@gmail.com','admin');
```

Antes disso a conta **nasce inerte** e cai numa tela de "aguardando liberação".
Para tirar acesso depois: `select public.revogar('email@…');`

> Isso não era verdade até hoje: qualquer conta logada conseguia se promover a
> admin com um PATCH na própria linha. Corrigido, e agora tem prova.

**2.6** **Database → Extensions**: habilite **`pg_cron`**. Depois, no SQL Editor:

```sql
select cron.schedule('backup-diario','0 6 * * *', $$select public.gerar_backup()$$);
```

(06:00 UTC = 03:00 em Brasília.) Confira dias depois com
`select feito_em, tabelas, linhas from public.backups order by feito_em desc limit 5;`

**2.7** `git add -A && git commit -m "liga o Supabase" && git push` — a Action
republica sozinha.

---

## 3 · n8n (20 minutos) — as automações

Leia antes: **`n8n/LEIA-ME.md`**. O resumo é que **nenhum fluxo manda mensagem
para eleitor**, e o porquê está lá com a citação da política da Meta.

**3.1** No SQL Editor, dê senha ao robô:

```sql
alter role n8n_bot login password 'ESCOLHA-UMA-SENHA-FORTE';
```

A senha vai para `SENHAS-NAO-COMITAR.txt`. Nunca no git, nunca no cofre.

**3.2** No n8n, crie a credencial Postgres **"Supabase Vilma"** apontando para
o **pooler** (o host direto do Supabase é só IPv6 e o VPS é IPv4):

```
host   aws-0-sa-east-1.pooler.supabase.com     porta 5432
user   postgres.<ref-do-projeto>               database postgres
senha  a que você acabou de criar
SSL    require   +   "Ignore SSL Issues" ligado
```

**3.3** Instale os fluxos **nesta ordem** (o `00` precisa existir primeiro,
porque os outros apontam para ele):

```
n8n/00-erros.json
n8n/01-backup-redundante.json
n8n/02-resumo-do-dia.json
n8n/03-sentinela.json
n8n/04-calendario-eleitoral.json
```

**3.4** Troque todo `SUBSTITUIR`: id das credenciais, e-mails da Mariana e do
Lucas, ref do Supabase, chave publishable e o id do fluxo `00-erros`.

**3.5** Publique cada um (**Publish**, não "salvar").

---

## 4 · Domínio (30 minutos + propagação) — a virada

⚠️ **Só faça este bloco quando o site estiver aprovado.** Aqui ele sai do
`noindex` e entra no Google.

**4.1** **Primeiro no GitHub**, Settings → Pages → **Custom domain**:
`www.vilmateixeira.com` → Save.

> A ordem é essa mesmo, e é contraintuitiva. A documentação do GitHub avisa que
> apontar o DNS antes de reivindicar o domínio abre uma janela em que outra
> pessoa pode hospedar um site nesse subdomínio.

**4.2** **Locaweb → Domínios → Zona DNS** de `vilmateixeira.com`:

| Nome | Tipo | Valor |
|---|---|---|
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `guilhermepoirotsph-web.github.io.` ← com o ponto no fim |

A Locaweb aceita A no apex apontando para fora. Se ela travar, o plano B é
mover **só o DNS** para a Cloudflare com a nuvem **cinza** (proxy desligado) —
mas então recrie MX/SPF/DKIM antes de virar os nameservers, ou o e-mail cai.

**4.3** Espere o DNS responder (10 min a algumas horas):

```bash
nslookup www.vilmateixeira.com 1.1.1.1
```

**4.4** Só então, no projeto:

```bash
node virar-dominio.mjs
```

Ele tira o `noindex`, ativa canonical e `og:url`, deixa as imagens de
compartilhamento em URL absoluta, libera o `robots.txt` mantendo `/painel/`
fora dos buscadores, gera o `sitemap.xml` e remonta o `index.html`.
Se precisar voltar atrás: `node virar-dominio.mjs --reverter` (o ciclo está
provado como reversível, sem deixar diferença).

```bash
git add -A && git commit -m "virada para o domínio" && git push
```

**4.5** No GitHub, Settings → Pages → marque **Enforce HTTPS** quando o
certificado sair (alguns minutos).

**4.6** Cole `https://www.vilmateixeira.com` no WhatsApp para conferir se o
cartão de compartilhamento aparece. Se o Facebook tiver cacheado a versão
antiga: <https://developers.facebook.com/tools/debug/>.

---

## O que continua faltando e não depende de mim

| O quê | Por quê |
|---|---|
| **Chip de campanha** | Sem número de campanha, os botões de WhatsApp somem do site — de propósito. Usar o do gabinete é usar estrutura de mandato. Com o chip, preencha `campanha.whatsapp` em `assets/js/dados.js` (ou o campo "WhatsApp da campanha" no painel do Lucas) e os botões voltam sozinhos. |
| **Foto da Vilma** | A única pública é a da Câmara: 204×250, com o brasão atrás. Peça um recorte PNG sem fundo, altura ≥ 1600px, e salve como `fotos/vilma.png`. |
| **O MP4 do recado** | O player com som e legenda está pronto e esperando. Sem o arquivo, cai no embed do Instagram. |
| **Advogado da campanha** | Validar o checklist eleitoral (`LEIA-ME.md`) e **reconferir no DivulgaCand** se 15115 e 2223 seguem deferidos. O site afirma que sim. |

---

## A regra do WhatsApp, para você repassar à Mariana e ao Lucas

Uma linha, e ela evita o problema inteiro:

> **Conversa individual com quem se cadastrou no site, sim.
> Lista de transmissão, não — nem pelo aplicativo.**

O porquê, se alguém perguntar: são **duas regras diferentes, de duas
autoridades diferentes**. A Meta proíbe a *Plataforma/API* em campanha política
— e o aplicativo WhatsApp Business é liberado, isso é verdade. Mas a Justiça
Eleitoral proíbe **disparo em massa**, e a definição legal é neutra quanto à
tecnologia (Res. TSE 23.610/2019, art. 37, XXI: *"um mesmo conteúdo, ou
variações deste, para um grande volume de usuárias e usuários por meio de
aplicativos de mensagem instantânea"* — não diz "via API"). Usar o app
permitido resolve só a primeira regra.

E não vale o argumento de que a lista de transmissão "já filtra sozinha" porque
só entrega a quem salvou o número: salvar contato é ato de quem recebe, e a
norma exige *"manifestação livre, informada e inequívoca"* (art. 37, XXVII).

**Se alguém responder SAIR:** 48 horas para descadastrar **e apagar os dados**,
sob multa de **R$ 100 por mensagem** enviada depois (art. 33, §1º). Marque na
hora no painel — ou mande a pessoa em `vilmateixeira.com/privacidade.html#descadastrar`,
que resolve sozinha.

---

## Antes do dia 4 de outubro

**Publicar conteúdo novo no dia da eleição é crime**, não multa (Lei 9.504/97,
art. 39, §5º, III e IV). Isso vale para post, para evento novo na agenda e para
troca de texto no painel.

O fluxo `04-calendario-eleitoral` avisa a equipe nos dias 01, 02, 03, 04 e 05.
Combine com a Mariana e o Lucas: **no sábado, tudo o que tiver de estar no ar
já está.** Tirar coisa do ar no domingo pode — tirar não é publicar.
