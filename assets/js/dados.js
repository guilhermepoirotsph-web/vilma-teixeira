/* ============================================================================
   dados.js — CONTEÚDO DO SITE (fonte: docs/DADOS.md)
   Tudo que o site escreve na tela sai daqui. Não escrever texto solto nas seções.
   Regra: dado real com fonte, ou lacuna honesta marcada.
   ========================================================================== */

window.VT_DADOS = {

  campanha: {
    dominio: 'www.vilmateixeira.com',
    titulo: 'Vilma Teixeira — Juntos por Caraguá e pelo Brasil',
    chamada: 'Duas lideranças que trabalham por Caraguá e pelo Brasil',
    assinatura: 'Juntos por Caraguá e pelo Brasil',
    ano: 2026,
    // Identificação obrigatória no rodapé (vedado o anonimato — art. 57-B, Lei 9.504/97)
    responsavel: 'Vilma Teixeira de Oliveira Santos',
    // Preenchidos pela assessoria antes de publicar:
    cnpjCampanha: '',            // CNPJ de campanha, se houver
    emailContato: '',            // e-mail de campanha (NÃO usar o institucional da Câmara)

    // WhatsApp de CAMPANHA. Vazio de propósito: enquanto não existir um chip de
    // campanha, os botões de WhatsApp somem do site e o contato vira formulário
    // + Instagram. Publicar o número do GABINETE seria usar estrutura de mandato
    // em propaganda — exatamente o que o rodapé diz que este site não faz.
    whatsapp: '',
    instagram: 'vereadoravilma',
    // O número do gabinete NÃO mora aqui, de propósito. Este arquivo é servido
    // ao navegador: guardar o contato do mandato aqui — mesmo sem usar — é
    // publicá-lo no código-fonte de um site de campanha, e é o print que o
    // adversário tira. Ele está em docs/DADOS.md §6-C, que não vai ao ar.

    eleicao: {
      turno1: '2026-10-04T08:00:00-03:00',
      dataExtenso: 'Domingo, 4 de outubro de 2026',
      rotulo: 'Falta para a eleição',
    },
  },

  /* ---------------------------------------------------------------- VILMA */
  vilma: {
    nome: 'Vilma Teixeira',
    nomeCompleto: 'Vilma Teixeira de Oliveira Santos',
    cargo: 'Vereadora de Caraguatatuba',
    partido: 'MDB',
    funcao: '1ª Secretária da Mesa Diretora · biênio 2025–2026',
    legislatura: '2025–2028',
    cidade: 'Caraguatatuba — SP',
    instagram: 'vereadoravilma',
    foto: 'fotos/vilma.png',
    retrato: 'fotos/vilma-retrato.jpg',

    lead: 'Começou em 1995 como auxiliar de serviços gerais. Hoje é 1ª Secretária da ' +
          'Mesa da Câmara, no quarto mandato como vereadora. Neste ano ela não está na ' +
          'urna — está pedindo dois votos para levar Caraguá até São Paulo e até Brasília.',

    // Frase atribuída — vem da biografia oficial, não é afirmação nossa.
    marco: {
      texto: 'primeira mulher da história de Caraguatatuba a se reeleger vereadora ' +
             'por três mandatos consecutivos',
      fonte: 'biografia oficial da Câmara Municipal de Caraguatatuba',
    },

    trajetoria: [
      { ano: '1995', titulo: 'Onde tudo começou',
        texto: 'Chega a Caraguatatuba para criar os filhos e entra no mercado de trabalho como auxiliar de serviços gerais.' },
      { ano: '1997', titulo: 'Agente comunitária de saúde',
        texto: 'Dois anos batendo de porta em porta nos bairros. Aprende a cidade pelo lado de dentro das casas.' },
      { ano: '2000', titulo: 'Técnica de enfermagem',
        texto: 'Forma-se e atua sete anos na profissão. A saúde deixa de ser tema e vira ofício.' },
      { ano: '2004', titulo: 'A primeira campanha',
        texto: 'Entra na política para levar a pauta da saúde e do social para dentro da Câmara.' },
      { ano: '2008', titulo: 'Eleita vereadora', votos: '1.589',
        texto: 'Primeiro mandato, com 1.589 votos de confiança.' },
      { ano: '2012', titulo: 'Reeleita', votos: '1.089',
        texto: 'A cidade renova o mandato.' },
      { ano: '2016', titulo: 'Reeleita de novo', votos: '1.350',
        texto: 'Terceiro mandato consecutivo.' },
      { ano: '2024', titulo: 'De volta à Câmara', votos: '1.154',
        texto: 'Eleita para a legislatura 2025–2028 e escolhida 1ª Secretária da Mesa Diretora.' },
    ],

    // Números EXATOS do sistema da Câmara (soma = 141). Não arredondar.
    mandato: {
      total: 141,
      periodo: 'proposições protocoladas em 2025 e 2026',
      linhas: [
        { rotulo: 'Requerimentos',                   n2025: 57, n2026: 18 },
        { rotulo: 'Moções',                          n2025: 16, n2026:  9 },
        { rotulo: 'Indicações',                      n2025: 13, n2026:  2 },
        { rotulo: 'Projetos de Resolução',           n2025:  6, n2026:  5 },
        { rotulo: 'Projetos de Lei',                 n2025:  4, n2026:  5 },
        { rotulo: 'Projetos de Decreto Legislativo', n2025:  4, n2026:  1 },
        { rotulo: 'Emenda à Lei Orgânica',           n2025:  0, n2026:  1 },
      ],
    },

    destaque: {
      selo: 'PL nº 15/26',
      titulo: 'Jardins terapêuticos na saúde pública',
      texto: 'Implantação de jardins terapêuticos nas UBSs e na UPA de Caraguatatuba — ' +
             'humanizar o espaço de atendimento para ajudar na recuperação do paciente e ' +
             'na saúde mental de quem é atendido e de quem atende.',
    },

    bandeiras: [
      { icone: 'saude',    titulo: 'Saúde',            texto: 'A pauta de origem: UBS que funciona, acolhimento e saúde mental.' },
      { icone: 'social',   titulo: 'Social',           texto: 'Quem mais precisa entra primeiro. Da agente comunitária à cadeira da Câmara.' },
      { icone: 'mulher',   titulo: 'Mulheres',         texto: 'Representatividade e políticas para quem sustenta a casa e a cidade.' },
      { icone: 'bairro',   titulo: 'Bairros',          texto: 'Indicação e requerimento são ferramenta de bairro — 90 protocolados no mandato.' },
      { icone: 'crianca',  titulo: 'Criança e família',texto: 'Educação, acolhimento e rede de proteção.' },
      { icone: 'cidade',   titulo: 'Caraguá',          texto: 'A cidade que a acolheu e que ela representa há quatro mandatos.' },
    ],

    // Endereço, e-mail institucional, telefone e nomes da equipe do gabinete
    // ficaram FORA daqui: nenhum é lido pelo site, e todos viajariam para o
    // navegador de quem abrisse a página. Estão em docs/DADOS.md §6-C.
  },

  /* -------------------------------------------------------------- REGINA */
  regina: {
    nome: 'Regina Nunes',
    nomeCompleto: 'Regina Carnovale Nunes',
    cargo: 'Deputada Estadual',
    uf: 'São Paulo',
    partido: 'MDB',
    numero: '15115',
    numeroFmt: ['1','5','1','1','5'],
    registro: 'Registro deferido no TSE',
    cor: 'magenta',
    instagram: 'reginanunessp',
    foto: 'fotos/regina.png',

    lead: 'Primeira-dama de São Paulo, criada na periferia da capital. ' +
          'Primeira vez que disputa uma eleição — e chega com a causa animal ' +
          'e o trabalho social embaixo do braço.',

    frase: 'Hospital ajuda, mas o que resolve é a castração. Sem isso, o problema só cresce.',
    fraseContexto: 'sobre o abandono de animais',

    bandeiras: [
      { titulo: 'Causa animal',
        texto: 'Castração como política pública central contra o abandono. Mantém, com recursos ' +
               'próprios e doações, um abrigo com cerca de 40 cães e organiza feiras de adoção.' },
      { titulo: 'Crianças com deficiência',
        texto: 'Ações de cuidado e inclusão para crianças com deficiência e suas famílias.' },
      { titulo: 'Mulheres em vulnerabilidade',
        texto: 'Fortalecimento das redes de apoio a mulheres em situação de vulnerabilidade.' },
      { titulo: 'Família e inclusão',
        texto: 'Projetos sociais e políticas públicas voltadas ao fortalecimento da família.' },
    ],

    fatos: [
      { n: '15115', r: 'Número na urna' },
      { n: '1ª',    r: 'Disputa eleitoral' },
      { n: '~40',   r: 'Cães no abrigo que mantém' },
      { n: 'MDB',   r: 'Mesmo partido da Vilma' },
    ],
  },

  /* ------------------------------------------------------------- CEZINHA */
  cezinha: {
    nome: 'Cezinha de Madureira',
    nomeCompleto: 'Antonio Cezar Correia Freire',
    cargo: 'Deputado Federal',
    uf: 'São Paulo',
    partido: 'PL',
    numero: '2223',
    numeroFmt: ['2','2','2','3'],
    registro: 'Registro deferido no TSE',
    cor: 'azul',
    foto: 'fotos/cezinha.png',

    lead: 'Jornalista, radialista e pastor. Deputado estadual em 2015, ' +
          'deputado federal desde 2019 — com votação crescente a cada eleição.',

    mandatos: [
      { ano: '2014', cargo: 'Deputado Estadual', votos: 105521, partido: 'DEM' },
      { ano: '2018', cargo: 'Deputado Federal',  votos: 119024, partido: 'PSD' },
      { ano: '2022', cargo: 'Deputado Federal',  votos: 143434, partido: 'PSD' },
    ],

    cargos: [
      'Presidente da Comissão de Viação e Transportes (2023–2024)',
      'Vice-Líder do Governo (2022–2023)',
      'Secretário de Transparência (2025)',
      'Comissões de Comunicação, Constituição e Justiça e Relações Exteriores',
    ],

    autoria: [
      { selo: 'PL 4188/2020', titulo: 'Liberdade religiosa',
        texto: 'Regulamenta o livre exercício de crenças e cultos religiosos previsto na Constituição.' },
      { selo: 'PL 2033/2022', titulo: 'Planos de saúde',
        texto: 'Estabelece hipóteses de cobertura de exames e tratamentos que estão fora do rol da saúde suplementar.' },
      { selo: 'PL 2352/2023', titulo: 'Radiodifusão',
        texto: 'Regras claras para a radiodifusão. Aprovado na Comissão de Comunicação da Câmara.' },
      { selo: 'Lei 16.269/2016 (SP)', titulo: 'Lei do Chip',
        texto: 'Exige rigor no cadastro de compradores de chip pré-pago. De sua autoria como deputado estadual.' },
    ],

    fatos: [
      { n: '2223',      r: 'Número na urna' },
      { n: '143.434',   r: 'Votos em 2022' },
      { n: '3',         r: 'Mandatos conquistados' },
      { n: 'PL',        r: 'Partido em 2026' },
    ],
  },

  /* --------------------------------------------------------------- VÍDEO */
  video: {
    url: 'https://www.instagram.com/p/Dcuqygpua5b/',
    autor: '@vereadoravilma',
    data: '31 de agosto de 2026',
    legenda: 'Caraguatatuba merece uma voz forte, preparada e comprometida com as pessoas. ' +
             'Apoio @reginanunessp para Deputada Estadual. Vamos juntos construir um futuro com ' +
             'mais trabalho, respeito e oportunidades para nossa cidade. Vote 15115.',
    tags: ['#ReginaNunes', '#15115', '#Caraguatatuba', '#LitoralNorte', '#SãoPaulo'],

    // Arquivo próprio: quando existir, o site usa o player com SOM e legenda
    // sincronizada em vez do embed do Instagram. Enquanto não existir, cai no embed.
    arquivo: 'midia/recado-vilma.mp4',
    cartaz: 'midia/recado-vilma-capa.jpg',

    // Legenda sincronizada. Cada trecho: { t: segundo em que entra, txt: fala }.
    // VAZIO de propósito — eu não tenho o áudio do vídeo. A assessoria preenche
    // (ou manda o MP4 e a transcrição) e o site passa a legendar sozinho.
    transcricao: [],
  },

  /* -------------------------------------------- COMPROMISSO COM CARAGUÁ */
  // PROPOSTA de campanha, não obra entregue. O texto do site deixa isso explícito.
  compromisso: {
    selo: 'O compromisso com Caraguá',
    titulo: 'Hospital veterinário público e gratuito',
    lead: 'Quem tem bicho em casa sabe: quando adoece, ou tem dinheiro para a clínica, ' +
          'ou não tem o que fazer. Caraguatatuba precisa de atendimento veterinário ' +
          'público e gratuito — e de castração de verdade, que é o que resolve o abandono ' +
          'na raiz.',
    pilares: [
      { titulo: 'Atendimento gratuito',
        texto: 'Consulta, exame e cirurgia para quem não tem como pagar clínica particular.' },
      { titulo: 'Castração como política',
        texto: 'A bandeira central da Regina: castrar em escala é o que faz o abandono cair. ' +
               'Hospital sozinho enxuga gelo.' },
      { titulo: 'O modelo já existe',
        texto: 'A cidade de São Paulo mantém uma rede de hospitais veterinários públicos ' +
               '— o 5º está em obras. Não é ideia solta: é política que já roda numa cidade grande.' },
    ],
    // frase que amarra a proposta ao voto, sem prometer o que não pode
    fecho: 'Não é favor. É política pública — e Caraguá só entra nessa conta com quem ' +
           'defende a causa lá dentro.',
  },

  /* -------------------------------------------------- AGENDA (fallback) */
  // O site tenta ler a agenda do Supabase. Sem banco configurado, mostra estes exemplos
  // marcados como demonstração — nunca finge que é agenda real.
  agendaExemplo: [
    { titulo: 'Caminhada no Centro',    local: 'Praça Dr. Cândido Motta — Centro', data: null, demo: true },
    { titulo: 'Reunião com lideranças', local: 'Massaguaçu',                        data: null, demo: true },
    { titulo: 'Visita ao Perequê-Mirim',local: 'Perequê-Mirim',                     data: null, demo: true },
  ],

  bairros: [
    'Centro', 'Indaiá', 'Sumaré', 'Martim de Sá', 'Praia das Palmeiras', 'Jardim Britânia',
    'Massaguaçu', 'Perequê-Mirim', 'Porto Novo', 'Travessão', 'Golfinhos', 'Tinga',
    'Jardim Casa Branca', 'Pontal Santamarina', 'Morro do Algodão', 'Rio do Ouro',
    'Jardim Primavera', 'Getuba', 'Cocanha', 'Mococa',
  ],
};
