// js/nucleo/namespace.js — cria o namespace global único window.Oratoria.
// É o PRIMEIRO script da aplicação (após vendor/). Todos os demais arquivos são IIFEs
// que recebem este objeto: (function (O) { 'use strict'; … })(window.Oratoria);

(function (global) {
  'use strict';

  if (global.Oratoria) return; // edição portátil ou recarga: preserva o que já existe

  global.Oratoria = {
    // Subespaços previstos na especificação
    config: {},      // constantes e parâmetros (config.js)
    estado: {},      // estado central e eventos (estado.js)
    temas: {},       // registro de temas (slides/temas-css.js + temas/*.js)
    layouts: {},     // registro de layouts de slide (slides/estilos-base.js)
    embutiveis: {},  // recursos em forma de string, carregados sob demanda (embutiveis/*.js)
    servicos: {},    // serviços externos opcionais (servicos/*.js)
    ui: {},          // componentes de interface (interface/*.js)

    // Subespaços de organização interna
    util: {},        // utilidades puras (utilidades.js)
    rotulos: {},     // mapas de rótulos (rotulos.js)
    slides: {},      // motor, estilos e apresentador
    conteudo: {},    // interpretador, tabelas, gráficos, imagens
    exportacao: {},  // HTML, projeto, PDF, Markdown, impressão
  };
})(window);
