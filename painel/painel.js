/* ============================================================================
   painel.js — painel da equipe da Vereadora Vilma Teixeira

   São dois painéis dentro de um login só, separados pelo PAPEL da pessoa:
     · assessora (Mariana) → Agenda + Apoiadores
     · social media        → Conteúdo (calendário editorial) + Site (lacunas)
     · admin (Guilherme)   → tudo

   Quem manda de verdade é o banco: a RLS do Supabase já barra o que cada
   papel não pode ver. O menu escondido aqui é só conforto — não é a proteção.
   ========================================================================== */
(() => {
  'use strict';

  /* ══════════════════════════════════════════════════════ CONFIG ══ */
  // Mesmos valores de assets/js/banco.js. A chave publishable é pública por
  // natureza; a proteção é a RLS (banco/schema.sql). Nunca service_role aqui.
  const CONFIG = {
    url:   'https://chqedjaonppkvuojkfam.supabase.co',
    chave: 'sb_publishable_9gBZ2KJ6s6oT7ToDssYmAg_b6FvUWO2',
  };

  // Gancho SÓ DE PRÉVIA: localhost e o domínio temporário do cloudflared.
  // Em produção (vilmateixeira.com) isto é inerte — window.VT_CONFIG nunca é
  // olhado, então nem XSS conseguiria desviar as chamadas para outro servidor.
  const ehPrevia = ['localhost', '127.0.0.1'].includes(location.hostname)
                || /\.trycloudflare\.com$/.test(location.hostname);
  if (ehPrevia && window.VT_CONFIG) Object.assign(CONFIG, window.VT_CONFIG);

  const LIGADO = Boolean(CONFIG.url && CONFIG.chave);
  const API  = LIGADO ? CONFIG.url.replace(/\/+$/, '') + '/rest/v1' : '';
  const AUTH = LIGADO ? CONFIG.url.replace(/\/+$/, '') + '/auth/v1' : '';

  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  const MES3 = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  const TIPOS = {
    comicio:   { r: 'Comício',   c: '#e8112d' },
    caminhada: { r: 'Caminhada', c: '#ffc629' },
    carreata:  { r: 'Carreata',  c: '#f58220' },
    reuniao:   { r: 'Reunião',   c: '#00a650' },
    visita:    { r: 'Visita',    c: '#00713a' },
    live:      { r: 'Live',      c: '#7ab648' },
    outro:     { r: 'Agenda',    c: '#5b6b60' },
  };
  const STATUS_AP = {
    novo:       'Novo', contatado: 'Contatado', engajado: 'Engajado',
    voluntario: 'Voluntário', descartado: 'Descartado',
  };
  const COLUNAS = [
    { id: 'ideia',     r: 'Ideia',      c: '#5b6b60' },
    { id: 'roteiro',   r: 'Roteiro',    c: '#a37400' },
    { id: 'producao',  r: 'Produção',   c: '#ffc629' },
    { id: 'aprovacao', r: 'Aprovação',  c: '#f58220' },
    { id: 'agendado',  r: 'Agendado',   c: '#34c173' },
    { id: 'publicado', r: 'Publicado',  c: '#00a650' },
  ];
  const FORMATOS = { reel: 'Reel', carrossel: 'Carrossel', story: 'Story',
                     foto: 'Foto', live: 'Live', texto: 'Texto' };

  /* ═════════════════════════════════════════════════════ SESSÃO ══ */
  const S = {
    token: null, refresh: null, uid: null, email: null,
    perfil: null,                       // { nome, papel, ativo }
    eventos: [], apoiadores: [], conteudos: [], site: [],
    mes: new Date(), visao: 'mes', escopo: 'tudo',
  };

  /* As duas agendas. Um compromisso é sempre exatamente um destes três:
     · publica   → está no site, qualquer pessoa vê
     · interna   → nunca vai ao site, é só do gabinete
     · rascunho  → ainda não decidido (nem publicado, nem interno) */
  const escopoDe = e => e.interno ? 'interna' : (e.publicado ? 'publica' : 'rascunho');

  const guardar = () => {
    try {
      localStorage.setItem('vt_sessao', JSON.stringify({
        token: S.token, refresh: S.refresh, uid: S.uid, email: S.email,
      }));
    } catch {}
  };
  const recuperar = () => {
    try { return JSON.parse(localStorage.getItem('vt_sessao') || 'null'); }
    catch { return null; }
  };
  const esquecer = () => { try { localStorage.removeItem('vt_sessao'); } catch {} };

  /* ═════════════════════════════════════════════════════ REDE ══ */
  async function api(caminho, opc = {}, tentou) {
    if (!LIGADO) throw new Error('Banco ainda não configurado neste painel.');
    const r = await fetch(API + caminho, {
      ...opc,
      headers: {
        apikey: CONFIG.chave,
        Authorization: 'Bearer ' + (S.token || CONFIG.chave),
        'Content-Type': 'application/json',
        ...(opc.headers || {}),
      },
    });
    if (r.status === 401 && !tentou && S.refresh) {   // token venceu: renova uma vez
      if (await renovar()) return api(caminho, opc, true);
    }
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(mensagemAmigavel(r.status, t));
    }
    // Com Prefer: return=minimal o PostgREST responde 201/204 SEM corpo —
    // chamar r.json() direto estoura "Unexpected end of JSON input" e o
    // registro, que foi gravado, parece ter falhado.
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  }

  function mensagemAmigavel(status, texto) {
    if (status === 401 || status === 403) return 'Seu acesso não permite esta ação.';
    if (status === 409) return 'Já existe um registro com esses dados.';
    if (/violates check constraint/i.test(texto)) return 'Algum campo está fora do formato esperado.';
    if (/row-level security/i.test(texto)) return 'Seu perfil não tem permissão para isso.';
    try { const j = JSON.parse(texto); if (j.message) return j.message; } catch {}
    return 'Não consegui completar (erro ' + status + ').';
  }

  async function renovar() {
    try {
      const r = await fetch(AUTH + '/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: S.refresh }),
      });
      if (!r.ok) return false;
      const j = await r.json();
      S.token = j.access_token; S.refresh = j.refresh_token;
      guardar();
      return true;
    } catch { return false; }
  }

  /* ═════════════════════════════════════════════════════ TOAST ══ */
  let tToast;
  function toast(msg, erro) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('erro', Boolean(erro));
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('on'));
    clearTimeout(tToast);
    tToast = setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => { el.hidden = true; }, 320);
    }, erro ? 5200 : 2800);
  }

  /* ═════════════════════════════════════════════════════ MODAL ══ */
  const modal = $('#modal');
  let fechaFoco = null;
  function abrirModal(titulo, html, aoMontar) {
    $('#modal-t').textContent = titulo;
    $('#modal-corpo').innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    fechaFoco = document.activeElement;
    aoMontar?.($('#modal-corpo'));
    $('#modal-corpo').querySelector('input,select,textarea,button')?.focus();
  }
  function fecharModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    fechaFoco?.focus?.();
  }
  modal.addEventListener('click', e => { if (e.target.closest('[data-fechar]')) fecharModal(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) fecharModal();
    if (e.key === 'Tab' && !modal.hidden) {
      const f = [...modal.querySelectorAll('a[href],button,input,select,textarea')]
        .filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ═════════════════════════════════════════════════════ LOGIN ══ */
  const formLogin = $('#form-login');
  let travadoAte = 0, erros = 0;

  formLogin.addEventListener('submit', async e => {
    e.preventDefault();
    const erro = $('#login-erro'), okEl = $('#login-ok');
    erro.hidden = true; okEl.hidden = true;

    if (Date.now() < travadoAte) {
      erro.textContent = 'Muitas tentativas. Espere ' +
        Math.ceil((travadoAte - Date.now()) / 60000) + ' minuto(s).';
      erro.hidden = false; return;
    }
    if (!LIGADO) {
      erro.textContent = 'O banco ainda não foi ligado neste painel. ' +
        'Preencha URL e chave em painel/painel.js (e em assets/js/banco.js).';
      erro.hidden = false; return;
    }

    const btn = $('#btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const r = await fetch(AUTH + '/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formLogin.email.value.trim(),
          password: formLogin.senha.value,
        }),
      });
      if (!r.ok) throw new Error('E-mail ou senha não conferem.');
      const j = await r.json();
      S.token = j.access_token; S.refresh = j.refresh_token;
      S.uid = j.user?.id; S.email = j.user?.email;
      guardar();
      erros = 0;
      formLogin.senha.value = '';
      await entrar();
    } catch (ex) {
      erros++;
      if (erros >= 5) { travadoAte = Date.now() + 5 * 60000; erros = 0; }
      erro.textContent = ex.message + (travadoAte > Date.now()
        ? ' Painel travado por 5 minutos.' : '');
      erro.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });

  $('#btn-esqueci').addEventListener('click', async () => {
    const erro = $('#login-erro'), okEl = $('#login-ok');
    erro.hidden = true; okEl.hidden = true;
    const mail = formLogin.email.value.trim();
    if (!mail) { erro.textContent = 'Escreva seu e-mail primeiro.'; erro.hidden = false; return; }
    if (!LIGADO) { erro.textContent = 'Banco ainda não ligado.'; erro.hidden = false; return; }
    try {
      await fetch(AUTH + '/recover', {
        method: 'POST',
        headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail }),
      });
    } catch {}
    // resposta sempre igual: não confirmamos se o e-mail existe
    okEl.textContent = 'Se este e-mail tiver acesso, o link de nova senha chega em instantes.';
    okEl.hidden = false;
  });

  $('#btn-sair').addEventListener('click', async () => {
    try { await fetch(AUTH + '/logout', { method: 'POST',
      headers: { apikey: CONFIG.chave, Authorization: 'Bearer ' + S.token } }); } catch {}
    esquecer();
    location.reload();
  });

  /* ═══════════════════════════════════════════════════ ENTRADA ══ */
  async function entrar() {
    let perfis;
    try {
      perfis = await api('/perfis?select=nome,papel,ativo,email&id=eq.' + S.uid);
    } catch (e) {
      toast(e.message, true);
      return;
    }
    S.perfil = perfis?.[0] || null;

    $('#tela-login').hidden = true;
    $('#app').hidden = false;

    const nome = S.perfil?.nome || (S.email || '').split('@')[0] || '—';
    $('#topo-quem').textContent = nome;
    $('#topo-avatar').textContent = nome.trim().charAt(0).toUpperCase() || '?';
    $('#topo-papel').textContent = rotuloPapel(S.perfil?.papel, S.perfil?.ativo);

    if (!S.perfil?.ativo || !S.perfil?.papel) {
      $('#inativo-email').textContent = 'Conta: ' + (S.email || '');
      $$('.lado__it').forEach(a => { a.hidden = true; });
      mostrar('inativo');
      return;
    }

    // esconde o que o papel não usa
    $$('.lado__it[data-papel]').forEach(a => {
      a.hidden = !a.dataset.papel.split(',').includes(S.perfil.papel);
    });

    montarAjuda();
    await Promise.all([carregarEventos(), carregarApoiadores(), carregarConteudos(), carregarSite()]);
    rotear();
  }

  const rotuloPapel = (p, ativo) => {
    if (!ativo || !p) return 'Sem acesso';
    return { admin: 'Administração', assessora: 'Assessoria', social: 'Social media' }[p] || p;
  };

  /* ═══════════════════════════════════════════════════ ROTEADOR ══ */
  const PERMISSAO = {
    // A agenda é da assessoria. O social media não precisa dela para produzir
    // conteúdo — e a agenda interna tem compromisso fechado que não é dele.
    agenda:     ['admin', 'assessora'],
    apoiadores: ['admin', 'assessora'],
    conteudo:   ['admin', 'social'],
    site:       ['admin', 'social'],
    ajuda:      ['admin', 'assessora', 'social'],
  };

  // uma única fonte de verdade: quem não abre a aba também não baixa o dado dela
  const podeVer = rota => PERMISSAO[rota]?.includes(S.perfil?.papel) === true;

  function mostrar(rota) {
    $$('.rota').forEach(s => { s.hidden = s.dataset.rota !== rota; });
    $$('.lado__it').forEach(a => a.classList.toggle('on', a.dataset.rota === rota));
    $('#lado').classList.remove('aberto');
    $('#topo-burger').setAttribute('aria-expanded', 'false');
  }

  function rotaPadrao() {
    if (S.perfil?.papel === 'social') return 'conteudo';
    return 'agenda';
  }

  function rotear() {
    if (!S.perfil?.ativo) { mostrar('inativo'); return; }
    let rota = (location.hash || '').replace('#', '') || rotaPadrao();
    if (!PERMISSAO[rota]) rota = rotaPadrao();
    if (!PERMISSAO[rota].includes(S.perfil.papel)) { mostrar('negado'); return; }
    mostrar(rota);
    if (rota === 'agenda') pintarAgenda();
    if (rota === 'apoiadores') pintarApoiadores();
    if (rota === 'conteudo') pintarKanban();
    if (rota === 'site') pintarSite();
  }
  addEventListener('hashchange', rotear);

  $('#topo-burger').addEventListener('click', e => {
    const lado = $('#lado');
    const abriu = lado.classList.toggle('aberto');
    e.currentTarget.setAttribute('aria-expanded', String(abriu));
  });

  /* ══════════════════════════════════════════════════════ CARGA ══ */
  async function carregarEventos() {
    if (!LIGADO || !podeVer('agenda')) return;
    try {
      S.eventos = await api('/eventos?select=*&order=inicio.asc&limit=500') || [];
      const futuros = S.eventos.filter(e => new Date(e.inicio) >= new Date()).length;
      $('#badge-agenda').textContent = futuros || '';
    } catch (e) { console.warn(e); }
  }
  async function carregarApoiadores() {
    if (!LIGADO || !podeVer('apoiadores')) return;
    try {
      S.apoiadores = await api('/apoiadores?select=*&order=criado_em.desc&limit=2000') || [];
      const novos = S.apoiadores.filter(a => a.status === 'novo').length;
      $('#badge-apoiadores').textContent = novos || '';
    } catch (e) { console.warn(e); }
  }
  async function carregarConteudos() {
    if (!LIGADO || !podeVer('conteudo')) return;
    try {
      S.conteudos = await api('/conteudos?select=*&order=data_prevista.asc.nullslast&limit=500') || [];
      const pend = S.conteudos.filter(c => c.status === 'aprovacao').length;
      $('#badge-conteudo').textContent = pend || '';
    } catch (e) { console.warn(e); }
  }
  async function carregarSite() {
    if (!LIGADO || !podeVer('site')) return;
    try {
      S.site = await api('/site_conteudo?select=*&order=grupo.asc,ordem.asc&limit=200') || [];
      const vazios = S.site.filter(c => !c.valor || !c.valor.trim()).length;
      $('#badge-site').textContent = vazios || '';
    } catch (e) { console.warn(e); }
  }

  /* ═══════════════════════════════════════════ AGENDA (Mariana) ══ */
  const iso = d => new Date(d).toISOString();
  const paraInput = d => {
    const x = new Date(d);
    if (isNaN(x)) return '';
    const p = n => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
  };
  const mesmoDia = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  /** Eventos do escopo escolhido (Tudo / Pública / Interna). */
  const visiveis = () => S.escopo === 'tudo'
    ? S.eventos
    : S.eventos.filter(e => escopoDe(e) === S.escopo);

  function pintarAgenda() {
    const base = S.mes;
    $('#mes-nome').textContent = MESES[base.getMonth()] + ' de ' + base.getFullYear();
    $('#cal').hidden = S.visao !== 'mes';
    $('#lista-ev').hidden = S.visao !== 'lista';

    const noMes = e => {
      const d = new Date(e.inicio);
      return d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth();
    };
    const doMes = visiveis().filter(noMes);
    $('#agenda-vazia').hidden = doMes.length > 0;

    // conta as três categorias do mês, para nada ficar esquecido num escopo
    const todosDoMes = S.eventos.filter(noMes);
    const n = { publica: 0, interna: 0, rascunho: 0 };
    todosDoMes.forEach(e => { n[escopoDe(e)]++; });

    const nota = $('#agenda-nota');
    if (nota) {
      const partes = [];
      if (n.publica)  partes.push('<b>' + n.publica + '</b> no site');
      if (n.interna)  partes.push('<b>' + n.interna + '</b> interna' + (n.interna > 1 ? 's' : ''));
      if (n.rascunho) partes.push('<b>' + n.rascunho + '</b> em rascunho');
      nota.hidden = todosDoMes.length === 0;
      nota.innerHTML = partes.length
        ? 'Neste mês: ' + partes.join(' · ') +
          (S.escopo === 'publica'
            ? ' — mostrando só o que está no site.'
            : S.escopo === 'interna'
              ? ' — mostrando só a agenda interna.'
              : '') +
          (n.rascunho && S.escopo !== 'tudo'
            ? ' <span class="agenda-nota__alerta">Rascunho só aparece em "Tudo".</span>'
            : '')
        : '';
    }

    if (S.visao === 'mes') pintarCalendario(base);
    else pintarListaEventos(doMes);
  }

  function pintarCalendario(base) {
    const grade = $('#cal-grade');
    const primeiro = new Date(base.getFullYear(), base.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());          // começa no domingo
    const hoje = new Date();

    let html = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const fora = d.getMonth() !== base.getMonth();
      const doDia = visiveis().filter(e => mesmoDia(new Date(e.inicio), d));

      const pilulas = doDia.slice(0, 3).map(e => {
        const t = TIPOS[e.tipo] || TIPOS.outro;
        const hora = new Date(e.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const cat = escopoDe(e);
        const legenda = { publica: 'no site', interna: 'interna — não vai ao site',
                          rascunho: 'rascunho — ainda não está no site' }[cat];
        return `<button class="pilula pilula--${cat}" style="--c:${t.c}" data-ev="${e.id}"
                   title="${esc(e.titulo)} (${legenda})">
                  <b>${hora}</b>${esc(e.titulo)}</button>`;
      }).join('');

      html += `<div class="dia${fora ? ' dia--fora' : ''}${mesmoDia(d, hoje) ? ' dia--hoje' : ''}"
                    data-dia="${d.toISOString()}">
                 <span class="dia__n">${d.getDate()}</span>
                 ${pilulas}
                 ${doDia.length > 3 ? `<span class="dia__mais">+${doDia.length - 3} mais</span>` : ''}
               </div>`;
    }
    grade.innerHTML = html;
  }

  function pintarListaEventos(lista) {
    const el = $('#lista-ev');
    if (!lista.length) { el.innerHTML = ''; return; }
    el.innerHTML = lista.map(e => {
      const d = new Date(e.inicio);
      const t = TIPOS[e.tipo] || TIPOS.outro;
      return `<article class="ev-l">
        <div class="ev-l__data">
          <span class="ev-l__dia">${String(d.getDate()).padStart(2, '0')}</span>
          <span class="ev-l__mes">${MES3[d.getMonth()]}</span>
        </div>
        <div class="ev-l__meio">
          <div class="card__m">
            <span class="tag" style="--tint:${t.c}33;--tcor:${t.c}">${t.r}</span>
            ${{ publica:  '<span class="tag tag--verde">No site</span>',
                interna:  '<span class="tag tag--ouro">Agenda interna</span>',
                rascunho: '<span class="tag tag--cinza">Rascunho</span>' }[escopoDe(e)]}
          </div>
          <h3 class="ev-l__t">${esc(e.titulo)}</h3>
          <div class="ev-l__i">
            <span>${d.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <span>${esc([e.local, e.bairro].filter(Boolean).join(' · ') || 'Local a confirmar')}</span>
          </div>
        </div>
        <div class="ev-l__acoes">
          <button class="btn btn--fraco btn--p" data-ev="${e.id}">Abrir</button>
        </div>
      </article>`;
    }).join('');
  }

  $('#mes-ant').addEventListener('click', () => {
    S.mes = new Date(S.mes.getFullYear(), S.mes.getMonth() - 1, 1); pintarAgenda();
  });
  $('#mes-prox').addEventListener('click', () => {
    S.mes = new Date(S.mes.getFullYear(), S.mes.getMonth() + 1, 1); pintarAgenda();
  });
  $('#mes-hoje').addEventListener('click', () => { S.mes = new Date(); pintarAgenda(); });
  $('#agenda-visao').addEventListener('click', e => {
    const b = e.target.closest('.segm__b'); if (!b) return;
    $$('#agenda-visao .segm__b').forEach(x => x.classList.toggle('segm__b--on', x === b));
    S.visao = b.dataset.v; pintarAgenda();
  });
  $('#agenda-escopo').addEventListener('click', e => {
    const b = e.target.closest('.segm__b'); if (!b) return;
    $$('#agenda-escopo .segm__b').forEach(x => x.classList.toggle('segm__b--on', x === b));
    S.escopo = b.dataset.e;
    $('#cal').dataset.escopo = S.escopo;
    pintarAgenda();
  });

  document.addEventListener('click', e => {
    const pil = e.target.closest('[data-ev]');
    if (pil) { e.stopPropagation(); abrirEvento(S.eventos.find(x => x.id === pil.dataset.ev)); return; }
    const dia = e.target.closest('.dia');
    if (dia && !$('.rota[data-rota=agenda]').hidden) abrirEvento(null, new Date(dia.dataset.dia));
  });
  $('#novo-evento').addEventListener('click', () => abrirEvento(null));

  function abrirEvento(ev, dia) {
    const novo = !ev;
    const d = ev ? new Date(ev.inicio) : (dia || new Date());
    if (novo && dia) d.setHours(9, 0, 0, 0);

    abrirModal(novo ? 'Novo compromisso' : 'Editar compromisso', `
      <form class="form-modal" id="f-ev">
        <label class="campo largo">
          <span class="campo__rot">O que é? <b>*</b></span>
          <input class="campo__in" name="titulo" required maxlength="160"
                 placeholder="Ex.: Caminhada no Centro" value="${esc(ev?.titulo || '')}">
        </label>
        <label class="campo">
          <span class="campo__rot">Tipo</span>
          <select class="campo__in" name="tipo">
            ${Object.entries(TIPOS).map(([k, v]) =>
              `<option value="${k}"${ev?.tipo === k ? ' selected' : ''}>${v.r}</option>`).join('')}
          </select>
        </label>
        <label class="campo">
          <span class="campo__rot">Começa <b>*</b></span>
          <input class="campo__in" type="datetime-local" name="inicio" required
                 value="${paraInput(ev?.inicio || d)}">
        </label>
        <label class="campo">
          <span class="campo__rot">Termina <em>(opcional)</em></span>
          <input class="campo__in" type="datetime-local" name="fim" value="${ev?.fim ? paraInput(ev.fim) : ''}">
        </label>
        <label class="campo">
          <span class="campo__rot">Bairro</span>
          <input class="campo__in" name="bairro" list="lista-bairros" placeholder="Ex.: Massaguaçu"
                 value="${esc(ev?.bairro || '')}">
        </label>
        <label class="campo largo">
          <span class="campo__rot">Local</span>
          <input class="campo__in" name="local" placeholder="Ex.: Praça Dr. Cândido Motta"
                 value="${esc(ev?.local || '')}">
        </label>
        <label class="campo largo">
          <span class="campo__rot">Endereço <em>(ajuda o "Como chegar" no site)</em></span>
          <input class="campo__in" name="endereco" placeholder="Rua, número"
                 value="${esc(ev?.endereco || '')}">
        </label>
        <label class="campo largo">
          <span class="campo__rot">Observação <em>(aparece no site)</em></span>
          <textarea class="campo__in" name="observacao" rows="2" maxlength="800"
            placeholder="Ex.: Levar guarda-chuva, tem café">${esc(ev?.observacao || '')}</textarea>
        </label>

        <label class="marca largo">
          <input type="checkbox" name="publicado" ${ev?.publicado ? 'checked' : ''}>
          <span><b>Publicar no site</b> — aparece na agenda pública para qualquer pessoa</span>
        </label>
        <label class="marca largo">
          <input type="checkbox" name="interno" ${ev?.interno ? 'checked' : ''}>
          <span><b>Compromisso interno</b> — reunião fechada, <b>nunca</b> vai para o site</span>
        </label>
        <label class="marca largo">
          <input type="checkbox" name="destaque" ${ev?.destaque ? 'checked' : ''}>
          <span>Destacar na agenda do site</span>
        </label>

        <p class="aviso" id="ev-erro" hidden></p>

        <div class="acoes">
          ${!novo ? '<button type="button" class="btn btn--perigo" id="ev-apagar">Apagar</button>' : ''}
          <button type="button" class="btn btn--fraco" data-fechar>Cancelar</button>
          <button type="submit" class="btn">${novo ? 'Criar compromisso' : 'Salvar'}</button>
        </div>
      </form>
      <datalist id="lista-bairros">
        ${['Centro','Indaiá','Sumaré','Martim de Sá','Praia das Palmeiras','Jardim Britânia',
           'Massaguaçu','Perequê-Mirim','Porto Novo','Travessão','Golfinhos','Tinga',
           'Jardim Casa Branca','Pontal Santamarina','Morro do Algodão','Rio do Ouro',
           'Jardim Primavera','Getuba','Cocanha','Mococa']
          .map(b => `<option value="${b}">`).join('')}
      </datalist>
    `, cx => {
      const f = cx.querySelector('#f-ev');
      const pub = f.publicado, intr = f.interno;
      // interno e publicado se excluem — a UI diz isso, o banco garante pela view
      intr.addEventListener('change', () => { if (intr.checked) pub.checked = false; });
      pub.addEventListener('change', () => { if (pub.checked) intr.checked = false; });

      f.addEventListener('submit', async e2 => {
        e2.preventDefault();
        const erro = f.querySelector('#ev-erro');
        erro.hidden = true;
        const dados = {
          titulo: f.titulo.value.trim(),
          tipo: f.tipo.value,
          inicio: new Date(f.inicio.value).toISOString(),
          fim: f.fim.value ? new Date(f.fim.value).toISOString() : null,
          local: f.local.value.trim() || null,
          endereco: f.endereco.value.trim() || null,
          bairro: f.bairro.value.trim() || null,
          observacao: f.observacao.value.trim() || null,
          publicado: f.publicado.checked,
          interno: f.interno.checked,
          destaque: f.destaque.checked,
        };
        if (dados.fim && dados.fim < dados.inicio) {
          erro.textContent = 'O fim não pode ser antes do começo.'; erro.hidden = false; return;
        }
        const btn = f.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Salvando…';
        try {
          if (novo) {
            await api('/eventos', { method: 'POST', headers: { Prefer: 'return=minimal' },
                                    body: JSON.stringify(dados) });
          } else {
            await api('/eventos?id=eq.' + ev.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
                                                   body: JSON.stringify(dados) });
          }
          await carregarEventos();
          pintarAgenda();
          fecharModal();
          toast(novo ? 'Compromisso criado.' : 'Compromisso salvo.');
        } catch (ex) {
          erro.textContent = ex.message; erro.hidden = false;
          btn.disabled = false; btn.textContent = novo ? 'Criar compromisso' : 'Salvar';
        }
      });

      cx.querySelector('#ev-apagar')?.addEventListener('click', async () => {
        if (!confirm('Apagar "' + ev.titulo + '"? Isso não tem volta.')) return;
        try {
          await api('/eventos?id=eq.' + ev.id, { method: 'DELETE' });
          await carregarEventos(); pintarAgenda(); fecharModal();
          toast('Compromisso apagado.');
        } catch (ex) { toast(ex.message, true); }
      });
    });
  }

  /* ═══════════════════════════════════════════════ APOIADORES ══ */
  function pintarApoiadores() {
    const busca = ($('#apoio-busca').value || '').toLowerCase().trim();
    const st = $('#apoio-status').value;
    const bai = $('#apoio-bairro').value;

    // filtro de bairro só com o que existe
    const selB = $('#apoio-bairro');
    if (selB.options.length <= 1 && S.apoiadores.length) {
      [...new Set(S.apoiadores.map(a => a.bairro).filter(Boolean))].sort()
        .forEach(b => selB.add(new Option(b, b)));
    }

    const lista = S.apoiadores.filter(a => {
      if (st && a.status !== st) return false;
      if (bai && a.bairro !== bai) return false;
      if (!busca) return true;
      return (a.nome + ' ' + a.bairro + ' ' + a.whatsapp).toLowerCase().includes(busca);
    });

    // números do topo
    const total = S.apoiadores.length;
    const novos = S.apoiadores.filter(a => a.status === 'novo').length;
    const volun = S.apoiadores.filter(a => ['engajado', 'voluntario'].includes(a.status)).length;
    const decl  = S.apoiadores.filter(a => (a.apoio || []).length > 0).length;
    const bairros = new Set(S.apoiadores.map(a => a.bairro).filter(Boolean)).size;
    $('#apoio-numeros').innerHTML = `
      <div class="kpi"><b>${total}</b><span>cadastrados no total</span></div>
      <div class="kpi kpi--magenta"><b>${novos}</b><span>ainda não contatados</span></div>
      <div class="kpi kpi--verde"><b>${volun}</b><span>engajados / voluntários</span></div>
      <div class="kpi"><b>${decl}</b><span>declararam apoio</span></div>
      <div class="kpi"><b>${bairros}</b><span>bairros alcançados</span></div>`;

    $('#apoio-vazio').hidden = lista.length > 0;
    $('.tabela-wrap').hidden = lista.length === 0;

    $('#corpo-apoio').innerHTML = lista.map(a => {
      const zap = (a.whatsapp || '').replace(/\D/g, '');
      const fmt = zap.length >= 10
        ? `(${zap.slice(0, 2)}) ${zap.slice(2, -4)}-${zap.slice(-4)}` : zap;
      const msg = encodeURIComponent(
        'Oi, ' + (a.nome || '').split(' ')[0] + '! Aqui é da equipe da Vereadora Vilma. ' +
        'Obrigada por se cadastrar no site 💚');
      return `<tr data-ap="${a.id}">
        <td class="td-nome">${esc(a.nome)}${a.email ? `<small>${esc(a.email)}</small>` : ''}</td>
        <td><a class="zap" href="https://wa.me/55${zap}?text=${msg}" target="_blank" rel="noopener">${fmt}</a></td>
        <td>${esc(a.bairro || '—')}</td>
        <td><div class="pilulas">${(a.ajuda || []).map(x =>
              `<span class="mini">${esc(rotuloAjuda(x))}</span>`).join('') || '—'}</div></td>
        <td><div class="pilulas">${(a.apoio || []).map(x =>
              `<span class="mini ${x === '2223' ? 'mini--azul' : 'mini--magenta'}">${esc(x)}</span>`).join('') || '—'}</div></td>
        <td>
          <select class="campo__in sel-status" data-status="${a.id}">
            ${Object.entries(STATUS_AP).map(([k, v]) =>
              `<option value="${k}"${a.status === k ? ' selected' : ''}>${v}</option>`).join('')}
          </select>
        </td>
        <td><button class="btn btn--fraco btn--p" data-verap="${a.id}">Ver</button></td>
      </tr>`;
    }).join('');
  }

  const ROT_AJUDA = {
    divulgar: 'Divulgar', adesivo: 'Adesivo', panfletar: 'Panfletar',
    reuniao: 'Ceder espaço', levar: 'Levar amigos', evento: 'Ajudar em evento',
    acompanhar: 'Acompanhar',
  };
  const rotuloAjuda = v => ROT_AJUDA[v] || v;

  ['#apoio-busca', '#apoio-status', '#apoio-bairro'].forEach(s =>
    $(s).addEventListener('input', pintarApoiadores));

  document.addEventListener('change', async e => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    try {
      await api('/apoiadores?id=eq.' + sel.dataset.status, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: sel.value }),
      });
      const a = S.apoiadores.find(x => x.id === sel.dataset.status);
      if (a) a.status = sel.value;
      const novos = S.apoiadores.filter(x => x.status === 'novo').length;
      $('#badge-apoiadores').textContent = novos || '';
      toast('Situação atualizada.');
    } catch (ex) { toast(ex.message, true); }
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-verap]');
    if (!b) return;
    const a = S.apoiadores.find(x => x.id === b.dataset.verap);
    if (!a) return;
    const zap = (a.whatsapp || '').replace(/\D/g, '');
    abrirModal(a.nome, `
      <div style="display:grid;gap:12px">
        <div class="card__m">
          <span class="tag">${STATUS_AP[a.status] || a.status}</span>
          <span class="tag tag--cinza">${new Date(a.criado_em).toLocaleDateString('pt-BR')}</span>
        </div>
        <p class="miudo" style="margin:0">
          <b style="color:var(--texto)">WhatsApp:</b> ${esc(zap)}<br>
          <b style="color:var(--texto)">Bairro:</b> ${esc(a.bairro || '—')}<br>
          ${a.email ? `<b style="color:var(--texto)">E-mail:</b> ${esc(a.email)}<br>` : ''}
          <b style="color:var(--texto)">Origem:</b> ${esc(a.origem || 'site')}
        </p>
        <div>
          <span class="campo__rot">Quer ajudar com</span>
          <div class="pilulas" style="margin-top:6px">
            ${(a.ajuda || []).map(x => `<span class="mini">${esc(rotuloAjuda(x))}</span>`).join('') ||
              '<span class="miudo">— nada marcado</span>'}
          </div>
        </div>
        <div>
          <span class="campo__rot">Declaração de apoio</span>
          <div class="pilulas" style="margin-top:6px">
            ${(a.apoio || []).map(x =>
              `<span class="mini ${x === '2223' ? 'mini--azul' : 'mini--magenta'}">${esc(x)}</span>`).join('') ||
              '<span class="miudo">— não declarou</span>'}
          </div>
          <p class="miudo" style="margin-top:6px">
            ${a.consente_apoio
              ? 'Consentimento específico dado pelo titular.'
              : 'Sem consentimento específico — por isso não há declaração guardada.'}
          </p>
        </div>
        ${a.recado ? `<div><span class="campo__rot">Recado para a Vilma</span>
          <p style="margin:6px 0 0;font-size:.92rem">${esc(a.recado)}</p></div>` : ''}
        <label class="campo">
          <span class="campo__rot">Anotação da equipe <em>(só aparece aqui)</em></span>
          <textarea class="campo__in" id="ap-obs" rows="3">${esc(a.obs_equipe || '')}</textarea>
        </label>
        <div class="acoes" style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn btn--verde" href="https://wa.me/55${zap}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
          <button class="btn" id="ap-salvar">Salvar anotação</button>
          <button class="btn btn--perigo" id="ap-apagar">Excluir cadastro</button>
        </div>
        <p class="miudo">
          Excluir atende o pedido de exclusão de dados do titular (LGPD art. 18) e não tem volta.
        </p>
      </div>
    `, cx => {
      cx.querySelector('#ap-salvar').addEventListener('click', async () => {
        try {
          const obs = cx.querySelector('#ap-obs').value.trim() || null;
          await api('/apoiadores?id=eq.' + a.id, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ obs_equipe: obs }),
          });
          a.obs_equipe = obs;
          fecharModal(); toast('Anotação salva.');
        } catch (ex) { toast(ex.message, true); }
      });
      cx.querySelector('#ap-apagar').addEventListener('click', async () => {
        if (!confirm('Excluir o cadastro de ' + a.nome + '? Isso não tem volta.')) return;
        try {
          await api('/apoiadores?id=eq.' + a.id, { method: 'DELETE' });
          S.apoiadores = S.apoiadores.filter(x => x.id !== a.id);
          pintarApoiadores(); fecharModal(); toast('Cadastro excluído.');
        } catch (ex) { toast(ex.message, true); }
      });
    });
  });

  $('#exportar-csv').addEventListener('click', () => {
    if (!S.apoiadores.length) { toast('Não há apoiadores para exportar.', true); return; }
    const cab = ['Nome', 'WhatsApp', 'Bairro', 'E-mail', 'Quer ajudar com',
                 'Apoio declarado', 'Situação', 'Recado', 'Cadastro'];
    const linhas = S.apoiadores.map(a => [
      a.nome, a.whatsapp, a.bairro, a.email || '',
      (a.ajuda || []).map(rotuloAjuda).join(' / '),
      (a.apoio || []).join(' / '),
      STATUS_AP[a.status] || a.status,
      (a.recado || '').replace(/\r?\n/g, ' '),
      new Date(a.criado_em).toLocaleString('pt-BR'),
    ]);
    const csv = [cab, ...linhas]
      .map(l => l.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';'))
      .join('\r\n');
    // BOM para o Excel abrir com acento certo
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'apoiadores-vilma-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('CSV baixado. Contém dado pessoal — guarde com cuidado.');
  });

  /* ══════════════════════════════════════ CONTEÚDO (social media) ══ */
  function pintarKanban() {
    const k = $('#kanban');
    $('#conteudo-vazio').hidden = S.conteudos.length > 0;
    k.innerHTML = COLUNAS.map(col => {
      const itens = S.conteudos.filter(c => c.status === col.id);
      return `<section class="col" data-col="${col.id}">
        <h3 class="col__t"><span class="col__pt" style="--c:${col.c}"></span>${col.r}
          <span class="col__n">${itens.length}</span></h3>
        <div class="col__lista" data-lista="${col.id}">
          ${itens.map(c => {
            const d = c.data_prevista ? new Date(c.data_prevista) : null;
            return `<article class="card" draggable="true" data-ct="${c.id}">
              <h4 class="card__t">${esc(c.titulo)}</h4>
              <div class="card__m">
                <span class="tag" style="--tint:${col.c}30;--tcor:${col.c}">${FORMATOS[c.formato] || c.formato}</span>
                ${c.responsavel ? `<span class="tag tag--cinza">${esc(c.responsavel)}</span>` : ''}
              </div>
              ${d ? `<span class="card__d">${d.toLocaleDateString('pt-BR',
                     { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('pt-BR',
                     { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
            </article>`;
          }).join('')}
        </div>
      </section>`;
    }).join('');
  }

  // arrastar e soltar entre colunas
  let arrastando = null;
  document.addEventListener('dragstart', e => {
    const c = e.target.closest('.card'); if (!c) return;
    arrastando = c.dataset.ct;
    c.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragend', e => {
    e.target.closest('.card')?.classList.remove('arrastando');
    $$('.col').forEach(c => c.classList.remove('alvo'));
    arrastando = null;
  });
  document.addEventListener('dragover', e => {
    const col = e.target.closest('.col'); if (!col || !arrastando) return;
    e.preventDefault();
    $$('.col').forEach(c => c.classList.toggle('alvo', c === col));
  });
  document.addEventListener('drop', async e => {
    const col = e.target.closest('.col'); if (!col || !arrastando) return;
    e.preventDefault();
    const id = arrastando, novo = col.dataset.col;
    $$('.col').forEach(c => c.classList.remove('alvo'));
    const c = S.conteudos.find(x => x.id === id);
    if (!c || c.status === novo) return;
    const antes = c.status;
    c.status = novo; pintarKanban();                 // resposta na hora
    try {
      await api('/conteudos?id=eq.' + id, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: novo }),
      });
      toast('Movido para ' + (COLUNAS.find(x => x.id === novo)?.r || novo) + '.');
    } catch (ex) {
      c.status = antes; pintarKanban();              // desfaz se o banco recusar
      toast(ex.message, true);
    }
  });

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-ct]');
    if (c && !$('.rota[data-rota=conteudo]').hidden) {
      abrirConteudo(S.conteudos.find(x => x.id === c.dataset.ct));
    }
  });
  $('#novo-conteudo').addEventListener('click', () => abrirConteudo(null));

  function abrirConteudo(ct) {
    const novo = !ct;
    abrirModal(novo ? 'Nova pauta' : 'Editar pauta', `
      <form class="form-modal" id="f-ct">
        <label class="campo largo">
          <span class="campo__rot">Título da pauta <b>*</b></span>
          <input class="campo__in" name="titulo" required maxlength="160"
                 placeholder="Ex.: Reel da caminhada no Centro" value="${esc(ct?.titulo || '')}">
        </label>
        <label class="campo">
          <span class="campo__rot">Formato</span>
          <select class="campo__in" name="formato">
            ${Object.entries(FORMATOS).map(([k, v]) =>
              `<option value="${k}"${ct?.formato === k ? ' selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
        <label class="campo">
          <span class="campo__rot">Etapa</span>
          <select class="campo__in" name="status">
            ${COLUNAS.map(c =>
              `<option value="${c.id}"${ct?.status === c.id ? ' selected' : ''}>${c.r}</option>`).join('')}
          </select>
        </label>
        <label class="campo">
          <span class="campo__rot">Quando vai ao ar</span>
          <input class="campo__in" type="datetime-local" name="data_prevista"
                 value="${ct?.data_prevista ? paraInput(ct.data_prevista) : ''}">
        </label>
        <label class="campo">
          <span class="campo__rot">Quem faz</span>
          <input class="campo__in" name="responsavel" placeholder="Nome"
                 value="${esc(ct?.responsavel || '')}">
        </label>
        <label class="campo largo">
          <span class="campo__rot">Pauta / roteiro</span>
          <textarea class="campo__in" name="pauta" rows="3"
            placeholder="O que precisa aparecer, quem fala, onde grava…">${esc(ct?.pauta || '')}</textarea>
        </label>
        <label class="campo largo">
          <span class="campo__rot">Legenda pronta</span>
          <textarea class="campo__in" name="legenda" rows="3">${esc(ct?.legenda || '')}</textarea>
        </label>
        <label class="campo">
          <span class="campo__rot">Hashtags</span>
          <input class="campo__in" name="hashtags" placeholder="#Caraguatatuba #15115"
                 value="${esc(ct?.hashtags || '')}">
        </label>
        <label class="campo">
          <span class="campo__rot">Link do post publicado</span>
          <input class="campo__in" name="link" type="url" placeholder="https://instagram.com/p/…"
                 value="${esc(ct?.link || '')}">
        </label>
        <p class="aviso" id="ct-erro" hidden></p>
        <div class="acoes">
          ${!novo ? '<button type="button" class="btn btn--perigo" id="ct-apagar">Apagar</button>' : ''}
          <button type="button" class="btn btn--fraco" data-fechar>Cancelar</button>
          <button type="submit" class="btn">${novo ? 'Criar pauta' : 'Salvar'}</button>
        </div>
      </form>
    `, cx => {
      const f = cx.querySelector('#f-ct');
      f.addEventListener('submit', async e2 => {
        e2.preventDefault();
        const erro = f.querySelector('#ct-erro'); erro.hidden = true;
        const dados = {
          titulo: f.titulo.value.trim(), formato: f.formato.value, status: f.status.value,
          data_prevista: f.data_prevista.value ? new Date(f.data_prevista.value).toISOString() : null,
          responsavel: f.responsavel.value.trim() || null,
          pauta: f.pauta.value.trim() || null,
          legenda: f.legenda.value.trim() || null,
          hashtags: f.hashtags.value.trim() || null,
          link: f.link.value.trim() || null,
        };
        const btn = f.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Salvando…';
        try {
          if (novo) await api('/conteudos', { method: 'POST', headers: { Prefer: 'return=minimal' },
                                              body: JSON.stringify(dados) });
          else await api('/conteudos?id=eq.' + ct.id, { method: 'PATCH',
                        headers: { Prefer: 'return=minimal' }, body: JSON.stringify(dados) });
          await carregarConteudos(); pintarKanban(); fecharModal();
          toast(novo ? 'Pauta criada.' : 'Pauta salva.');
        } catch (ex) {
          erro.textContent = ex.message; erro.hidden = false;
          btn.disabled = false; btn.textContent = novo ? 'Criar pauta' : 'Salvar';
        }
      });
      cx.querySelector('#ct-apagar')?.addEventListener('click', async () => {
        if (!confirm('Apagar a pauta "' + ct.titulo + '"?')) return;
        try {
          await api('/conteudos?id=eq.' + ct.id, { method: 'DELETE' });
          await carregarConteudos(); pintarKanban(); fecharModal(); toast('Pauta apagada.');
        } catch (ex) { toast(ex.message, true); }
      });
    });
  }

  /* ══════════════════════════════ SITE — as lacunas editáveis ══ */
  const NOME_GRUPO = {
    video: '🎬 Vídeo em destaque', heroi: '⭐ Abertura do site',
    regina: '🌸 Regina Nunes', cezinha: '🔷 Cezinha de Madureira',
    geral: '⚙️ Geral',
  };

  function pintarSite() {
    const alvo = $('#grupos-site');
    $('#site-vazio').hidden = S.site.length > 0;
    if (!S.site.length) { alvo.innerHTML = ''; return; }

    // o vídeo em destaque é o que ele mais mexe: abre primeiro
    const ORDEM = ['video', 'heroi', 'regina', 'cezinha', 'geral'];
    const grupos = [...new Set(S.site.map(c => c.grupo))]
      .sort((a, b) => {
        const ia = ORDEM.indexOf(a), ib = ORDEM.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    alvo.innerHTML = grupos.map((gp, i) => {
      const campos = S.site.filter(c => c.grupo === gp);
      const faltam = campos.filter(c => !c.valor || !c.valor.trim()).length;
      return `<section class="grupo${i === 0 ? ' aberto' : ''}" data-grupo="${gp}">
        <button class="grupo__t" type="button">
          ${NOME_GRUPO[gp] || gp}
          <span class="grupo__n">${faltam ? faltam + ' em branco' : 'tudo preenchido'}</span>
          <span class="grupo__seta">▾</span>
        </button>
        <div class="grupo__corpo">
          ${campos.map(c => campoSite(c)).join('')}
        </div>
      </section>`;
    }).join('');
  }

  function campoSite(c) {
    const largo = c.tipo === 'texto_longo' || c.tipo === 'imagem';
    const v = esc(c.valor || '');
    const entrada = c.tipo === 'texto_longo'
      ? `<textarea class="campo__in" data-chave="${c.chave}" rows="3">${v}</textarea>`
      : `<input class="campo__in" data-chave="${c.chave}"
              type="${c.tipo === 'url' || c.tipo === 'imagem' ? 'url' : 'text'}"
              inputmode="${c.tipo === 'numero' ? 'numeric' : 'text'}" value="${v}">`;
    return `<label class="campo ${largo ? 'campo--largo' : ''}">
      <span class="campo__rot">${esc(c.rotulo)}
        <span class="salvo" data-salvo="${c.chave}">salvo ✓</span></span>
      ${entrada}
      ${c.dica ? `<span class="campo__dica">${esc(c.dica)}</span>` : ''}
      ${c.tipo === 'imagem' && c.valor
        ? `<img class="previa-img" src="${esc(c.valor)}" alt="" onerror="this.hidden=true">` : ''}
    </label>`;
  }

  $('#grupos-site').addEventListener('click', e => {
    const t = e.target.closest('.grupo__t');
    if (t) t.closest('.grupo').classList.toggle('aberto');
  });

  // salva ao sair do campo (o social media não precisa procurar botão)
  $('#grupos-site').addEventListener('change', async e => {
    const el = e.target.closest('[data-chave]');
    if (!el) return;
    const chave = el.dataset.chave;
    const valor = el.value.trim() || null;
    const reg = S.site.find(c => c.chave === chave);
    if (reg && (reg.valor || '') === (valor || '')) return;

    // número da urna precisa ser só dígito, senão o simulador quebra
    if (reg?.tipo === 'numero' && valor && !/^[0-9]{2,6}$/.test(valor)) {
      toast('O número precisa ter só dígitos (ex.: 15115).', true);
      el.value = reg.valor || '';
      return;
    }
    try {
      await api('/site_conteudo?chave=eq.' + encodeURIComponent(chave), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ valor }),
      });
      if (reg) reg.valor = valor;
      const marca = document.querySelector(`[data-salvo="${CSS.escape(chave)}"]`);
      if (marca) { marca.classList.add('on'); setTimeout(() => marca.classList.remove('on'), 1800); }
      const vazios = S.site.filter(c => !c.valor || !c.valor.trim()).length;
      $('#badge-site').textContent = vazios || '';
    } catch (ex) { toast(ex.message, true); }
  });

  /* ══════════════════════════════════════════════════════ AJUDA ══ */
  function montarAjuda() {
    const papel = S.perfil?.papel;
    const nome = (S.perfil?.nome || '').split(' ')[0];
    const blocos = [];

    blocos.push(`<div class="bloco">
      <p style="margin:0">${nome ? '<b>Oi, ' + esc(nome) + '!</b> ' : ''}
      Este painel é da equipe da Vereadora Vilma. Seu acesso é
      <b>${rotuloPapel(papel, true)}</b>.</p></div>`);

    if (['admin', 'assessora'].includes(papel)) blocos.push(`
      <h2>As duas agendas</h2>
      <div class="bloco">
        <p style="margin:0 0 10px">
          O calendário guarda <b>duas agendas ao mesmo tempo</b>. O seletor
          <b>Tudo · Pública · Interna</b> escolhe qual você está vendo.
        </p>
        <ul>
          <li><b>Pública</b> (pílula colorida cheia) — está no site, qualquer pessoa vê.
              É a agenda que o eleitor usa para saber onde a Vilma vai estar.</li>
          <li><b>Interna</b> (contorno dourado) — reunião fechada, agenda pessoal, alinhamento
              de equipe. <b>Nunca</b> aparece no site, em nenhuma hipótese.</li>
          <li><b>Rascunho</b> (contorno apagado) — ainda não decidido: não está no site nem
              foi marcado como interno. Só aparece na visão <b>Tudo</b>.</li>
        </ul>
        <p style="margin:10px 0 0">
          Ao criar, marcar <b>interno</b> desmarca <b>publicar no site</b> sozinho —
          um compromisso nunca pode ser as duas coisas.
        </p>
      </div>
      <h2>Mexendo na agenda</h2>
      <div class="bloco">
        <ol>
          <li>Clique em <b>+ Novo compromisso</b> — ou direto no dia do calendário.</li>
          <li>Preencha o que é, quando e onde.</li>
          <li>Decida: vai para o site (<b>publicar</b>) ou fica só aqui (<b>interno</b>)?</li>
          <li>Para mudar depois, clique no compromisso no calendário.</li>
          <li>A linha abaixo do seletor conta quantos você tem de cada tipo no mês.</li>
        </ol>
      </div>
      <div class="bloco bloco--alerta">
        <p style="margin:0"><b>Dica:</b> só publique quando o horário estiver confirmado.
        A pessoa que vê a agenda no site pode sair de casa por causa dela.</p>
      </div>
      <h2>Apoiadores</h2>
      <div class="bloco">
        <ul>
          <li>Quem se cadastra pelo site cai aqui como <b>Novo</b>.</li>
          <li>Clique no número do WhatsApp para já abrir a conversa com a mensagem pronta.</li>
          <li>Mude a <b>situação</b> conforme for falando com a pessoa.</li>
          <li><b>Baixar CSV</b> gera a planilha para o Excel.</li>
        </ul>
        <p style="margin-top:10px"><b>São dados pessoais de verdade.</b> Não repasse para fora
        da campanha. Se a pessoa pedir para sair, use <b>Excluir cadastro</b> — é o direito dela.</p>
      </div>`);

    if (['admin', 'social'].includes(papel)) blocos.push(`
      <h2>Conteúdo</h2>
      <div class="bloco">
        <ul>
          <li>Cada card é uma pauta. Arraste entre as colunas conforme avança.</li>
          <li>Clique no card para escrever roteiro, legenda e hashtags.</li>
          <li>Publicou? Cole o link do post e mova para <b>Publicado</b>.</li>
        </ul>
      </div>
      <h2>Site</h2>
      <div class="bloco">
        <ul>
          <li>É onde você <b>alimenta o site</b> sem mexer em código.</li>
          <li><b>Vídeo em destaque:</b> cole o link do post do Instagram e pronto — o site troca sozinho.</li>
          <li><b>Fotos:</b> cole o link da imagem (PNG sem fundo fica melhor).</li>
          <li>Salva sozinho quando você sai do campo — aparece "salvo ✓".</li>
          <li>Campo em branco = o site usa o texto padrão. Nunca fica buraco na tela.</li>
        </ul>
      </div>
      <div class="bloco bloco--alerta">
        <p style="margin:0"><b>Atenção com os números 15115 e 2223.</b> Se mudar ali,
        muda no site inteiro e no simulador de urna. Confira antes de salvar.</p>
      </div>`);

    blocos.push(`
      <h2>Segurança</h2>
      <div class="bloco">
        <ul>
          <li>Seu acesso é <b>pessoal</b>. Não empreste login nem senha.</li>
          <li>Terminou? Clique em <b>Sair</b>, principalmente em computador de terceiro.</li>
          <li>Conta nova nasce <b>sem acesso</b> — quem administra libera.</li>
        </ul>
      </div>`);

    $('#ajuda-conteudo').innerHTML = blocos.join('');
  }

  /* ══════════════════════════════════════════════════════ BOOT ══ */
  (async () => {
    if (!LIGADO) {
      $('#login-erro').textContent =
        'Painel ainda sem banco. Preencha URL e chave em painel/painel.js — ' +
        'passo a passo no LEIA-ME do projeto.';
      $('#login-erro').hidden = false;
      return;
    }
    const s = recuperar();
    if (!s?.token) return;
    S.token = s.token; S.refresh = s.refresh; S.uid = s.uid; S.email = s.email;
    try { await entrar(); }
    catch { esquecer(); }
  })();
})();
