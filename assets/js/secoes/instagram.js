/* ============================================================================
   instagram.js — a vitrine do Instagram da Vilma.

   · O cartão de perfil (foto dela no anel nas cores do MDB) existe sempre.
   · A grade de posts só aparece se a equipe escolheu posts no painel
     (Site → Instagram). Cada link vira o embed OFICIAL do Instagram: a imagem
     continua hospedada lá, a visualização conta para ela, nada é copiado.
   · Carrega tarde (quando a seção chega perto da tela): embed.js é pesado.
   · Se o Instagram bloquear o embed, cada post vira um cartão "Ver no
     Instagram" — nunca um buraco branco.
   ========================================================================== */
VT.secao('instagram', () => {
  const g = VT.g;
  const secao = document.getElementById('instagram');
  const grade = document.getElementById('insta-grade');
  if (!secao) return;

  VT.pintarAvatares();

  if (VT.animando && g) {
    g.fromTo('.perfil__anel', { rotate: -90, scale: .7 }, {
      rotate: 0, scale: 1, duration: 1.1, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '.insta__topo', start: 'top 80%', once: true },
    });
    // o @ gigante desliza de lado conforme a seção passa
    g.fromTo('.insta__marca', { xPercent: 8 }, {
      xPercent: -8, ease: 'none',
      scrollTrigger: { trigger: secao, start: 'top bottom', end: 'bottom top', scrub: .8 },
    });
  }

  if (!grade) return;

  const cartaoReserva = url =>
    '<a class="insta__reserva" href="' + VT.escapar(url) + '" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/>' +
        '<circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>' +
      '<b>Ver este post no Instagram</b><span>abre em outra aba ↗</span>' +
    '</a>';

  const montar = async () => {
    try { await window.VT_CONTEUDO?.pronto; } catch {}
    const posts = (window.VT_DADOS?.instagram?.posts || []).filter(Boolean).slice(0, 4);
    if (!posts.length) return;           // sem post escolhido: só o cartão de perfil

    grade.hidden = false;
    grade.dataset.n = String(posts.length);
    grade.innerHTML = posts.map(url =>
      '<div class="insta__post">' +
        '<blockquote class="instagram-media" data-instgrm-permalink="' + VT.escapar(url) + '" ' +
          'data-instgrm-version="14" style="background:#fff;border:0;margin:0;padding:0;width:100%;min-width:0">' +
          cartaoReserva(url) +
        '</blockquote>' +
      '</div>').join('');

    const processar = () => {
      if (window.instgrm?.Embeds) { window.instgrm.Embeds.process(); return true; }
      return false;
    };
    if (!processar()) {
      const s = document.createElement('script');
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      s.onload = () => { processar(); setTimeout(VT.refresh, 900); };
      s.onerror = () => console.warn('[instagram] embed.js bloqueado — ficam os cartões de link');
      document.body.appendChild(s);
    } else setTimeout(VT.refresh, 900);

    // o embed muda a altura da página quando termina: recalcula os gatilhos
    setTimeout(VT.refresh, 4000);
  };

  VT.quandoVisivel(secao, montar, '400px');
});
