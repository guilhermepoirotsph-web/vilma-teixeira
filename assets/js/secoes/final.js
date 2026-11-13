/* final.js — fecho da página */
VT.secao('final', () => {
  const g = VT.g;

  // Botões de WhatsApp: só existem se houver número PRÓPRIO (não o do
  // gabinete). Sem número, nascem hidden no HTML e continuam escondidos.
  const ligar = () => {
    const href = VT.wa('Oi, Vilma! Vim pelo seu site. 💚');
    ['final-wa', 'wa-float', 'rodape-wa'].forEach(id => {
      const a = document.getElementById(id);
      if (!a) return;
      if (href) { a.href = href; a.hidden = false; }
      else a.hidden = true;
    });
  };
  ligar();
  // o número pode chegar pelo painel (geral.whatsapp) depois da primeira pintura
  window.VT_CONTEUDO?.pronto?.then(ligar).catch(() => {});

  if (!VT.animando || !g) return;

  const frase = document.getElementById('final-frase');
  if (frase) {
    g.fromTo(frase.children, { opacity: 0, y: 54, scale: .93 }, {
      opacity: 1, y: 0, scale: 1, stagger: .12, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: frase, start: 'top 82%', once: true },
    });
  }

  g.fromTo('.final__faixa', { scaleX: 0 }, {
    scaleX: 1, duration: 1.1, ease: 'power3.inOut',
    scrollTrigger: { trigger: '.final__faixa', start: 'top 92%', once: true },
  });

  g.fromTo('.final__assina', { opacity: 0, scale: .82 }, {
    opacity: .9, scale: 1, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: '.final__assina', start: 'top 92%', once: true },
  });
});
