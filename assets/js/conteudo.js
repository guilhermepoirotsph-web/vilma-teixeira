/* ============================================================================
   conteudo.js — aplica no site o que a equipe editou no painel.

   Fecha o defeito mais repetido da casa: chave no banco sem efeito no site.
   Toda chave da tabela `site_conteudo` cai em UM destes dois caminhos:
     1. atributo data-vt="chave" no HTML   → troca texto/src/href na hora
     2. mapa APLICAR abaixo               → troca dentro de VT_DADOS
   Se a chave estiver vazia no banco, o site usa o que já está no código —
   nunca fica buraco na tela.
   ========================================================================== */
(() => {
  'use strict';

  const D = window.VT_DADOS || {};

  /* Link de post do Instagram → permalink limpo, ou nada.
     Só passa instagram.com/p|reel|tv/CÓDIGO — qualquer outra coisa colada no
     painel (link de perfil, encurtador, texto) é descartada em vez de virar
     um embed quebrado ou um href estranho no site. */
  function postInstagram(v) {
    const m = String(v || '').trim()
      .match(/^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]{5,40})/i);
    return m ? 'https://www.instagram.com/' + m[1].toLowerCase() + '/' + m[2] + '/' : '';
  }

  /* Foto vinda do painel: só http(s) ou caminho relativo do próprio site. */
  function urlDeFoto(v) {
    const t = String(v || '').trim();
    if (/^https:\/\//i.test(t)) return t;
    if (/^(?:\.\/)?(?:fotos|midia|assets)\/[\w./-]+\.(?:png|jpe?g|webp)$/i.test(t)) return t;
    return '';
  }

  /* Onde cada chave entra dentro de VT_DADOS (o que as seções leem). */
  const APLICAR = {
    'heroi.foto':       v => { const u = urlDeFoto(v); if (u) D.vilma.foto = u; },
    'geral.whatsapp':   v => (D.campanha.whatsapp = v.replace(/\D/g, '')),
    'geral.instagram':  v => (D.campanha.instagram = v.replace(/^@/, '').trim()),
  };
  // instagram.post1…4 e galeria.1…6: posição fixa, para a ordem do painel
  // ser a ordem do site
  for (let i = 1; i <= 4; i++) {
    APLICAR['instagram.post' + i] = v => {
      const u = postInstagram(v);
      if (u) (D.instagram ||= { posts: [] }).posts[i - 1] = u;
    };
  }
  for (let i = 1; i <= 6; i++) {
    APLICAR['galeria.' + i] = v => {
      const u = urlDeFoto(v);
      if (u) (D.galeria ||= [])[i - 1] = u;
    };
  }

  /** Troca o conteúdo dos elementos marcados com data-vt / data-vt-src / data-vt-href. */
  function pintar(mapa) {
    document.querySelectorAll('[data-vt]').forEach(el => {
      const v = mapa[el.dataset.vt];
      if (v == null || v === '') return;
      el.textContent = v;
    });
    document.querySelectorAll('[data-vt-src]').forEach(el => {
      const v = urlDeFoto(mapa[el.dataset.vtSrc]);
      if (!v) return;
      el.hidden = false;
      el.src = v;
      // a moldura de lacuna irmã sai de cena
      el.parentElement?.querySelector('.foto-vaga')?.setAttribute('hidden', '');
    });
    document.querySelectorAll('[data-vt-href]').forEach(el => {
      const v = mapa[el.dataset.vtHref];
      if (v) el.href = v;
    });

    // o @ do Instagram aparece em vários lugares (herói, seção, rodapé, menu)
    const ig = (D.campanha?.instagram || '').replace(/^@/, '');
    if (ig && /^[\w.]{1,30}$/.test(ig)) {
      document.querySelectorAll('[data-ig-link]').forEach(a => {
        a.href = 'https://www.instagram.com/' + ig + '/';
      });
      document.querySelectorAll('[data-ig-arroba]').forEach(el => { el.textContent = '@' + ig; });
    }

    // faixa de aviso no topo (só aparece se a equipe escrever algo)
    const aviso = mapa['geral.aviso'];
    const barra = document.getElementById('faixa-aviso');
    if (barra && aviso && aviso.trim()) {
      barra.querySelector('span').textContent = aviso.trim();
      barra.hidden = false;
      document.documentElement.classList.add('com-aviso');
      // a faixa muda --nav-h de 74 para 112: sem recalcular, todo start de
      // ScrollTrigger fica 38px errado
      requestAnimationFrame(() => window.VT?.refresh());
    }
  }

  /* --------------------------------------------------------------- carga */
  // O objeto precisa existir ANTES de a função rodar: sem banco não há await
  // nenhum no caminho, então o corpo executa inteiro de forma síncrona e
  // encontraria window.VT_CONTEUDO ainda indefinido.
  const CT = { mapa: {}, pronto: null };
  window.VT_CONTEUDO = CT;

  CT.pronto = (async () => {
      let mapa = {};
      try {
        if (window.VT_BANCO?.ligado) {
          const r = await window.VT_BANCO.conteudoSite();
          if (r.ok) mapa = r.mapa;
        }
      } catch (e) { console.warn('[conteudo]', e.message); }

      Object.entries(mapa).forEach(([k, v]) => {
        if (v == null || String(v).trim() === '') return;
        try { APLICAR[k]?.(String(v)); } catch (e) { console.warn('[conteudo] ' + k, e.message); }
      });

      CT.mapa = mapa;
      // pinta sempre — mesmo sem banco, para o @ do dados.js valer em todo lugar
      const aplicar = () => pintar(mapa);
      if (document.readyState === 'loading') addEventListener('DOMContentLoaded', aplicar, { once: true });
      else aplicar();

      return mapa;
  })();
})();
