# Automações no n8n

Quatro fluxos, todos internos. **Nenhum deles fala com eleitor** — e isso não é
timidez de projeto, é o que a regra permite.

## Por que o n8n aqui é copiloto, não remetente

O pedido original era "API do WhatsApp + disparo pelo n8n". Não dá, por dois
motivos independentes — qualquer um dos dois já bastaria:

**1. A Meta proíbe.** A política oficial da WhatsApp Business Platform, em
português (`whatsappbusiness.com/pt-br/policy`, conferido em 09/09/2026):

> Proibimos o uso da Plataforma do WhatsApp Business por políticos ou partidos,
> candidatos e campanhas políticas.

Sem exceção, sem via de aprovação, e a proibição alcança também "entidades que
prestam serviços relacionados à política" — ou seja, a própria GD Studio não
pode mandar pela conta dela em nome da campanha. O risco não é só a conta da
Vilma ser reprovada: **banimento escala para o portfólio inteiro do Meta
Business**, e nesse portfólio moram os clientes comerciais da agência.

**2. A lei eleitoral proíbe.** A Resolução TSE 23.610/2019 veda o disparo em
massa de conteúdo político-eleitoral em aplicativo de mensagem, e proíbe ceder,
doar ou vender cadastro eletrônico a candidato ou partido.

**E "API não oficial" por QR Code** (Evolution, Baileys, Z-API e afins) é pior,
não melhor: viola os Termos do WhatsApp, foi o alvo das ondas de banimento de
números brasileiros em 2026, e é literalmente o disparo em massa que a norma
veda.

## O que dá para fazer, e é o que está montado aqui

A pessoa fala primeiro (link `wa.me` no site), a equipe responde **uma a uma**
pelo aplicativo WhatsApp Business — que é liberado para político, porque a
vedação é da *Plataforma/API*, não do aplicativo. O banco guarda a prova de
consentimento, quem já foi contatado e quem pediu para sair.

O n8n avisa, prepara o texto e monta o link. **Quem aperta o botão é uma
pessoa.**

## Os fluxos

| Arquivo | Quando roda | O que faz |
|---|---|---|
| `00-erros.json` | quando outro fluxo falha | grava no log e avisa por e-mail. **Instale este primeiro** — os outros apontam para ele. |
| `01-backup-redundante.json` | 04:10 | chama `gerar_backup()`. É a **segunda** cópia: a primeira é o `pg_cron` às 03:00, dentro do banco. |
| `02-resumo-do-dia.json` | 18:00 | manda para a Mariana a agenda de amanhã e quem se cadastrou e ainda não foi contatado, **com o link wa.me pronto para clicar**. |
| `03-sentinela.json` | a cada 15 min | confere se o site e a agenda pública respondem. Não aceita só o 200: confere uma frase-âncora, porque deploy quebrado devolve 200 com página vazia. |
| `04-calendario-eleitoral.json` | 08:00 | avisa nas datas que importam. A mais séria: **no dia 04/10 publicar conteúdo novo é crime**, não multa. |

## Instalar

Duas formas. A segunda é melhor.

**Paste no canvas** — abra o n8n, `Ctrl+A` `Delete` num fluxo novo, cole o
conteúdo do arquivo. A aba precisa estar **na frente**: o canvas do n8n não
pinta com a aba em segundo plano.

**Pela API** (evita os problemas de sessão e do botão Publish):

```bash
curl -X POST "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data @00-erros.json
```

O corpo aceita exatamente `name`, `nodes`, `connections` e `settings` — é por
isso que os arquivos não têm `id`, `active` nem `tags`: campo a mais volta 400.

## Antes de ligar qualquer um

1. **Credencial Postgres "Supabase Vilma"** apontando para o **pooler** — o host
   direto do Supabase é só IPv6 e o VPS é IPv4:
   ```
   host   aws-0-sa-east-1.pooler.supabase.com     porta 5432
   user   postgres.<ref-do-projeto>               database postgres
   SSL    require  +  "Ignore SSL Issues" ligado
   ```
2. **Credencial SMTP "SMTP GD Studio"** para os e-mails de aviso.
3. Trocar todo `SUBSTITUIR` dos arquivos: id das credenciais, e-mails da equipe,
   ref do projeto Supabase, chave publishable e o id do fluxo `00-erros`.
4. Rodar `banco/04-automacao.sql` e criar a senha do papel do robô:
   ```sql
   alter role n8n_bot login password 'ESCOLHA-UMA-SENHA-FORTE';
   ```
   A senha vai para `SENHAS-NAO-COMITAR.txt`. Nunca aqui, nunca no cofre.

## O n8n não recebe a `service_role`

Aquela chave tem `BYPASSRLS`: quem a tiver lê nome, telefone, bairro, recado e
**opinião política** da base inteira — dado sensível do art. 11 da LGPD — e ela
moraria num n8n exposto num IP público. Em vez disso existe o papel `n8n_bot`,
que **não tem GRANT em tabela nenhuma** e só executa quatro funções:
`resumo_do_dia`, `marcar_contato`, `registrar_log` e `gerar_backup`.

Se o VPS for comprometido, o que vaza é o resumo do dia. Isso está provado:
`node banco/provar-sql.mjs` tem uma seção que tenta ler cada tabela como
`n8n_bot` e exige `permission denied` em todas.

## O que ainda não existe, e por quê

**Agente com modelo de linguagem.** Continua na lista, mas com uma restrição
que precisa entrar no desenho desde o começo: a norma eleitoral veda chatbot
ou avatar que **simule diálogo com a candidata ou com pessoa real**. Um
assistente que responde dúvidas sobre a agenda e as propostas, deixando claro
em toda resposta que é um robô do site e não a Vilma, é caminho. "Fale com a
Vilma" não é.
