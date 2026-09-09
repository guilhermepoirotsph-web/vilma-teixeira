/* ============================================================================
   historia.js — linha do tempo horizontal com a seção pinada.
   Rolar para baixo empurra a trilha para o lado. No celular também
   (decisão da casa: efeito de scroll fica ligado em todo tamanho).

   HISTÓRICO DE DEFEITO (09/09/2026) — dois sintomas, uma causa:
   antes o resize chamava um montar() que MATAVA e recriava o ScrollTrigger.
     · `kill(true)` remove o espaçador do pin → o documento encolhe ~2.100px de
       uma vez → quem estava abaixo disso é jogado PARA CIMA ("volta pro topo").
     · o montar() recriava os `g.from()` dos marcos. Um from() criado quando o
       elemento já está em opacity 0 grava ZERO como valor final — os oito
       marcos ficavam invisíveis e a seção pinada virava 2.000px de tela vazia
       com só a barra de rolagem andando.
   Correção: o ScrollTrigger é criado UMA vez, com valores em FUNÇÃO +
   invalidateOnRefresh — quem recalcula no resize é o próprio ScrollTrigger.
   E os marcos usam fromTo, com destino explícito. Não existe mais montar().
   ========================================================================== */
VT.secao('historia', () => {
  const g = VT.g;
  const palco = document.getElementById('historia-palco');
  const trilho = document.getElementById('historia-trilho');
  const barra = document.getElementById('historia-barra');
  if (!palco || !trilho) return;

  // sem animação: vira rolagem lateral manual, continua legível
  if (!VT.animando || !g) {
    palco.style.overflowX = 'auto';
    return;
  }

  /** Quanto a trilha precisa andar para a última data encostar na borda. */
  const percurso = () => Math.max(0, trilho.scrollWidth - palco.clientWidth);

  /* ------------------------------------------- entrada dos marcos (uma vez)
     fromTo com destino explícito: from() sozinho, se algum dia for recriado
     com o elemento já transparente, grava 0 como estado final. */
  g.fromTo('.marco',
    { opacity: 0, y: 30 },
    {
      opacity: 1, y: 0, duration: .7, stagger: .07, ease: 'power2.out',
      scrollTrigger: { trigger: palco, start: 'top 80%', once: true },
    });

  /* --------------------------------------------- o pin, criado UMA vez só */
  const tl = g.timeline({
    scrollTrigger: {
      trigger: palco,
      start: 'center center',
      // funções, não números: com invalidateOnRefresh o ScrollTrigger
      // reavalia as duas no resize, sem precisar matar e recriar nada
      end: () => '+=' + (percurso() + palco.clientHeight * .5),
      pin: true,
      scrub: .85,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: () => { if (barra) barra.style.transform = 'scaleX(0)'; },
      onUpdate: s => { if (barra) barra.style.transform = 'scaleX(' + s.progress + ')'; },
    },
  });

  tl.to(trilho, { x: () => -percurso(), ease: 'none' });

  (VT.debug ||= {}).historia = tl;

  /* As larguras dos cartões dependem de Anton/Archivo. Enquanto a fonte da web
     não chega, o percurso é medido com a fonte de sistema e sai errado — o pin
     fica curto ou comprido demais. Uma medição a mais quando a fonte assenta. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => VT.refresh()).catch(() => {});
  }
});
