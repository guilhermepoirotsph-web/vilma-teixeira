/* ============================================================================
   agenda.js — agenda pública da vereadora.
   Lê a view `agenda_publica` do Supabase (só o que a assessoria publicou).
   Sem banco → estado "agenda sendo montada", nunca uma lista falsa.
   ========================================================================== */
VT.secao('agenda', () => {
  const lista = document.getElementById('agenda-lista');
  const vazio = document.getElementById('agenda-vazio');
  const filtros = document.getElementById('agenda-filtros');
  if (!lista) return;

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  const TIPOS = {
    comicio:   { rot: 'Comício',   tint: 'rgba(255,198,41,.16)',  cor: '#ffc629' },
    caminhada: { rot: 'Caminhada', tint: 'rgba(224,168,0,.16)', cor: '#e0a800' },
    carreata:  { rot: 'Carreata',  tint: 'rgba(163,116,0,.16)', cor: '#a37400' },
    reuniao:   { rot: 'Reunião',   tint: 'rgba(125,220,159,.16)',   cor: '#7ddc9f' },
    visita:    { rot: 'Visita',    tint: 'rgba(52,193,115,.16)',   cor: '#34c173' },
    live:      { rot: 'Live',      tint: 'rgba(0,166,80,.16)', cor: '#00a650' },
    outro:     { rot: 'Agenda',    tint: 'rgba(91,107,96,.08)',   cor: '#5b6b60' },
  };

  /* ------------------------------------------------------------- hoje */
  const hoje = new Date();
  const elDia = document.getElementById('agenda-hoje-dia');
  const elMes = document.getElementById('agenda-hoje-mes');
  if (elDia) elDia.textContent = String(hoje.getDate()).padStart(2, '0');
  if (elMes) elMes.textContent = MESES[hoje.getMonth()];

  /* ------------------------------------------------------------ ícones */
  const ico = {
    relogio: '<svg viewBox="0 0 24 24" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pino:    '<svg viewBox="0 0 24 24" stroke-linecap="round"><path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  };

  /* ------------------------------------------- .ics para salvar na agenda */
  function ics(ev) {
    const z = d => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const fim = ev.fim || new Date(new Date(ev.inicio).getTime() + 2 * 3600e3).toISOString();
    const corpo = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vilma Teixeira//Agenda//PT-BR',
      'BEGIN:VEVENT',
      'UID:' + (ev.id || Date.now()) + '@vilmateixeira.com',
      'DTSTAMP:' + z(Date.now()),
      'DTSTART:' + z(ev.inicio),
      'DTEND:' + z(fim),
      'SUMMARY:' + String(ev.titulo || '').replace(/\r?\n/g, ' '),
      'LOCATION:' + [ev.local, ev.bairro, 'Caraguatatuba-SP'].filter(Boolean).join(', '),
      'DESCRIPTION:Agenda da Vereadora Vilma Teixeira',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(corpo);
  }

  /* ------------------------------------------------------------ cartão */
  function cartao(ev) {
    const d = new Date(ev.inicio);
    const valida = !isNaN(d);
    const t = TIPOS[ev.tipo] || TIPOS.outro;
    const passado = valida && d < new Date(Date.now() - 3 * 3600e3);

    const hora = valida
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : 'horário a confirmar';

    const ondeTxt = [ev.local, ev.bairro].filter(Boolean).join(' · ') || 'Local a confirmar';
    const buscaMapa = encodeURIComponent(
      [ev.endereco || ev.local, ev.bairro, 'Caraguatatuba SP'].filter(Boolean).join(', '));
    const mapa = ev.link_mapa || ('https://www.google.com/maps/search/?api=1&query=' + buscaMapa);

    const msg = 'Oi! Quero confirmar presença em "' + (ev.titulo || 'evento') + '"' +
                (valida ? ' no dia ' + d.toLocaleDateString('pt-BR') : '') + '.';
    const zap = VT.wa(msg);   // vazio quando não há número de campanha

    return `
      <article class="ev${passado ? ' ev--passado' : ''}${ev.destaque ? ' ev--destaque' : ''}"
               data-tipo="${VT.escapar(ev.tipo || 'outro')}">
        <div class="ev__data">
          <span class="ev__dia">${valida ? String(d.getDate()).padStart(2, '0') : '--'}</span>
          <span class="ev__mes">${valida ? MESES[d.getMonth()] : ''}</span>
          <span class="ev__sem">${valida ? SEMANA[d.getDay()] : ''}</span>
        </div>
        <div class="ev__meio">
          <span class="ev__tipo" style="--tint:${t.tint};--tcor:${t.cor}">${t.rot}</span>
          <h3 class="ev__titulo">${VT.escapar(ev.titulo || 'Compromisso')}</h3>
          <div class="ev__linha">
            <span class="ev__ico">${ico.relogio}<b>${hora}</b></span>
            <span class="ev__ico">${ico.pino}${VT.escapar(ondeTxt)}</span>
          </div>
          ${ev.observacao ? `<p class="miudo" style="margin:2px 0 0">${VT.escapar(ev.observacao)}</p>` : ''}
        </div>
        <div class="ev__acoes">
          ${zap ? `<a class="ev__btn" href="${zap}" target="_blank" rel="noopener">Confirmar presença</a>` : ''}
          <a class="ev__btn ev__btn--fraco" href="${mapa}" target="_blank" rel="noopener">Como chegar</a>
          ${valida ? `<a class="ev__btn ev__btn--fraco" href="${ics(ev)}"
             download="agenda-vilma.ics">Salvar na agenda</a>` : ''}
        </div>
      </article>`;
  }

  /* ------------------------------------------------------------ pintar */
  let todos = [];
  let filtro = 'todos';

  function pintar() {
    const itens = filtro === 'todos' ? todos : todos.filter(e => (e.tipo || 'outro') === filtro);

    if (!itens.length) {
      lista.innerHTML = '';
      lista.hidden = true;
      if (vazio) {
        vazio.hidden = false;
        const t = vazio.querySelector('h3');
        const p = vazio.querySelector('.lead');
        if (todos.length && filtro !== 'todos') {
          t.textContent = 'Nada desse tipo por enquanto';
          p.textContent = 'Não há compromissos dessa categoria na agenda. Veja em "Tudo".';
        } else {
          t.textContent = 'Agenda sendo montada';
          p.textContent = 'Os próximos compromissos entram aqui assim que a assessoria publicar. ' +
                          'Quer ser avisado? Deixe seu contato logo abaixo.';
        }
      }
      return;
    }

    if (vazio) vazio.hidden = true;
    lista.hidden = false;
    lista.innerHTML = itens.map(cartao).join('');

    if (VT.animando && VT.g) {
      VT.g.from(lista.children, {
        opacity: 0, y: 24, stagger: .07, duration: .6, ease: 'power2.out', overwrite: true,
      });
    }
    VT.refresh();
  }

  /* ----------------------------------------------------------- filtros */
  filtros?.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    filtros.querySelectorAll('.chip').forEach(c => c.classList.toggle('chip--on', c === b));
    filtro = b.dataset.f;
    pintar();
  });

  /* ------------------------------------------------------------ buscar */
  (async () => {
    const r = await window.VT_BANCO.agenda();
    todos = (r.itens || []).filter(e => e && e.titulo);
    if (!r.ok && !window.VT_BANCO.ligado) {
      console.info('[agenda] banco ainda não configurado — mostrando estado vazio honesto.');
    }
    // esconde filtros de tipos que não existem na agenda
    if (filtros && todos.length) {
      const presentes = new Set(todos.map(e => e.tipo || 'outro'));
      filtros.querySelectorAll('.chip').forEach(c => {
        if (c.dataset.f !== 'todos') c.hidden = !presentes.has(c.dataset.f);
      });
    } else if (filtros) {
      filtros.hidden = true;
    }
    pintar();
  })();
});
