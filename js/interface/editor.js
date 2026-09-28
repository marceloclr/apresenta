// js/interface/editor.js — editor de Markdown: <textarea> com uma camada <pre> de realce
// sobreposta (numeração de linhas e destaque simples de sintaxe, §5.1).
//
//   O.ui.editor.iniciar()
//   O.ui.editor.texto()                              → conteúdo atual
//   O.ui.editor.aplicarTexto(novo)                   → substitui só o trecho alterado (desfazível)
//   O.ui.editor.substituir(inicio, fim, texto)       → edição por posição (desfazível)
//   O.ui.editor.inserirNoCursor(texto, { bloco })    → insere no cursor; bloco = entre linhas em branco
//   O.ui.editor.irParaLinha(n, { focar })            → move o cursor e rola até a linha
//   O.ui.editor.linhaAtual() · linhaDe(pos) · inicioDaLinha(n) · linhas(inicio, fim)
//
// Toda alteração feita pela interface passa por document.execCommand('insertText'), que
// mantém a pilha de desfazer do navegador (Ctrl+Z); sem suporte, recorre a setRangeText.
// O texto é espelhado em O.estado 'projeto.markdown'; carregamentos externos (abrir arquivo,
// exemplo, retomar) chegam pelo observador e substituem o conteúdo sem passar pelo desfazer.
//
// Alinhamento das camadas: ambas usam a mesma fonte, o mesmo recuo e a mesma quebra de linha
// (pre-wrap); a largura da barra de rolagem do <textarea> é compensada no <pre>, e a rolagem é
// espelhada. Cada linha lógica é um bloco na camada de realce, numerado por contador CSS.

(function (O) {
  'use strict';

  const ED = (O.ui.editor = {});
  const U = O.util;
  const C = O.config;
  const E = O.estado;

  let area = null;      // <textarea>
  let realce = null;    // <pre>
  let quadro = null;
  let posicao = null;   // indicador "Linha x, coluna y"
  let tabLivre = false; // Esc seguido de Tab: o foco sai do editor
  let intervaloSlide = [0, 0]; // linhas (1-based) do slide sob o cursor, destacadas na calha
  let ultimaLinha = 0;
  let quadroPendente = 0;

  // ═══════════════════════════════ Realce ═══════════════════════════════

  const esc = U.escaparHtml;
  const INLINE = /(!\[[^\]\n]*\]\([^)\n]*\))|(\[[^\]\n]+\]\([^)\n]*\))|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s\n][^*\n]*\*)|(\{[.#][^{}\n]*\})/g;

  function realcarInline(linha) {
    let saida = '';
    let desde = 0;
    let corpo = linha;
    const marcador = linha.match(/^(\s*)([-*+]|\d{1,3}[.)])(\s+)/);
    if (marcador) {
      saida += `${esc(marcador[1])}<span class="r-marcador">${esc(marcador[2])}</span>${esc(marcador[3])}`;
      corpo = linha.slice(marcador[0].length);
    } else if (/^\s*>/.test(linha)) {
      const m = linha.match(/^(\s*>+)/);
      saida += `<span class="r-citacao">${esc(m[1])}</span>`;
      corpo = linha.slice(m[1].length);
    }
    INLINE.lastIndex = 0;
    let m;
    while ((m = INLINE.exec(corpo))) {
      saida += esc(corpo.slice(desde, m.index));
      const classe = m[1] ? 'r-imagem' : m[2] ? 'r-link' : m[3] ? 'r-codigo-inline' : m[4] ? 'r-forte' : m[5] ? 'r-enfase' : 'r-atributos';
      saida += `<span class="${classe}">${esc(m[0])}</span>`;
      desde = m.index + m[0].length;
    }
    return saida + esc(corpo.slice(desde));
  }

  function realcarTabela(linha) {
    return esc(linha).replace(/(^|[^\\])\|/g, '$1<span class="r-tabela">|</span>');
  }

  /** HTML da camada de realce: um bloco por linha lógica. */
  function htmlRealce(texto) {
    const linhas = texto.split('\n');
    let fimFm = -1;
    if (/^﻿?---[ \t]*$/.test(linhas[0] || '')) {
      for (let i = 1; i < linhas.length; i++) if (/^---[ \t]*$/.test(linhas[i])) { fimFm = i; break; }
    }
    let cerca = null;
    const partes = new Array(linhas.length);
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      let classe = 'l';
      let html;
      if (i <= fimFm) {
        classe += ' r-fm';
        const kv = l.match(/^(\s*[\w-]+)(\s*:)(.*)$/);
        html = (i === 0 || i === fimFm) ? `<span class="r-separador-texto">${esc(l)}</span>`
          : kv ? `<span class="r-chave">${esc(kv[1])}</span>${esc(kv[2])}<span class="r-valor">${esc(kv[3])}</span>` : esc(l);
      } else if (cerca) {
        const fecha = l.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (fecha && fecha[1][0] === cerca[0] && fecha[1].length >= cerca.length) { cerca = null; classe += ' r-cerca'; } else classe += ' r-codigo';
        html = esc(l);
      } else if (/^ {0,3}(`{3,}|~{3,})/.test(l)) {
        cerca = l.match(/^ {0,3}(`{3,}|~{3,})/)[1];
        classe += ' r-cerca';
        const m = l.match(/^(\s*[`~]+)(.*)$/);
        html = `${esc(m[1])}<span class="r-info">${esc(m[2])}</span>`;
      } else if (/^---[ \t]*$/.test(l)) {
        classe += ' r-separador';
        html = esc(l);
      } else if (/^\s{0,3}#{1,6}\s/.test(l)) {
        classe += ' r-titulo';
        html = esc(l);
      } else if (/^\s*<!--.*-->\s*$/.test(l)) {
        classe += ' r-diretiva';
        html = esc(l);
      } else if (/^\s*:{3,}/.test(l)) {
        classe += ' r-conteiner';
        html = esc(l);
      } else if (/^\s*\|/.test(l)) {
        html = realcarTabela(l);
      } else if (/^\s*\{[^{}]*\}\s*$/.test(l)) {
        html = `<span class="r-atributos">${esc(l)}</span>`;
      } else {
        html = realcarInline(l);
      }
      const numero = i + 1;
      if (numero === ultimaLinha) classe += ' atual';
      if (numero >= intervaloSlide[0] && numero <= intervaloSlide[1]) classe += ' no-slide';
      partes[i] = `<div class="${classe}">${html || ' '}</div>`;
    }
    return partes.join('');
  }

  function redesenhar() {
    quadroPendente = 0;
    const digitos = String(area.value.split('\n').length).length;
    quadro.style.setProperty('--editor-calha', `calc(${Math.max(2, digitos)}ch + 26px)`);
    realce.innerHTML = htmlRealce(area.value);
    sincronizarGeometria();
  }
  const agendarRedesenho = () => { if (!quadroPendente) quadroPendente = requestAnimationFrame(redesenhar); };

  function sincronizarGeometria() {
    const barra = area.offsetWidth - area.clientWidth;
    realce.style.setProperty('--editor-barra', `${barra}px`);
    realce.scrollTop = area.scrollTop;
    realce.scrollLeft = area.scrollLeft;
  }

  // ═══════════════════════════════ Posições ═══════════════════════════════

  ED.texto = () => (area ? area.value : '');
  ED.linhaDe = (pos) => { let n = 1; const t = area.value; for (let i = 0; i < pos && i < t.length; i++) if (t.charCodeAt(i) === 10) n++; return n; };
  ED.inicioDaLinha = function (n) {
    const t = area.value;
    let pos = 0;
    for (let linha = 1; linha < n; linha++) {
      const i = t.indexOf('\n', pos);
      if (i < 0) return t.length;
      pos = i + 1;
    }
    return pos;
  };
  ED.fimDaLinha = (n) => { const i = area.value.indexOf('\n', ED.inicioDaLinha(n)); return i < 0 ? area.value.length : i; };
  ED.linhaAtual = () => (area ? ED.linhaDe(area.selectionStart) : 1);
  /** Texto das linhas [inicio, fim] (1-based, inclusivas). */
  ED.linhas = (inicio, fim) => area.value.slice(ED.inicioDaLinha(inicio), ED.fimDaLinha(fim));

  function informarCursor() {
    const pos = area.selectionStart;
    const linha = ED.linhaDe(pos);
    const coluna = pos - ED.inicioDaLinha(linha) + 1;
    if (posicao) posicao.textContent = `Linha ${linha}, coluna ${coluna}`;
    if (linha !== ultimaLinha) {
      ultimaLinha = linha;
      agendarRedesenho();
      E.emitir('editor:cursor', { linha, coluna });
    }
  }

  /** Destaca na calha as linhas do slide sob o cursor (chamado pela pré-visualização). */
  ED.marcarSlide = function (inicio, fim) {
    if (intervaloSlide[0] === inicio && intervaloSlide[1] === fim) return;
    intervaloSlide = [inicio, fim];
    agendarRedesenho();
  };

  /** Rola o editor até a linha n, deixando-a no terço superior. */
  function rolarAte(n) {
    const bloco = realce.children[n - 1];
    if (!bloco) return;
    const topo = bloco.offsetTop;
    if (topo < area.scrollTop + 24 || topo > area.scrollTop + area.clientHeight - 48) {
      area.scrollTop = Math.max(0, topo - area.clientHeight / 3);
      sincronizarGeometria();
    }
  }

  ED.irParaLinha = function (n, { focar = true } = {}) {
    if (!area) return;
    const pos = ED.inicioDaLinha(Math.max(1, n));
    if (focar) area.focus({ preventScroll: true });
    area.setSelectionRange(pos, pos);
    if (quadroPendente) { cancelAnimationFrame(quadroPendente); redesenhar(); }
    rolarAte(Math.max(1, n));
    informarCursor();
  };

  // ═══════════════════════════════ Edição ═══════════════════════════════

  /**
   * Substitui o trecho [inicio, fim) por `texto`, preservando o desfazer. `selecao`:
   * 'fim' (cursor após o texto, padrão), 'tudo' (seleciona o inserido) ou um número (posição).
   * O foco volta ao elemento que o detinha, salvo `focarEditor`.
   */
  ED.substituir = function (inicio, fim, texto, { selecao = 'fim', focarEditor = false } = {}) {
    const anterior = document.activeElement;
    const rolagem = area.scrollTop;
    area.focus({ preventScroll: true });
    area.setSelectionRange(inicio, fim);
    let feito = false;
    try {
      feito = texto === '' ? (inicio === fim || document.execCommand('delete', false)) : document.execCommand('insertText', false, texto);
    } catch (_) { feito = false; }
    if (!feito) {
      area.setRangeText(texto, inicio, fim, 'end');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (selecao === 'tudo') area.setSelectionRange(inicio, inicio + texto.length);
    else if (typeof selecao === 'number') area.setSelectionRange(selecao, selecao);
    area.scrollTop = rolagem;
    if (!focarEditor && anterior && anterior !== area && anterior.isConnected && anterior.focus) anterior.focus({ preventScroll: true });
    informarCursor();
    rolarAte(ED.linhaAtual());
  };

  /**
   * Aplica um texto completo novo alterando apenas o trecho que difere (prefixo e sufixo
   * comuns preservados): o desfazer fica granular e a rolagem não salta.
   */
  ED.aplicarTexto = function (novo, opcoes = {}) {
    const atual = area.value;
    if (novo === atual) return;
    let i = 0;
    const max = Math.min(atual.length, novo.length);
    while (i < max && atual.charCodeAt(i) === novo.charCodeAt(i)) i++;
    let j = 0;
    while (j < max - i && atual.charCodeAt(atual.length - 1 - j) === novo.charCodeAt(novo.length - 1 - j)) j++;
    const fimAntigo = atual.length - j;
    const trecho = novo.slice(i, novo.length - j);
    if (opcoes.preservarCursor) {
      // O cursor fica onde estava no texto (deslocado se a mudança ocorreu antes dele)
      const pos = area.selectionStart;
      const destino = pos >= fimAntigo ? pos + trecho.length - (fimAntigo - i) : pos <= i ? pos : i + trecho.length;
      const rolagem = area.scrollTop;
      ED.substituir(i, fimAntigo, trecho, Object.assign({}, opcoes, { selecao: destino }));
      area.scrollTop = rolagem;
      sincronizarGeometria();
      return;
    }
    ED.substituir(i, fimAntigo, trecho, opcoes);
  };

  /**
   * Insere no cursor. Com `bloco`, garante linha em branco antes e depois (blocos Markdown).
   * `cursor`: deslocamento, dentro do texto inserido, onde o cursor deve ficar.
   */
  ED.inserirNoCursor = function (texto, { bloco = false, cursor = null, focarEditor = true } = {}) {
    const inicio = area.selectionStart;
    const fim = area.selectionEnd;
    let t = texto;
    let deslocamento = 0;
    if (bloco) {
      const antes = area.value.slice(0, inicio);
      const depois = area.value.slice(fim);
      const prefixo = !antes || /\n\n$/.test(antes) ? '' : /\n$/.test(antes) ? '\n' : '\n\n';
      const sufixo = /^\n\n/.test(depois) ? '' : /^\n/.test(depois) ? '\n' : depois ? '\n\n' : '\n';
      t = prefixo + texto.replace(/\n+$/, '') + sufixo;
      deslocamento = prefixo.length;
    }
    const alvo = cursor === null ? null : inicio + deslocamento + cursor;
    ED.substituir(inicio, fim, t, { selecao: alvo === null ? 'fim' : alvo, focarEditor });
  };

  /** Insere `texto` como novo slide logo após o slide que termina na linha `linhaFim`. */
  ED.inserirAposLinha = function (linhaFim, texto, { cursor = null } = {}) {
    const pos = ED.fimDaLinha(linhaFim);
    const antes = area.value.slice(0, pos);
    const prefixo = (/\n\s*$/.test(antes) || !antes ? '' : '\n') + '\n---\n';
    const t = prefixo + texto.replace(/\n+$/, '') + '\n';
    const alvo = cursor === null ? pos + prefixo.length : pos + prefixo.length + cursor;
    ED.substituir(pos, pos, t, { selecao: alvo, focarEditor: true });
  };

  // ═══════════════════════════════ Teclado ═══════════════════════════════

  function aoTeclar(ev) {
    if (ev.key === 'Escape') {
      tabLivre = true;
      O.ui.anunciar('Tab agora leva o foco para fora do editor.');
      return;
    }
    if (ev.key === 'Tab' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      if (tabLivre) { tabLivre = false; return; }
      ev.preventDefault();
      const recuo = C.EDITOR_RECUO;
      const linha = ED.linhaAtual();
      const inicioLinha = ED.inicioDaLinha(linha);
      if (ev.shiftKey) {
        const atual = area.value.slice(inicioLinha, inicioLinha + recuo.length);
        const remover = atual.length - atual.replace(/^ +/, '').length;
        if (remover) ED.substituir(inicioLinha, inicioLinha + remover, '', { selecao: Math.max(inicioLinha, area.selectionStart - remover), focarEditor: true });
      } else {
        ED.substituir(area.selectionStart, area.selectionEnd, recuo, { focarEditor: true });
      }
      return;
    }
    tabLivre = false;
  }

  // ═══════════════════════════════ Início ═══════════════════════════════

  ED.iniciar = function () {
    area = U.$('#editor-texto');
    realce = U.$('#editor-realce');
    quadro = U.$('#editor-quadro');
    posicao = U.$('#editor-posicao');
    if (!area || !realce) return;

    area.value = E.obter('projeto.markdown') || '';
    area.addEventListener('input', () => {
      E.definir('projeto.markdown', area.value);
      agendarRedesenho();
      informarCursor();
    });
    area.addEventListener('scroll', sincronizarGeometria, { passive: true });
    area.addEventListener('keydown', aoTeclar);
    area.addEventListener('keyup', informarCursor);
    area.addEventListener('pointerup', informarCursor);
    area.addEventListener('focus', informarCursor);
    document.addEventListener('selectionchange', () => { if (document.activeElement === area) informarCursor(); });
    new ResizeObserver(() => sincronizarGeometria()).observe(area);

    // Carregamentos externos (abrir, exemplo, retomar, projeto importado)
    E.observar('projeto.markdown', (valor) => {
      const v = valor || '';
      if (v === area.value) return;
      area.value = v;
      area.setSelectionRange(0, 0);
      area.scrollTop = 0;
      ultimaLinha = 0;
      redesenhar();
      informarCursor();
    });

    redesenhar();
    informarCursor();
  };

  ED.focar = () => area && area.focus();
  ED.elemento = () => area;
})(window.Oratoria);
