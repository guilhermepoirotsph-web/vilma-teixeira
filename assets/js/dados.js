/* ============================================================================
   dados.js — CONTEÚDO DO SITE (fonte: docs/DADOS.md)
   Tudo que o site escreve na tela sai daqui. Não escrever texto solto nas seções.
   Regra: dado real com fonte, ou lacuna honesta marcada.
   ========================================================================== */

window.VT_DADOS = {

  // O nome "campanha" ficou por compatibilidade (nucleo.js, apoie.js e o
  // painel leem daqui). Desde 13/11/2026 o site é só da Vilma e do mandato.
  campanha: {
    dominio: 'www.vilmateixeira.com',
    titulo: 'Vilma Teixeira · Vereadora de Caraguatatuba (MDB)',
    assinatura: 'Juntos por Caraguá',
    ano: 2026,
    // Identificação obrigatória no rodapé (vedado o anonimato — art. 57-B, Lei 9.504/97)
    responsavel: 'Vilma Teixeira de Oliveira Santos',
    emailContato: '',            // e-mail próprio (NÃO usar o institucional da Câmara)

    // WhatsApp PRÓPRIO da Vilma (não o do gabinete). Vazio de propósito:
    // sem número, os botões de WhatsApp somem do site e o contato vira
    // formulário + Instagram. Publicar o número do GABINETE seria usar
    // estrutura de mandato numa página pessoal — o que o rodapé diz que não faz.
    whatsapp: '',
    instagram: 'vereadoravilma',
    // O número do gabinete NÃO mora aqui, de propósito: este arquivo é servido
    // ao navegador. Ele está em docs/DADOS.md §6-C, que não vai ao ar.
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

    lead: 'Começou em 1995 como auxiliar de serviços gerais, foi agente comunitária de ' +
          'saúde e técnica de enfermagem. Hoje é 1ª Secretária da Mesa da Câmara, no quarto ' +
          'mandato — e autora da lei que leva jardins terapêuticos às UBSs e à UPA de Caraguatatuba.',

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

    // O projeto dela que virou lei. Fonte: Diário Oficial do Município de
    // Caraguatatuba nº 1844, 13/04/2026 (texto conferido em 13/11/2026).
    lei: {
      numero: '2.832',
      ano: '2026',
      sancao: '8 de abril de 2026',
      titulo: 'Jardins terapêuticos nas UBSs e na UPA',
      ementa: 'Institui a implantação de Jardins Terapêuticos nas Unidades Básicas de Saúde (UBS) ' +
              'e na Unidade de Pronto Atendimento (UPA) do Município de Caraguatatuba.',
      fonte: 'Diário Oficial do Município de Caraguatatuba, nº 1844, 13/04/2026',
      finalidades: [
        'proporcionar ambiente agradável, acolhedor e calmante, favorecendo o equilíbrio emocional dos usuários',
        'contribuir com ações de humanização do atendimento em saúde',
        'possibilitar apoio complementar a tratamentos de saúde física e mental',
        'servir como espaço educativo (plantas medicinais, terapia ocupacional e práticas integrativas)',
      ],
    },

    bandeiras: [
      { icone: 'saude',    titulo: 'Saúde',            texto: 'A pauta de origem: UBS que funciona, acolhimento e saúde mental — agora com lei própria.' },
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

  /* ----------------------------------------------------------- INSTAGRAM */
  // Os posts em destaque vêm do painel (Site → Instagram, chaves instagram.post1…4).
  // Cada link vira o embed OFICIAL do Instagram — a imagem continua hospedada lá,
  // a visualização conta para ela e não há cópia de conteúdo. Lista vazia = a
  // grade não aparece (nunca entra post de mentira).
  instagram: {
    posts: [],
  },

  /* ------------------------------------------------------------- GALERIA */
  // Fotos da Vilma: sobem pelo painel (Site → Galeria, galeria.1…6) ou entram
  // como arquivo em fotos/ e são listadas aqui (ex.: 'fotos/galeria-1.jpg').
  // Sem nenhuma, a seção #fotos fica escondida — e o link "Fotos" do menu também.
  // Lista vazia por padrão: o site não sai procurando arquivo que não existe.
  galeria: [],
  galeriaArquivos: [],

  /* -------------------------------------------------- AGENDA (fallback) */
  // O site tenta ler a agenda do Supabase. Sem banco configurado, mostra estes exemplos
  // marcados como demonstração — nunca finge que é agenda real.
  agendaExemplo: [
    { titulo: 'Reunião de bairro',      local: 'Centro',                           data: null, demo: true },
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
