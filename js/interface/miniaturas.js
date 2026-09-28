// js/interface/miniaturas.js — faixa inferior com a sequência de slides em miniatura (§5.1).
//
// Alimentada pela renderização completa ('previa:completa'): uma miniatura por seção, incluídas
// as continuações de tabelas paginadas. Cada miniatura leva data-origem (D32), o índice do slide
// no texto, que a liga ao editor.
//
//   • clique, Enter ou Espaço: leva o cursor do editor ao slide;
//   • setas ← →, Home, End: percorrem as miniaturas (tabulação itinerante: uma só parada de Tab);
//   • arrastar, ou Alt+← / Alt+→: reordena o slide no texto (D27; Ctrl+Z desfaz);
//   • o slide de título (origem 0) e o cabeçalho ficam fixos.
//
// Desempenho: o clone escalado de cada slide só é inserido quando a miniatura entra na área
// visível (IntersectionObserver); gráficos aparecem como moldura, sem desenho.

(function (O) {
  'use strict';

  const MI = (O.ui.miniaturas = {});
  const U = O.util;
  const E = O.estado;
  const S = O.slides;

  let lista = null;
  let contador = null;
  let observador = null;
  let focoPendente = null;  // origem a focar depois da próxima reconstrução (após reordenar)
  let arrastada = null;     // origem em arraste
  let proporcao = { largura: 1920, altura: 1080 };

  const TIPO_ARRASTE = 'application/x-apresenta-slide';
  const botoes = () => U.$$('.miniatura', lista);

  // ═══════════════════════════ Construção ═══════════════════════════

  function dimensoes() {
    const alturaUtil = Math.max(40, lista.clientHeight - 22);
    const h = Math.min(alturaUtil, 120);
    return { w: Math.round(h * proporcao.largura / proporcao.altura), h: Math.round(h) };
  }

  function preencher(botao) {
    const quadro = U.$('.miniatura-slide', botao);
    if (!quadro || quadro.firstChild || !botao._secao) return;
    const clone = botao._secao.cloneNode(true);
    clone.classList.add('o-miniatura');
    clone.removeAttribute('aria-label');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.transform = `scale(${quadro.clientHeight / proporcao.altura})`;
    quadro.append(clone);
  }

  function reconstruir(r) {
    if (!lista) return;
    proporcao = S.dimensoes(r.meta.proporcao);
    const rolagem = lista.scrollLeft;
    const atual = O.ui.previa.slideAtual();
    const focoDentro = lista.contains(document.activeElement);
    const origemFocada = focoDentro ? Number(document.activeElement.dataset.origem) : null;
    const { w, h } = dimensoes();
    if (observador) observador.disconnect();
    observador = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { if (e.isIntersecting) { preencher(e.target); observador.unobserve(e.target); } });
    }, { root: lista, rootMargin: '0px 300px' });

    const titulos = r.resultado.slides;
    const itens = r.secoes.map((secao, i) => {
      const origem = Number(secao.dataset.origem);
      const continuacao = secao.classList.contains('o-continuacao');
      const titulo = (titulos[origem] && titulos[origem].titulo) || O.rotulos.rotuloLayout(secao.dataset.layout);
      const fixo = origem === 0;
      const botao = U.el('button', {
        type: 'button', class: 'miniatura',
        'data-origem': origem, 'data-indice': i, draggable: fixo ? 'false' : 'true', tabindex: '-1',
        'aria-label': `Slide ${i + 1}: ${titulo}${continuacao ? ' (continuação)' : ''}`,
        'data-dica': fixo
          ? `Slide ${i + 1} · ${titulo}. Leva o cursor do editor a este slide. O slide de título fica sempre no início.`
          : `Slide ${i + 1} · ${titulo}${continuacao ? ' (continuação de tabela longa)' : ''}. Leva o cursor do editor a este slide. Arraste, ou use Alt+← e Alt+→, para mudar sua posição no texto (Ctrl+Z desfaz).`,
        'data-dica-posicao': 'acima',
        style: `--mini-w:${w}px;--mini-h:${h}px`,
      },
      U.el('span', { class: 'miniatura-numero', 'aria-hidden': 'true' }, String(i + 1)),
      U.el('span', { class: 'miniatura-slide', 'data-tema': r.meta.tema, 'aria-hidden': 'true' }));
      if (continuacao) botao.classList.add('miniatura-continuacao');
      botao._secao = secao;
      return botao;
    });
    lista.replaceChildren(...itens.map((b) => U.el('li', null, b)));
    itens.forEach((b) => observador.observe(b));
    lista.scrollLeft = rolagem;
    contador.textContent = itens.length ? `${itens.length} slide${itens.length > 1 ? 's' : ''}` : 'Nenhum slide';

    marcarAtual(atual, { rolar: false });
    const focar = focoPendente !== null ? focoPendente : origemFocada;
    focoPendente = null;
    const alvo = focar !== null ? itens.find((b) => Number(b.dataset.origem) === focar) : null;
    const itinerante = alvo || itens.find((b) => b.getAttribute('aria-current') === 'true') || itens[0];
    if (itinerante) itinerante.tabIndex = 0;
    if (alvo && (focoDentro || focar !== null)) { alvo.focus({ preventScroll: true }); alvo.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }

  function marcarAtual(origem, { rolar = true } = {}) {
    let primeiro = null;
    botoes().forEach((b) => {
      const sim = Number(b.dataset.origem) === origem;
      if (sim) { b.setAttribute('aria-current', 'true'); if (!primeiro) primeiro = b; } else b.removeAttribute('aria-current');
    });
    if (primeiro && rolar && !lista.contains(document.activeElement)) primeiro.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (primeiro && !lista.contains(document.activeElement)) {
      botoes().forEach((b) => { b.tabIndex = b === primeiro ? 0 : -1; });
    }
  }

  // ═══════════════════════════ Reordenação ═══════════════════════════

  /** Move o slide `de` para a posição `para` (índices do texto). */
  function mover(de, para) {
    const texto = O.ui.editor.texto();
    const r = O.conteudo.reordenarSlides(texto, de, para);
    if (!r) return false;
    focoPendente = para;
    O.ui.editor.aplicarTexto(r.texto);
    O.ui.editor.irParaLinha(r.linha, { focar: false });
    O.ui.anunciar(`Slide movido para a posição ${para + 1}. Ctrl+Z no editor desfaz.`);
    return true;
  }

  function limparMarcas() { botoes().forEach((b) => b.classList.remove('soltar-antes', 'soltar-depois')); }

  function destinoDoArraste(ev) {
    const alvo = ev.target.closest?.('.miniatura');
    if (!alvo || arrastada === null) return null;
    const t = Number(alvo.dataset.origem);
    const r = alvo.getBoundingClientRect();
    const depois = ev.clientX > r.left + r.width / 2;
    let para = depois ? (t >= arrastada ? t : t + 1) : (t > arrastada ? t - 1 : t);
    if (t === 0) para = 1;
    return { alvo, depois: t === 0 ? true : depois, para };
  }

  function iniciarArraste() {
    lista.addEventListener('dragstart', (ev) => {
      const b = ev.target.closest?.('.miniatura');
      if (!b || b.getAttribute('draggable') !== 'true') { ev.preventDefault(); return; }
      arrastada = Number(b.dataset.origem);
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData(TIPO_ARRASTE, String(arrastada));
      O.ui.dicas.ocultar();
      b.classList.add('arrastando');
    });
    lista.addEventListener('dragover', (ev) => {
      if (arrastada === null) return;
      const d = destinoDoArraste(ev);
      if (!d) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      limparMarcas();
      d.alvo.classList.add(d.depois ? 'soltar-depois' : 'soltar-antes');
    });
    lista.addEventListener('dragleave', (ev) => { if (!lista.contains(ev.relatedTarget)) limparMarcas(); });
    lista.addEventListener('drop', (ev) => {
      if (arrastada === null) return;
      ev.preventDefault();
      const d = destinoDoArraste(ev);
      limparMarcas();
      if (d && d.para !== arrastada) mover(arrastada, d.para);
      arrastada = null;
    });
    lista.addEventListener('dragend', () => {
      arrastada = null;
      limparMarcas();
      botoes().forEach((b) => b.classList.remove('arrastando'));
    });
  }

  // ═══════════════════════════ Teclado e clique ═══════════════════════════

  function aoTeclar(ev) {
    const b = ev.target.closest?.('.miniatura');
    if (!b) return;
    const todos = botoes();
    const i = todos.indexOf(b);
    const origem = Number(b.dataset.origem);
    if (ev.altKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      ev.preventDefault();
      if (origem === 0) { O.ui.anunciar('O slide de título fica sempre no início.'); return; }
      const para = origem + (ev.key === 'ArrowRight' ? 1 : -1);
      if (para < 1 || !mover(origem, para)) O.ui.anunciar('O slide já está no limite da sequência.');
      return;
    }
    let destino = null;
    if (ev.key === 'ArrowRight') destino = todos[Math.min(todos.length - 1, i + 1)];
    else if (ev.key === 'ArrowLeft') destino = todos[Math.max(0, i - 1)];
    else if (ev.key === 'Home') destino = todos[0];
    else if (ev.key === 'End') destino = todos[todos.length - 1];
    if (!destino) return;
    ev.preventDefault();
    todos.forEach((x) => { x.tabIndex = x === destino ? 0 : -1; });
    destino.focus();
    destino.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ═══════════════════════════ Início ═══════════════════════════

  MI.iniciar = function () {
    lista = U.$('#lista-miniaturas');
    contador = U.$('#miniaturas-contador');
    if (!lista) return;
    E.ouvir('previa:completa', reconstruir);
    E.ouvir('previa:slide', ({ indice }) => marcarAtual(indice));
    lista.addEventListener('click', (ev) => {
      const b = ev.target.closest?.('.miniatura');
      if (!b) return;
      botoes().forEach((x) => { x.tabIndex = x === b ? 0 : -1; });
      O.ui.previa.irParaSlide(Number(b.dataset.origem));
    });
    lista.addEventListener('keydown', aoTeclar);
    // Rolagem vertical do mouse percorre a faixa na horizontal
    lista.addEventListener('wheel', (ev) => {
      if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) { lista.scrollLeft += ev.deltaY; ev.preventDefault(); }
    }, { passive: false });
    iniciarArraste();
    let alturaAnterior = 0;
    new ResizeObserver(() => {
      if (Math.abs(lista.clientHeight - alturaAnterior) < 4) return;
      alturaAnterior = lista.clientHeight;
      const r = O.ui.previa.completa();
      if (r) reconstruir(r);
    }).observe(lista);
  };
})(window.Oratoria);
