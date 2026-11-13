/* projetos.js — a lei em destaque + contadores do mandato (valores exatos do DADOS.md) */
VT.secao('projetos', () => {
  const g = VT.g;

  const total = document.getElementById('contador-141');
  if (total) VT.contar(total, 141, { duracao: 2.2 });

  document.querySelectorAll('.tipo__n[data-n]').forEach(el => {
    VT.contar(el, Number(el.dataset.n), { gatilho: el.closest('.tipo'), duracao: 1.4 });
  });

  VT.cascata('#mandato-grade', '.revelar', .06);
  VT.cascata('#bandeiras', '.revelar', .07);
  VT.tilt('.tipo', 6);

  if (!VT.animando || !g) return;

  // a lei: a faixa do MDB se desenha e as finalidades entram em sequência.
  // fromTo com destino explícito (from() numa seção que remonta grava 0 como final)
  const lei = document.getElementById('lei');
  if (lei) {
    g.fromTo(lei.querySelector('.lei__faixa'), { scaleX: 0 }, {
      scaleX: 1, duration: 1.2, ease: 'power3.inOut',
      scrollTrigger: { trigger: lei, start: 'top 80%', once: true },
    });
    g.fromTo(lei.querySelectorAll('.lei__fins li'), { opacity: 0, x: 26 }, {
      opacity: 1, x: 0, stagger: .1, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: lei.querySelector('.lei__fins'), start: 'top 86%', once: true },
    });
    g.to(lei.querySelector('.lei__folha'), {
      rotate: 8, y: -24, ease: 'none',
      scrollTrigger: { trigger: lei, start: 'top bottom', end: 'bottom top', scrub: .8 },
    });
  }
});
