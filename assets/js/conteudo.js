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

  /**
   * Transcrição escrita por gente vira legenda sincronizada.
   * Aceita "0:07 fala", "1:02:33 fala" e também "00:07 - fala".
   * Linha sem tempo entra colada na anterior (fala que continua).
   */
  function lerTranscricao(texto) {
    const trechos = [];
    String(texto || '').split(/\r?\n/).forEach(linha => {
      const bruto = linha.trim();
      if (!bruto) return;
      const m = bruto.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})\s*[-–—:]?\s*(.+)$/);
      if (!m) {
        if (trechos.length) trechos[trechos.length - 1].txt += ' ' + bruto;
        return;
      }
      const h = Number(m[1] || 0), min = Number(m[2]), seg = Number(m[3]);
      trechos.push({ t: h * 3600 + min * 60 + seg, txt: m[4].trim() });
    });
    return trechos.sort((a, b) => a.t - b.t);
  }

  /* Onde cada chave entra dentro de VT_DADOS (o que as seções leem). */
  const APLICAR = {
    'video.url':        v => (D.video.url = v),
    'video.legenda':    v => (D.video.legenda = v),
    'video.data':       v => (D.video.data = v),
    'video.arquivo':    v => (D.video.arquivo = v),
    // A equipe digita "0:07 Boa noite, Caraguá." e o site vira legenda sincronizada.
    // Formato de gente, não .vtt — quem escreve é o social media, não um técnico.
    'video.transcricao': v => { D.video.transcricao = lerTranscricao(v); },

    'regina.nome':      v => (D.regina.nome = v),
    'regina.numero':    v => { D.regina.numero = v; D.regina.numeroFmt = v.split(''); },
    'regina.cargo':     v => (D.regina.cargo = v),
    'regina.partido':   v => (D.regina.partido = v),
    'regina.lead':      v => (D.regina.lead = v),
    'regina.frase':     v => (D.regina.frase = v),
    'regina.foto':      v => (D.regina.foto = v),
    'regina.instagram': v => (D.regina.instagram = v),

    'cezinha.nome':     v => (D.cezinha.nome = v),
    'cezinha.numero':   v => { D.cezinha.numero = v; D.cezinha.numeroFmt = v.split(''); },
    'cezinha.cargo':    v => (D.cezinha.cargo = v),
    'cezinha.partido':  v => (D.cezinha.partido = v),
    'cezinha.lead':     v => (D.cezinha.lead = v),
    'cezinha.foto':     v => (D.cezinha.foto = v),

    'heroi.foto':       v => (D.vilma.foto = v),
    'geral.whatsapp':   v => (D.campanha.whatsapp = v.replace(/\D/g, '')),
    'geral.instagram':  v => (D.campanha.instagram = v.replace(/^@/, '')),
  };

  /** Troca o conteúdo dos elementos marcados com data-vt / data-vt-src / data-vt-href. */
  function pintar(mapa) {
    document.querySelectorAll('[data-vt]').forEach(el => {
      const v = mapa[el.dataset.vt];
      if (v == null || v === '') return;
      el.textContent = v;
    });
    document.querySelectorAll('[data-vt-src]').forEach(el => {
      const v = mapa[el.dataset.vtSrc];
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

    // números da urna e das placas aparecem em vários lugares
    [['regina', D.regina], ['cezinha', D.cezinha]].forEach(([k, c]) => {
      if (!mapa[k + '.numero']) return;
      document.querySelectorAll('[data-num="' + k + '"]').forEach(el => { el.textContent = c.numero; });
    });

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
      const aplicar = () => pintar(mapa);
      if (document.readyState === 'loading') addEventListener('DOMContentLoaded', aplicar, { once: true });
      else aplicar();

      return mapa;
  })();
})();
