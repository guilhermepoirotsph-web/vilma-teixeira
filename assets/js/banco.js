/* ============================================================================
   banco.js — camada de dados (Supabase) com degradação honesta.

   SEM banco configurado o site NÃO quebra e NÃO perde apoiador:
     · agenda    → mostra o estado "agenda sendo montada"
     · formulário→ grava na fila local (localStorage) e abre o WhatsApp
                   com a mensagem pronta, para o cadastro não se perder.

   Para ligar o banco: preencher URL e CHAVE abaixo.
   A chave publishable (anon) é PÚBLICA por natureza — a proteção é RLS no banco
   (banco/schema.sql). Nunca colocar service_role aqui.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------ CONFIG */
  const CONFIG = {
    url:   '',   // ex.: https://xxxxxxxxxxxx.supabase.co
    chave: '',   // publishable / anon key
  };

  // Gancho SÓ DE PRÉVIA: localhost e o domínio temporário do cloudflared.
  // Em produção (vilmateixeira.com) isto é inerte — window.VT_CONFIG nunca é
  // olhado, então nem XSS conseguiria desviar as chamadas para outro servidor.
  const ehPrevia = ['localhost', '127.0.0.1'].includes(location.hostname)
                || /\.trycloudflare\.com$/.test(location.hostname);
  if (ehPrevia && window.VT_CONFIG) Object.assign(CONFIG, window.VT_CONFIG);

  const ligado = Boolean(CONFIG.url && CONFIG.chave);
  const base = ligado ? CONFIG.url.replace(/\/+$/, '') + '/rest/v1' : '';

  /* Colunas públicas explícitas — nunca select('*') na leitura pública
     (defesa em profundidade: se alguém abrir uma coluna interna, ela não vaza). */
  const COLUNAS_AGENDA = 'id,titulo,tipo,inicio,fim,local,endereco,bairro,observacao,link_mapa,destaque';

  const cab = () => ({
    'apikey': CONFIG.chave,
    'Authorization': 'Bearer ' + CONFIG.chave,
    'Content-Type': 'application/json',
  });

  async function pedir(caminho, opc = {}) {
    if (!ligado) throw new Error('sem-banco');
    const r = await fetch(base + caminho, { ...opc, headers: { ...cab(), ...(opc.headers || {}) } });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 200) : ''));
    }
    // resposta sem corpo (204, ou 201 com Prefer: return=minimal) não passa por JSON.parse
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  }

  /* ------------------------------------------------------ FILA LOCAL */
  const CHAVE_FILA = 'vt_fila_apoio';
  const fila = {
    ler() { try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]'); } catch { return []; } },
    somar(item) {
      try {
        const f = fila.ler();
        f.push({ ...item, _local: new Date().toISOString() });
        localStorage.setItem(CHAVE_FILA, JSON.stringify(f.slice(-80)));
      } catch { /* modo privado: segue sem fila */ }
    },
    limpar() { try { localStorage.removeItem(CHAVE_FILA); } catch {} },
  };

  /* ----------------------------------------------- limite de envio */
  // 6 envios a cada 10 minutos por navegador (freio simples anti-spam;
  // o freio de verdade é no banco, na função RPC).
  function podeEnviar() {
    try {
      const k = 'vt_envios';
      const agora = Date.now();
      const lista = JSON.parse(localStorage.getItem(k) || '[]').filter(t => agora - t < 600000);
      if (lista.length >= 6) return false;
      lista.push(agora);
      localStorage.setItem(k, JSON.stringify(lista));
      return true;
    } catch { return true; }
  }

  /* --------------------------------------------------------- API */
  window.VT_BANCO = {
    ligado,

    /** Próximos eventos publicados. Devolve [] quando não há banco. */
    async agenda() {
      if (!ligado) return { ok: false, motivo: 'sem-banco', itens: [] };
      try {
        // Filtrar por `inicio`, não por `fim`: a maioria dos compromissos é
        // cadastrada sem hora de término, e `fim >= hoje` com fim nulo é NULL —
        // ou seja, sumia do site. A folga de 6h mantém o evento de hoje visível.
        const desde = new Date(Date.now() - 6 * 3600e3).toISOString();
        const q = `/agenda_publica?select=${COLUNAS_AGENDA}` +
                  `&inicio=gte.${desde}&order=inicio.asc&limit=40`;
        const itens = await pedir(q);
        return { ok: true, itens: Array.isArray(itens) ? itens : [] };
      } catch (e) {
        console.warn('[agenda]', e.message);
        return { ok: false, motivo: e.message, itens: [] };
      }
    },

    /** Textos, links e fotos que a equipe editou no painel (view site_publico). */
    async conteudoSite() {
      if (!ligado) return { ok: false, motivo: 'sem-banco', mapa: {} };
      try {
        const linhas = await pedir('/site_publico?select=chave,valor&limit=200');
        const mapa = {};
        (linhas || []).forEach(l => { mapa[l.chave] = l.valor; });
        return { ok: true, mapa };
      } catch (e) {
        console.warn('[conteudo-site]', e.message);
        return { ok: false, motivo: e.message, mapa: {} };
      }
    },

    /**
     * Grava um apoiador.
     * Escrita SEMPRE por RPC SECURITY DEFINER (anon não tem insert direto).
     * Devolve { ok, modo:'banco'|'local', erro? }
     */
    async apoiar(dados) {
      if (!podeEnviar()) {
        return { ok: false, modo: 'bloqueado',
                 erro: 'Você já enviou vários cadastros agora há pouco. Tente de novo em alguns minutos.' };
      }

      if (!ligado) {
        fila.somar(dados);
        return { ok: true, modo: 'local' };
      }

      try {
        const r = await pedir('/rpc/registrar_apoio', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            p_nome: dados.nome,
            p_whatsapp: dados.whatsapp,
            p_bairro: dados.bairro,
            p_email: dados.email || null,
            p_ajuda: dados.ajuda || [],
            p_recado: dados.recado || null,
            p_apoio: dados.apoio || [],
            p_consente_apoio: Boolean(dados.consente_apoio),
            p_origem: dados.origem || 'site',
          }),
        });
        return { ok: true, modo: 'banco', dado: r };
      } catch (e) {
        // banco fora do ar não pode custar um apoiador
        fila.somar(dados);
        console.warn('[apoiar]', e.message);
        return { ok: true, modo: 'local', erro: e.message };
      }
    },

    fila,
  };
})();
