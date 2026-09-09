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
    .filter(n => !alcancados.has(n.name) && !/trigger/i.test(n.type))
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
  /* A Meta proíbe campanha política na Plataforma WhatsApp Business, e a lei
     eleitoral veda disparo em massa. Nenhum fluxo pode mandar mensagem para
     eleitor — nem por nó nativo, nem por HTTP na Graph API, nem por API não
     oficial. Esta prova existe para o dia em que alguém "só for testar". */
  const PROIBIDO = [
    { re: /n8n-nodes-base\.whatsApp/i,      o: 'nó nativo do WhatsApp Business' },
    { re: /graph\.facebook\.com/i,          o: 'Graph API da Meta' },
    { re: /\/messages['"]?\s*[,}]/,         o: 'endpoint de envio de mensagem' },
    { re: /evolution|baileys|z-?api|wppconnect|venom-?bot/i, o: 'API não oficial de WhatsApp' },
    { re: /whatsAppApi/,                    o: 'credencial da WhatsApp Business Platform' },
  ];
  const achados = [];
  for (const arq of arquivos) {
    const t = fs.readFileSync(path.join(DIR, arq), 'utf8');
    for (const p of PROIBIDO) if (p.re.test(t)) achados.push(`${arq} → ${p.o}`);
  }
  achados.length === 0
    ? ok('nenhum fluxo manda mensagem para eleitor (nem oficial, nem não oficial)')
    : bad('FLUXO ENVIANDO WHATSAPP — proibido pela Meta e pela norma eleitoral',
          achados.join(' | '));

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
