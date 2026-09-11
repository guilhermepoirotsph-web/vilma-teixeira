# Automações no n8n

Oito fluxos. Cinco internos (00 a 04), e três de chat pelo **Z-API**, decidido
pelo Guilherme em 11/09/2026: `05-chat-entrada`, `06-lembretes` e
`07-boas-vindas`.

> **O que mudou, e o que não mudou.** Este arquivo dizia "nenhum fluxo fala com
> eleitor". Continua sendo a regra para tudo que é **automático e empurrado** —
> com uma exceção que o cliente escolheu e que está marcada como tal: o fluxo
> **07** manda uma confirmação para quem se cadastrou no site. Uma, por pessoa,
> com consentimento gravado e instrução de saída na própria mensagem.
> O detalhamento legal e o caminho de menor risco estão em
> `docs/AGENTE-AGENDA.md`, seção 5, e no rodapé de `banco/02-contato.sql`.

## Por que o n8n aqui é copiloto, não remetente

O pedido original era "API do WhatsApp + disparo pelo n8n". Pela **API oficial**
não dá, por dois motivos independentes — qualquer um dos dois já bastaria:

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

**E a via não oficial por QR Code — que é o Z-API, o caminho escolhido —** não
resolve as duas de uma vez, resolve uma só. A cláusula da Meta é contratual, da
*Plataforma Business*, e não alcança o Z-API. O que alcança é o **Termo de
Serviço do WhatsApp**: cliente não autorizado é uso irregular, e a sanção é
**banimento do número**.

A documentação de bloqueios da própria Z-API (2026) diz qual é o gatilho, e ele
é específico: **o que mais pesa é a quantidade de destinatários DIFERENTES**,
não o volume de mensagens. Isso separa os usos:

- falar com a Mariana e o Guilherme todo dia → 2 ou 3 destinatários, sempre os
  mesmos. Risco baixo.
- mandar uma confirmação para cada pessoa nova que se cadastra → um
  destinatário novo de cada vez. **É o padrão que derruba número.**

Daí a regra que não se negocia: **o robô mora num chip só dele**, nunca no
número que a campanha usa para falar com as pessoas. Se o chip do robô cair, a
campanha continua de pé.

E a lei eleitoral só entra quando o destinatário é **eleitor**: conversa interna
de equipe não é propaganda nem disparo em massa.

## O que dá para fazer, e é o que está montado aqui

A pessoa fala primeiro (link `wa.me` no site), a equipe responde **uma a uma**
pelo aplicativo WhatsApp Business — que é liberado para político, porque a
vedação da Meta é da *Plataforma/API*, não do aplicativo. O banco guarda a
prova de consentimento, quem já foi contatado e quem pediu para sair.

O n8n avisa, prepara o texto e monta o link. **Quem aperta o botão é uma
pessoa.**

### ⚠️ A armadilha: o app ser permitido NÃO libera lista de transmissão

Esta é a confusão que qualquer pessoa da equipe vai fazer, e ela custa caro.
São **duas regras diferentes**, de **duas autoridades diferentes**:

| | O que proíbe | Quem manda |
|---|---|---|
| **Plataforma/API** | usar a Cloud API em campanha política | **Meta** (política de uso) |
| **Disparo em massa** | mandar o mesmo conteúdo para muita gente sem consentimento | **Justiça Eleitoral** (lei) |

Usar o aplicativo permitido resolve **só a primeira**. A definição legal de
disparo em massa é **neutra quanto à tecnologia** — Res. TSE 23.610/2019,
art. 37, XXI: *"envio, compartilhamento ou encaminhamento de um mesmo conteúdo,
ou de variações deste, para um grande volume de usuárias e usuários por meio de
aplicativos de mensagem instantânea"*. Não diz "via API". **Lista de transmissão
do app grátis para centenas de eleitores é disparo em massa**, e o art. 34, II
tem duas vedações ligadas por "ou": sem consentimento **ou** com ferramenta
fora dos termos do provedor. O app resolve a segunda; a primeira continua de pé.

E não vale dizer que a lista de transmissão "já filtra" porque só entrega a quem
salvou o número: **salvar um contato é ato unilateral de quem recebe**, e o
art. 37, XXVII exige *"manifestação livre, informada e inequívoca"*. Limitação
técnica do WhatsApp não é base legal.

**A regra prática para a Mariana e o Lucas, em uma linha:**
> conversa individual com quem se cadastrou no site, sim. Lista de transmissão,
> não — nem no aplicativo.

O porto seguro expresso é o art. 33, §2º: mensagem **consentida**, enviada por
**pessoa natural**, de forma **privada** ou em grupo restrito, fica fora das
normas de propaganda eleitoral. É exatamente o desenho montado aqui.

### E se alguém responder "SAIR"

O art. 33 dá **48 horas** para descadastrar **e eliminar os dados**, com multa
de **R$ 100 por mensagem** enviada depois do prazo (art. 33, §1º; Lei 9.504/97,
art. 57-G, parágrafo único). Não espere as 48h: a assessora marca `optout` no
painel na hora, ou a própria pessoa resolve sozinha em
`privacidade.html#descadastrar`. O opt-out vale para os dois formatos do
número — isso está provado no banco.

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
