// js/slides/renderizador.js — encadeamento completo do projeto ao conjunto de slides, e a
// apresentação dentro do editor.
//
//   const r = await O.slides.renderizar(projeto);
//     → { meta, resultado, secoes, css, paginacao, avisos }
//   const ap = await O.slides.apresentar(projeto, { indice, telaCheia });  // sobreposição no editor
//
// Etapas: interpretação → CSS (slides + tema com ajustes) → montagem → medição e paginação
// de tabelas no hospedeiro fora da tela (após o carregamento das fontes). O mesmo resultado
// alimenta a pré-visualização (etapa 6) e a exportação (etapa 7).

(function (O) {
  'use strict';

  const S = O.slides;
  const U = O.util;

  /** Assinatura do acervo: muda quando algum arquivo entra, sai ou é substituído. */
  S.assinaturaAcervo = (acervo) => Object.keys(acervo || {}).sort().map((k) => `${k}:${acervo[k].bytes || (acervo[k].dataUrl || acervo[k].texto || '').length}`).join('|');

  S.renderizar = async function (projeto, opcoes = {}) {
    const acervo = projeto.acervo || {};
    const resolverImagem = S.resolvedorDoAcervo(acervo);
    const resolverArquivo = U.criarBuscaPorNome(acervo);
    const resultado = O.conteudo.interpretar(projeto.markdown || '', { resolverImagem, resolverArquivo, assinatura: S.assinaturaAcervo(acervo) });
    const meta = resultado.meta;
    const css = S.cssSlides() + O.temas.gerarCss(meta.tema, projeto.ajustesTema || {});
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const palco = S.hospedeDeMedicao(css, meta.tema, meta.proporcao);
    const montadas = S.montarTodos(resultado, { resolverImagem });
    const pag = opcoes.paginar === false ? { secoes: montadas, ocorrencias: [] } : O.conteudo.tabelas.paginar(montadas, palco);
    const avisos = resultado.avisos.concat(pag.ocorrencias.map((o) => ({
      gravidade: 'info', codigo: o.acao === 'dividida' ? 'tabela-dividida' : 'tabela-reduzida', slide: o.slide, linha: null,
      mensagem: o.acao === 'dividida'
        ? `Tabela "${o.titulo}" (${o.linhas} linhas) dividida em ${o.partes} slides, com fonte de ${o.fonte} px.`
        : `Tabela "${o.titulo}" teve a fonte reduzida para ${o.fonte} px para caber no slide.`,
    })));
    return { meta, resultado, secoes: pag.secoes, css, paginacao: pag.ocorrencias, avisos };
  };

  let ativa = null;

  /** Apresenta o projeto numa sobreposição de tela inteira dentro do editor. */
  S.apresentar = async function (projeto, opcoes = {}) {
    if (ativa) ativa.encerrar();
    const retornoFoco = document.activeElement;
    const r = await S.renderizar(projeto);
    const { largura, altura } = S.dimensoes(r.meta.proporcao);
    const camada = document.createElement('div');
    camada.className = 'o-sobreposicao-apresentacao';
    camada.style.cssText = 'position:fixed;inset:0;z-index:2000;background:#000';
    camada.dataset.tema = r.meta.tema;
    const estilo = document.createElement('style');
    estilo.textContent = r.css;
    const raiz = document.createElement('div');
    raiz.dataset.tema = r.meta.tema;
    raiz.style.cssText = `--s-largura:${largura}px;--s-altura:${altura}px`;
    r.secoes.forEach((s) => raiz.append(s));
    camada.append(estilo, raiz);
    document.body.append(camada);

    const motor = S.motorSlides(raiz, {
      largura, altura, indice: opcoes.indice || 0, hash: false,
      transicao: r.meta.transicao, titulo: r.meta.titulo || O.config.APP_NOME,
      apresentador: S.motorApresentador, graficos: S.motorGraficos,
      aoMudar: opcoes.aoMudar, sair: () => encerrar(),
    });
    raiz.focus();
    if (opcoes.telaCheia && raiz.requestFullscreen) raiz.requestFullscreen().catch(() => {});

    function encerrar() {
      motor.destruir();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      camada.remove();
      ativa = null;
      if (retornoFoco && retornoFoco.focus) retornoFoco.focus();
      O.estado.emitir('apresentacao:encerrada', { indice: motor.atual() });
    }
    ativa = { motor, encerrar, renderizacao: r };
    O.estado.emitir('apresentacao:iniciada', { total: motor.total });
    return ativa;
  };
})(window.Oratoria);
