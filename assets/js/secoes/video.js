/* ============================================================================
   video.js — o recado da Vilma, para OUVIR e LER ao mesmo tempo.

   O limite é do navegador, não do site: vídeo só toca sozinho se estiver MUDO.
   Som exige um gesto da pessoa — não existe jeito de contornar, e tentar
   contornar faz o navegador bloquear o vídeo inteiro. Então:

     · o vídeo entra rodando MUDO, em laço, como um pôster vivo;
     · um botão grande "Ouvir o recado" liga o som no primeiro toque e volta
       o vídeo para o começo;
     · a legenda aparece na tela em qualquer caso — quem não puder ouvir, lê tudo.

   Escada de fontes:
     1. midia/recado-vilma.mp4  -> player próprio, com som e legenda sincronizada
     2. embed oficial do Instagram -> quando não há arquivo próprio
     3. convite para abrir no Instagram -> se o embed for bloqueado
   ========================================================================== */
VT.secao('video', () => {
  const g = VT.g;
  const secao = document.getElementById('video');
  const slot = document.getElementById('video-slot');
  const moldura = document.getElementById('video-moldura');
  if (!secao || !slot) return;

  const $ = id => document.getElementById(id);
  const player = $('video-player');
  const espera = $('video-espera');
  const btnOuvir = $('video-ouvir');
  const barra = $('video-barra');
  const ctrl = $('video-ctrl');
  const btnToggle = $('video-toggle');
  const btnSom = $('video-som');
  const btnRepetir = $('video-repetir');
  const caixaLegendas = $('video-legendas');
  const legendaAtual = $('video-legenda-atual');
  const subOuvir = $('video-ouvir-sub');

  let URL_POST = window.VT_DADOS?.video?.url || 'https://www.instagram.com/p/Dcuqygpua5b/';
  const prontoConteudo = (window.VT_CONTEUDO?.pronto || Promise.resolve()).then(() => {
    URL_POST = window.VT_DADOS?.video?.url || URL_POST;
  }).catch(() => {});

  /* --------------------------------------------------------- animações */
  if (VT.animando && g) {
    const palavras = VT.partir($('video-legenda'), 'words');
    if (palavras.length > 1) {
      palavras.forEach(p => p.classList.add('pal'));
      g.from(palavras, {
        opacity: 0, y: 24, stagger: .022, duration: .6, ease: 'power2.out',
        scrollTrigger: { trigger: '.video__fala', start: 'top 80%', once: true },
      });
    }
    if (moldura) {
      g.from(moldura, {
        opacity: 0, y: 60, scale: .92, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: moldura, start: 'top 88%', once: true },
      });
      g.to(moldura, {
        y: -46, ease: 'none',
        scrollTrigger: { trigger: secao, start: 'top bottom', end: 'bottom top', scrub: .8 },
      });
    }
    g.utils.toArray('.video__tags li').forEach((li, i) => {
      g.from(li, {
        opacity: 0, y: 14, duration: .5, delay: i * .05, ease: 'power2.out',
        scrollTrigger: { trigger: '.video__tags', start: 'top 90%', once: true },
      });
    });
    g.from('.compro__pilar', {
      opacity: 0, y: 26, stagger: .1, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: '.compro__pilares', start: 'top 86%', once: true },
    });
  }

  /* --------------------------------------------------- 3º degrau: convite */
  const convite = motivo => {
    if (player) player.hidden = true;
    if (btnOuvir) btnOuvir.hidden = true;
    if (ctrl) ctrl.hidden = true;
    if (barra) barra.hidden = true;
    slot.innerHTML =
      '<div class="video__espera">' +
        '<div class="video__play" aria-hidden="true"><i></i></div>' +
        '<p class="lead" style="font-size:1rem;max-width:26ch">O recado está no Instagram da Vilma.</p>' +
        '<a class="btn" href="' + URL_POST + '" target="_blank" rel="noopener">Assistir no Instagram</a>' +
      '</div>';
    if (motivo) console.warn('[video]', motivo);
  };

  /* ------------------------------------------- 2º degrau: embed Instagram */
  const usarEmbed = () => {
    const bq = document.createElement('blockquote');
    bq.className = 'instagram-media';
    bq.setAttribute('data-instgrm-permalink', URL_POST);
    bq.setAttribute('data-instgrm-version', '14');
    bq.style.cssText = 'background:#0b1526;border:0;margin:0;padding:0;width:100%;min-width:0';
    slot.innerHTML = '';
    slot.appendChild(bq);

    const processar = () => {
      if (window.instgrm?.Embeds) { window.instgrm.Embeds.process(); return true; }
      return false;
    };
    if (!processar()) {
      const s = document.createElement('script');
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      s.onload = () => { processar(); setTimeout(VT.refresh, 900); };
      s.onerror = () => convite('embed.js bloqueado');
      document.body.appendChild(s);
    } else setTimeout(VT.refresh, 900);

    setTimeout(() => {
      const iframe = slot.querySelector('iframe');
      if (!iframe || iframe.clientHeight < 120) convite('embed não renderizou a tempo');
      else VT.refresh();
    }, 7000);
  };

  /* --------------------------------- 1º degrau: player próprio, com som */
  function usarPlayer(fonte, cartaz) {
    if (espera) espera.remove();
    player.hidden = false;
    player.src = fonte;
    if (cartaz) player.poster = cartaz;
    player.muted = true;         // mudo para poder rodar sozinho
    player.loop = true;
    player.playsInline = true;
    player.preload = 'metadata';
    player.play().catch(() => {/* nem mudo pôde: o botão resolve */});

    if (btnOuvir) btnOuvir.hidden = false;
    if (barra) barra.hidden = false;

    const trechos = (window.VT_DADOS?.video?.transcricao || [])
      .filter(t => t && typeof t.t === 'number' && t.txt)
      .sort((a, b) => a.t - b.t);

    // não prometer legenda que não existe: o rótulo só promete o que vai entregar
    if (subOuvir) subOuvir.textContent = trechos.length ? 'com som e legenda' : 'com som';

    /* ---- ligar o som (precisa de um gesto — é regra do navegador) ---- */
    const ligarSom = () => {
      player.muted = false;
      player.loop = false;
      player.currentTime = 0;
      player.volume = 1;
      const p = player.play();
      if (p && p.catch) p.catch(() => convite('o navegador recusou tocar o vídeo'));
      btnOuvir.hidden = true;
      if (ctrl) ctrl.hidden = false;
      if (trechos.length && caixaLegendas) caixaLegendas.hidden = false;
      moldura?.classList.add('video__moldura--tocando');
    };
    btnOuvir?.addEventListener('click', ligarSom);

    /* ------------------------------- controles ------------------------------- */
    btnToggle?.addEventListener('click', () => {
      if (player.paused) { player.play(); btnToggle.textContent = '❚❚'; btnToggle.setAttribute('aria-label', 'Pausar'); }
      else { player.pause(); btnToggle.textContent = '▶'; btnToggle.setAttribute('aria-label', 'Tocar'); }
    });
    btnSom?.addEventListener('click', () => {
      player.muted = !player.muted;
      btnSom.setAttribute('aria-pressed', String(!player.muted));
      btnSom.setAttribute('aria-label', player.muted ? 'Ligar som' : 'Desligar som');
      btnSom.classList.toggle('video__btn--off', player.muted);
    });
    btnRepetir?.addEventListener('click', () => {
      player.currentTime = 0; player.muted = false; player.play();
    });

    /* --------------------- barra de progresso + legenda ---------------------- */
    const pintaBarra = barra?.querySelector('i');
    let iAtual = -1;
    player.addEventListener('timeupdate', () => {
      if (pintaBarra && player.duration) {
        pintaBarra.style.transform = 'scaleX(' + (player.currentTime / player.duration) + ')';
      }
      if (!trechos.length || !legendaAtual) return;
      let i = -1;
      for (let k = 0; k < trechos.length; k++) if (player.currentTime >= trechos[k].t) i = k;
      if (i !== iAtual) {
        iAtual = i;
        legendaAtual.textContent = i >= 0 ? trechos[i].txt : '';
        if (VT.animando && g && i >= 0) {
          g.fromTo(legendaAtual, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .3 });
        }
      }
    });
    player.addEventListener('ended', () => {
      moldura?.classList.remove('video__moldura--tocando');
      if (btnToggle) { btnToggle.textContent = '▶'; btnToggle.setAttribute('aria-label', 'Tocar'); }
    });
    player.addEventListener('error', () => convite('o arquivo de vídeo não abriu'));

    // fora da tela, pausa: ninguém quer áudio tocando escondido
    new IntersectionObserver(es => {
      if (!es[0].isIntersecting && !player.paused && !player.muted) player.pause();
    }, { threshold: .25 }).observe(secao);

    VT.refresh();
  }

  /* --------------------------------------------- escolhe o degrau e liga */
  const ligar = async () => {
    await prontoConteudo;
    const d = window.VT_DADOS?.video || {};
    if (!player || !d.arquivo) return usarEmbed();

    // o arquivo existe? (HEAD evita baixar o vídeo inteiro só para descobrir)
    let temArquivo = false;
    try {
      const r = await fetch(d.arquivo, { method: 'HEAD' });
      temArquivo = r.ok && !/text\/html/.test(r.headers.get('content-type') || '');
    } catch { temArquivo = false; }

    if (!temArquivo) return usarEmbed();

    let temCartaz = false;
    if (d.cartaz) { try { temCartaz = (await fetch(d.cartaz, { method: 'HEAD' })).ok; } catch {} }
    usarPlayer(d.arquivo, temCartaz ? d.cartaz : null);
  };

  VT.quandoVisivel(secao, ligar, '320px');
});
