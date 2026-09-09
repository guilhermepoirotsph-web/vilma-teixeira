/* mandato.js — contadores dos números do mandato (valores exatos do DADOS.md) */
VT.secao('mandato', () => {
  const total = document.getElementById('contador-141');
  if (total) VT.contar(total, 141, { duracao: 2.2 });

  document.querySelectorAll('.tipo__n[data-n]').forEach(el => {
    VT.contar(el, Number(el.dataset.n), { gatilho: el.closest('.tipo'), duracao: 1.4 });
  });

  VT.cascata('#mandato-grade', '.revelar', .06);
  VT.cascata('#bandeiras', '.revelar', .07);
  VT.tilt('.tipo', 6);
});
