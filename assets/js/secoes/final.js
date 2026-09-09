/* final.js — fecho da página */
VT.secao('final', () => {
  const g = VT.g;

  // Botões de WhatsApp: só existem se houver número de CAMPANHA. Sem número,
  // eles nascem hidden no HTML e continuam escondidos — nada de mandar a pessoa
  // para o número do gabinete.
  const msg = 'Oi! Vim pelo site da Vereadora Vilma e quero somar com a campanha. 💪';
  const href = VT.wa(msg);
  ['final-wa', 'wa-float', 'rodape-wa'].forEach(id => {
    const a = document.getElementById(id);
    if (!a) return;
    if (href) { a.href = href; a.hidden = false; }
    else a.hidden = true;
  });

  if (!VT.animando || !g) return;

  const frase = document.getElementById('final-frase');
  if (frase) {
    g.from(frase.children, {
      opacity: 0, y: 54, scale: .93, stagger: .12, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: frase, start: 'top 82%', once: true },
    });
  }

  g.from('.final__placas .cola', {
    opacity: 0, y: 34, rotateX: -40, stagger: .13, duration: .8, ease: 'back.out(1.4)',
    scrollTrigger: { trigger: '.final__placas', start: 'top 88%', once: true },
  });

  g.from('.final__assina', {
    opacity: 0, scale: .82, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: '.final__assina', start: 'top 92%', once: true },
  });
});
