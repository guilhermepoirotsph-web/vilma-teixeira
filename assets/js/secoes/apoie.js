/* ============================================================================
   apoie.js — formulário de apoio (o "controle de possíveis votos").

   Cuidados que estão no código, não só no texto:
   · consentimento comum obrigatório + consentimento ESPECÍFICO e destacado
     para a declaração de apoio (posicionamento político é dado sensível —
     LGPD art. 5º II e art. 11, I). O específico só aparece se a pessoa marcar
     algum número, e sem ele o apoio NÃO é enviado.
   · honeypot invisível contra robô.
   · nenhum CPF, título de eleitor ou documento é pedido.
   · sem banco (ou com o banco fora do ar) o cadastro cai na fila local e o
     WhatsApp abre com tudo preenchido — apoiador nenhum se perde.
   ========================================================================== */
VT.secao('apoie', () => {
  const g = VT.g;
  const form = document.getElementById('form-apoio');
  if (!form) return;

  const $ = s => form.querySelector(s);
  const barra = document.getElementById('form-barra');
  const telas = [...form.querySelectorAll('.form__tela')];
  const passos = [...form.querySelectorAll('.form__passo')];
  const elErro = document.getElementById('form-erro');
  const elOk = document.getElementById('form-ok');
  const aceiteSensivel = document.getElementById('aceite-sensivel');

  /* ------------------------------------------------------------ bairros */
  const sel = form.querySelector('select[name=bairro]');
  const bairros = window.VT_DADOS?.bairros || [];
  if (sel && bairros.length) {
    bairros.forEach(b => {
      const o = document.createElement('option');
      o.value = b; o.textContent = b;
      sel.appendChild(o);
    });
    const outro = document.createElement('option');
    outro.value = 'Outro'; outro.textContent = 'Outro bairro / outra cidade';
    sel.appendChild(outro);
  }

  /* ------------------------------------------------------ máscara do zap */
  const zap = form.querySelector('input[name=whatsapp]');
  zap?.addEventListener('input', () => {
    let v = zap.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length) v = `(${v}`;
    zap.value = v;
  });

  /* --------------------------------------- consentimento específico on/off */
  const apoios = () => [...form.querySelectorAll('input[name=apoio]:checked')].map(i => i.value);
  form.querySelectorAll('input[name=apoio]').forEach(i => {
    i.addEventListener('change', () => {
      const tem = apoios().length > 0;
      if (aceiteSensivel) {
        aceiteSensivel.hidden = !tem;
        if (!tem) aceiteSensivel.querySelector('input').checked = false;
      }
    });
  });

  /* --------------------------------------------------------- validação */
  function erroCampo(campo, msg) {
    const cx = campo.closest('.campo') || campo.closest('.aceite');
    if (!cx) return;
    cx.classList.add('ruim');
    const e = cx.querySelector('.campo__erro');
    if (e) e.textContent = msg;
    if (VT.animando && g) g.fromTo(cx, { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1,.4)' });
  }
  function limpar(cx) {
    cx.querySelectorAll('.ruim').forEach(e => e.classList.remove('ruim'));
  }

  function validar(n) {
    const tela = telas[n - 1];
    limpar(tela);
    let ok = true;

    if (n === 1) {
      const nome = $('input[name=nome]');
      if (nome.value.trim().length < 3) { erroCampo(nome, 'Escreva seu nome completo.'); ok = false; }

      const so = zap.value.replace(/\D/g, '');
      if (so.length < 10 || so.length > 11) { erroCampo(zap, 'WhatsApp com DDD, ex.: (12) 99999-9999.'); ok = false; }

      if (!sel.value) { erroCampo(sel, 'Escolha o seu bairro.'); ok = false; }

      const mail = $('input[name=email]');
      if (mail.value && !/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(mail.value)) {
        erroCampo(mail, 'Confira o e-mail.'); ok = false;
      }
    }

    if (n === 3) {
      const c = $('input[name=consente]');
      if (!c.checked) { erroCampo(c, 'Precisamos da sua autorização para guardar o contato.'); ok = false; }

      if (apoios().length && aceiteSensivel && !aceiteSensivel.querySelector('input').checked) {
        aceiteSensivel.classList.add('ruim');
        mostrarErro('Para registrar a declaração de apoio precisamos do consentimento específico — ' +
                    'ou desmarque os números.');
        ok = false;
      }
    }
    return ok;
  }

  /* ------------------------------------------------------------ passos */
  let atual = 1;
  function ir(n) {
    if (n > atual && !validar(atual)) return;
    atual = n;
    telas.forEach((t, i) => t.classList.toggle('on', i === n - 1));
    passos.forEach((p, i) => {
      p.classList.toggle('on', i === n - 1);
      p.classList.toggle('feito', i < n - 1);
    });
    if (barra) barra.style.width = (n / telas.length * 100) + '%';
    esconderErro();

    const topo = form.getBoundingClientRect().top + scrollY - 120;
    if (scrollY > topo + 120) VT.irPara(form);
    telas[n - 1].querySelector('input,select,textarea,button')?.focus({ preventScroll: true });
  }
  form.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => ir(Number(b.dataset.ir))));

  // Enter avança em vez de enviar antes da hora
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox])')) {
      e.preventDefault();
      if (atual < telas.length) ir(atual + 1);
    }
  });

  /* ------------------------------------------------------------- erros */
  function mostrarErro(msg) {
    if (!elErro) return;
    elErro.hidden = false;
    elErro.textContent = msg;
  }
  function esconderErro() { if (elErro) elErro.hidden = true; }

  /* -------------------------------------------------- mensagem do zap */
  function textoZap(d) {
    const linhas = [
      'Olá! Quero somar com a campanha da Vereadora Vilma. 💪',
      '',
      'Nome: ' + d.nome,
      'WhatsApp: ' + d.whatsapp,
      'Bairro: ' + d.bairro,
    ];
    if (d.email) linhas.push('E-mail: ' + d.email);
    if (d.ajuda?.length) linhas.push('Posso ajudar com: ' + d.ajuda.map(rotuloAjuda).join(', '));
    if (d.consente_apoio && d.apoio?.length) linhas.push('Vou de: ' + d.apoio.join(' e '));
    if (d.recado) linhas.push('', 'Recado: ' + d.recado);
    return linhas.join('\n');
  }
  const ROTULOS = {
    divulgar: 'divulgar nas redes', adesivo: 'adesivo no carro', panfletar: 'panfletar no bairro',
    reuniao: 'ceder espaço pra reunião', levar: 'levar amigos pra votar',
    evento: 'ajudar em evento', acompanhar: 'acompanhar',
  };
  const rotuloAjuda = v => ROTULOS[v] || v;

  /* O texto que estava NA TELA quando a pessoa marcou, lido do próprio DOM.
     Guardar a redação de hoje numa constante do código não serve de prova:
     quando a redação mudar, a constante muda junto, e o registro antigo passa
     a alegar um texto que aquela pessoa nunca leu. Em representação eleitoral
     ou pedido da ANPD, a pergunta é exatamente "o que ela leu?". */
  const textoDoAceite = () => [...form.querySelectorAll('.aceite')]
    .filter(l => l.querySelector('input')?.checked && !l.hidden)
    .map(l => l.querySelector('span')?.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean).join(' | ') || null;

  /* ------------------------------------------------------------- envio */
  let enviando = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (enviando) return;
    if (!validar(3)) return;

    // honeypot: robô preencheu → fingimos sucesso e não gravamos nada
    if ($('input[name=apelido_site]')?.value) { sucesso({ nome: '' }, 'local', true); return; }

    const dados = {
      nome: $('input[name=nome]').value.trim(),
      whatsapp: zap.value.replace(/\D/g, ''),
      bairro: sel.value,
      email: $('input[name=email]').value.trim() || null,
      ajuda: [...form.querySelectorAll('input[name=ajuda]:checked')].map(i => i.value),
      recado: $('textarea[name=recado]').value.trim() || null,
      apoio: apoios(),
      consente_apoio: Boolean(aceiteSensivel && !aceiteSensivel.hidden &&
                              aceiteSensivel.querySelector('input').checked),
      origem: 'site',
      texto_consent: textoDoAceite(),
    };
    // sem consentimento específico, a declaração de apoio não sai daqui
    if (!dados.consente_apoio) dados.apoio = [];

    enviando = true;
    const btn = document.getElementById('form-enviar');
    const rot = btn.querySelector('span');
    const antes = rot.textContent;
    rot.textContent = 'Enviando…';
    btn.disabled = true;
    esconderErro();

    const r = await window.VT_BANCO.apoiar(dados);

    enviando = false;
    btn.disabled = false;
    rot.textContent = antes;

    if (!r.ok) { mostrarErro(r.erro || 'Não consegui enviar agora. Tente de novo em instantes.'); return; }
    sucesso(dados, r.modo);
  });

  /* ----------------------------------------------------------- sucesso */
  function sucesso(dados, modo, mudo) {
    telas.forEach(t => t.classList.remove('on'));
    form.querySelector('.form__passos').style.display = 'none';
    elOk.hidden = false;

    const primeiro = (dados.nome || '').split(' ')[0];
    const msgEl = document.getElementById('form-ok-msg');
    const waEl = document.getElementById('form-ok-wa');

    // Sem número de CAMPANHA não existe botão de WhatsApp (o do gabinete não
    // pode ser usado em propaganda). A pessoa é mandada para o Instagram, que
    // é canal da própria Vilma.
    const ig = (window.VT_DADOS?.campanha?.instagram || 'vereadoravilma').replace(/^@/, '');
    const temZap = Boolean(VT.wa(''));

    if (modo === 'local' && !mudo) {
      if (temZap) {
        msgEl.innerHTML = (primeiro ? '<b>' + VT.escapar(primeiro) + '</b>, seu ' : 'Seu ') +
          'cadastro foi guardado neste aparelho. Para a equipe receber agora, ' +
          '<b>toque no botão abaixo</b> — a mensagem já vai pronta.';
        waEl.href = VT.wa(textoZap(dados));
        waEl.hidden = false;
      } else {
        msgEl.innerHTML = (primeiro ? '<b>' + VT.escapar(primeiro) + '</b>, seu ' : 'Seu ') +
          'cadastro foi guardado neste aparelho e a equipe recebe assim que o site ' +
          'for ligado ao banco. Se quiser falar agora, chame no ' +
          '<b>Instagram @' + VT.escapar(ig) + '</b>.';
        if (waEl) {
          waEl.href = 'https://www.instagram.com/' + encodeURIComponent(ig) + '/';
          waEl.textContent = 'Falar no Instagram';
          waEl.classList.remove('btn--zap');
          waEl.hidden = false;
        }
      }
    } else {
      msgEl.innerHTML = (primeiro ? 'Obrigada, <b>' + VT.escapar(primeiro) + '</b>! ' : 'Obrigada! ') +
        'A equipe da Vilma vai entrar em contato com o material da campanha.';
      if (temZap) {
        waEl.href = VT.wa('Oi! Acabei de me cadastrar no site da Vereadora Vilma. 💚');
        waEl.hidden = false;
      } else if (waEl) {
        waEl.href = 'https://www.instagram.com/' + encodeURIComponent(ig) + '/';
        waEl.textContent = 'Seguir no Instagram';
        waEl.classList.remove('btn--zap');
        waEl.hidden = false;
      }
    }

    if (VT.animando && g) {
      // fromTo: sucesso() roda de novo em "cadastrar outra pessoa"; um from()
      // criado no meio da animação anterior gravaria o valor parcial como final
      g.fromTo(elOk, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: .6, ease: 'power3.out' });
      confete();
    }
    VT.irPara(form);
    VT.refresh();
  }

  document.getElementById('form-outro')?.addEventListener('click', () => {
    form.reset();
    if (aceiteSensivel) aceiteSensivel.hidden = true;
    elOk.hidden = true;
    form.querySelector('.form__passos').style.display = '';
    ir(1);
  });

  /* ----------------------------------------------------------- confete */
  function confete() {
    const cores = ['#00a650', '#ffc629', '#00a650', '#fbfaf6'];
    const r = form.getBoundingClientRect();
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('i');
      p.className = 'confete';
      p.style.background = cores[i % cores.length];
      p.style.left = (r.left + Math.random() * r.width) + 'px';
      p.style.top = (Math.max(r.top, 0) + 30) + 'px';
      document.body.appendChild(p);
      g.to(p, {
        y: innerHeight * (.45 + Math.random() * .7),
        x: (Math.random() - .5) * 300,
        rotation: Math.random() * 800 - 400,
        opacity: 0,
        duration: 1.6 + Math.random() * 1.4,
        ease: 'power1.out',
        onComplete: () => p.remove(),
      });
    }
  }

  /* --------------------------------------------------------- entrada */
  if (VT.animando && g) {
    g.from('.apoie__form-wrap', {
      opacity: 0, y: 50, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.apoie__caixa', start: 'top 80%', once: true },
    });
    g.from('.apoie__lista li', {
      opacity: 0, x: -20, stagger: .1, duration: .6, ease: 'power2.out',
      scrollTrigger: { trigger: '.apoie__lista', start: 'top 88%', once: true },
    });
  }
  if (barra) barra.style.width = (1 / telas.length * 100) + '%';
});
