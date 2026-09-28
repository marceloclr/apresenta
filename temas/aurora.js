// temas/aurora.js — AURORA · claro · frio · institucional (especificação §6.1).
// Derivado do tema claro dos sistemas da SEPLAG/CE.

(function (O) {
  'use strict';

  O.temas.registrar({
    id: 'aurora',
    nome: 'Aurora',
    ambiente: 'claro',
    descricao: 'Claro, frio e institucional: azul sóbrio sobre fundo gelo, com grade técnica discreta.',
    recomendacao: 'Salas de aula e reuniões com luz plena; conteúdo técnico e institucional.',
    fontes: { titulo: 'IBM Plex Sans', corpo: 'IBM Plex Sans', mono: 'IBM Plex Mono', pesoTitulo: 600 },
    variaveis: {
      '--s-fundo': '#f5f7fb',
      '--s-tela': '#eaeff8',
      '--s-superficie': '#ffffff',
      '--s-superficie-2': '#f1f5f9',
      '--s-texto': '#1e293b',
      '--s-texto-2': '#475569',
      '--s-borda': '#cbd5e1',
      '--s-acento': '#6a9fcc',        // decorativo: faixas, marcadores, bordas
      '--s-acento-texto': '#2f5f8f',  // links e texto em cor (AA)
      '--s-acento-2': '#4b607c',
      '--s-sucesso': '#3f7a55',
      '--s-aviso': '#a45f19',         // especificado #a8621a (4,42:1 sobre o fundo); ajustado para AA (R2)
      '--s-erro': '#b54a32',
      '--s-tabela-cabecalho-fundo': '#1e293b',
      '--s-tabela-cabecalho-texto': '#f1f5f9',
      '--s-tabela-zebra': '#f1f5f9',
      '--s-tabela-destaque': 'rgba(106, 159, 204, .18)',
      '--s-grafico-1': '#2f5f8f',
      '--s-grafico-2': '#5d8a6a',
      '--s-grafico-3': '#b0763a',
      '--s-grafico-4': '#8a5a8c',
      '--s-grafico-5': '#3f8c8c',
      '--s-grafico-6': '#a34f4f',
      '--s-grafico-eixo': '#475569',
      '--s-grafico-grade': 'rgba(15, 23, 42, .10)',
      '--s-vinheta': 'rgba(30, 41, 59, .045)',
    },
    // Parâmetros calibrados nos sistemas de origem: escurecimento de 16% sobre a tela
    grade: { ativa: true, menor: 0.015, maior: 0.15, cruz: 0.01, intensidadeCor: '16%' },
  });
})(window.Oratoria);
