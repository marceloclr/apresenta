// js/conteudo/graficos.js — bloco ```grafico (§4.6): dados → <figure class="o-grafico">.
//
//   ```grafico
//   tipo: barras                 # barras | linhas | pizza | rosca
//   fonte: execucao_2025.csv     # ou "dados:" inline (CSV em bloco | ou lista YAML)
//   rotulos: Órgão               # coluna das categorias (padrão: a primeira)
//   series: Dotação, Empenhado   # padrão: todas as colunas numéricas
//   ordenar: Dotação desc
//   limite: 8
//   alternavel: true             # seletor de tipo no slide (padrão: sim)
//   titulo: Execução por órgão
//   ```
//
// O HTML resultante é estático e sanitizável: a figura guarda a especificação normalizada em
// data-grafico, um <canvas> e uma tabela com os mesmos dados (alternativa acessível e
// recurso quando o Chart.js não estiver presente). Quem desenha é motorGraficos
// (js/slides/graficos-runtime.js), o mesmo código usado nas apresentações exportadas.

(function (O) {
  'use strict';

  const U = O.util;
  const D = O.conteudo.dados;
  const G = (O.conteudo.graficos = {});

  G.TIPOS = ['barras', 'linhas', 'pizza', 'rosca'];

  /** Dados inline: texto CSV (bloco literal "|") ou lista de objetos YAML. */
  function dadosInline(dados) {
    if (Array.isArray(dados)) {
      const colunas = Array.from(new Set(dados.flatMap((l) => Object.keys(l || {}))));
      return { nome: 'dados inline', colunas, linhas: dados.map((l) => Object.fromEntries(colunas.map((c) => [c, l[c] == null ? '' : String(l[c])]))) };
    }
    return Object.assign({ nome: 'dados inline' }, D.lerCsv(String(dados)));
  }

  /** Normaliza a especificação e extrai rótulos e séries. */
  G.preparar = function (spec, ctx = {}) {
    const avisar = ctx.avisar || (() => {});
    const dados = spec.dados != null ? dadosInline(spec.dados) : D.obter(spec.fonte, ctx.resolverArquivo);
    if (!dados.colunas.length) throw new Error('a fonte de dados não tem colunas.');
    const tipo = G.TIPOS.includes(String(spec.tipo || '').trim()) ? String(spec.tipo).trim() : 'barras';
    if (spec.tipo && tipo !== String(spec.tipo).trim()) avisar('aviso', 'grafico-tipo-invalido', `Tipo de gráfico "${spec.tipo}" desconhecido; usado "barras". Válidos: ${G.TIPOS.join(', ')}.`);

    const colRotulos = spec.rotulos ? D.coluna(dados, spec.rotulos) : dados.colunas[0];
    const sel = D.selecionar(dados, { ordenar: spec.ordenar, limite: spec.limite });
    let colSeries = D.lista(spec.series).map((s) => D.coluna(dados, s));
    if (!colSeries.length) {
      colSeries = dados.colunas.filter((c) => c !== colRotulos && sel.linhas.length && sel.linhas.every((l) => !String(l[c] ?? '').trim() || Number.isFinite(U.lerNumero(l[c]))));
    }
    if (!colSeries.length) throw new Error('nenhuma coluna numérica encontrada para as séries.');

    const series = colSeries.map((c) => {
      const valores = sel.linhas.map((l) => { const n = U.lerNumero(l[c]); return Number.isFinite(n) ? n : null; });
      const invalidos = valores.filter((v) => v === null).length;
      if (invalidos) avisar('aviso', 'grafico-valor-invalido', `Série "${c}": ${invalidos} valor(es) não numérico(s) ignorado(s).`);
      return { nome: c, valores };
    });
    if ((tipo === 'pizza' || tipo === 'rosca') && series.length > 1) avisar('info', 'grafico-pizza-series', `Gráfico de ${tipo} mostra apenas a primeira série ("${series[0].nome}"); as demais aparecem ao alternar para barras ou linhas.`);

    return {
      tipo,
      titulo: spec.titulo ? String(spec.titulo) : '',
      rotulos: sel.linhas.map((l) => String(l[colRotulos] ?? '')),
      eixoRotulos: colRotulos,
      series,
      alternavel: spec.alternavel === undefined ? true : !(spec.alternavel === false || spec.alternavel === 'false' || spec.alternavel === 'nao' || spec.alternavel === 'não'),
      empilhado: spec.empilhado === true,
      fonte: dados.nome,
    };
  };

  /** Figura estática: data-grafico, canvas e tabela alternativa. */
  G.html = function (g) {
    const e = U.escaparHtml;
    const descricao = `Gráfico de ${O.rotulos.rotuloGrafico(g.tipo).toLowerCase()}: ${g.series.map((s) => s.nome).join(', ')} por ${g.eixoRotulos}`;
    const cab = `<th>${e(g.eixoRotulos)}</th>${g.series.map((s) => `<th>${e(s.nome)}</th>`).join('')}`;
    const linhas = g.rotulos.map((r, i) => `<tr><td>${e(r)}</td>${g.series.map((s) => `<td>${s.valores[i] == null ? '' : e(U.formatarDecimal(s.valores[i], 2))}</td>`).join('')}</tr>`).join('');
    return `<figure class="o-grafico" data-grafico="${e(JSON.stringify(g))}">`
      + (g.titulo ? `<figcaption class="o-grafico-titulo">${e(g.titulo)}</figcaption>` : '')
      + `<div class="o-grafico-area"><canvas role="img" aria-label="${e(descricao)}"></canvas></div>`
      + `<table class="o-grafico-dados numerica"><caption>${e(descricao)}</caption><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table>`
      + '</figure>\n';
  };

  O.conteudo.blocos.registrar('grafico', (spec, ctx) => G.html(G.preparar(spec, ctx)), { rotulo: 'Gráfico' });
})(window.Oratoria);
