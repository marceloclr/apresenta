// js/interface/previa.js — pré-visualização ao vivo do slide sob o cursor (§5.1) e
// renderização completa do projeto (D26).
//
// Duas velocidades:
//   • rápida (ATRASO_PREVIA_MS, 300 ms após a última alteração): interpreta o texto (com o cache
//     por slide do interpretador) e monta SOMENTE o slide sob o cursor, escalado ao espaço
//     disponível, com todos os fragmentos visíveis e gráficos desenhados;
//   • completa (ATRASO_RENDERIZACAO_MS, 1 s): O.slides.renderizar — montagem de todos os slides e
//     paginação de tabelas —, que alimenta miniaturas, indicadores e Conferência.
//
//   O.ui.previa.interpretacao()   → último resultado do interpretador (rápido)
//   O.ui.previa.completa()        → última renderização completa { meta, secoes, css, avisos, … }
//   O.ui.previa.slideAtual()      → índice (no texto) do slide sob o cursor
//   O.ui.previa.irParaSlide(i)    → leva o cursor do editor ao início do slide i
//   O.ui.previa.contexto()        → { resolverImagem, resolverArquivo, assinatura } do acervo
//
// Eventos: 'previa:interpretada' { r }, 'previa:slide' { indice, total }, 'previa:completa' r.
// O CSS dos slides (base + tema com ajustes) fica num único <style id="estilos-slides">, que
// também serve às miniaturas.

(function (O) {
  'use strict';

  const PV = (O.ui.previa = {});
  const S = O.slides;
  const U = O.util;
  const C = O.config;
  const E = O.estado;
  const I = O.conteudo;

  let palco = null;     // área disponível (letterbox)
  let raiz = null;      // contêiner na resolução de referência, escalado
  let vazio = null;
  let rotulo = null;
  let estilo = null;
  let graficos = null;
  let interpretacao = null;
  let completa = null;
  let indiceAtual = 0;
  let chaveMostrada = '';
  let cssAtual = '';
  let geracao = 0;
  let linhaCursor = 1;

  PV.interpretacao = () => interpretacao;
  PV.completa = () => completa;
  PV.slideAtual = () => indiceAtual;

  PV.contexto = function () {
    const acervo = E.obter('projeto.acervo') || {};
    return {
      resolverImagem: S.resolvedorDoAcervo(acervo),
      resolverArquivo: U.criarBuscaPorNome(acervo),
      assinatura: S.assinaturaAcervo(acervo),
    };
  };

  // ═══════════════════════════ Velocidade rápida ═══════════════════════════

  function interpretar() {
    const ctx = PV.contexto();
    interpretacao = I.interpretar(E.obter('projeto.markdown') || '', ctx);
    const css = S.cssSlides() + O.temas.gerarCss(interpretacao.meta.tema, E.obter('projeto.ajustesTema') || {});
    if (css !== cssAtual) { estilo.textContent = css; cssAtual = css; chaveMostrada = ''; }
    E.definir('projeto.temaId', interpretacao.meta.tema, { silencioso: true }); // espelho (D25)
    E.emitir('previa:interpretada', { r: interpretacao });
    mostrar();
  }

  function escalar() {
    if (!raiz || !interpretacao) return;
    const { largura, altura } = S.dimensoes(interpretacao.meta.proporcao);
    const w = palco.clientWidth;
    const h = palco.clientHeight;
    if (!w || !h) return;
    const s = Math.min(w / largura, h / altura);
    const x = Math.round((w - largura * s) / 2);
    const y = Math.round((h - altura * s) / 2);
    raiz.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }

  function mostrar() {
    if (!interpretacao || !raiz) return;
    const r = interpretacao;
    const total = r.slides.length;
    vazio.hidden = total > 0;
    raiz.hidden = total === 0;
    if (!total) {
      if (graficos) { graficos.destruir(); graficos = null; }
      raiz.replaceChildren();
      chaveMostrada = '';
      rotulo.textContent = 'Nenhum slide';
      E.emitir('previa:slide', { indice: 0, total: 0 });
      return;
    }
    indiceAtual = Math.max(0, Math.min(total - 1, I.slideDaLinha(r, linhaCursor)));
    const slide = r.slides[indiceAtual];
    O.ui.editor.marcarSlide(slide.linhaInicio, slide.linhaFim);
    const chave = `${indiceAtual}|${total}|${slide.html}|${slide.layout}|${slide.fundo}|${slide.classes.join(' ')}|${JSON.stringify(r.meta)}|${cssAtual.length}`;
    if (chave !== chaveMostrada) {
      chaveMostrada = chave;
      let ordinal = 0;
      for (let i = 0; i <= indiceAtual; i++) if (r.slides[i].layout === 'secao') ordinal++;
      const { largura, altura } = S.dimensoes(r.meta.proporcao);
      const secao = S.montarSlide(slide, { meta: r.meta, total, ordinalSecao: ordinal, resolverImagem: PV.contexto().resolverImagem });
      if (graficos) { graficos.destruir(); graficos = null; }
      palco.dataset.tema = r.meta.tema;
      raiz.dataset.tema = r.meta.tema;
      raiz.style.width = `${largura}px`;
      raiz.style.height = `${altura}px`;
      raiz.style.setProperty('--s-largura', `${largura}px`);
      raiz.style.setProperty('--s-altura', `${altura}px`);
      raiz.replaceChildren(secao);
      escalar();
      graficos = S.motorGraficos(raiz, { animar: false });
    }
    const layout = O.rotulos.rotuloLayout(slide.layout);
    rotulo.textContent = `Slide ${indiceAtual + 1} de ${total} · ${layout}`;
    E.definir('interface.slideAtual', indiceAtual);
    E.emitir('previa:slide', { indice: indiceAtual, total });
  }

  const agendarInterpretacao = U.debounce(interpretar, C.ATRASO_PREVIA_MS);

  // ═══════════════════════════ Velocidade completa ═══════════════════════════

  const agendarCompleta = U.debounce(async function () {
    const minha = ++geracao;
    try {
      const r = await S.renderizar(E.obter('projeto'));
      if (minha !== geracao) return;
      completa = r;
      E.emitir('previa:completa', r);
    } catch (e) {
      console.error(`[${C.APP_NOME}] renderização completa falhou:`, e);
    }
  }, C.ATRASO_RENDERIZACAO_MS);

  /** Força as duas renderizações sem esperar (abrir projeto, trocar tema). */
  PV.atualizarAgora = function () {
    agendarInterpretacao.cancelar();
    interpretar();
    agendarCompleta();
  };

  // ═══════════════════════════ Navegação ═══════════════════════════

  PV.irParaSlide = function (i, { focar = false } = {}) {
    const r = interpretacao;
    if (!r || !r.slides.length) return;
    const alvo = r.slides[Math.max(0, Math.min(r.slides.length - 1, i))];
    // Começo do conteúdo do slide (depois das linhas em branco iniciais), para o cursor cair nele
    let linha = alvo.linhaInicio;
    const t = O.ui.editor.texto().split('\n');
    while (linha < alvo.linhaFim && t[linha - 1] !== undefined && !t[linha - 1].trim()) linha++;
    O.ui.editor.irParaLinha(linha, { focar });
    if (!focar) { linhaCursor = linha; mostrar(); }
  };

  /** Índice, entre as seções da renderização completa, da primeira parte do slide `origem`. */
  PV.secaoDoSlide = function (origem) {
    if (!completa) return origem;
    const i = completa.secoes.findIndex((s) => Number(s.dataset.origem) === origem);
    return i < 0 ? 0 : i;
  };

  // ═══════════════════════════ Início ═══════════════════════════

  PV.iniciar = function () {
    palco = U.$('#previa-palco');
    raiz = U.$('#previa-raiz');
    vazio = U.$('#previa-vazio');
    rotulo = U.$('#previa-rotulo');
    estilo = document.getElementById('estilos-slides');
    if (!estilo) {
      estilo = U.el('style', { id: 'estilos-slides' });
      document.head.append(estilo);
    }
    raiz.classList.add('o-expandido'); // fragmentos visíveis na pré-visualização

    new ResizeObserver(() => { escalar(); if (graficos) graficos.atualizar(); }).observe(palco);

    E.observar('projeto.markdown', () => { agendarInterpretacao(); agendarCompleta(); });
    E.observar('projeto.acervo', () => { agendarInterpretacao(); agendarCompleta(); });
    E.observar('projeto.ajustesTema', () => { agendarInterpretacao(); agendarCompleta(); });
    E.ouvir('editor:cursor', ({ linha }) => { linhaCursor = linha; if (interpretacao) mostrar(); });

    U.$('#botao-previa-anterior')?.addEventListener('click', () => PV.irParaSlide(indiceAtual - 1));
    U.$('#botao-previa-proximo')?.addEventListener('click', () => PV.irParaSlide(indiceAtual + 1));

    // Fontes: a primeira medição precisa das fontes definitivas
    const pronto = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    pronto.then(() => PV.atualizarAgora());
  };
})(window.Oratoria);
