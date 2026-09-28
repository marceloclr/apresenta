// js/nucleo/config.js — constantes e parâmetros da aplicação.
// Para renomear a aplicação, altere apenas APP_NOME.
// VERSAO deve coincidir com package.json (conferido por tools/verificar.mjs).

(function (O) {
  'use strict';

  const c = O.config;

  c.APP_NOME = 'Apresenta';
  c.APP_SLUG = 'oratoria'; // identificador estável: prefixo de arquivos, bancos e caches (D31)
  c.VERSAO = '0.1.0';

  // ── Composição dos slides ────────────────────────────────────────────────
  c.PROPORCOES = {
    '16:9': { largura: 1920, altura: 1080 },
    '4:3': { largura: 1440, altura: 1080 },
  };
  c.PROPORCAO_PADRAO = '16:9';
  c.MARGEM_LATERAL = 96;  // px na resolução de referência
  c.MARGEM_VERTICAL = 80;
  c.CORPO_MINIMO = 28;    // px — corpo de texto
  c.TITULO_MINIMO = 56;
  c.TITULO_MAXIMO = 72;
  c.TABELA_FONTE_MINIMA = 18; // piso padrão; temas podem elevar (D8)
  c.LAYOUT_PADRAO = 'conteudo';
  c.LAYOUT_PRIMEIRO_SLIDE = 'titulo';
  c.TEMA_PADRAO = 'aurora';
  c.TRANSICAO_PADRAO = 'suave';

  // ── Interface ────────────────────────────────────────────────────────────
  c.ATRASO_PREVIA_MS = 300;          // debounce da pré-visualização
  c.ATRASO_RENDERIZACAO_MS = 1000;   // inatividade antes da renderização completa (paginação, D26)
  c.ATRASO_AUTOSSALVAMENTO_MS = 2000; // inatividade antes de salvar
  c.ATRASO_DICA_MS = 350;            // espera antes de exibir a dica ao passar o ponteiro
  c.ATRASO_CONFIRMACAO_MS = 4000;    // janela da confirmação em dois toques (descartar, remover)
  c.MINUTOS_POR_SLIDE = 1.5;         // fator do tempo estimado (ajustável na aba Tema)
  c.MINUTOS_POR_SLIDE_LIMITES = [0.25, 10];
  c.EDITOR_RECUO = '  ';             // inserido pela tecla Tab no editor

  // ── Imagens ──────────────────────────────────────────────────────────────
  c.IMAGEM_LADO_MAXIMO = 1920;
  c.IMAGEM_QUALIDADE = 0.85;
  c.IMAGEM_QUALIDADE_LIMITES = [0.5, 0.95];
  c.IMAGEM_ALERTA_BYTES = 800 * 1024; // acima disto, aviso na Conferência
  c.TEXTO_ALTERNATIVO_MAXIMO = 250;
  c.TIPOS_ACEITOS = ['.md', '.markdown', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.csv'];
  c.TIPOS_DOCUMENTO = ['.pdf', '.doc', '.docx', '.odt', '.xls', '.xlsx']; // importação na etapa 6-B (§16)

  // ── Exportação em PDF (direta) ───────────────────────────────────────────
  c.PDF_RESOLUCOES = { '1x': 1, '1,5x': 1.5 };
  c.PDF_QUALIDADE = 0.85;

  // ── Persistência ─────────────────────────────────────────────────────────
  c.BANCO_NOME = 'oratoria';
  c.BANCO_VERSAO = 1;

  // ── Módulos sob demanda (somente com rede; versões fixadas) ──────────────
  // Carregados por <script> dinâmico (funciona em file:// e https).
  c.MODULOS_REDE = {
    katex: {
      versao: '0.18.9',
      url: 'https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.js',
      global: 'katex',
      licenca: 'MIT',
    },
    mermaid: {
      versao: '12.0.0',
      url: 'https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js',
      global: 'mermaid',
      licenca: 'MIT',
    },
    sheetjs: {
      versao: '0.20.3', // a confirmar na etapa 6 contra cdn.sheetjs.com (distribuição oficial)
      url: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
      global: 'XLSX',
      licenca: 'Apache-2.0',
    },
  };
  c.TEMPO_LIMITE_REDE_MS = 8000;
  c.SONDA_REDE_URL = 'https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/circle-small.svg'; // 1 KB, licença Apache-2.0

  // ── Embutíveis (carregados sob demanda na exportação) ─────────────────────
  c.EMBUTIVEIS = {
    fontes: 'embutiveis/fontes-base64.js',
    chart: 'embutiveis/chart-fonte.js',
    exemplos: 'embutiveis/exemplos.js', // JSON em string; lido com JSON.parse
  };

  // ── Desenvolvimento ──────────────────────────────────────────────────────
  // Ativo com ?dev na URL (ex.: index.html?dev) ou em localhost; habilita auditorias no console.
  c.DESENVOLVIMENTO = /[?&]dev\b/.test(location.search) || location.hostname === 'localhost';

  Object.freeze(c.PROPORCOES);
})(window.Oratoria);
