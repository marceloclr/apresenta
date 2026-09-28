// js/exportacao/html.js — apresentação exportada como UM arquivo .html autocontido (§9.1).
//
//   const r = await O.exportacao.html.gerar(projeto, { aoProgredir });
//     → { html, nome, bytes, slides, avisos, parcelas }
//   await O.exportacao.html.baixar(projeto)   → gera e oferece o download; devolve o mesmo resultado
//
// Conteúdo do arquivo:
//   • slides já montados e paginados (O.slides.renderizar), com HTML sanitizado e imagens do
//     acervo em data URL; notas do orador em <aside class="o-notas"> (lidas pelo apresentador);
//   • CSS dos slides + SOMENTE o tema escolhido, com os ajustes do projeto;
//   • @font-face em data URL apenas das famílias usadas pelo tema (D13; embutível de fontes);
//   • motorSlides, motorApresentador e motorGraficos reinjetados via toString();
//   • Chart.js (embutível) apenas se houver gráfico;
//   • CSP que bloqueia qualquer requisição externa (D4).
// Realce de código já vem pré-renderizado pelo interpretador (D1).
//
// Os embutíveis são lidos sob demanda pelo carregador (uma promessa por recurso).

(function (O) {
  'use strict';

  const H = (O.exportacao.html = {});
  const U = O.util;
  const S = O.slides;
  const C = O.config;

  const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:";

  /** Protege código embutido em <script>: "</script" e "<!--" não podem aparecer literalmente. */
  const protegerScript = (codigo) => String(codigo).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  /** Protege CSS embutido em <style>. */
  const protegerEstilo = (css) => String(css).replace(/<\/(style)/gi, '<\\/$1');

  /** @font-face em data URL para as faces das famílias indicadas. */
  function cssFontes(faces, familias) {
    return faces.filter((f) => familias.includes(f.familia)).map((f) =>
      `@font-face { font-family: '${f.familia}'; font-style: ${f.estilo}; font-weight: ${f.peso}; font-display: block; src: url(data:font/woff2;base64,${f.base64}) format('woff2'); }`).join('\n');
  }

  const CSS_PAGINA = [
    'html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }',
    '#deck { position: fixed; inset: 0; }',
    '@media print { html, body { overflow: visible; } }',
  ].join('\n');

  /** Nome do arquivo: titulo-normalizado_AAAA-MM-DD.html */
  H.nomeArquivo = function (projeto, meta, extensao = '.html') {
    const titulo = projeto.titulo || (meta && meta.titulo) || 'apresentacao';
    return `${U.normalizarNome(titulo)}_${U.dataIso()}${extensao}`;
  };

  H.gerar = async function (projeto, { aoProgredir = () => {} } = {}) {
    aoProgredir('Montando os slides', 0.1);
    const r = await S.renderizar(projeto);
    if (!r.secoes.length) throw new Error('Não há slides para exportar: escreva ou abra um texto primeiro.');
    const meta = r.meta;
    const { largura, altura } = S.dimensoes(meta.proporcao);
    const temGrafico = r.secoes.some((s) => s.querySelector('figure.o-grafico'));

    aoProgredir('Lendo as fontes', 0.3);
    const faces = await O.carregador.embutivel('fontes');
    const fontes = cssFontes(faces, O.temas.familiasUsadas(meta.tema));
    let chart = '';
    if (temGrafico) {
      aoProgredir('Lendo a biblioteca de gráficos', 0.5);
      chart = await O.carregador.embutivel('chart');
    }

    aoProgredir('Compondo o arquivo', 0.75);
    const secoes = r.secoes.map((s) => {
      const c = s.cloneNode(true);
      c.removeAttribute('data-origem');
      return c.outerHTML;
    }).join('\n');
    const titulo = meta.titulo || projeto.titulo || 'Apresentação';
    const opcoes = {
      largura, altura, hash: true, transicao: meta.transicao, titulo,
    };
    const motor = [
      `var motorSlides = ${S.motorSlides.toString()};`,
      `var motorApresentador = ${S.motorApresentador.toString()};`,
      `var motorGraficos = ${S.motorGraficos.toString()};`,
      `(function () {`,
      `  var opcoes = ${JSON.stringify(opcoes)};`,
      `  opcoes.apresentador = motorApresentador;`,
      `  if (typeof Chart !== 'undefined') opcoes.graficos = motorGraficos;`,
      `  var deck = document.getElementById('deck');`,
      `  motorSlides(deck, opcoes);`,
      `  deck.focus();`,
      `})();`,
    ].join('\n');

    const e = U.escaparHtml;
    const html = [
      '<!doctype html>',
      `<html lang="${e(meta.idioma || 'pt-BR')}">`,
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      `<meta name="generator" content="${e(C.APP_NOME)} ${e(C.VERSAO)}">`,
      meta.autor ? `<meta name="author" content="${e(meta.autor)}">` : null,
      `<title>${e(titulo)}</title>`,
      `<style id="o-fontes">\n${protegerEstilo(fontes)}\n</style>`,
      `<style id="o-pagina">\n${CSS_PAGINA}\n</style>`,
      `<style id="o-slides">\n${protegerEstilo(r.css)}\n</style>`,
      '</head>',
      '<body>',
      `<div id="deck" data-tema="${e(meta.tema)}" style="--s-largura:${largura}px;--s-altura:${altura}px">`,
      secoes,
      '</div>',
      chart ? `<script>\n${protegerScript(chart)}\n</script>` : null,
      `<script>\n${protegerScript(motor)}\n</script>`,
      '</body>',
      '</html>',
      '',
    ].filter((l) => l !== null).join('\n');

    const bytes = new TextEncoder().encode(html).length;
    const avisos = r.avisos.filter((a) => ['imagem-ausente', 'imagem-externa', 'bloco-invalido', 'bloco-falhou', 'bloco-indisponivel'].includes(a.codigo));
    aoProgredir('Pronto', 1);
    return {
      html, bytes, nome: H.nomeArquivo(projeto, meta), slides: r.secoes.length, avisos,
      parcelas: { fontes: fontes.length, chart: chart.length, css: r.css.length, motor: motor.length, slides: secoes.length },
    };
  };

  H.baixar = async function (projeto, opcoes) {
    const r = await H.gerar(projeto, opcoes);
    U.baixar(new Blob([r.html], { type: 'text/html;charset=utf-8' }), r.nome);
    return r;
  };
})(window.Oratoria);
