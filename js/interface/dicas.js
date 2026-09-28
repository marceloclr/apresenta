// js/interface/dicas.js — componente próprio de dicas (tooltips).
//
// Marcação:
//   <button data-dica="Explica a função e a consequência da ação.">…</button>
//   <span class="indicador" data-dica-titulo="Tamanho estimado"
//         data-dica="Soma das parcelas do arquivo exportado."
//         data-dica-formula="Σ imagens × 4/3 + motor + tema + fontes">…</span>
//   data-dica-posicao="acima|abaixo|direita|esquerda" (padrão: acima)
//
// Acessibilidade:
//   • cada alvo recebe aria-describedby apontando para uma descrição permanente (lida por
//     leitores de tela mesmo sem a dica visível);
//   • alvos não focalizáveis (indicadores) recebem tabindex="0" para acesso pelo teclado;
//   • a dica aparece no foco por teclado, persiste sob o ponteiro e fecha com Esc (WCAG 1.4.13).
//
// Controles indisponíveis usam aria-disabled (não o atributo disabled, que suprime eventos
// e impediria a dica explicativa): O.ui.dicas.indisponivel(botao, 'Motivo…').

(function (O) {
  'use strict';

  const D = (O.ui.dicas = {});
  const U = O.util;
  const C = O.config;

  const SELETOR = '[data-dica], [data-dica-formula], [data-dica-titulo]';
  const NATIVAMENTE_FOCALIZAVEL = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
  let balao = null;          // elemento flutuante único
  let descricoes = null;     // contêiner das descrições permanentes
  let alvoAtual = null;
  let temporizador = null;
  let ocultarTimer = null;
  let contador = 0;

  // ── Conteúdo ───────────────────────────────────────────────────────────
  function lerConteudo(el) {
    return {
      titulo: el.getAttribute('data-dica-titulo') || '',
      texto: el.getAttribute('data-dica') || '',
      formula: el.getAttribute('data-dica-formula') || '',
      motivo: el.getAttribute('aria-disabled') === 'true' ? (el.getAttribute('data-dica-motivo') || '') : '',
    };
  }

  function textoPlano({ titulo, texto, formula, motivo }) {
    return [titulo, texto, formula && `Cálculo: ${formula}`, motivo && `Indisponível: ${motivo}`].filter(Boolean).join('. ');
  }

  function preencherBalao({ titulo, texto, formula, motivo }) {
    const partes = [
      titulo && U.el('strong', { class: 'dica-titulo' }, titulo),
      texto && U.el('span', { class: 'dica-texto' }, texto),
      formula && U.el('code', { class: 'dica-formula' }, formula),
      motivo && U.el('span', { class: 'dica-motivo' }, motivo),
    ].filter(Boolean); // replaceChildren converteria null em texto "null"
    balao.replaceChildren(...partes);
  }

  // ── Vinculação (aria-describedby e foco) ─────────────────────────────────
  function vincular(el) {
    if (!descricoes) return;
    const conteudo = lerConteudo(el);
    const plano = textoPlano(conteudo);
    let id = el.getAttribute('data-dica-id');
    let desc = id && document.getElementById(id);
    if (!desc) {
      id = `dica-desc-${++contador}`;
      desc = U.el('span', { id });
      descricoes.append(desc);
      el.setAttribute('data-dica-id', id);
    }
    if (desc.textContent !== plano) desc.textContent = plano;
    const atuais = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!atuais.includes(id)) el.setAttribute('aria-describedby', [...atuais, id].join(' '));
    if (!NATIVAMENTE_FOCALIZAVEL.test(el.tagName) && !el.hasAttribute('tabindex') && !el.isContentEditable) el.setAttribute('tabindex', '0');
    if (el === alvoAtual && balao && !balao.hidden) { preencherBalao(conteudo); posicionar(el); }
  }

  function desvincular(el) {
    const id = el.getAttribute('data-dica-id');
    if (!id) return;
    document.getElementById(id)?.remove();
  }

  function vincularTudo(raiz = document) {
    if (raiz.nodeType === 1 && raiz.matches(SELETOR)) vincular(raiz);
    raiz.querySelectorAll?.(SELETOR).forEach(vincular);
  }

  // ── Exibição e posição ─────────────────────────────────────────────────
  function posicionar(el) {
    const r = el.getBoundingClientRect();
    const margem = 8;
    const distancia = 10;
    const preferida = el.getAttribute('data-dica-posicao') || 'acima';
    balao.style.left = '0px';
    balao.style.top = '0px';
    const b = balao.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const cabe = {
      acima: r.top - b.height - distancia >= margem,
      abaixo: r.bottom + b.height + distancia <= vh - margem,
      direita: r.right + b.width + distancia <= vw - margem,
      esquerda: r.left - b.width - distancia >= margem,
    };
    const opostos = { acima: 'abaixo', abaixo: 'acima', direita: 'esquerda', esquerda: 'direita' };
    const lado = cabe[preferida] ? preferida : cabe[opostos[preferida]] ? opostos[preferida] : (cabe.abaixo ? 'abaixo' : 'acima');
    let x, y;
    if (lado === 'acima' || lado === 'abaixo') {
      x = r.left + r.width / 2 - b.width / 2;
      y = lado === 'acima' ? r.top - b.height - distancia : r.bottom + distancia;
    } else {
      y = r.top + r.height / 2 - b.height / 2;
      x = lado === 'esquerda' ? r.left - b.width - distancia : r.right + distancia;
    }
    x = Math.max(margem, Math.min(x, vw - b.width - margem));
    y = Math.max(margem, Math.min(y, vh - b.height - margem));
    balao.style.left = `${Math.round(x)}px`;
    balao.style.top = `${Math.round(y)}px`;
    balao.dataset.lado = lado;
    // posição da seta, relativa ao balão
    const setaX = Math.max(12, Math.min(r.left + r.width / 2 - x, b.width - 12));
    const setaY = Math.max(12, Math.min(r.top + r.height / 2 - y, b.height - 12));
    balao.style.setProperty('--dica-seta-x', `${Math.round(setaX)}px`);
    balao.style.setProperty('--dica-seta-y', `${Math.round(setaY)}px`);
  }

  function mostrar(el) {
    clearTimeout(ocultarTimer);
    const conteudo = lerConteudo(el);
    if (!conteudo.titulo && !conteudo.texto && !conteudo.formula && !conteudo.motivo) return;
    alvoAtual = el;
    preencherBalao(conteudo);
    balao.hidden = false;
    balao.classList.remove('visivel');
    posicionar(el);
    requestAnimationFrame(() => balao.classList.add('visivel'));
  }

  function ocultar() {
    clearTimeout(temporizador);
    clearTimeout(ocultarTimer);
    if (!balao) return;
    balao.classList.remove('visivel');
    balao.hidden = true;
    alvoAtual = null;
  }

  const agendarOcultacao = () => { clearTimeout(ocultarTimer); ocultarTimer = setTimeout(ocultar, 120); };

  // ── Eventos delegados ──────────────────────────────────────────────────
  function aoPonteiroSobre(ev) {
    if (ev.pointerType === 'touch') return;
    const el = ev.target.closest?.(SELETOR);
    if (!el || el === alvoAtual) { if (el) clearTimeout(ocultarTimer); return; }
    clearTimeout(temporizador);
    temporizador = setTimeout(() => mostrar(el), C.ATRASO_DICA_MS);
  }

  function aoPonteiroFora(ev) {
    const el = ev.target.closest?.(SELETOR);
    if (!el) return;
    if (ev.relatedTarget && (el.contains(ev.relatedTarget) || balao.contains(ev.relatedTarget))) return;
    clearTimeout(temporizador);
    if (el === alvoAtual) agendarOcultacao();
  }

  function aoFocar(ev) {
    const el = ev.target.closest?.(SELETOR);
    if (!el) return;
    let porTeclado = true;
    try { porTeclado = el.matches(':focus-visible'); } catch (_) { /* navegador antigo */ }
    if (porTeclado) { clearTimeout(temporizador); mostrar(el); }
  }

  function aoDesfocar(ev) {
    const el = ev.target.closest?.(SELETOR);
    if (el && el === alvoAtual) ocultar();
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape' && alvoAtual) { ocultar(); ev.stopPropagation(); }
  }

  // Bloqueia a ação de controles com aria-disabled="true" (a dica continua disponível)
  function bloquearIndisponivel(ev) {
    const el = ev.target.closest?.('[aria-disabled="true"]');
    if (!el) return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    mostrar(el);
  }

  // ── API pública ────────────────────────────────────────────────────────
  D.iniciar = function () {
    if (balao) return;
    balao = U.el('div', { id: 'dica-flutuante', class: 'dica', role: 'tooltip', hidden: true });
    descricoes = U.el('div', { id: 'dicas-descricoes', hidden: true });
    document.body.append(balao, descricoes);

    document.addEventListener('pointerover', aoPonteiroSobre);
    document.addEventListener('pointerout', aoPonteiroFora);
    document.addEventListener('focusin', aoFocar);
    document.addEventListener('focusout', aoDesfocar);
    document.addEventListener('keydown', aoTeclar, true);
    document.addEventListener('click', bloquearIndisponivel, true);
    document.addEventListener('keydown', bloquearIndisponivel, true);
    balao.addEventListener('pointerenter', () => clearTimeout(ocultarTimer));
    balao.addEventListener('pointerleave', agendarOcultacao);
    window.addEventListener('scroll', ocultar, true);
    window.addEventListener('resize', ocultar);

    vincularTudo(document);
    new MutationObserver((mutacoes) => {
      for (const m of mutacoes) {
        if (m.type === 'attributes') { if (m.target.matches(SELETOR)) vincular(m.target); continue; }
        m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n !== balao && n !== descricoes) vincularTudo(n); });
        m.removedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches?.(SELETOR)) desvincular(n);
          n.querySelectorAll?.(SELETOR).forEach(desvincular);
          if (alvoAtual && n.contains(alvoAtual)) ocultar();
        });
      }
    }).observe(document.body, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['data-dica', 'data-dica-titulo', 'data-dica-formula', 'data-dica-motivo', 'aria-disabled'],
    });
  };

  /** Define ou atualiza a dica de um elemento. */
  D.definir = function (el, { texto, titulo, formula, posicao } = {}) {
    if (texto !== undefined) el.setAttribute('data-dica', texto);
    if (titulo !== undefined) titulo ? el.setAttribute('data-dica-titulo', titulo) : el.removeAttribute('data-dica-titulo');
    if (formula !== undefined) formula ? el.setAttribute('data-dica-formula', formula) : el.removeAttribute('data-dica-formula');
    if (posicao) el.setAttribute('data-dica-posicao', posicao);
    vincular(el);
    return el;
  };

  /** Torna o controle indisponível, preservando foco e dica, e registra o motivo. */
  D.indisponivel = function (el, motivo) {
    el.setAttribute('aria-disabled', 'true');
    el.setAttribute('data-dica-motivo', motivo || 'Recurso indisponível no momento.');
    vincular(el);
  };

  D.disponivel = function (el) {
    el.removeAttribute('aria-disabled');
    el.removeAttribute('data-dica-motivo');
    vincular(el);
  };

  D.ocultar = ocultar;

  /**
   * Auditoria: controles interativos e indicadores sem dica. Retorna a lista e,
   * em modo de desenvolvimento, relata no console.
   */
  D.auditar = function (raiz = document) {
    const candidatos = U.$$('button, [role="button"], [role="tab"], input:not([type="hidden"]), select, textarea, .indicador', raiz)
      .filter((el) => !el.closest('#dica-flutuante') && !el.hasAttribute('data-dica-dispensada'));
    const faltantes = candidatos.filter((el) => !el.matches(SELETOR));
    if (C.DESENVOLVIMENTO) {
      if (faltantes.length) console.warn(`[${C.APP_NOME}] ${faltantes.length} controle(s) sem dica:`, faltantes);
      else console.info(`[${C.APP_NOME}] Auditoria de dicas: ${candidatos.length} controles, todos com dica.`);
    }
    return faltantes;
  };
})(window.Oratoria);
