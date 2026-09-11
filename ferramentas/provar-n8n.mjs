#!/usr/bin/env node
/* ============================================================================
   provar-n8n.mjs — confere os fluxos de `n8n/` sem precisar do n8n.

   JSON de workflow quebrado só dá erro quando alguém cola no canvas, meses
   depois, com pressa. Estas provas pegam antes: forma do arquivo, ligações
   apontando para nós que existem, credencial declarada, `SUBSTITUIR` que ficou
   para trás — e, o que mais importa neste projeto, que nenhum fluxo fale com
   eleitor.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'n8n');
const provas = [];
const ok = (n, d = '') => provas.push({ ok: true, n, d });
const bad = (n, d = '') => provas.push({ ok: false, n, d });

const arquivos = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
arquivos.length >= 4 ? ok('há fluxos em n8n/', arquivos.join(', '))
                     : bad('poucos fluxos', arquivos.join(', '));

/* o endpoint POST /api/v1/workflows aceita EXATAMENTE estas chaves */
const CHAVES = new Set(['name', 'nodes', 'connections', 'settings']);

for (const arq of arquivos) {
  const bruto = fs.readFileSync(path.join(DIR, arq), 'utf8');
  let wf;
  try { wf = JSON.parse(bruto); ok(arq + ' é JSON válido'); }
  catch (e) { bad(arq + ' é JSON inválido', e.message); continue; }

  const extras = Object.keys(wf).filter(k => !CHAVES.has(k));
  extras.length === 0
    ? ok(arq + ' só tem as chaves que a API aceita')
    : bad(arq + ' tem chave a mais (a API devolve 400)', extras.join(', '));

  const nomes = new Set((wf.nodes || []).map(n => n.name));
  nomes.size === (wf.nodes || []).length
    ? ok(arq + ': nome de nó não se repete')
    : bad(arq + ': nomes de nó repetidos — a ligação vira ambígua');

  for (const n of wf.nodes || []) {
    for (const campo of ['id', 'name', 'type', 'typeVersion', 'position', 'parameters']) {
      if (n[campo] === undefined) bad(`${arq}: nó "${n.name}" sem ${campo}`);
    }
    if (!Array.isArray(n.position) || n.position.length !== 2)
      bad(`${arq}: nó "${n.name}" com position inválida`);
  }

  /* a ligação usa o NOME do nó, não o id — apontar para nome que não existe
     cola no canvas sem erro e simplesmente não conecta */
  let ligacoesOk = true;
  for (const [de, saidas] of Object.entries(wf.connections || {})) {
    if (!nomes.has(de)) { bad(`${arq}: ligação sai de "${de}", que não existe`); ligacoesOk = false; }
    for (const ramo of saidas.main || []) {
      for (const alvo of ramo || []) {
        if (!nomes.has(alvo.node)) {
          bad(`${arq}: ligação vai para "${alvo.node}", que não existe`); ligacoesOk = false;
        }
      }
    }
  }
  if (ligacoesOk) ok(arq + ': toda ligação aponta para nó que existe');

  /* todo nó, menos o gatilho, tem que ser alcançável */
  const alcancados = new Set();
  for (const saidas of Object.values(wf.connections || {}))
    for (const ramo of saidas.main || []) for (const a of ramo || []) alcancados.add(a.node);
  const orfaos = (wf.nodes || [])
    // webhook É gatilho (o nome do tipo não diz "trigger"), e sticky note
    // é recado no canvas, não nó de execução
    .filter(n => !alcancados.has(n.name) && !/trigger|webhook|stickyNote/i.test(n.type))
    .map(n => n.name);
  orfaos.length === 0 ? ok(arq + ': nenhum nó solto no canvas')
                      : bad(arq + ': nó que nunca roda', orfaos.join(', '));

  /* nó de banco precisa de credencial declarada */
  for (const n of wf.nodes || []) {
    if (/postgres|emailSend/.test(n.type) && !n.credentials)
      bad(`${arq}: nó "${n.name}" sem credencial declarada`);
  }

  /* o fluxo de erro é o único que não aponta para um fluxo de erro */
  if (!/00-erros/.test(arq)) {
    wf.settings?.errorWorkflow
      ? ok(arq + ' tem fluxo de erro configurado')
      : bad(arq + ' sem errorWorkflow — falha morre calada');
  }
}

/* ─────────────────── a trava que dá sentido a este projeto ─────────────── */
{
  /* A regra aqui MUDOU em 11/09/2026, e é importante entender o porquê, senão
     alguém "conserta" de volta.

     A versão anterior reprovava qualquer menção a WhatsApp, inclusive Z-API.
     Só que ela estava protegendo a coisa errada: barrava a FERRAMENTA quando o
     perigo real é o DESTINATÁRIO. Com o Guilherme escolhendo o Z-API (11/09), a
     regra literal tornaria o projeto inteiro reprovado sem tornar ninguém mais
     seguro — e uma bateria que reprova o caminho escolhido é uma bateria que
     vai ser desligada.

     O que continua proibido, e por motivo próprio:
       · a Plataforma WhatsApp Business (Cloud API) — política da Meta veda
         campanha política, e o banimento escala para o portfólio da agência;
       · as outras APIs não oficiais que NÃO foram escolhidas — cada uma que
         entra é uma superfície a mais para manter e auditar.

     O que passou a ser permitido, com trava: o Z-API, desde que o destinatário
     saia SEMPRE de uma função do banco (que é onde mora consentimento, opt-out
     e o limite de uma-vez-só) ou de quem escreveu primeiro. Número escrito à
     mão num fluxo é o começo de toda lista de transmissão. */
  const PROIBIDO = [
    { re: /n8n-nodes-base\.whatsApp/i, o: 'nó nativo da WhatsApp Business Platform (Meta proíbe campanha política)' },
    { re: /graph\.facebook\.com/i,     o: 'Graph API da Meta' },
    { re: /whatsAppApi/,               o: 'credencial da WhatsApp Business Platform' },
    { re: /evolution|baileys|wppconnect|venom-?bot/i, o: 'API não oficial que não é a escolhida' },
  ];
  const achados = [];
  for (const arq of arquivos) {
    const t = fs.readFileSync(path.join(DIR, arq), 'utf8');
    for (const p of PROIBIDO) if (p.re.test(t)) achados.push(arq + ' → ' + p.o);
  }
  achados.length === 0
    ? ok('nenhum fluxo usa a API oficial da Meta nem outra API não oficial')
    : bad('CAMINHO PROIBIDO NUM FLUXO', achados.join(' | '));

  /* ── o segredo não mora no repositório ── */
  {
    const vazados = [];
    for (const arq of arquivos) {
      const t = fs.readFileSync(path.join(DIR, arq), 'utf8');
      // api.z-api.io/instances/<algo>/token/<algo> escrito literalmente
      if (/api\.z-api\.io\/instances\/(?!\{)[A-Za-z0-9]{6,}/.test(t))
        vazados.push(arq + ' → id de instância literal na URL');
      if (/Client-Token"\s*,\s*"value"\s*:\s*"(?!=\{\{)[A-Za-z0-9]{10,}/.test(t))
        vazados.push(arq + ' → Client-Token literal');
    }
    vazados.length === 0
      ? ok('nenhum fluxo traz id, token ou Client-Token do Z-API escrito no arquivo')
      : bad('SEGREDO DO Z-API COMITADO', vazados.join(' | '));
  }

  /* ── quem envia, envia para quem o BANCO mandou ── */
  {
    const problemas = [];
    for (const arq of arquivos) {
      const wf = JSON.parse(fs.readFileSync(path.join(DIR, arq), 'utf8'));
      for (const n of wf.nodes || []) {
        const corpo = JSON.stringify(n.parameters || {});
        if (!/send-text/.test(corpo)) continue;

        if (!/\$env\.ZAPI_BASE/.test(corpo))
          problemas.push(`${arq}/${n.name}: URL do Z-API fora da variável de ambiente`);
        if (!/\$env\.ZAPI_CLIENT_TOKEN/.test(corpo))
          problemas.push(`${arq}/${n.name}: sem Client-Token vindo do ambiente`);
        if (!/phone:\s*\$json\.(zap|phone)\b/.test(corpo))
          problemas.push(`${arq}/${n.name}: destinatário não vem do banco nem de quem escreveu`);
        if (/"phone"\s*:\s*"?\d{10,}/.test(corpo))
          problemas.push(`${arq}/${n.name}: número de telefone escrito à mão`);
      }
    }
    problemas.length === 0
      ? ok('todo envio tira o destinatário do banco (ou de quem escreveu primeiro), nunca de número fixo')
      : bad('ENVIO COM DESTINATÁRIO FORA DO CONTROLE DO BANCO', problemas.join(' | '));
  }

  /* ── o fluxo de entrada não pode conversar consigo mesmo nem em grupo ── */
  if (arquivos.includes('05-chat-entrada.json')) {
    const t = fs.readFileSync(path.join(DIR, '05-chat-entrada.json'), 'utf8');
    /fromMe/.test(t) && /isGroup/.test(t)
      ? ok('05 filtra fromMe e isGroup — sem laço com a própria mensagem, sem responder em grupo')
      : bad('05 sem as duas guardas de entrada (fromMe / isGroup)');
    /bot_entrada/.test(t)
      ? ok('05 decide a rota pelo banco (bot_entrada), não por nó de if')
      : bad('05 não chama bot_entrada — a regra voltou para dentro do n8n');
    /TROCAR|SUBSTITUIR/.test(JSON.parse(t).nodes.find(n => n.type.endsWith('webhook'))?.parameters?.path || '')
      ? ok('o caminho do webhook é placeholder no repositório — a URL é a credencial')
      : bad('URL REAL DE WEBHOOK COMITADA — quem a tiver se passa pela assessora');
  }

  /* ── o empurrado nunca manda duas vezes ── */
  if (arquivos.includes('07-boas-vindas.json')) {
    const wf = JSON.parse(fs.readFileSync(path.join(DIR, '07-boas-vindas.json'), 'utf8'));
    const envio = (wf.nodes || []).find(n => /send-text/.test(JSON.stringify(n.parameters || {})));
    const fila = JSON.stringify(wf).includes('bot_boas_vindas_pendentes');

    fila ? ok('07 tira a fila de bot_boas_vindas_pendentes (consentimento, opt-out e uma-vez-só no banco)')
         : bad('07 monta a lista por fora do banco');
    envio && envio.retryOnFail !== true
      ? ok('07 NÃO tenta de novo ao falhar — reenviar aqui é mandar duas vezes para a mesma pessoa')
      : bad('07 com retry no envio: risco de mensagem duplicada para eleitor');
    /chip/i.test(JSON.stringify(wf))
      ? ok('07 carrega na cara o aviso do chip separado e do risco de banimento')
      : bad('07 sem o aviso de risco visível no próprio fluxo');
  }

  /* E o caminho permitido tem que EXISTIR, não só o proibido estar ausente.
     O link nasce no banco (resumo_do_dia monta o wa.me) e o fluxo do resumo
     tem que usá-lo — senão a Mariana fica sem ferramenta nenhuma e a equipe
     vai improvisar por fora, que é justamente o que se quer evitar. */
  const sql = fs.readFileSync(path.join(RAIZ, 'banco', '04-automacao.sql'), 'utf8');
  /wa\.me/.test(sql)
    ? ok('o banco monta o link wa.me de cada pessoa (resumo_do_dia)')

    : bad('resumo_do_dia não monta link de contato');

  const resumo = fs.readFileSync(path.join(DIR, '02-resumo-do-dia.json'), 'utf8');
  /p\.link/.test(resumo)
    ? ok('o fluxo do resumo entrega esse link para a equipe clicar (caminho permitido)')
    : bad('o fluxo não usa o link — a Mariana ficou sem ferramenta');
}

/* ───────────────── o que ainda precisa ser preenchido à mão ────────────── */
{
  const pendentes = arquivos.flatMap(arq => {
    const t = fs.readFileSync(path.join(DIR, arq), 'utf8');
    const n = (t.match(/SUBSTITUIR/g) || []).length;
    return n ? [`${arq}: ${n}`] : [];
  });
  /* Aqui o esperado é ter pendência: as credenciais são dele. A prova serve
     para o número aparecer no relatório, não para reprovar. */
  ok('marcações SUBSTITUIR a preencher antes de ligar', pendentes.join(' · ') || 'nenhuma');

  const leiaMe = path.join(DIR, 'LEIA-ME.md');
  fs.existsSync(leiaMe) ? ok('n8n/LEIA-ME.md explica o porquê e o passo a passo')
                        : bad('sem LEIA-ME em n8n/');
}

const bons = provas.filter(p => p.ok).length;
console.log('\n═══ PROVAS DOS FLUXOS DO n8n ═══\n');
provas.forEach(p => console.log(` ${p.ok ? '✓' : '✗'} ${p.n}${p.d ? '  → ' + p.d : ''}`));
console.log(`\n${bons}/${provas.length} passaram` + (bons === provas.length ? '  🎉' : '  ⚠ VER ACIMA'));
process.exitCode = bons === provas.length ? 0 : 1;
