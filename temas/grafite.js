// temas/grafite.js — GRAFITE · escuro · frio · técnico (especificação §6.3).
// Exatamente o tema escuro em uso no SEJUD.

(function (O) {
  'use strict';

  O.temas.registrar({
    id: 'grafite',
    nome: 'Grafite',
    ambiente: 'escuro',
    descricao: 'Escuro e frio: branco quente sobre grafite, grade técnica e rótulos em Mono.',
    recomendacao: 'Auditórios, salas escurecidas e telas grandes; conteúdo técnico, dados e sistemas.',
    fontes: { titulo: 'IBM Plex Sans', corpo: 'IBM Plex Sans', mono: 'IBM Plex Mono', pesoTitulo: 600 },
    variaveis: {
      '--s-fundo': '#0d1116',
      '--s-tela': '#161d27',
      '--s-superficie': '#1a2029',
      '--s-superficie-2': '#232a35',
      '--s-texto': '#ebe7e4',
      '--s-texto-2': '#9fa4ab',
      '--s-borda': '#3d4550',
      '--s-acento': '#6a9fcc',
      '--s-acento-texto': '#6a9fcc',
      '--s-acento-2': '#4b607c',
      '--s-sucesso': '#5db87a',
      '--s-aviso': '#e8993a',
      '--s-erro': '#e8704f',
      // Cabeçalho discreto: Mono maiúsculo na cor de acento, sem fundo cheio (ver extras)
      '--s-tabela-cabecalho-fundo': '#161d27',
      '--s-tabela-cabecalho-texto': '#6a9fcc',
      '--s-tabela-zebra': 'rgba(255, 255, 255, .03)',
      '--s-tabela-destaque': 'rgba(106, 159, 204, .16)',
      '--s-grafico-1': '#6a9fcc',
      '--s-grafico-2': '#5db87a',
      '--s-grafico-3': '#e8993a',
      '--s-grafico-4': '#e8704f',
      '--s-grafico-5': '#a3a473',
      '--s-grafico-6': '#b86b52',
      '--s-grafico-eixo': '#9fa4ab',
      '--s-grafico-grade': 'rgba(255, 255, 255, .06)',
      '--s-vinheta': 'rgba(0, 0, 0, .38)',
    },
    // Parâmetros calibrados: clareamento de 44% sobre a tela
    grade: { ativa: true, menor: 0.01, maior: 0.17, cruz: 0.03, intensidadeCor: '44%' },
    extras: `
& .o-slide thead th {
  background: transparent; color: var(--s-tabela-cabecalho-texto);
  font-family: var(--s-fonte-mono); font-size: 0.72em; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  border-bottom: 2px solid var(--s-borda); border-radius: 0 !important;
}
& .o-slide th, & .o-slide td { border-bottom: 0; }
& .o-slide tbody tr + tr > * { border-top: 1px solid var(--s-borda); }
& .o-slide .o-ordinal, & .o-slide h3 { font-family: var(--s-fonte-mono); text-transform: uppercase; letter-spacing: 0.08em; }
& .o-slide h3 { font-size: calc(28px * var(--s-escala, 1)); color: var(--s-acento-texto); }
& .o-slide[data-layout="conteudo"] .o-titulo,
& .o-slide[data-layout="duas-colunas"] .o-titulo,
& .o-slide[data-layout="tabela"] .o-titulo { padding-left: 36px; position: relative; }
& .o-slide[data-layout="conteudo"] .o-titulo::before,
& .o-slide[data-layout="duas-colunas"] .o-titulo::before,
& .o-slide[data-layout="tabela"] .o-titulo::before {
  content: ''; position: absolute; left: 0; top: 0.14em; bottom: 0.14em; width: 10px; border-radius: 5px;
  background: linear-gradient(180deg, var(--s-acento) 0 55%, var(--s-acento-2) 55% 100%);
}
`,
  });
})(window.Oratoria);
