/* ============================================================================
   heroi.js — abertura do site
   · entrada do nome (SplitText) e das placas de número
   · paralaxe do herói no scroll
   · palco 3D (Three.js) com o "mar de luzes" do comício — carregado só no idle,
     desligável por ?3d=0, e com queda limpa para o gradiente CSS.
   ========================================================================== */
VT.secao('heroi', () => {
  const g = VT.g;
  const heroi = document.querySelector('.heroi');
  if (!heroi) return;

  /* --------------------------------------------------- foto ou lacuna */
  // Sem a foto, o herói vira uma composição de pôster em coluna única, em vez
  // de deixar meia tela vazia. Fica intencional, não quebrado.
  const foto = heroi.querySelector('.heroi__foto');
  if (foto) {
    const semFoto = () => {
      foto.hidden = true;
      heroi.classList.add('heroi--sem-foto');
      VT.refresh();
    };
    foto.addEventListener('error', semFoto, { once: true });
    if (foto.complete && foto.naturalWidth === 0) semFoto();
  }

  /* ------------------------------------------------------- animações */
  if (VT.animando && g) {
    // NASCE PAUSADA e toca UMA vez, quando o preloader sai. Antes ela tocava na
    // criação e era reiniciada depois — a abertura levava ~6s e quem chegava via
    // um herói vazio, com os botões em opacity 0. Medido, não suposto.
    // fromTo, NUNCA from: numa timeline pausada o from() grava como valor final
    // o próprio estado inicial que ele acaba de aplicar, e o elemento fica
    // preso em opacity 0 para sempre. Medido: os dois botões do herói sumiam.
    const tl = g.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const surgir = (alvo, de, para, posicao) =>
      tl.fromTo(alvo, { opacity: 0, ...de }, { opacity: 1, ...para }, posicao);

    surgir('.heroi__olho', { y: 18 }, { y: 0, duration: .55 });
    surgir('.heroi__assina', { y: 54, scale: .94 }, { y: 0, scale: 1, duration: .95 }, '-=.3');
    surgir('.heroi__sobrenome', { y: 24, letterSpacing: '.5em' },
                                { y: 0, letterSpacing: '.16em', duration: .8 }, '-=.65');

    const linhas = VT.partir(heroi.querySelector('.heroi__lead'), 'lines');
    surgir(linhas.length > 1 ? linhas : '.heroi__lead',
           { y: 18 }, { y: 0, stagger: .07, duration: .6 }, '-=.5');

    surgir('.heroi__acoes .btn', { y: 20 }, { y: 0, stagger: .09, duration: .55 }, '-=.35');
    surgir('.heroi__marca-mesa', {}, { duration: .5 }, '-=.35');
    surgir('.heroi__figura', { x: 44 }, { x: 0, duration: 1 }, '-=.95');
    surgir('.placa', { y: 40, rotateX: -28 },
                     { y: 0, rotateX: 0, stagger: .11, duration: .7 }, '-=.6');
    surgir('.heroi__rolar', {}, { duration: .5 }, '-=.25');

    // interação só DEPOIS que a entrada terminou — nada de mexer em elemento
    // que ainda está aparecendo
    tl.eventCallback('onComplete', () => {
      VT.magnetico('.heroi__acoes .btn');
      VT.magnetico('.placa', .18);
      VT.tilt('.placa', 9);
    });

    (VT.debug ||= {}).heroi = tl;   // para ferramentas/medir e sondas
    VT.aoPronto(() => tl.play());

    // Rede de segurança: se por qualquer motivo a abertura não sinalizar,
    // o herói não pode ficar invisível. Depois de 5s ele aparece de qualquer jeito.
    setTimeout(() => { if (tl.progress() === 0) tl.progress(1); }, 5000);

    // paralaxe ao rolar
    g.to('.heroi__figura', {
      y: -70, ease: 'none',
      scrollTrigger: { trigger: heroi, start: 'top top', end: 'bottom top', scrub: .6 },
    });
    g.to('.heroi__texto', {
      y: 60, opacity: .25, ease: 'none',
      scrollTrigger: { trigger: heroi, start: 'top top', end: 'bottom 40%', scrub: .6 },
    });
    g.to('.heroi__placas', {
      y: 90, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: heroi, start: '55% top', end: 'bottom top', scrub: .6 },
    });
  }

  /* ============================================ PALCO 3D — mar de luzes */
  const tela = document.getElementById('palco3d');
  const params = new URLSearchParams(location.search);
  const quer3d = params.get('3d') !== '0' && VT.animando;
  const podeWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { return false; }
  })();

  if (!tela || !quer3d || !podeWebGL) return;

  const ligar = async () => {
    let THREE;
    try { THREE = await import('../../../vendor/three.module.min.js'); }
    catch (e) { console.warn('[palco3d] three não carregou —', e.message); return; }

    const movel = innerWidth < 860;
    const N = movel ? 2600 : 6200;

    const cena = new THREE.Scene();
    cena.fog = new THREE.FogExp2(0x04122b, 0.085);

    const cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 90);
    cam.position.set(0, 2.6, 13);

    const rend = new THREE.WebGLRenderer({ canvas: tela, alpha: true, antialias: !movel, powerPreference: 'high-performance' });
    rend.setPixelRatio(Math.min(devicePixelRatio, movel ? 1.25 : 1.6));
    rend.setSize(innerWidth, innerHeight, false);

    /* ------- pontos: uma multidão de luzes que respira em ondas ------- */
    const pos = new Float32Array(N * 3);
    const cor = new Float32Array(N * 3);
    const semente = new Float32Array(N);
    const tam = new Float32Array(N);

    const paleta = [
      new THREE.Color(0xe4185f), // magenta
      new THREE.Color(0xe9b949), // ouro
      new THREE.Color(0x3d78d1), // royal
      new THREE.Color(0xf7f4ee), // marfim
    ];
    const pesos = [.4, .26, .24, .10];

    const sortear = () => {
      let r = Math.random(), a = 0;
      for (let i = 0; i < pesos.length; i++) { a += pesos[i]; if (r <= a) return paleta[i]; }
      return paleta[0];
    };

    // ARCO, não anel: a plateia fica toda À FRENTE da câmera. No anel, metade
    // das luzes nascia atrás dela e só entrava na conta do custo.
    for (let i = 0; i < N; i++) {
      const raio = 1.5 + Math.pow(Math.random(), .62) * 27;
      const ang = -Math.PI * .12 + Math.random() * Math.PI * 1.24;
      pos[i * 3]     = Math.cos(ang) * raio;
      pos[i * 3 + 1] = -2.2 + Math.random() * 1.6;
      pos[i * 3 + 2] = -2.5 - Math.abs(Math.sin(ang)) * raio * .55;

      const c = sortear();
      cor[i * 3] = c.r; cor[i * 3 + 1] = c.g; cor[i * 3 + 2] = c.b;
      semente[i] = Math.random() * Math.PI * 2;
      tam[i] = 5 + Math.random() * 16;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('cor', new THREE.BufferAttribute(cor, 3));
    geo.setAttribute('semente', new THREE.BufferAttribute(semente, 1));
    geo.setAttribute('tam', new THREE.BufferAttribute(tam, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        t: { value: 0 },
        dpr: { value: rend.getPixelRatio() },
        mouse: { value: new THREE.Vector2() },
      },
      // Profundidade de verdade: parallax e névoa saem da MESMA distância de
      // câmera, aplicados DEPOIS do modelView — assim a rotação lenta do grupo
      // não entorta o eixo do mouse. (cena.fog não alcança ShaderMaterial.)
      vertexShader: `
        attribute vec3 cor; attribute float semente; attribute float tam;
        uniform float t; uniform float dpr; uniform vec2 mouse;
        varying vec3 vCor; varying float vBrilho; varying float vNeblina;
        void main(){
          vCor = cor;
          vec3 p = position;
          float onda = sin(t*0.85 + semente + p.x*0.16) * 0.55
                     + sin(t*0.42 + p.z*0.2) * 0.35;
          p.y += onda;
          p.x += sin(t*0.22 + semente)*0.16;
          vBrilho = 0.55 + 0.45*sin(t*1.9 + semente*3.1);

          vec4 mv = modelViewMatrix * vec4(p,1.0);
          float dist = max(0.001, -mv.z);
          float peso = clamp(1.0 - (dist - 16.0)/20.0, 0.10, 1.0);
          mv.x +=  mouse.x * peso * 2.6;
          mv.y += -mouse.y * peso * 1.0;

          vNeblina = 1.0 - exp(-pow(dist * 0.030, 2.0));
          gl_PointSize = tam * dpr * (14.0/dist) * (0.62 + 0.38*(1.0 - vNeblina));
          gl_Position = projectionMatrix * mv;
        }`,
      // sem mix(): com AdditiveBlending, misturar com o marinho SOMA azul em
      // vez de lavar. O que apaga o ponto distante é o alfa.
      fragmentShader: `
        varying vec3 vCor; varying float vBrilho; varying float vNeblina;
        void main(){
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if(r > 0.5) discard;
          float halo = pow(1.0 - r*2.0, 2.4);
          gl_FragColor = vec4(vCor, halo * vBrilho * 1.05 * (1.0 - vNeblina*0.7));
        }`,
    });

    const pontos = new THREE.Points(geo, mat);
    cena.add(pontos);

    /* ---------------- feixes de luz do palco (aditivos) ---------------- */
    const feixes = new THREE.Group();
    const corFeixe = [0xe4185f, 0xe9b949, 0x3d78d1];
    for (let i = 0; i < 3; i++) {
      const gfx = new THREE.ConeGeometry(2.6, 26, 20, 1, true);
      const m = new THREE.MeshBasicMaterial({
        color: corFeixe[i], transparent: true, opacity: .052,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const f = new THREE.Mesh(gfx, m);
      f.position.set((i - 1) * 8.5, 12, -9);
      f.rotation.z = (i - 1) * .3;
      feixes.add(f);
    }
    cena.add(feixes);

    /* ------------------------------------------------------- interação */
    let mx = 0, my = 0, ax = 0, ay = 0;
    const aoMover = e => {
      mx = (e.clientX / innerWidth - .5);
      my = (e.clientY / innerHeight - .5);
    };
    // dedo não tem hover: em celular isso só gastaria evento
    const temMouse = !matchMedia('(hover:none)').matches;
    if (temMouse) addEventListener('pointermove', aoMover, { passive: true });

    let progresso = 0;
    if (g && VT.ST) {
      VT.ST.create({
        trigger: heroi, start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: s => { progresso = s.progress; },
      });
    }

    /* ---------------------------------------------- qualidade adaptativa */
    let nivel = 2;                                   // 2 cheio · 1 leve · 0 mínimo
    const dprDoNivel = () => nivel === 2 ? (movel ? 1.25 : 1.6)
                           : nivel === 1 ? (movel ? 1 : 1.15) : 1;

    let pedidoResize = 0, larguraAnt = innerWidth;
    const redimensionar = () => {
      if (pedidoResize) return;
      pedidoResize = requestAnimationFrame(() => {
        pedidoResize = 0;
        // a barra de URL do iOS dispara resize a cada rolagem; a caixa é 100svh
        // e não muda de largura — só recalcula quando a largura muda de verdade
        if (movel && innerWidth === larguraAnt) return;
        larguraAnt = innerWidth;
        cam.aspect = innerWidth / innerHeight;
        cam.updateProjectionMatrix();
        rend.setPixelRatio(Math.min(devicePixelRatio, dprDoNivel()));
        rend.setSize(innerWidth, innerHeight, false);
        mat.uniforms.dpr.value = rend.getPixelRatio();
      });
    };
    addEventListener('resize', redimensionar, { passive: true });

    const rebaixar = () => {
      if (nivel === 0) return;
      nivel--;
      if (nivel === 0) {
        feixes.visible = false;
        geo.setDrawRange(0, Math.floor(N * .55));
      }
      larguraAnt = -1; redimensionar();
      console.info('[palco3d] aparelho apertado — nível', nivel);
    };

    /* ------------------------------------------------------------ laço */
    const relogio = new THREE.Clock();
    // 12,7ms (e não 16,7) para não perder quadro por bater no vsync de 60Hz
    const tetoMs = movel ? 1000 / 30 - 2 : 1000 / 60 - 4;
    const limiteMs = tetoMs * 1.6;
    let ultimo = 0, anterior = 0, naTela = false, abaViva = !document.hidden, idAF = 0;
    let aquece = 12, amostras = 0, soma = 0, primeiroQuadro = true;

    const desenhar = agora => {
      idAF = 0;
      if (!(naTela && abaViva)) return;               // guarda ANTES de reagendar
      if (agora - ultimo < tetoMs) { idAF = requestAnimationFrame(desenhar); return; }

      const dt = anterior ? agora - anterior : 0; anterior = agora;
      if (aquece) aquece--;
      else if (amostras < 45 && dt && dt < 200) {
        soma += dt;
        if (++amostras === 45 && soma / 45 > limiteMs) rebaixar();
      }
      ultimo = agora;

      const t = relogio.getElapsedTime();
      mat.uniforms.t.value = t;

      ax += (mx - ax) * .045;
      ay += (my - ay) * .045;
      mat.uniforms.mouse.value.set(ax, ay);           // o parallax agora é do shader
      cam.position.x = ax * 1.1;
      cam.position.y = 2.6 - ay * 1.5 + progresso * 3.2;
      cam.lookAt(0, .6 + progresso * 1.2, -4);

      pontos.rotation.y = t * .012;
      if (feixes.visible) feixes.children.forEach((f, i) => {
        f.rotation.z = (i - 1) * .3 + Math.sin(t * .28 + i) * .16;
        f.material.opacity = .052 + Math.sin(t * .8 + i * 2.1) * .022;
      });

      rend.render(cena, cam);
      // a classe entra no primeiro quadro DESENHADO: o fade de 1,4s deixa de
      // acontecer sobre um canvas ainda vazio
      if (primeiroQuadro) { primeiroQuadro = false; tela.classList.add('pronto'); }

      idAF = requestAnimationFrame(desenhar);
    };

    const tocar = () => {
      if (idAF || !(naTela && abaViva)) return;
      relogio.getDelta();                             // sem isto o Clock devolve
      anterior = 0;                                   // 30s de uma vez e a onda pula
      idAF = requestAnimationFrame(desenhar);
    };
    const parar = () => { if (idAF) cancelAnimationFrame(idAF); idAF = 0; };

    const io = new IntersectionObserver(es => {
      naTela = es[0].isIntersecting;
      naTela ? tocar() : parar();
    }, { threshold: 0 });
    io.observe(heroi);

    const aoTrocarAba = () => { abaViva = !document.hidden; abaViva ? tocar() : parar(); };
    document.addEventListener('visibilitychange', aoTrocarAba);

    /* ------------------------------------------------------ morte limpa */
    const matar = () => {
      parar();
      io.disconnect();
      document.removeEventListener('visibilitychange', aoTrocarAba);
      if (temMouse) removeEventListener('pointermove', aoMover);
      removeEventListener('resize', redimensionar);
      geo.dispose(); mat.dispose();
      feixes.children.forEach(f => { f.geometry.dispose(); f.material.dispose(); });
      rend.dispose(); rend.forceContextLoss();
    };
    // sem {once:true} e COM o guard: se a pessoa volta da página de privacidade
    // pelo bfcache, o palco tem que estar vivo
    addEventListener('pagehide', e => { if (!e.persisted) matar(); });

    (VT.debug ||= {}).palco = { matar, rebaixar, get nivel() { return nivel; } };
  };

  /* --------------------------------- só quando o aparelho comporta */
  const con = navigator.connection || {};
  const magro = con.saveData === true
             || /(^|-)2g/.test(con.effectiveType || '')
             || (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4);
  // aparelho apertado fica com o céu em CSS, que se sustenta sozinho —
  // melhor isso do que 733 KB de three.js no 4G da praia
  if (magro) { console.info('[palco3d] aparelho/rede magros — só o céu CSS'); return; }

  const disparar = () => ('requestIdleCallback' in window)
    ? requestIdleCallback(ligar, { timeout: 8000 })
    : setTimeout(ligar, 2500);
  addEventListener('load', () => VT.aoPronto(disparar), { once: true });
});
