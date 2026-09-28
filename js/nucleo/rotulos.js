// js/nucleo/rotulos.js — mapas de rótulos exibidos na interface.
// Regra: quando só o texto mudar, altere aqui; nunca renomeie o identificador (chave).

(function (O) {
  'use strict';

  const R = O.rotulos;

  R.ROTULO_LAYOUT = {
    'titulo': 'Título',
    'secao': 'Divisor de seção',
    'conteudo': 'Conteúdo',
    'duas-colunas': 'Duas colunas',
    'imagem-lateral': 'Imagem lateral',
    'imagem-fundo': 'Imagem de fundo',
    'citacao': 'Citação',
    'tabela': 'Tabela',
    'encerramento': 'Encerramento',
  };

  R.ROTULO_ABA = {
    'composicao': 'Composição',
    'acervo': 'Acervo',
    'tabelas': 'Tabelas',
    'tema': 'Tema',
    'conferencia': 'Conferência',
    'apresentar': 'Apresentar e exportar',
    'biblioteca': 'Biblioteca',
    'guia': 'Guia',
  };

  R.ROTULO_AMBIENTE = { claro: 'Ambiente claro', escuro: 'Ambiente escuro' };

  R.ROTULO_TRANSICAO = { nenhuma: 'Nenhuma', suave: 'Suave', deslizar: 'Deslizar' };

  R.ROTULO_GRAFICO = { barras: 'Barras', linhas: 'Linhas', pizza: 'Pizza', rosca: 'Rosca' };

  R.ROTULO_PROPORCAO = { '16:9': 'Panorâmica (16:9)', '4:3': 'Clássica (4:3)' };

  R.ROTULO_TEMA_INTERFACE = { escuro: 'Interface escura', claro: 'Interface clara' };

  R.ROTULO_GRAVIDADE = { erro: 'Impedimento', aviso: 'Advertência', info: 'Observação' };

  R.ROTULO_PERSISTENCIA = {
    indexeddb: 'Guarda automática no navegador',
    memoria: 'Guarda apenas nesta sessão',
  };

  /** Rótulo genérico: devolve o texto do mapa ou a própria chave, se ausente. */
  R.rotulo = function (mapa, chave) {
    return (mapa && Object.prototype.hasOwnProperty.call(mapa, chave)) ? mapa[chave] : String(chave);
  };

  R.rotuloLayout = (chave) => R.rotulo(R.ROTULO_LAYOUT, chave);
  R.rotuloAba = (chave) => R.rotulo(R.ROTULO_ABA, chave);
  R.rotuloAmbiente = (chave) => R.rotulo(R.ROTULO_AMBIENTE, chave);
  R.rotuloTransicao = (chave) => R.rotulo(R.ROTULO_TRANSICAO, chave);
  R.rotuloGrafico = (chave) => R.rotulo(R.ROTULO_GRAFICO, chave);
  R.rotuloGravidade = (chave) => R.rotulo(R.ROTULO_GRAVIDADE, chave);
})(window.Oratoria);
