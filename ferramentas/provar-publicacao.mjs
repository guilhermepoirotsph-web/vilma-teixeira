#!/usr/bin/env node
/* ============================================================================
   provar-publicacao.mjs — prova que `publicar.mjs` monta o pacote certo e que
   a rede de segurança contra segredo funciona de verdade.

   A rede só serve se alguém já a viu falhar. Aqui ela é testada plantando uma
   chave service_role de mentira e conferindo que a publicação é abortada.
   ========================================================================== */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const provas = [];
const ok = (n, d = '') => provas.push({ ok: true, n, d });
const bad = (n, d = '') => provas.push({ ok: false, n, d });

const publicar = args => {
  try {
    return { saida: execFileSync('node', [path.join(RAIZ, 'publicar.mjs'), ...args],
                                 { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' }), codigo: 0 };
  } catch (e) {
    return { saida: (e.stdout || '') + (e.stderr || ''), codigo: e.status ?? 1 };
  }
};

/* ───────────────────────────────── 1 · o pacote tem o que precisa ter */
{
  const { saida, codigo } = publicar([]);
  codigo === 0 ? ok('publicar.mjs roda sem erro') : bad('publicar.mjs falhou', saida.slice(0, 200));

  const SITE = path.join(RAIZ, '_site');
  const existe = p => fs.existsSync(path.join(SITE, p));

  for (const p of ['index.html', 'privacidade.html', 'robots.txt',
                   'assets/css/base.css', 'assets/js/nucleo.js', 'assets/img/og.jpg',
                   'painel/index.html', 'painel/painel.js', 'vendor']) {
    existe(p) ? ok('vai ao ar: ' + p) : bad('FALTOU no pacote: ' + p);
  }

  /* o que jamais pode ser servido por URL */
  for (const p of ['banco', 'docs', 'ferramentas', 'caps', 'n8n', 'montar.mjs',
                   'preview-server.mjs', 'publicar.mjs', 'LEIA-ME.md',
                   '.github', 'virar-dominio.mjs', 'partes',
                   'painel/config.local.js', 'assets/js/config.local.js',
                   'fotos/_pagina-vilma.html', 'fotos/_referencia-vilma-camara.jpg',
                   'fotos/_cezinha-camara-referencia.jpg']) {
    !existe(p) ? ok('fica fora do ar: ' + p) : bad('VAZOU para o pacote: ' + p);
  }

  /* o que vai ao ar tem que ser o index REMONTADO, não um resquício */
  const idx = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  /<!--SECOES-->/.test(idx) ? bad('index.html do pacote não foi montado')
                            : ok('index.html do pacote está montado');
  /og:image/.test(idx) ? ok('index.html leva o cartão de compartilhamento')
                       : bad('index.html sem og:image');
}

/* ──────────────────────── 2 · a rede pega uma service_role plantada */
{
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const falsa = `${b64({ alg: 'HS256', typ: 'JWT' })}.` +
                `${b64({ iss: 'supabase', role: 'service_role', exp: 9999999999 })}.` +
                'assinatura_de_mentira_para_teste_0123456789';
  const alvo = path.join(RAIZ, 'assets', 'js', 'zz-teste-vazamento.js');
  fs.writeFileSync(alvo, `/* teste */\nconst CHAVE = '${falsa}';\n`);
  try {
    const { saida, codigo } = publicar(['--listar']);
    codigo !== 0 ? ok('publicação é ABORTADA quando há service_role no material')
                 : bad('service_role passou pela rede!');
    /service_role/.test(saida) ? ok('a mensagem diz qual papel foi encontrado')
                               : bad('mensagem não identifica o papel', saida.slice(-200));
    /zz-teste-vazamento/.test(saida) ? ok('a mensagem diz em QUE arquivo está')
                                     : bad('mensagem não aponta o arquivo');
  } finally { fs.rmSync(alvo, { force: true }); }
}

/* ───────────── 3 · a chave anon (que PODE ir ao ar) não é barrada */
{
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const anon = `${b64({ alg: 'HS256', typ: 'JWT' })}.` +
               `${b64({ iss: 'supabase', role: 'anon', exp: 9999999999 })}.` +
               'assinatura_de_mentira_para_teste_0123456789';
  const alvo = path.join(RAIZ, 'assets', 'js', 'zz-teste-anon.js');
  fs.writeFileSync(alvo, `const CHAVE = '${anon}';\n`);
  try {
    const { codigo } = publicar(['--listar']);
    codigo === 0 ? ok('chave anon passa (é pública por natureza; quem protege é a RLS)')
                 : bad('chave anon foi barrada por engano');
  } finally { fs.rmSync(alvo, { force: true }); }
}

/* ─────────── 4 · o aviso "nunca service_role aqui" não é falso positivo */
{
  const { codigo, saida } = publicar(['--listar']);
  codigo === 0
    ? ok('o comentário "nunca service_role aqui" não dispara a rede')
    : bad('falso positivo na rede de segredo', saida.slice(-260));
}

/* ───── 5 · nada de estrutura de mandato no material que vai ao ar ───── */
{
  /* O rodapé jura que o site não usa recursos nem estrutura da Câmara. Não
     basta parar de EXIBIR: o que está no JS servido está publicado, e é o print
     que o adversário tira. Esta prova varre o pacote inteiro. */
  publicar([]);
  const SITE = path.join(RAIZ, '_site');
  const TXT = /\.(html?|js|mjs|css|json|txt|xml|svg)$/i;
  const varrer = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? varrer(p) : (TXT.test(d.name) ? [p] : []);
  });

  /* A regra é por PADRÃO, não pelo valor. Procurar o número do gabinete
     literalmente obrigaria a escrevê-lo aqui — publicando no repositório
     justamente o dado que a prova existe para manter fora. E a regra por
     padrão é mais forte: pega também qualquer OUTRO telefone que alguém
     cole sem pensar. */
  const CAMPANHA = (fs.readFileSync(path.join(RAIZ, 'assets', 'js', 'dados.js'), 'utf8')
    .match(/whatsapp:\s*'([0-9]*)'/) || [, ''])[1];

  const INSTITUCIONAL = [
    { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]*\.(gov|leg)\.br/i, o: 'e-mail institucional (.gov.br/.leg.br)' },
    { re: /\b1166[0-9]-?[0-9]{3}\b/,                          o: 'CEP da região do gabinete' },
    { re: /Câmara Municipal de Caraguatatuba[^<]{0,40}(Av|Rua|Avenida)/i, o: 'endereço ligado à Câmara' },
  ];
  /* Celular brasileiro de verdade: DDD válido, o 9 obrigatório, 8 dígitos. */
  const DDD = /^(1[1-9]|2[12478]|3[1-8]|4[1-9]|5[13-5]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/;
  const TELEFONE = /(?:\+?55\s?)?\(?(\d{2})\)?[\s-]?9(\d{4})[\s-]?(\d{4})/g;
  /* Placeholder de formulário não é vazamento: "(12) 99999-9999" e
     "12999998888" existem para ensinar o formato. Um número real quase nunca
     traz quatro dígitos iguais seguidos; um placeholder quase sempre traz. */
  const ehExemplo = assinante => /(\d)\1{3}/.test(assinante);

  const varrerVazamento = () => {
    const vazou = [];
    for (const f of varrer(SITE)) {
      const rel = path.relative(SITE, f);
      // vendor/ é biblioteca de terceiro minificada: constantes como 4294967295
      // têm cara de telefone e não são conteúdo nosso
      if (rel.split(path.sep)[0] === 'vendor') continue;
      const t = fs.readFileSync(f, 'utf8');
      for (const s of INSTITUCIONAL) if (s.re.test(t)) vazou.push(`${rel} → ${s.o}`);

      for (const [achado, ddd, a, b] of t.matchAll(TELEFONE)) {
        if (!DDD.test(ddd)) continue;
        if (ehExemplo(a + b)) continue;
        const so = achado.replace(/\D/g, '').replace(/^55/, '');
        // o único telefone que pode existir no que vai ao ar é o chip de campanha
        if (CAMPANHA && so === CAMPANHA.replace(/^55/, '')) continue;
        vazou.push(`${rel} → telefone que não é o da campanha: ${achado.trim()}`);
      }
    }
    return vazou;
  };

  const vazou = varrerVazamento();
  vazou.length === 0
    ? ok('no que vai ao ar não existe telefone além do chip de campanha, nem contato institucional',
         CAMPANHA ? 'chip: ' + CAMPANHA : 'nenhum telefone (chip ainda não existe)')
    : bad('estrutura de mandato no material publicado', vazou.join(' | '));

  /* CONTROLE POSITIVO. Prova que só diz "está limpo" e nunca foi vista
     apontando sujeira não vale nada: pode estar quebrada há meses. Aqui um
     telefone realista (fictício, DDD de Caraguá) e um e-mail institucional
     são plantados no pacote, e a varredura tem que achar os dois. */
  {
    const alvo = path.join(SITE, 'assets', 'js', 'zz-teste-contato.js');
    fs.writeFileSync(alvo,
      `const CONTATO = { fone: '(12) 98213-4576', ` +
      `email: 'fulano.teste@camaracaragua.sp.gov.br' };\n`);
    try {
      const achados = varrerVazamento();
      achados.some(a => /telefone/.test(a))
        ? ok('a varredura ACHA um telefone plantado no pacote')
        : bad('telefone plantado passou pela varredura');
      achados.some(a => /institucional/.test(a))
        ? ok('a varredura ACHA um e-mail institucional plantado')
        : bad('e-mail institucional plantado passou');
    } finally { fs.rmSync(alvo, { force: true }); }
  }

  /* e a foto oficial da Câmara também não pode ser servida */
  const fotos = fs.existsSync(path.join(SITE, 'fotos'))
    ? fs.readdirSync(path.join(SITE, 'fotos')) : [];
  !fotos.some(f => /camara|oficial|referencia/i.test(f))
    ? ok('nenhuma foto institucional da Câmara no pacote', fotos.join(', ') || '(sem fotos)')
    : bad('foto da Câmara no pacote', fotos.join(', '));
}

const bons = provas.filter(p => p.ok).length;
console.log('\n═══ PROVAS DA PUBLICAÇÃO ═══\n');
provas.forEach(p => console.log(` ${p.ok ? '✓' : '✗'} ${p.n}${p.d ? '  → ' + p.d : ''}`));
console.log(`\n${bons}/${provas.length} passaram` + (bons === provas.length ? '  🎉' : '  ⚠ VER ACIMA'));
process.exitCode = bons === provas.length ? 0 : 1;
