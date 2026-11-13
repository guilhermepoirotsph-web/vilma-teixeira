# Textos prontos para o grupo (Mariana + Lucas)

Copie e cole cada bloco. O `*asterisco*` vira **negrito** no WhatsApp.

> ⚠️ **Antes de mandar, confira se os links ainda estão de pé.** São túneis
> temporários: caem quando o computador desliga ou dorme. Se caírem, peça
> links novos — o endereço muda, o conteúdo não.
>
> **Site:** https://analyst-registered-agreement-think.trycloudflare.com
> **Painel:** https://analyst-registered-agreement-think.trycloudflare.com/painel/

---

## 1 · Abertura do grupo

```
Boa noite, pessoal! 👋

Criei esse grupo pra alinhar o site da Vilma com vocês dois.

O site já está pronto pra ver e pra mexer. Nesta primeira fase é uma
*prévia*: o endereço é provisório e os dados que estão lá dentro são
inventados, só pra vocês entenderem como funciona. Podem clicar em tudo,
criar, apagar, errar à vontade — não quebra nada e não vai pro ar.

Vou mandar agora uma mensagem pra cada um com o link, o login e um
passo a passo curtinho. Qualquer dúvida, pergunta aqui no grupo mesmo.

O site: https://analyst-registered-agreement-think.trycloudflare.com
```

---

## 2 · Mariana (assessora — agenda e apoiadores)

```
Mariana, esse é o seu 👇

*Painel:* https://analyst-registered-agreement-think.trycloudflare.com/painel/
*E-mail:* mariana@vilmateixeira.com.br
*Senha:* teste1234

(Esse login é só de teste, pra você conhecer. O definitivo eu crio depois
com o seu e-mail de verdade, e a *senha quem escolhe é você* — eu nunca vou
saber nem mandar senha por aqui.)

*O que você faz por aí:*

*1) Agenda* — é o coração do seu painel. São *duas agendas no mesmo
calendário*:
  • *Pública* — aparece no site pra qualquer pessoa que entrar.
  • *Interna* — fica só com a equipe, ninguém de fora vê.
Tem um seletor em cima do calendário pra alternar entre Tudo / Pública /
Interna. Repare na linha "Neste mês: X no site · X internas · X em rascunho" —
é o seu resumo rápido.

*2) Criar compromisso* — botão "+ Novo compromisso". Preenche título, tipo
(comício, caminhada, carreata, reunião, visita, live), dia, hora, local e
bairro. A chavinha *"Publicar no site"* é o que decide se aquilo vira público
ou fica interno. Deixou desmarcado e sem marcar interno? Fica em rascunho,
esperando você decidir.

*3) Apoiadores* — todo mundo que preencher o formulário do site cai nessa
lista pra você: nome, WhatsApp, bairro e no que a pessoa quer ajudar. Você
muda a situação de cada um (Novo → Contatado → Engajado → Voluntário) e tem
o botão *"Baixar CSV"* pra abrir tudo no Excel.
Isso é dado pessoal de eleitor: use só dentro da campanha, não repassa
pra fora. O site já pede o consentimento certinho pra isso.

*4) Como usar* — última aba do menu. Deixei o passo a passo escrito lá
dentro do próprio painel, pra você não depender de mim.

Abre no celular também, pode testar. 🙂
```

---

## 3 · Lucas (social media — conteúdo e textos do site)

```
Lucas, esse é o seu 👇

*Painel:* https://analyst-registered-agreement-think.trycloudflare.com/painel/
*E-mail:* lucas@vilmateixeira.com.br
*Senha:* teste1234

(Login só de teste, pra você conhecer. O definitivo eu crio com o seu e-mail
de verdade e a *senha quem escolhe é você* — eu nunca vou saber nem mandar
senha por aqui.)

*O que você faz por aí:*

*1) Conteúdo* — é um quadro tipo Trello pra pauta de rede social:
Ideia → Roteiro → Produção → Aprovação → Agendado → Publicado.
Cria a pauta em "+ Nova pauta", escolhe o formato (reel, carrossel, story,
foto, live), põe responsável e data prevista, e vai *arrastando o card* de
coluna em coluna conforme anda. O que estiver em "Aprovação" acende um aviso
no menu, pra ninguém esquecer de aprovar.

*2) Site* — essa é a parte que interessa: são *18 lacunas* que você troca
sozinho, sem me pedir nada. Você digita, clica em salvar e *muda no site na
hora*. Desde 13/11 o site é *só da Vilma*. Está separado por bloco:
  • *Instagram* — cole o link de até *4 posts ou reels* da @vereadoravilma
    (instagram.com/p/… ou /reel/…). O site mostra cada um com o player
    oficial do Instagram. Link do *perfil* não vale: tem que ser do post.
  • *Herói* — a abertura da página: linha de cima, texto, selo e a foto da Vilma.
  • *Galeria* — até *6 fotos* da Vilma (agenda, bairros, Câmara). Sem
    nenhuma, a galeria nem aparece no site.
  • *Geral* — WhatsApp próprio da Vilma (nunca o do gabinete), Instagram,
    frase do fim da página e o *aviso do topo* (deixa vazio quando não tiver aviso).

*Dica das fotos:* a foto do herói fica bem melhor em *PNG sem fundo*
(recortado). JPG comum também entra: o site emoldura. Nunca foto com brasão
ou fundo oficial da Câmara.

*3) Como usar* — última aba do menu, com o passo a passo escrito.

Pode mexer à vontade que nada disso vai pro ar ainda. 🙂
```

---

## Depois (quando o Supabase de verdade existir)

1. Pedir a cada um **só o e-mail** (nunca senha).
2. Criar a conta no Supabase → a pessoa recebe convite e **define a própria senha**.
3. Rodar `select public.promover('email@…','assessora')` / `'social'`.
   Antes disso o perfil **nasce inerte** e não abre nada — é proposital.
4. Trocar os links provisórios pelo domínio definitivo.
