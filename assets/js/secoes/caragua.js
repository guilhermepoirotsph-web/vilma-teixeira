/* caragua.js — faixas infinitas com os bairros + contadores da cidade */
VT.secao('caragua', () => {
  const g = VT.g;
  const bairros = (window.VT_DADOS?.bairros) || [];
  if (!bairros.length) return;

  const encher = (id, inverso) => {
    const trilho = document.getElementById(id);
    if (!trilho) return;

    const lista = inverso ? [...bairros].reverse() : bairros;
    // duas cópias: quando a primeira sai, a segunda já está no lugar
    const bloco = () => lista.map(b => '<span>' + VT.escapar(b) + '</span>').join('');
    trilho.innerHTML = bloco() + bloco();

    if (!VT.animando || !g) return;
    const largura = trilho.scrollWidth / 2;
    g.fromTo(trilho,
      { x: inverso ? -largura : 0 },
      { x: inverso ? 0 : -largura, duration: inverso ? 46 : 52, ease: 'none', repeat: -1 });
  };

  encher('marquee-1', false);
  encher('marquee-2', true);

  document.querySelectorAll('.caragua__n[data-n]').forEach(el => {
    const n = Number(el.dataset.n);
    VT.contar(el, n, {
      gatilho: el.closest('.cartao'),
      duracao: 1.6,
      formatar: v => Math.round(v).toLocaleString('pt-BR') + (n === 30 ? '' : ''),
    });
  });
});
