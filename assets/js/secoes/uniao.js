/* uniao.js — contagem regressiva da eleição + a frase-manifesto */
VT.secao('uniao', () => {
  const g = VT.g;

  /* ------------------------------------------------ contagem regressiva
     1º turno das eleições gerais de 2026: domingo, 4 de outubro, 8h.
     Urgência honesta — data pública e verificável, sem relógio falso que
     reinicia quando a página recarrega. */
  (() => {
    const caixa = document.getElementById('conta');
    if (!caixa) return;
    // a data vem do dados.js (com fonte em docs/DADOS.md §8), não hardcoded aqui
    const ELEICAO = window.VT_DADOS?.campanha?.eleicao || {};
    const alvo = new Date(ELEICAO.turno1 || '2026-10-04T08:00:00-03:00').getTime();
    if (!Number.isFinite(alvo)) return;   // sem isso, "NaN dias" ao vivo na 2ª dobra
    const campos = {};
    caixa.querySelectorAll('[data-c]').forEach(el => { campos[el.dataset.c] = el; });
    const fim = document.getElementById('conta-fim');
    const blocos = document.getElementById('conta-blocos');

    const doisDig = n => String(n).padStart(2, '0');
    let ultimoDia = null;

    const bater = () => {
      const resta = alvo - Date.now();

      if (resta <= 0) {
        if (blocos) blocos.hidden = true;
        if (fim) {
          fim.hidden = false;
          fim.innerHTML = 'É <b>hoje</b>. Leve os números anotados e não deixe para depois.';
        }
        return false;
      }

      const s = Math.floor(resta / 1000);
      const d = Math.floor(s / 86400);
      campos.d.textContent = d;
      campos.h.textContent = doisDig(Math.floor((s % 86400) / 3600));
      campos.m.textContent = doisDig(Math.floor((s % 3600) / 60));
      campos.s.textContent = doisDig(s % 60);

      // um pulsinho quando vira o dia, nada de animar 60x por minuto
      if (ultimoDia !== null && d !== ultimoDia && VT.animando && g) {
        g.fromTo(campos.d, { scale: 1.28 }, { scale: 1, duration: .6, ease: 'back.out(2)' });
      }
      ultimoDia = d;
      return true;
    };

    if (!bater()) return;
    let relogio = setInterval(() => { if (!bater()) clearInterval(relogio); }, 1000);
    // aba escondida não precisa de relógio rodando
    document.addEventListener('visibilitychange', () => {
      clearInterval(relogio);
      if (!document.hidden) { bater(); relogio = setInterval(() => { if (!bater()) clearInterval(relogio); }, 1000); }
    });

    if (VT.animando && g) {
      g.from(caixa, {
        opacity: 0, y: 26, duration: .8, ease: 'power3.out',
        scrollTrigger: { trigger: caixa, start: 'top 92%', once: true },
      });
    }
  })();
  const frase = document.getElementById('uniao-frase');
  if (!frase || !VT.animando || !g) return;

  const palavras = VT.partir(frase, 'words');
  if (palavras.length > 1) {
    palavras.forEach(p => p.classList.add('p'));
    g.from(palavras, {
      opacity: 0, y: 46, rotateX: -55, stagger: .045, duration: .85, ease: 'power3.out',
      scrollTrigger: { trigger: frase, start: 'top 82%', once: true },
    });
  }

  VT.cascata('.uniao__trio', '.revelar', .11);
});
