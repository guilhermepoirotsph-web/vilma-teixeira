/* cezinha.js — palco do candidato a deputado federal (2223) + votação crescente */
VT.secao('cezinha', () => {
  const g = VT.g;
  const secao = document.getElementById('cezinha');
  if (!secao) return;

  // recorte PNG -> retrato emoldurado -> pôster em coluna única
  VT.escadaDeFoto(secao.querySelector('.candidato__figura'),
    () => secao.classList.add('candidato--sem-foto'));

  // contadores de voto (sempre rodam, com ou sem animação)
  secao.querySelectorAll('.voto__n[data-n]').forEach(el => {
    VT.contar(el, Number(el.dataset.n), { gatilho: '#votos-cezinha', duracao: 1.9 });
  });

  if (!VT.animando || !g) {
    secao.querySelectorAll('.voto__barra i').forEach(i => { i.style.transform = 'scaleX(1)'; });
    return;
  }

  g.to(secao.querySelectorAll('.voto__barra i'), {
    scaleX: 1, duration: 1.25, stagger: .16, ease: 'power3.out',
    scrollTrigger: { trigger: '#votos-cezinha', start: 'top 86%', once: true },
  });

  g.to(secao.querySelector('.candidato__numerao'), {
    x: 90, y: 40, ease: 'none',
    scrollTrigger: { trigger: secao, start: 'top bottom', end: 'bottom top', scrub: 1 },
  });

  // fromTo porque a placa carrega .revelar (opacity 0) — ver regina.js
  g.fromTo(secao.querySelector('.urnaplaca'),
    { opacity: 0, y: 40, rotateX: -60, scale: .88 },
    { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: 1, ease: 'back.out(1.5)',
      scrollTrigger: { trigger: secao.querySelector('.urnaplaca'), start: 'top 86%', once: true } });

  g.from(secao.querySelector('.candidato__figura'), {
    opacity: 0, x: -60, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: secao, start: 'top 68%', once: true },
  });

  g.from(secao.querySelectorAll('.cargos li'), {
    opacity: 0, x: -18, stagger: .07, duration: .6, ease: 'power2.out',
    scrollTrigger: { trigger: secao.querySelector('.cargos'), start: 'top 88%', once: true },
  });

  VT.cascata(secao.querySelector('.pautas'), '.revelar', .09);
  VT.tilt('#cezinha .pauta', 6);
});
