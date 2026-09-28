// js/interface/painel-tema.js — aba Tema (§5.2, §6.6): escolha do modelo, ajustes finos e
// comparação lado a lado com o slide atual.
//
// Onde cada escolha é gravada (D25):
//   • no cabeçalho do texto (front-matter): tema, proporção, transição, rodapé, numeração e
//     logotipo — o .md continua autossuficiente; alteração desfazível com Ctrl+Z;
//   • em projeto.ajustesTema: cor de acento, grade de fundo (ligada e intensidade) e escala
//     tipográfica — sobreposições de variáveis que não criam tema novo;
//   • em projeto.opcoes: minutos por slide (indicador de duração).
//
//   O.ui.tema.iniciar()

(function (O) {
  'use strict';

  const TM = (O.ui.tema = {});
  const U = O.util;
  const C = O.config;
  const E = O.estado;
  const R = O.rotulos;
  const T = O.temas;

  let meta = {};
  let comparacaoAberta = false;
  let estiloComparacao = null;

  const ajustes = () => E.obter('projeto.ajustesTema') || {};
  const definirAjuste = (fn) => E.atualizar('projeto.ajustesTema', (a) => fn(Object.assign({}, a || {})));

  /** Grava uma chave do cabeçalho do texto (desfazível). */
  function definirMeta(chave, valor) {
    const novo = O.conteudo.definirMeta(O.ui.editor.texto(), chave, valor);
    O.ui.editor.aplicarTexto(novo, { preservarCursor: true });
  }

  // ═══════════════════════════ Modelos ═══════════════════════════

  function amostras(tema) {
    const v = T.aplicarAjustes(tema.id, {}).variaveis;
    return ['--s-fundo', '--s-superficie', '--s-texto', '--s-acento', '--s-grafico-2', '--s-grafico-3']
      .map((k) => U.el('span', { class: 'amostra', style: `background:${v[k]}`, title: `${k}: ${v[k]}` }));
  }

  function montarModelos() {
    const alvo = U.$('#lista-modelos');
    if (!alvo) return;
    alvo.replaceChildren(...T.lista().map((tema) => {
      const radio = U.el('input', {
        type: 'radio', name: 'modelo-tema', value: tema.id, class: 'sr-only',
        'data-dica': `${tema.nome}: ${tema.descricao} Recomendado para: ${tema.recomendacao} Grava "tema: ${tema.id}" no cabeçalho do texto (Ctrl+Z desfaz).`,
      });
      radio.addEventListener('change', () => { if (radio.checked) { definirMeta('tema', tema.id); O.ui.anunciar(`Tema ${tema.nome} aplicado.`); } });
      return U.el('label', { class: 'modelo', 'data-tema-id': tema.id },
        radio,
        U.el('span', { class: 'modelo-topo' },
          U.el('strong', null, tema.nome),
          U.el('span', { class: 'selo', 'data-estado': tema.ambiente === 'escuro' ? 'pendente' : 'ok' }, R.rotuloAmbiente(tema.ambiente))),
        U.el('span', { class: 'modelo-amostras', 'aria-hidden': 'true' }, ...amostras(tema)),
        U.el('span', { class: 'modelo-descricao' }, tema.recomendacao || tema.descricao));
    }));
  }

  function refletirModelo() {
    U.$$('#lista-modelos input[type="radio"]').forEach((r) => {
      r.checked = r.value === meta.tema;
      r.closest('.modelo').classList.toggle('modelo-ativo', r.checked);
    });
  }

  // ═══════════════════════════ Ajustes finos ═══════════════════════════

  function iniciarAjustes() {
    const acento = U.$('#campo-acento');
    const restaurarAcento = U.$('#botao-acento-modelo');
    const grade = U.$('#campo-grade');
    const intensidade = U.$('#campo-grade-intensidade');
    const escala = U.$('#campo-escala');
    const proporcao = U.$('#campo-proporcao');
    const transicao = U.$('#campo-transicao');
    const rodape = U.$('#campo-rodape');
    const numeracao = U.$('#campo-numeracao');
    const logotipo = U.$('#campo-logotipo');
    const minutos = U.$('#campo-minutos');

    proporcao.replaceChildren(...Object.entries(R.ROTULO_PROPORCAO).map(([k, v]) => U.el('option', { value: k }, v)));
    transicao.replaceChildren(...Object.entries(R.ROTULO_TRANSICAO).map(([k, v]) => U.el('option', { value: k }, v)));

    acento.addEventListener('input', U.debounce(() => definirAjuste((a) => Object.assign(a, { acento: acento.value })), 120));
    restaurarAcento.addEventListener('click', () => { definirAjuste((a) => { delete a.acento; return a; }); O.ui.anunciar('Cor de acento do modelo restaurada.'); });
    grade.addEventListener('change', () => definirAjuste((a) => Object.assign(a, { grade: Object.assign({}, a.grade, { ativa: grade.checked }) })));
    intensidade.addEventListener('input', () => {
      U.$('#saida-grade').textContent = `${intensidade.value}%`;
      definirAjuste((a) => Object.assign(a, { grade: Object.assign({}, a.grade, { intensidade: Number(intensidade.value) / 100 }) }));
    });
    escala.addEventListener('input', () => {
      U.$('#saida-escala').textContent = `${escala.value}%`;
      definirAjuste((a) => Object.assign(a, { escala: Number(escala.value) / 100 }));
    });
    proporcao.addEventListener('change', () => definirMeta('proporcao', proporcao.value));
    transicao.addEventListener('change', () => definirMeta('transicao', transicao.value));
    numeracao.addEventListener('change', () => definirMeta('numeracao', numeracao.checked));
    logotipo.addEventListener('change', () => definirMeta('logotipo', logotipo.value || null));
    const gravarRodape = U.debounce(() => definirMeta('rodape', rodape.value.trim() || null), 600);
    rodape.addEventListener('input', () => {
      if (/[\r\n]/.test(rodape.value)) rodape.value = rodape.value.replace(/[\r\n]+/g, ' ');
      gravarRodape();
    });
    rodape.addEventListener('blur', () => gravarRodape.agora());
    minutos.addEventListener('input', () => {
      minutos.value = minutos.value.replace(/[^\d.,]/g, '');
      const [min, max] = C.MINUTOS_POR_SLIDE_LIMITES;
      const v = U.lerNumero(minutos.value);
      const valido = Number.isFinite(v) && v >= min && v <= max;
      minutos.setAttribute('aria-invalid', valido ? 'false' : 'true');
      U.$('#ajuda-minutos').textContent = valido ? '' : `Informe um valor entre ${U.formatarDecimal(min)} e ${U.formatarDecimal(max)}.`;
      if (valido) E.atualizar('projeto.opcoes', (o) => Object.assign({}, o, { minutosPorSlide: v }));
    });
    U.$('#botao-restaurar-tema')?.addEventListener('click', () => {
      E.definir('projeto.ajustesTema', {});
      O.ui.notificar('Acento, grade e escala voltaram ao padrão do modelo.', { gravidade: 'ok' });
    });
  }

  /** Reflete estado e cabeçalho nos controles, sem mexer no que está sendo editado. */
  function refletirAjustes() {
    const ativo = document.activeElement;
    const def = (el, fn) => { if (el && el !== ativo) fn(el); };
    const tema = T.obter(meta.tema);
    if (!tema) return;
    const a = ajustes();
    const aplicado = T.aplicarAjustes(tema.id, a);
    const v = aplicado.variaveis;
    def(U.$('#campo-acento'), (el) => { el.value = U.corHex(U.lerCor(a.acento || v['--s-acento']) || { r: 0, g: 0, b: 0 }); });
    const correcao = aplicado.correcoes[0];
    const nota = U.$('#nota-acento');
    if (correcao) {
      nota.textContent = `Para manter o contraste AA, links e textos em cor usam ${correcao.ajustada} (${U.formatarRazao(correcao.razao)}, antes ${U.formatarRazao(correcao.razaoOriginal)}).`;
      O.ui.dicas.definir(nota, { texto: 'O acento escolhido não atingia 4,5:1 contra o fundo ou a superfície do tema; a variante mais escura (tema claro) ou mais clara (tema escuro) preserva o matiz e garante a leitura.', formula: 'razão = (L₁ + 0,05) ÷ (L₂ + 0,05)' });
    } else {
      nota.textContent = a.acento ? 'O acento escolhido atende ao contraste AA.' : 'Cor de acento do modelo.';
    }
    def(U.$('#campo-grade'), (el) => { el.checked = aplicado.gradeAtiva; });
    const intens = Math.round(((a.grade && Number.isFinite(a.grade.intensidade)) ? a.grade.intensidade : 1) * 100);
    def(U.$('#campo-grade-intensidade'), (el) => { el.value = String(intens); });
    U.$('#saida-grade').textContent = `${intens}%`;
    const esc = Math.round((Number.isFinite(a.escala) ? a.escala : 1) * 100);
    def(U.$('#campo-escala'), (el) => { el.value = String(esc); });
    U.$('#saida-escala').textContent = `${esc}%`;
    def(U.$('#campo-proporcao'), (el) => { el.value = meta.proporcao; });
    def(U.$('#campo-transicao'), (el) => { el.value = meta.transicao; });
    def(U.$('#campo-rodape'), (el) => { el.value = meta.rodape || ''; });
    def(U.$('#campo-numeracao'), (el) => { el.checked = !!meta.numeracao; });
    def(U.$('#campo-logotipo'), (el) => {
      const imagens = Object.values(E.obter('projeto.acervo') || {}).filter((i) => i.tipo === 'imagem');
      const atual = meta.logotipo ? String(meta.logotipo) : '';
      el.replaceChildren(U.el('option', { value: '' }, 'Nenhum'),
        ...imagens.map((i) => U.el('option', { value: i.nome }, i.nome)),
        atual && !imagens.some((i) => i.nome === atual) ? U.el('option', { value: atual }, `${atual} (ausente do acervo)`) : null);
      el.value = atual;
    });
    def(U.$('#campo-minutos'), (el) => { el.value = U.formatarDecimal(E.obter('projeto.opcoes.minutosPorSlide') || C.MINUTOS_POR_SLIDE, 2); });
  }

  // ═══════════════════════════ Comparação ═══════════════════════════

  function montarComparacao() {
    const alvo = U.$('#comparacao-modelos');
    const r = O.ui.previa.interpretacao();
    if (!alvo || !comparacaoAberta) return;
    if (!r || !r.slides.length) { alvo.replaceChildren(U.el('p', { class: 'cartao-nota' }, 'Escreva ou abra um texto para comparar os modelos.')); return; }
    const a = ajustes();
    const css = O.slides.cssSlides() + T.lista().map((t) => T.gerarCss(t.id, a)).join('\n');
    if (!estiloComparacao) { estiloComparacao = U.el('style', { id: 'estilos-comparacao' }); document.head.append(estiloComparacao); }
    if (estiloComparacao.textContent !== css) estiloComparacao.textContent = css;
    const i = O.ui.previa.slideAtual();
    const slide = r.slides[i];
    const { largura, altura } = O.slides.dimensoes(r.meta.proporcao);
    const resolverImagem = O.ui.previa.contexto().resolverImagem;
    let ordinal = 0;
    for (let k = 0; k <= i; k++) if (r.slides[k].layout === 'secao') ordinal++;
    alvo.replaceChildren(...T.lista().map((tema) => {
      const secao = O.slides.montarSlide(slide, { meta: Object.assign({}, r.meta, { tema: tema.id }), total: r.slides.length, ordinalSecao: ordinal, resolverImagem });
      secao.classList.add('o-miniatura');
      const quadro = U.el('span', { class: 'comparacao-quadro', 'data-tema': tema.id, style: `--s-largura:${largura}px;--s-altura:${altura}px;aspect-ratio:${largura}/${altura}` }, secao);
      const botao = U.el('button', {
        type: 'button', class: `comparacao-item${tema.id === r.meta.tema ? ' modelo-ativo' : ''}`,
        'data-dica': `Aplica o modelo ${tema.nome} (${R.rotuloAmbiente(tema.ambiente).toLowerCase()}). ${tema.recomendacao}`,
        onclick: () => { definirMeta('tema', tema.id); O.ui.anunciar(`Tema ${tema.nome} aplicado.`); },
      }, quadro, U.el('span', { class: 'comparacao-nome' }, tema.nome));
      requestAnimationFrame(() => { secao.style.transform = `scale(${quadro.clientWidth / largura})`; });
      return botao;
    }));
  }

  // ═══════════════════════════ Início ═══════════════════════════

  TM.iniciar = function () {
    if (!U.$('#painel-tema')) return;
    montarModelos();
    iniciarAjustes();
    const botaoComparar = U.$('#botao-comparar');
    botaoComparar?.addEventListener('click', () => {
      comparacaoAberta = !comparacaoAberta;
      botaoComparar.textContent = comparacaoAberta ? 'Ocultar comparação' : 'Comparar com o slide atual';
      botaoComparar.setAttribute('aria-expanded', String(comparacaoAberta));
      const alvo = U.$('#comparacao-modelos');
      alvo.hidden = !comparacaoAberta;
      if (comparacaoAberta) montarComparacao(); else alvo.replaceChildren();
    });
    const atualizarComparacao = U.debounce(montarComparacao, 200);
    E.ouvir('previa:interpretada', ({ r }) => { meta = r.meta; refletirModelo(); refletirAjustes(); atualizarComparacao(); });
    E.ouvir('previa:slide', () => atualizarComparacao());
    E.observar('projeto.ajustesTema', () => { refletirAjustes(); atualizarComparacao(); });
    E.observar('projeto.opcoes', refletirAjustes);
    E.observar('projeto.acervo', refletirAjustes);
    E.ouvir('temas:registrado', montarModelos);
  };
})(window.Oratoria);
