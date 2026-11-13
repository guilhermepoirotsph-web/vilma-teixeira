/* ============================================================================
   galeria.js — fotos da Vilma em Caraguá.

   Fonte, nesta ordem:
     1. painel → Site → Galeria (galeria.1 … galeria.6), via conteudo.js
     2. arquivos em fotos/, listados em dados.js → galeriaArquivos
   Sem nenhuma foto, a seção #fotos e o link "Fotos" do menu continuam
   escondidos. Foto que não abre é descartada em silêncio — nunca ícone
   de imagem quebrada.
   ========================================================================== */
VT.secao('galeria', () => {
  const g = VT.g;
  const secao = document.getElementById('fotos');
  const grade = document.getElementById('galeria-grade');
  if (!secao || !grade) return;

  const carrega = src => new Promise(responder => {
    const sonda = new Image();
    sonda.onload = () => responder(sonda.naturalWidth > 0 ? { src, w: sonda.naturalWidth, h: sonda.naturalHeight } : null);
    sonda.onerror = () => responder(null);
    sonda.src = src;
  });

  (async () => {
    try { await window.VT_CONTEUDO?.pronto; } catch {}
    const D = window.VT_DADOS || {};
    let candidatas = (D.galeria || []).filter(Boolean);
    if (!candidatas.length) candidatas = (D.galeriaArquivos || []).filter(Boolean);
    const fotos = (await Promise.all(candidatas.map(carrega))).filter(Boolean);
    if (!fotos.length) return;

    grade.dataset.n = String(fotos.length);
    grade.innerHTML = fotos.map((f, i) =>
      '<button class="galeria__item" type="button" data-i="' + i + '" ' +
        'aria-label="Ampliar foto ' + (i + 1) + ' de ' + fotos.length + '">' +
        '<img src="' + VT.escapar(f.src) + '" alt="Vereadora Vilma Teixeira em Caraguatatuba" ' +
          'loading="lazy" decoding="async" width="' + f.w + '" height="' + f.h + '">' +
      '</button>').join('');

    secao.hidden = false;
    document.querySelectorAll('[data-so-com-fotos]').forEach(a => { a.hidden = false; });

    /* ------------------------------------------------------ lupa */
    const lupa = document.getElementById('galeria-lupa');
    const lupaImg = document.getElementById('galeria-lupa-img');
    if (lupa && lupaImg && typeof lupa.showModal === 'function') {
      grade.addEventListener('click', e => {
        const b = e.target.closest('.galeria__item');
        if (!b) return;
        lupaImg.src = fotos[Number(b.dataset.i)].src;
        lupaImg.alt = 'Vereadora Vilma Teixeira em Caraguatatuba (ampliada)';
        lupa.showModal();
      });
      lupa.addEventListener('click', e => {
        if (e.target === lupa || e.target.closest('.lupa__fechar')) lupa.close();
      });
    }

    if (VT.animando && g) {
      g.fromTo(grade.children, { opacity: 0, y: 40, scale: .96 }, {
        opacity: 1, y: 0, scale: 1, stagger: .08, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: grade, start: 'top 85%', once: true },
      });
    }
    VT.refresh();
  })();
});
