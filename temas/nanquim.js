// temas/nanquim.js — NANQUIM · escuro · quente · alto contraste para auditório (especificação §6.4).

(function (O) {
  'use strict';

  O.temas.registrar({
    id: 'nanquim',
    nome: 'Nanquim',
    ambiente: 'escuro',
    descricao: 'Escuro e quente, de alto contraste: marfim sobre nanquim esverdeado, títulos serifados e latão.',
    recomendacao: 'Grandes auditórios, projeção a distância, eventos e palestras de encerramento; máxima legibilidade no escuro.',
    fontes: {
      titulo: 'IBM Plex Serif', corpo: 'IBM Plex Sans', mono: 'IBM Plex Mono',
      pesoTitulo: 600, fatorTitulo: 1.08, espacamentoCorpo: '0.005em',
    },
    variaveis: {
      '--s-fundo': '#121412',
      '--s-tela': '#181b18',
      '--s-superficie': '#1f231f',
      '--s-superficie-2': '#2a2f29',
      '--s-texto': '#efece6',
      '--s-texto-2': '#b5b0a5',
      '--s-borda': '#3a4038',
      '--s-acento': '#c9a45c',        // latão claro
      '--s-acento-texto': '#c9a45c',
      '--s-acento-2': '#8fa37a',      // musgo claro
      '--s-sucesso': '#8fa37a',
      '--s-aviso': '#d9a35a',
      '--s-erro': '#d08b6a',
      '--s-tabela-cabecalho-fundo': '#c9a45c',
      '--s-tabela-cabecalho-texto': '#121412',
      '--s-tabela-zebra': 'rgba(239, 236, 230, .04)',
      '--s-tabela-destaque': 'rgba(201, 164, 92, .18)',
      '--s-tabela-fonte-minima': '22px', // D8: nunca abaixo de 22 px
      '--s-grafico-1': '#c9a45c',
      '--s-grafico-2': '#8fa37a',
      '--s-grafico-3': '#7fa6c4',
      '--s-grafico-4': '#d08b6a',
      '--s-grafico-5': '#b39cc9',
      '--s-grafico-6': '#d9c9a3',
      '--s-grafico-eixo': '#b5b0a5',
      '--s-grafico-grade': 'rgba(239, 236, 230, .07)',
      '--s-vinheta': 'rgba(0, 0, 0, .42)',
      '--s-fonte-citacao': "'IBM Plex Serif', Georgia, serif",
      // Halo radial muito sutil de latão no canto superior esquerdo, no lugar da grade
      '--s-textura': 'radial-gradient(1100px 760px at 0% 0%, rgba(201, 164, 92, .10), transparent 62%)',
    },
    grade: { ativa: false, menor: 0.01, maior: 0.12, cruz: 0.02, intensidadeCor: '40%' },
    extras: `
& .o-slide thead th { font-family: var(--s-fonte-corpo); }
`,
  });
})(window.Oratoria);
