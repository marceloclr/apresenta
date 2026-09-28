// temas/marfim.js — MARFIM · claro · quente · acadêmico-clássico (especificação §6.2).

(function (O) {
  'use strict';

  O.temas.registrar({
    id: 'marfim',
    nome: 'Marfim',
    ambiente: 'claro',
    descricao: 'Claro e quente: tinta sobre marfim, títulos serifados e filetes de latão.',
    recomendacao: 'Aulas expositivas, humanidades, história e palestras de tom reflexivo; ambientes com luz quente.',
    fontes: { titulo: 'IBM Plex Serif', corpo: 'IBM Plex Sans', mono: 'IBM Plex Mono', pesoTitulo: 600 },
    variaveis: {
      '--s-fundo': '#f7f3ea',
      '--s-tela': '#efe8d8',
      '--s-superficie': '#fffdf8',
      '--s-superficie-2': '#f1ead9',
      '--s-texto': '#1f2328',
      '--s-texto-2': '#55504a',
      '--s-borda': '#d8ccb4',
      '--s-acento': '#a07a3c',        // latão (decorativo)
      '--s-acento-texto': '#7d5a24',
      '--s-acento-2': '#5f7050',      // musgo
      '--s-sucesso': '#4f6b3f',
      '--s-aviso': '#9a5f1c',
      '--s-erro': '#9c3f2e',
      '--s-tabela-cabecalho-fundo': '#3a342c',
      '--s-tabela-cabecalho-texto': '#f7f3ea',
      '--s-tabela-zebra': '#f3ecdd',
      '--s-tabela-destaque': 'rgba(160, 122, 60, .16)',
      '--s-grafico-1': '#7d5a24',
      '--s-grafico-2': '#5f7050',
      '--s-grafico-3': '#3f5f7a',
      '--s-grafico-4': '#8c4a3c',
      '--s-grafico-5': '#6b5a8a',
      '--s-grafico-6': '#a07a3c',
      '--s-grafico-eixo': '#55504a',
      '--s-grafico-grade': 'rgba(31, 35, 40, .10)',
      '--s-vinheta': 'rgba(90, 64, 24, .05)',
      '--s-fonte-citacao': "'IBM Plex Serif', Georgia, serif",
      // Textura de papel: fibras muito tênues em gradientes radiais (sem imagem)
      '--s-textura': 'radial-gradient(1200px 700px at 18% 12%, rgba(255, 253, 248, .55), transparent 60%), radial-gradient(900px 600px at 85% 90%, rgba(160, 122, 60, .06), transparent 65%)',
    },
    grade: { ativa: false, menor: 0.02, maior: 0.12, cruz: 0.01, intensidadeCor: '22%' },
    extras: `
& .o-slide thead th { border-bottom: 4px solid var(--s-acento); }
& .o-slide .o-titulo { letter-spacing: 0; }
& .o-slide blockquote { font-family: var(--s-fonte-citacao); font-style: italic; }
& .o-slide[data-layout="secao"] .o-ordinal { font-family: var(--s-fonte-titulo); letter-spacing: 0.02em; }
`,
  });
})(window.Oratoria);
