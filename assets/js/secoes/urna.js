/* ============================================================================
   urna.js — simulador de urna eletrônica (treino).

   Ordem real da eleição geral: Deputado Federal (4) → Deputado Estadual (5).
   Nada é enviado a lugar nenhum: é 100% no navegador, sem gravar nada.
   Som gerado com Web Audio (sem arquivo, sem direito autoral) e só depois de
   um gesto do usuário — navegador não deixa tocar antes.
   ========================================================================== */
VT.secao('urna', async () => {
  const g = VT.g;
  const maquina = document.getElementById('urna-maquina');
  if (!maquina) return;

  // espera o que a equipe editou no painel (número, nome, foto).
  // Sem banco, isso resolve na hora e a urna usa os valores do código.
  try { await window.VT_CONTEUDO?.pronto; } catch {}

  /* ------------------------------------------------------------ dados */
  const D = window.VT_DADOS || {};
  const cez = D.cezinha || {}, reg = D.regina || {};

  const APOIADOS = {
    [cez.numero || '2223']:  { nome: cez.nome || 'Cezinha de Madureira', partido: cez.partido || 'PL',
                               cargo: cez.cargo || 'Deputado Federal',  foto: cez.foto || 'fotos/cezinha.png' },
    [reg.numero || '15115']: { nome: reg.nome || 'Regina Nunes',        partido: reg.partido || 'MDB',
                               cargo: reg.cargo || 'Deputada Estadual', foto: reg.foto || 'fotos/regina.png' },
  };

  const FASES = [
    { id: 'federal',  rotulo: (cez.cargo || 'Deputado Federal').toUpperCase(),
      digitos: (cez.numero || '2223').length,  esperado: cez.numero || '2223',  passo: '1 de 2' },
    { id: 'estadual', rotulo: (reg.cargo || 'Deputada Estadual').toUpperCase(),
      digitos: (reg.numero || '15115').length, esperado: reg.numero || '15115', passo: '2 de 2' },
  ];

  /* ------------------------------------------------------------- refs */
  const $ = id => document.getElementById(id);
  const lcd = $('lcd'), elCargo = $('lcd-cargo'), elPasso = $('lcd-passo');
  const elDig = $('lcd-digitos'), elFicha = $('lcd-ficha'), elAviso = $('lcd-aviso');
  const elFim = $('lcd-fim'), elPe = $('lcd-pe'), elLinha = maquina.querySelector('.lcd__linha');
  const elNome = $('lcd-nome'), elPartido = $('lcd-partido'), elCargoFic = $('lcd-cargofic');
  const elRetrato = $('lcd-retrato');
  const btnSom = $('urna-som');

  /* -------------------------------------------------------------- som */
  let ctx = null, comSom = true;
  const acordar = () => { if (!ctx) { try { ctx = new (AudioContext || webkitAudioContext)(); } catch {} } };
  function bip(freq = 1046, dur = .085, vol = .1, tipo = 'square') {
    if (!comSom || !ctx) return;
    try {
      const o = ctx.createOscillator(), gan = ctx.createGain();
      o.type = tipo; o.frequency.value = freq;
      gan.gain.setValueAtTime(0, ctx.currentTime);
      gan.gain.linearRampToValueAtTime(vol, ctx.currentTime + .008);
      gan.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
      o.connect(gan); gan.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur + .02);
    } catch {}
  }
  const bipTecla    = () => bip(1046, .07, .085);
  const bipConfirma = () => { bip(880, .1, .1); setTimeout(() => bip(1318, .22, .11), 110); };
  const bipErro     = () => { bip(220, .18, .1, 'sawtooth'); };

  btnSom?.addEventListener('click', () => {
    comSom = !comSom;
    btnSom.setAttribute('aria-pressed', String(comSom));
    if (comSom) { acordar(); bipTecla(); }
  });

  /* ------------------------------------------------------------ estado */
  let iFase = 0;
  let buffer = '';
  let branco = false;
  let travado = false;
  const escolhas = [];

  const fase = () => FASES[iFase];

  /* ------------------------------------------------------------ pintar */
  function pintarDigitos() {
    const f = fase();
    elDig.innerHTML = '';
    for (let i = 0; i < f.digitos; i++) {
      const cx = document.createElement('span');
      cx.className = 'lcd__cx';
      if (i < buffer.length) { cx.classList.add('cheia'); cx.textContent = buffer[i]; }
      else if (i === buffer.length && !branco) cx.classList.add('ativa');
      elDig.appendChild(cx);
    }
  }

  function pintarFicha() {
    const f = fase();
    const completo = buffer.length === f.digitos;

    elAviso.hidden = true;
    elFicha.hidden = true;

    if (branco) {
      elFicha.hidden = true;
      elAviso.hidden = false;
      elAviso.innerHTML = '<b>VOTO EM BRANCO</b><br>Aperte <b>CONFIRMA</b> para confirmar ou ' +
                          '<b>CORRIGE</b> para escolher um número.';
      return;
    }
    if (!completo) return;

    const c = APOIADOS[buffer];
    if (!c) {
      elAviso.hidden = false;
      elAviso.innerHTML = '<b>NÚMERO NÃO CORRESPONDE</b> a nenhum candidato apoiado por esta ' +
                          'página. Aperte <b>CORRIGE</b> e tente <b>' + f.esperado + '</b>.';
      bipErro();
      return;
    }

    elFicha.hidden = false;
    elNome.textContent = c.nome;
    elPartido.textContent = c.partido;
    elCargoFic.textContent = c.cargo;
    elRetrato.style.backgroundImage = 'url("' + c.foto + '")';
    elRetrato.textContent = '';
    // se a foto não existir ainda, o retrato mostra as iniciais
    const teste = new Image();
    teste.onerror = () => {
      elRetrato.style.backgroundImage = 'none';
      elRetrato.textContent = c.nome.split(' ').map(p => p[0]).slice(0, 2).join('');
    };
    teste.src = c.foto;

    if (VT.animando && g) g.fromTo(elFicha, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .3 });
  }

  function pintarTela() {
    const f = fase();
    elCargo.textContent = f.rotulo;
    elPasso.textContent = f.passo;
    lcd.dataset.fase = f.id;
    pintarDigitos();
    pintarFicha();
    elPe.hidden = false;
    elPe.innerHTML = 'Aperte a tecla:<br><b>CONFIRMA</b> para confirmar este voto<br>' +
                     '<b>CORRIGE</b> para digitar de novo';
  }

  function telaFim() {
    travado = true;
    elLinha.hidden = true;
    elFicha.hidden = true;
    elAviso.hidden = true;
    elPe.hidden = true;
    elCargo.textContent = 'VOTO DE TREINO CONCLUÍDO';
    elPasso.textContent = '2 de 2';
    elFim.hidden = false;

    const resumo = escolhas
      .map(e => e.branco ? '<b>' + e.cargo + ':</b> branco'
                         : '<b>' + e.cargo + ':</b> ' + e.numero + ' — ' + (APOIADOS[e.numero]?.nome || '—'))
      .join('<br>');
    elFim.querySelector('p').innerHTML =
      resumo + '<br><br>Na hora de verdade é exatamente assim. 💚';

    bipConfirma();
    if (VT.animando && g) {
      g.fromTo(elFim, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .5, ease: 'back.out(1.6)' });
      confete();
    }
    setTimeout(() => { reiniciarBotao(); }, 900);
  }

  function reiniciarBotao() {
    if (elFim.querySelector('.urna__denovo')) return;
    const b = document.createElement('button');
    b.className = 'btn btn--ouro urna__denovo';
    b.type = 'button';
    b.style.marginTop = '10px';
    b.textContent = 'Treinar de novo';
    b.addEventListener('click', reiniciar);
    elFim.appendChild(b);
  }

  function reiniciar() {
    iFase = 0; buffer = ''; branco = false; travado = false; escolhas.length = 0;
    elFim.hidden = true;
    elFim.querySelector('.urna__denovo')?.remove();
    elLinha.hidden = false;
    pintarTela();
  }

  /* ------------------------------------------------------------- ações */
  function digitar(n) {
    if (travado || branco) return;
    const f = fase();
    if (buffer.length >= f.digitos) return;
    buffer += n;
    acordar(); bipTecla();
    pintarDigitos();
    if (buffer.length === f.digitos) pintarFicha();
  }

  function corrigir() {
    if (travado) return;
    buffer = ''; branco = false;
    acordar(); bipTecla();
    pintarTela();
  }

  function votarBranco() {
    if (travado) return;
    branco = true; buffer = '';
    acordar(); bipTecla();
    pintarDigitos();
    pintarFicha();
  }

  function confirmar() {
    if (travado) return;
    const f = fase();
    acordar();

    if (!branco && buffer.length !== f.digitos) { bipErro(); sacudir(); return; }
    if (!branco && !APOIADOS[buffer]) { bipErro(); sacudir(); return; }

    escolhas.push({ cargo: f.rotulo, numero: buffer, branco });
    bipConfirma();

    if (iFase < FASES.length - 1) {
      iFase++; buffer = ''; branco = false;
      if (VT.animando && g) {
        g.fromTo(lcd, { opacity: .35 }, { opacity: 1, duration: .45, ease: 'power2.out' });
      }
      pintarTela();
    } else {
      telaFim();
    }
  }

  function sacudir() {
    if (!VT.animando || !g) return;
    g.fromTo(lcd, { x: -7 }, { x: 0, duration: .45, ease: 'elastic.out(1,.35)' });
  }

  /* ------------------------------------------------------------ teclas */
  function premir(el) {
    if (!el) return;
    el.classList.add('premida');
    setTimeout(() => el.classList.remove('premida'), 110);
  }

  maquina.querySelectorAll('.tecla[data-t]').forEach(b => {
    b.addEventListener('click', () => { digitar(b.dataset.t); premir(b); });
  });
  maquina.querySelector('[data-a=corrige]')?.addEventListener('click', e => { corrigir(); premir(e.currentTarget); });
  maquina.querySelector('[data-a=branco]')?.addEventListener('click', e => { votarBranco(); premir(e.currentTarget); });
  maquina.querySelector('[data-a=confirma]')?.addEventListener('click', e => { confirmar(); premir(e.currentTarget); });

  // teclado físico — só quando a urna está na tela
  let naTela = false;
  new IntersectionObserver(es => { naTela = es[0].isIntersecting; }, { threshold: .35 }).observe(maquina);

  addEventListener('keydown', e => {
    if (!naTela) return;
    if (document.activeElement?.matches('input,textarea,select')) return;

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault(); digitar(e.key);
      premir(maquina.querySelector('.tecla[data-t="' + e.key + '"]'));
    } else if (e.key === 'Enter') {
      e.preventDefault(); confirmar(); premir(maquina.querySelector('[data-a=confirma]'));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault(); corrigir(); premir(maquina.querySelector('[data-a=corrige]'));
    } else if (e.key.toLowerCase() === 'b') {
      e.preventDefault(); votarBranco(); premir(maquina.querySelector('[data-a=branco]'));
    }
  });

  /* ----------------------------------------------------------- confete */
  function confete() {
    const cores = ['#00a650', '#ffc629', '#00a650', '#fbfaf6'];
    const r = maquina.getBoundingClientRect();
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.className = 'confete';
      p.style.background = cores[i % cores.length];
      p.style.left = (r.left + Math.random() * r.width) + 'px';
      p.style.top = (r.top + r.height * .35) + 'px';
      document.body.appendChild(p);
      g.to(p, {
        y: innerHeight * (.5 + Math.random() * .6),
        x: (Math.random() - .5) * 340,
        rotation: Math.random() * 900 - 450,
        opacity: 0,
        duration: 1.7 + Math.random() * 1.3,
        ease: 'power1.out',
        onComplete: () => p.remove(),
      });
    }
  }

  /* -------------------------------------------------------- entrada */
  pintarTela();

  if (VT.animando && g) {
    g.from(maquina, {
      opacity: 0, y: 60, rotateX: 12, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.urna__cena', start: 'top 84%', once: true },
    });
    g.from('.urna__ajuda', {
      opacity: 0, y: 40, duration: .9, ease: 'power3.out',
      scrollTrigger: { trigger: '.urna__cena', start: 'top 84%', once: true },
    });
  }
});
