#!/usr/bin/env node
/* semear-previa.mjs — enche o Supabase FALSO com dados de demonstração para a
   prévia que o cliente abre no celular: agenda pública, agenda interna,
   rascunho, apoiadores e o kanban de conteúdo do Lucas.
   Antes: node ferramentas/supabase-falso.mjs
   Uso:   node ferramentas/semear-previa.mjs                                 */
const API = process.argv.find(a => a.startsWith('--api='))?.split('=')[1]
         || 'http://localhost:8810';
const CHAVE = 'chave-publishable-de-teste';

await fetch(API + '/reset', { method: 'POST', headers: { apikey: CHAVE } });
const tok = await (await fetch(API + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'guilherme@gdstudiox.com.br', password: 'teste1234' }),
})).json();

const post = (tabela, dado) => fetch(API + '/rest/v1/' + tabela, {
  method: 'POST',
  headers: { apikey: CHAVE, Authorization: 'Bearer ' + tok.access_token,
             'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify(dado),
});

const dia = (n, h, m = 0) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0);
  return d.toISOString();
};

/* agenda — o que o site mostra, o que só a Mariana vê, e o rascunho ------- */
const EVENTOS = [
  { titulo: 'Caminhada no Centro', tipo: 'caminhada', inicio: dia(1, 9), local: 'Praça Dr. Cândido Motta', bairro: 'Centro', publicado: true, destaque: true },
  { titulo: 'Reunião de bairro no Massaguaçu', tipo: 'reuniao', inicio: dia(2, 19), local: 'Salão da igreja', bairro: 'Massaguaçu', publicado: true },
  { titulo: 'Visita à UBS do Perequê-Mirim', tipo: 'visita', inicio: dia(4, 14, 30), local: 'UBS', bairro: 'Perequê-Mirim', publicado: true },
  { titulo: 'Live com a Regina Nunes', tipo: 'live', inicio: dia(6, 20), local: 'Instagram @vereadoravilma', publicado: true },
  { titulo: 'Carreata com o Cezinha', tipo: 'carreata', inicio: dia(8, 15), local: 'Saída da Praça da Cultura', bairro: 'Centro', publicado: true },
  { titulo: 'Comício de encerramento', tipo: 'comicio', inicio: dia(9, 18), local: 'Praça da Cultura', bairro: 'Centro', publicado: true, destaque: true },
  { titulo: 'Alinhamento interno da equipe', tipo: 'reuniao', inicio: dia(3, 8), local: 'Escritório', interno: true },
  { titulo: 'Café com lideranças do Travessão', tipo: 'reuniao', inicio: dia(5, 9), local: 'A confirmar', bairro: 'Travessão', interno: true },
  { titulo: 'Panfletagem no Travessão', tipo: 'caminhada', inicio: dia(7, 8), bairro: 'Travessão', publicado: false },
];

const APOIADORES = [
  { nome: 'Joana Ribeiro dos Santos', whatsapp: '12977778888', bairro: 'Massaguaçu', ajuda: ['panfletar', 'divulgar'], apoio: ['15115', '2223'], consente: true, consente_apoio: true, status: 'novo' },
  { nome: 'Carlos Eduardo Prado', whatsapp: '12988776655', bairro: 'Centro', email: 'carlos@exemplo.com', ajuda: ['adesivo'], apoio: ['2223'], consente: true, consente_apoio: true, status: 'contatado' },
  { nome: 'Marlene Souza Lima', whatsapp: '12996655443', bairro: 'Perequê-Mirim', ajuda: ['reuniao', 'levar'], consente: true, status: 'engajado', recado: 'A UBS do bairro precisa de mais médico à tarde.' },
  { nome: 'Antônio Ferreira', whatsapp: '12981112233', bairro: 'Travessão', ajuda: ['acompanhar'], consente: true, status: 'novo' },
  { nome: 'Rita de Cássia Alves', whatsapp: '12994443322', bairro: 'Sumaré', ajuda: ['evento', 'panfletar'], apoio: ['15115'], consente: true, consente_apoio: true, status: 'voluntario' },
  { nome: 'Sebastião Nunes de Oliveira', whatsapp: '12987654321', bairro: 'Porto Novo', ajuda: ['levar'], apoio: ['2223'], consente: true, consente_apoio: true, status: 'novo', recado: 'Quero ajudar no hospital veterinário.' },
];

const CONTEUDOS = [
  { titulo: 'Reel da caminhada no Centro', formato: 'reel', status: 'ideia', responsavel: 'Lucas' },
  { titulo: 'Carrossel: 141 proposições', formato: 'carrossel', status: 'roteiro', responsavel: 'Lucas', data_prevista: dia(2, 10) },
  { titulo: 'Story do bastidor da reunião', formato: 'story', status: 'producao', responsavel: 'Vilma' },
  { titulo: 'Vídeo apoio à Regina 15115', formato: 'reel', status: 'aprovacao', responsavel: 'Lucas', data_prevista: dia(3, 18) },
  { titulo: 'Post do comício', formato: 'foto', status: 'agendado', responsavel: 'Lucas', data_prevista: dia(9, 21) },
  { titulo: 'Live com o Cezinha 2223', formato: 'live', status: 'publicado', responsavel: 'Vilma' },
];

for (const e of EVENTOS) await post('eventos', e);
for (const a of APOIADORES) await post('apoiadores', a);
for (const c of CONTEUDOS) await post('conteudos', c);

const conta = async v => (await (await fetch(API + '/rest/v1/' + v + '?select=id',
  { headers: { apikey: CHAVE, Authorization: 'Bearer ' + tok.access_token } })).json()).length;

console.log('✓ semeado:',
  await conta('eventos'), 'compromissos ·',
  await conta('apoiadores'), 'apoiadores ·',
  await conta('conteudos'), 'conteúdos ·',
  await conta('agenda_publica'), 'na agenda pública do site');
