/* regina.js — palco da candidata a deputada estadual (15115) */
VT.secao('regina', () => {
  const g = VT.g;
  const secao = document.getElementById('regina');
  if (!secao) return;

  // recorte PNG -> retrato emoldurado -> pôster em coluna única
  VT.escadaDeFoto(secao.querySelector('.candidato__figura'),
    () => secao.classList.add('candidato--sem-foto'));

  if (!VT.animando || !g) return;

  // o número gigante do fundo desliza no scroll
  g.to(secao.querySelector('.candidato__numerao'), {
    x: -90, y: 40, ease: 'none',
    scrollTrigger: { trigger: secao, start: 'top bottom', end: 'bottom top', scrub: 1 },
  });

  // a placa 15115 chega girando.
  // fromTo (não from): o elemento tem .revelar, que já o deixa em opacity 0 —
  // um from() animaria de 0 para 0 e a placa nunca apareceria.
  g.fromTo(secao.querySelector('.urnaplaca'),
    { opacity: 0, y: 40, rotateX: -60, scale: .88 },
    { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: 1, ease: 'back.out(1.5)',
      scrollTrigger: { trigger: secao.querySelector('.urnaplaca'), start: 'top 86%', once: true } });

  g.from(secao.querySelector('.candidato__figura'), {
    opacity: 0, x: 60, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: secao, start: 'top 68%', once: true },
  });

  g.from(secao.querySelectorAll('.fato'), {
    opacity: 0, y: 26, stagger: .08, duration: .7, ease: 'power3.out',
    scrollTrigger: { trigger: secao.querySelector('.fatos'), start: 'top 88%', once: true },
  });

  VT.cascata(secao.querySelector('.pautas'), '.revelar', .09);
  VT.tilt('#regina .pauta', 6);
});
