// js/slides/composicao.js — monta o elemento <section> de cada slide a partir do resultado
// do interpretador: aplica o layout (e seu preparo estrutural), fundo, classes, rodapé,
// numeração, logotipo e atributos de acessibilidade.
//
//   const secao = O.slides.montarSlide(slide, { meta, total, ordinalSecao, resolverImagem });
//   const secoes = O.slides.montarTodos(resultadoDoInterpretador, { resolverImagem });
//
// O resultado é um elemento DOM (pré-visualização) cujo outerHTML serve à exportação.

(function (O) {
  'use strict';

  const S = O.slides;
  const U = O.util;

  /**
   * @param slide   item de resultado.slides do interpretador
   * @param ctx     { meta, total, ordinalSecao, resolverImagem(nome) → { src, alt? } | null, documento? }
   */
  S.montarSlide = function (slide, ctx = {}) {
    const doc = ctx.documento || document;
    const meta = ctx.meta || {};
    const secao = doc.createElement('section');
    const layout = O.layouts.obter(slide.layout);

    secao.className = ['o-slide', ...(slide.classes || [])].join(' ');
    secao.dataset.layout = layout.id;
    secao.dataset.indice = String(slide.indice);
    // Índice do slide no texto: sobrevive à paginação (as continuações são clones) e à
    // renumeração, e liga miniaturas e pré-visualização à posição no editor.
    secao.dataset.origem = String(slide.indice);
    if (slide.transicao) secao.dataset.transicao = slide.transicao;
    secao.setAttribute('aria-roledescription', 'slide');
    secao.setAttribute('aria-label', `Slide ${slide.indice + 1} de ${ctx.total || slide.indice + 1}`);

    // Fundo por diretiva <!-- fundo: arquivo.jpg -->
    if (slide.fundo) {
      const img = ctx.resolverImagem ? ctx.resolverImagem(slide.fundo) : null;
      const fundo = doc.createElement('div');
      fundo.className = 'o-fundo';
      if (img) {
        fundo.style.backgroundImage = `url("${img.src}")`;
        fundo.setAttribute('role', 'img');
        fundo.setAttribute('aria-label', img.alt || '');
      } else {
        fundo.classList.add('o-imagem-ausente');
        fundo.textContent = `Imagem de fundo não encontrada no acervo: ${slide.fundo}`;
      }
      secao.append(fundo);
    }

    const conteudo = doc.createElement('div');
    conteudo.className = 'o-conteudo';
    conteudo.innerHTML = slide.html; // já sanitizado pelo interpretador
    secao.append(conteudo);

    // Título do slide: primeiro h1 ou h2 de nível superior
    const titulo = conteudo.querySelector(':scope > h1, :scope > h2');
    if (titulo) titulo.classList.add('o-titulo');

    if (typeof layout.preparar === 'function') {
      try {
        layout.preparar(secao, { meta, diretivas: slide.diretivas || {}, ordinalSecao: ctx.ordinalSecao, indice: slide.indice, total: ctx.total });
      } catch (e) {
        console.error(`[${O.config.APP_NOME}] preparo do layout "${layout.id}" falhou no slide ${slide.indice + 1}:`, e);
      }
    }

    // Notas do orador: guardadas no slide, sempre ocultas (lidas pelo modo apresentador)
    if (slide.notas) {
      const notas = doc.createElement('aside');
      notas.className = 'o-notas';
      notas.setAttribute('aria-hidden', 'true');
      notas.innerHTML = slide.notas; // já sanitizadas pelo interpretador
      secao.append(notas);
    }

    // Rodapé: texto, logotipo e numeração (o slide de título dispensa rodapé)
    const exibirRodape = layout.id !== 'titulo' && (meta.rodape || meta.numeracao || meta.logotipo);
    if (exibirRodape) {
      const rodape = doc.createElement('footer');
      rodape.className = 'o-rodape';
      if (meta.logotipo && ctx.resolverImagem) {
        const logo = ctx.resolverImagem(meta.logotipo);
        if (logo) { const i = doc.createElement('img'); i.className = 'o-logotipo'; i.src = logo.src; i.alt = ''; rodape.append(i); }
      }
      const texto = doc.createElement('span');
      texto.className = 'o-rodape-texto';
      texto.textContent = meta.rodape || '';
      rodape.append(texto);
      if (meta.numeracao) {
        const n = doc.createElement('span');
        n.className = 'o-numero';
        n.textContent = `${slide.indice + 1} / ${ctx.total || slide.indice + 1}`;
        rodape.append(n);
      }
      secao.append(rodape);
    }
    return secao;
  };

  /**
   * Monta todos os slides do resultado do interpretador, numerando as seções.
   * @returns HTMLElement[]
   */
  S.montarTodos = function (resultado, opcoes = {}) {
    const total = resultado.slides.length;
    let ordinal = 0;
    return resultado.slides.map((slide) => {
      if (slide.layout === 'secao') ordinal++;
      return S.montarSlide(slide, Object.assign({}, opcoes, { meta: resultado.meta, total, ordinalSecao: ordinal }));
    });
  };

  /** Resolvedor de imagens do acervo (§4.4): devolve { src, alt, nome } ou null. */
  S.resolvedorDoAcervo = function (acervo) {
    const buscar = U.criarBuscaPorNome(acervo);
    return (referencia) => {
      const item = buscar(referencia);
      if (!item || !item.dataUrl) return null;
      return { src: item.dataUrl, alt: item.alt || '', nome: item.nome || U.nomeBase(referencia) };
    };
  };

  /** Atualiza índice, rótulo acessível e numeração após paginação ou reordenação. */
  S.renumerar = function (secoes) {
    const total = secoes.length;
    secoes.forEach((s, i) => {
      s.dataset.indice = String(i);
      s.setAttribute('aria-label', `Slide ${i + 1} de ${total}`);
      const n = s.querySelector('.o-numero');
      if (n) n.textContent = `${i + 1} / ${total}`;
    });
    return secoes;
  };

  /**
   * Hospedeiro fora da tela, na resolução de referência, para medir slides com o CSS
   * real (paginação de tabelas). Reaproveitado enquanto o CSS não mudar.
   */
  let hospede = null;
  S.hospedeDeMedicao = function (css, temaId, proporcao) {
    const { largura, altura } = S.dimensoes(proporcao);
    if (!hospede) {
      hospede = document.createElement('div');
      hospede.setAttribute('aria-hidden', 'true');
      hospede.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:layout style';
      hospede.append(document.createElement('style'), document.createElement('div'));
      document.body.append(hospede);
    }
    const [estilo, palco] = hospede.children;
    if (estilo.textContent !== css) estilo.textContent = css;
    palco.dataset.tema = temaId;
    palco.style.cssText = `--s-largura:${largura}px;--s-altura:${altura}px;width:${largura}px`;
    palco.replaceChildren();
    return palco;
  };
})(window.Oratoria);
