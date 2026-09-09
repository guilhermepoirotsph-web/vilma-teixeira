/* ============================================================================
   nucleo.js — motor de animação e utilidades do site (window.VT)
   GSAP 3.15 + ScrollTrigger + SplitText + Lenis (todos locais em vendor/).
   Regra da casa: efeito de scroll fica LIGADO mesmo com "reduzir movimento".
   Só ?anim=0 desliga tudo (html.sem-anim).
   ========================================================================== */
(() => {
  'use strict';

  const raiz = document.documentElement;
  const params = new URLSearchParams(location.search);
  const animando = params.get('anim') !== '0';
  raiz.classList.add(animando ? 'anim' : 'sem-anim');

  const g = window.gsap;
  const ST = window.ScrollTrigger;
  if (g && ST) {
    g.registerPlugin(ST, window.SplitText || {});
    // sem isto a barra de endereço do celular recalcula todo pin a cada rolagem
    ST.config({ ignoreMobileResize: true });
  }

  /* ------------------------------------------------------- rolagem suave */
  let lenis = null;
  if (animando && window.Lenis && innerWidth > 860) {
    lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: .95 });
    if (g) {
      lenis.on('scroll', ST.update);
      g.ticker.add(t => lenis.raf(t * 1000));
      g.ticker.lagSmoothing(0);
    }
  }

  const VT = window.VT = {
    animando,
    g, ST,
    lenis,

    /**
     * Altura ocupada pela nav fixa, em px. Nunca use número fixo: quando a
     * equipe liga a faixa de aviso, html.com-aviso troca --nav-h de 74 para 112.
     */
    topoNav(extra = 8) {
      return (parseInt(getComputedStyle(raiz).getPropertyValue('--nav-h')) || 74) + extra;
    },

    /** Rola até um alvo respeitando a nav fixa. */
    irPara(alvo) {
      const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
      if (!el) return;
      const y = el.getBoundingClientRect().top + scrollY - VT.topoNav();
      if (lenis) lenis.scrollTo(y, { duration: 1.15 });
      else scrollTo({ top: y, behavior: animando ? 'smooth' : 'auto' });
    },

    /** Registra o setup de uma seção. Roda sozinho quando o DOM está pronto. */
    secao(nome, fn) {
      const rodar = () => {
        try { fn(); }
        catch (e) { console.error('[seção ' + nome + ']', e); }
      };
      if (document.readyState === 'loading') addEventListener('DOMContentLoaded', rodar, { once: true });
      else rodar();
    },

    /** Divide texto em linhas/palavras. Devolve os elementos para animar. */
    partir(el, tipo = 'words') {
      if (!el) return [];
      if (window.SplitText && animando) {
        const s = new window.SplitText(el, { type: tipo, linesClass: 'linha-part' });
        return s[tipo === 'chars' ? 'chars' : tipo === 'lines' ? 'lines' : 'words'];
      }
      return [el];
    },

    /** Revelação padrão ao entrar na tela. */
    revelar(sel, opc = {}) {
      if (!animando || !g) return;
      const alvos = typeof sel === 'string' ? g.utils.toArray(sel) : [sel].flat();
      alvos.forEach(el => {
        g.to(el, {
          opacity: 1, y: 0, duration: .95, ease: 'power3.out',
          ...opc,
          scrollTrigger: { trigger: opc.gatilho || el, start: opc.start || 'top 86%', once: true },
        });
      });
    },

    /** Revelação em cascata dentro de um container. */
    cascata(container, sel = '.revelar', passo = .085) {
      if (!animando || !g) return;
      const pai = typeof container === 'string' ? document.querySelector(container) : container;
      if (!pai) return;
      const itens = pai.querySelectorAll(sel);
      if (!itens.length) return;
      g.to(itens, {
        opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: passo,
        scrollTrigger: { trigger: pai, start: 'top 82%', once: true },
      });
    },

    /** Conta um número de 0 até o valor, quando entra na tela. */
    contar(el, valor, opc = {}) {
      if (!el) return;
      const fmt = opc.formatar || (n => Math.round(n).toLocaleString('pt-BR'));
      if (!animando || !g) { el.textContent = fmt(valor); return; }
      const alvo = { v: 0 };
      g.to(alvo, {
        v: valor, duration: opc.duracao || 1.9, ease: 'power2.out',
        onUpdate: () => { el.textContent = fmt(alvo.v); },
        scrollTrigger: { trigger: opc.gatilho || el, start: 'top 88%', once: true },
      });
    },

    /**
     * Efeito magnético no cursor (desktop).
     * `overwrite:false` é OBRIGATÓRIO: sem isso o quickTo MATA as outras
     * animações do mesmo elemento ao ser criado — e o botão que estava
     * entrando com opacity 0 congela invisível para sempre. Foi medido.
     */
    magnetico(sel, forca = .32) {
      if (!animando || !g || matchMedia('(hover:none)').matches) return;
      g.utils.toArray(sel).forEach(el => {
        const x = g.quickTo(el, 'x', { duration: .5, ease: 'power3', overwrite: false });
        const y = g.quickTo(el, 'y', { duration: .5, ease: 'power3', overwrite: false });
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          x((e.clientX - r.left - r.width / 2) * forca);
          y((e.clientY - r.top - r.height / 2) * forca);
        });
        el.addEventListener('pointerleave', () => { x(0); y(0); });
        el.addEventListener('pointerdown', () => g.to(el, { scale: .96, duration: .16, overwrite: false }));
        el.addEventListener('pointerup', () => g.to(el, { scale: 1, duration: .3, overwrite: false }));
      });
    },

    /** Inclinação 3D no hover. */
    tilt(sel, max = 7) {
      if (!animando || !g || matchMedia('(hover:none)').matches) return;
      g.utils.toArray(sel).forEach(el => {
        el.style.transformStyle = 'preserve-3d';
        // overwrite:false pelo mesmo motivo do magnetico() acima
        const rx = g.quickTo(el, 'rotationX', { duration: .6, ease: 'power3', overwrite: false });
        const ry = g.quickTo(el, 'rotationY', { duration: .6, ease: 'power3', overwrite: false });
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          rx((.5 - (e.clientY - r.top) / r.height) * max * 2);
          ry(((e.clientX - r.left) / r.width - .5) * max * 2);
        });
        el.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    },

    /**
     * Escada de imagem de uma pessoa, do melhor para o pior, sem nunca deixar
     * buraco na tela:
     *   1. recorte PNG sem fundo  (.foto-recorte)  — o ideal
     *   2. retrato emoldurado     (.retrato)       — funciona com foto comum
     *   3. layout de pôster       (aoFaltarTudo)   — sem foto nenhuma
     */
    escadaDeFoto(figura, aoFaltarTudo) {
      if (!figura) return;
      const recorte = figura.querySelector('.foto-recorte');
      const retrato = figura.querySelector('.retrato');
      const retratoImg = retrato && retrato.querySelector('img');

      // Sonda com Image() em vez de esperar load/error do elemento da página:
      // imagem com loading="lazy" dentro de um elemento hidden NUNCA é buscada,
      // então nem load nem error disparam e a escada ficava travada no primeiro
      // degrau. A sonda força a requisição e responde sempre.
      const existe = src => new Promise(responder => {
        if (!src) return responder(false);
        const sonda = new Image();
        sonda.onload = () => responder(sonda.naturalWidth > 0);
        sonda.onerror = () => responder(false);
        sonda.src = src;
      });

      (async () => {
        if (recorte && await existe(recorte.getAttribute('src'))) {
          recorte.hidden = false;
          if (retrato) retrato.hidden = true;
          return VT.refresh();
        }
        if (recorte) recorte.hidden = true;

        if (retratoImg && await existe(retratoImg.getAttribute('src'))) {
          retratoImg.loading = 'eager';
          retrato.hidden = false;
          return VT.refresh();
        }
        if (retrato) retrato.hidden = true;

        if (aoFaltarTudo) aoFaltarTudo();
        VT.refresh();
      })();
    },

    /** Roda fn quando o elemento aparece (para carregar coisa pesada tarde). */
    quandoVisivel(el, fn, margem = '250px') {
      if (!el) return;
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
      }, { rootMargin: margem });
      io.observe(el);
    },

    /**
     * Link de WhatsApp com mensagem pronta.
     * Devolve STRING VAZIA quando não há número de campanha — quem chama tem a
     * obrigação de esconder o botão. Nunca cair no número do gabinete.
     */
    wa(msg) {
      const n = (window.VT_DADOS?.campanha?.whatsapp || '').replace(/\D/g, '');
      if (!n) return '';
      return 'https://wa.me/' + n + (msg ? '?text=' + encodeURIComponent(msg) : '');
    },

    /** Formata data ISO em pt-BR. */
    data(iso, comHora = true) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const opc = { day: '2-digit', month: 'long', year: 'numeric' };
      if (comHora) { opc.hour = '2-digit'; opc.minute = '2-digit'; }
      return d.toLocaleDateString('pt-BR', opc).replace(',', ' ·');
    },

    escapar(s) {
      return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    refresh() { if (ST) ST.refresh(); },
  };

  /* ------------------------------------------------------------ PRELOADER */
  const pl = document.getElementById('carregando');
  if (pl) {
    const barra = pl.querySelector('.pl-barra i');
    const pct = pl.querySelector('.pl-pct');
    let n = 0;
    const alvoFinal = { v: 0 };
    const pintar = () => {
      const v = Math.min(100, Math.round(alvoFinal.v));
      if (pct) pct.textContent = v + '%';
      if (barra) barra.style.transform = 'scaleX(' + (v / 100) + ')';
    };
    const fechar = () => {
      if (VT.jaPronto) return;
      VT.jaPronto = true;                 // quem registrar depois não perde o sinal
      pl.classList.add('fim');
      document.body.classList.remove('travado');
      setTimeout(() => { pl.remove(); VT.refresh(); }, 700);
      document.dispatchEvent(new CustomEvent('vt:pronto'));
    };
    if (animando && g) {
      document.body.classList.add('travado');
      g.to(alvoFinal, { v: 100, duration: 1.35, ease: 'power2.inOut', onUpdate: pintar, onComplete: fechar });
    } else { alvoFinal.v = 100; pintar(); fechar(); }
    // rede de segurança: nunca deixar o preloader preso
    setTimeout(() => { if (document.body.contains(pl)) fechar(); }, 6000);
  } else {
    addEventListener('load', () => {
      VT.jaPronto = true;
      document.dispatchEvent(new CustomEvent('vt:pronto'));
    }, { once: true });
  }

  /** Roda fn quando a abertura terminar — ou já, se terminou antes de registrar. */
  VT.aoPronto = fn => {
    if (VT.jaPronto) fn();
    else document.addEventListener('vt:pronto', fn, { once: true });
  };

  /* ------------------------------------------------------------------ NAV */
  VT.secao('nav', () => {
    const nav = document.querySelector('.nav');
    const burger = document.querySelector('.burger');
    const menu = document.querySelector('.menu');
    if (!nav) return;

    const solidez = () => nav.classList.toggle('solida', scrollY > 40);
    solidez();
    addEventListener('scroll', solidez, { passive: true });

    // menu mobile com laço de foco
    if (burger && menu) {
      const itens = menu.querySelectorAll('a,button');
      itens.forEach((a, i) => a.style.setProperty('--i', (i * .045 + .1) + 's'));
      const abrir = v => {
        burger.setAttribute('aria-expanded', String(v));
        menu.classList.toggle('aberto', v);
        document.body.classList.toggle('travado', v);
        if (v) itens[0]?.focus();
      };
      burger.addEventListener('click', () => abrir(burger.getAttribute('aria-expanded') !== 'true'));
      menu.addEventListener('click', e => { if (e.target.closest('a')) abrir(false); });
      addEventListener('keydown', e => {
        if (e.key === 'Escape' && menu.classList.contains('aberto')) { abrir(false); burger.focus(); }
        if (e.key === 'Tab' && menu.classList.contains('aberto')) {
          const f = [burger, ...itens];
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
    }

    // âncoras internas
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const alvo = a.getAttribute('href');
      if (alvo.length < 2) return;
      const el = document.querySelector(alvo);
      if (!el) return;
      e.preventDefault();
      VT.irPara(el);
      history.replaceState(null, '', alvo);
    });

    // link ativo conforme a seção
    if (g && ST) {
      document.querySelectorAll('.nav__links a[href^="#"]').forEach(a => {
        const alvo = document.querySelector(a.getAttribute('href'));
        if (!alvo) return;
        ST.create({
          trigger: alvo, start: 'top 45%', end: 'bottom 45%',
          onToggle: s => a.classList.toggle('ativo', s.isActive),
        });
      });
    }
  });

  /* ------------------------------------------- revelação genérica global */
  VT.aoPronto(() => {
    if (!animando || !g) return;
    g.utils.toArray('.revelar').forEach(el => {
      if (el.dataset.manual === '1') return;
      g.to(el, {
        opacity: 1, y: 0, duration: .95, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    // só o botão flutuante aqui; os do herói entram quando a abertura termina
    // (interação só depois que o elemento acabou de aparecer)
    VT.magnetico('.wafloat');
    setTimeout(() => VT.refresh(), 300);
  });

  /* ------------------------------------------------- rede de segurança
     Conteúdo invisível é o pior defeito possível: a página parece vazia e
     ninguém percebe. Se algum .revelar entrar bem dentro da tela e continuar
     transparente (gatilho que não montou, tween que animou de 0 para 0),
     ele é mostrado na marra. Medir opacity é o único jeito de pegar isso —
     o DOM e o innerText não denunciam. */
  if (animando) {
    const vigiar = () => {
      document.querySelectorAll('.revelar').forEach(el => {
        const r = el.getBoundingClientRect();
        const dentro = r.top < innerHeight * .85 && r.bottom > innerHeight * .15;
        if (!dentro) return;
        if (Number(getComputedStyle(el).opacity) >= .1) return;
        if (g) g.set(el, { opacity: 1, y: 0, x: 0, scale: 1, rotationX: 0, clearProps: 'transform' });
        else { el.style.opacity = '1'; el.style.transform = 'none'; }
      });
    };
    let esperando = null;
    addEventListener('scroll', () => {
      clearTimeout(esperando);
      esperando = setTimeout(vigiar, 700);   // só quando a rolagem para
    }, { passive: true });
    setTimeout(vigiar, 4000);
  }

  // recalcula em mudança de tamanho
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => VT.refresh(), 220); });
})();
