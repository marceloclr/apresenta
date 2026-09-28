// js/conteudo/tabelas.js — fontes de dados tabulares, bloco ```tabela e paginação automática.
//
// Fontes de dados (O.conteudo.dados):
//   Itens do acervo com { tipo: 'csv', texto } — separador detectado pelo PapaParse — ou
//   { tipo: 'planilha', planilhas: { nome: { colunas, linhas } } } (importação de XLS/XLSX).
//   Referência a planilha específica: "arquivo.xlsx#Nome da planilha".
//
// Bloco (§4.5):
//   ```tabela
//   fonte: execucao_2025.csv
//   colunas: Órgão, Dotação, Empenhado
//   ordenar: Dotação desc
//   limite: 12
//   classes: zebra numerica
//   ```
//
// Paginação (§4.5): se a tabela exceder a área útil, a fonte é reduzida 1 px por vez até o
// piso do tema (--s-tabela-fonte-minima: 18 px, ou 22 px no Nanquim); persistindo o excesso,
// a tabela é dividida em slides sucessivos, com cabeçalho repetido e "(continuação)" no título.

(function (O) {
  'use strict';

  const U = O.util;
  const D = (O.conteudo.dados = {});
  const T = (O.conteudo.tabelas = {});

  // ═══════════════════════════════ Fontes de dados ═══════════════════════════════

  const cacheCsv = new WeakMap(); // item do acervo → { colunas, linhas }

  /** Converte texto CSV em { colunas, linhas: [{ coluna: valor }] }. */
  D.lerCsv = function (texto) {
    const r = window.Papa.parse(String(texto || '').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', dynamicTyping: false, transformHeader: (h) => h.trim() });
    const colunas = (r.meta.fields || []).filter((c) => c !== '');
    const erros = r.errors.filter((e) => e.type !== 'Delimiter').slice(0, 3).map((e) => `linha ${e.row + 2}: ${e.message}`);
    return { colunas, linhas: r.data, erros, separador: r.meta.delimiter };
  };

  /**
   * Resolve a referência "arquivo.csv" ou "arquivo.xlsx#Planilha" num conjunto de dados.
   * @returns { colunas, linhas, nome } ou lança Error com mensagem legível.
   */
  D.obter = function (referencia, resolverArquivo) {
    if (!referencia) throw new Error('informe a fonte de dados, por exemplo "fonte: execucao_2025.csv".');
    const [arquivo, planilha] = String(referencia).split('#');
    const item = resolverArquivo ? resolverArquivo(arquivo.trim()) : null;
    if (!item) throw new Error(`arquivo "${arquivo.trim()}" não encontrado no acervo.`);
    if (item.tipo === 'csv') {
      if (!cacheCsv.has(item)) cacheCsv.set(item, D.lerCsv(item.texto));
      const d = cacheCsv.get(item);
      return Object.assign({ nome: item.nome || arquivo }, d);
    }
    if (item.tipo === 'planilha') {
      const nomes = Object.keys(item.planilhas || {});
      const escolhida = planilha ? nomes.find((n) => U.chaveNormalizada(n) === U.chaveNormalizada(planilha)) : nomes[0];
      if (!escolhida) throw new Error(`planilha "${planilha}" não existe em "${arquivo}". Disponíveis: ${nomes.join(', ')}.`);
      return Object.assign({ nome: `${arquivo}#${escolhida}` }, item.planilhas[escolhida]);
    }
    throw new Error(`"${arquivo}" não é uma fonte de dados tabular (CSV ou planilha).`);
  };

  /** Lista de nomes: aceita array YAML ou texto separado por vírgulas. */
  D.lista = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((s) => String(s).trim()).filter(Boolean);

  /** Localiza a coluna real a partir do nome informado (sem acentos nem maiúsculas). */
  D.coluna = function (dados, nome) {
    const alvo = U.chaveNormalizada(nome);
    const achada = dados.colunas.find((c) => U.chaveNormalizada(c) === alvo);
    if (!achada) throw new Error(`coluna "${nome}" não existe. Colunas disponíveis: ${dados.colunas.join(', ')}.`);
    return achada;
  };

  const COMPARADOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

  /** Aplica colunas, ordenação ("Coluna desc|asc") e limite. Devolve { colunas, linhas }. */
  D.selecionar = function (dados, { colunas, ordenar, limite } = {}) {
    const cols = colunas && D.lista(colunas).length ? D.lista(colunas).map((c) => D.coluna(dados, c)) : dados.colunas.slice();
    let linhas = dados.linhas.slice();
    if (ordenar) {
      const m = String(ordenar).trim().match(/^(.*?)(?:\s+(asc|desc|crescente|decrescente))?$/i);
      const col = D.coluna(dados, m[1]);
      const desc = /^(desc|decrescente)$/i.test(m[2] || '');
      linhas.sort((a, b) => {
        const na = U.lerNumero(a[col]);
        const nb = U.lerNumero(b[col]);
        const r = Number.isFinite(na) && Number.isFinite(nb) ? na - nb : COMPARADOR.compare(String(a[col] ?? ''), String(b[col] ?? ''));
        return desc ? -r : r;
      });
    }
    const n = parseInt(limite, 10);
    if (Number.isFinite(n) && n > 0) linhas = linhas.slice(0, n);
    return { colunas: cols, linhas };
  };

  // ═════════════════════════════════ Bloco tabela ═════════════════════════════════

  const CLASSES_VALIDAS = /^(zebra|compacta|numerica|destacar-(linha|coluna)-\d{1,2})$/;

  T.htmlTabela = function ({ colunas, linhas }, classes, fonte) {
    const e = U.escaparHtml;
    const cab = colunas.map((c) => `<th>${e(c)}</th>`).join('');
    const corpo = linhas.map((l) => `<tr>${colunas.map((c) => `<td>${e(l[c] ?? '')}</td>`).join('')}</tr>`).join('\n');
    const cls = classes.length ? ` class="${classes.join(' ')}"` : '';
    return `<table${cls} data-fonte="${e(fonte)}">\n<thead><tr>${cab}</tr></thead>\n<tbody>\n${corpo}\n</tbody>\n</table>\n`;
  };

  O.conteudo.blocos.registrar('tabela', function (spec, ctx) {
    const dados = D.obter(spec.fonte, ctx.resolverArquivo);
    if (dados.erros && dados.erros.length) ctx.avisar('aviso', 'csv-irregular', `"${dados.nome}": ${dados.erros.join('; ')}`);
    const sel = D.selecionar(dados, spec);
    const pedidas = String(spec.classes || '').split(/[\s,]+/).filter(Boolean);
    const invalidas = pedidas.filter((c) => !CLASSES_VALIDAS.test(c));
    if (invalidas.length) ctx.avisar('aviso', 'classe-tabela-desconhecida', `Classes de tabela desconhecidas: ${invalidas.join(', ')}.`);
    return T.htmlTabela(sel, pedidas.filter((c) => CLASSES_VALIDAS.test(c)), dados.nome);
  }, { rotulo: 'Tabela a partir de dados' });

  // ═══════════════════════════════════ Paginação ══════════════════════════════════

  /** Há conteúdo além da área útil do slide? */
  function transborda(secao) {
    const alvos = [secao.querySelector('.o-conteudo'), ...secao.querySelectorAll('.o-tabela-contentor')].filter(Boolean);
    return alvos.some((el) => el.scrollHeight > el.clientHeight + 1);
  }

  const pxDe = (valor, padrao) => { const n = parseFloat(valor); return Number.isFinite(n) ? n : padrao; };

  /**
   * Pagina as tabelas de uma lista de slides já montados. O `palco` deve estar no documento,
   * com o CSS dos slides e do tema aplicado (O.slides.hospedeDeMedicao).
   * @returns { secoes: HTMLElement[], ocorrencias: [{ slide, titulo, acao, fonte, partes }] }
   */
  T.paginar = function (secoes, palco) {
    const saida = [];
    const ocorrencias = [];
    for (const secao of secoes) {
      const tabelas = secao.querySelectorAll('.o-conteudo table:not(.o-grafico-dados)');
      if (!tabelas.length) { saida.push(secao); continue; }
      palco.append(secao);
      if (!transborda(secao)) { secao.remove(); saida.push(secao); continue; }

      // A maior tabela é a que se ajusta e, se preciso, se divide
      const tabela = Array.from(tabelas).sort((a, b) => b.rows.length - a.rows.length)[0];
      const minimo = pxDe(getComputedStyle(secao).getPropertyValue('--s-tabela-fonte-minima'), O.config.TABELA_FONTE_MINIMA);
      let fonte = Math.floor(pxDe(getComputedStyle(tabela).fontSize, 28));
      const titulo = (secao.querySelector('.o-titulo')?.textContent || '').trim();
      while (fonte > minimo && transborda(secao)) {
        fonte -= 1;
        tabela.style.setProperty('--o-tabela-fonte', `${fonte}px`);
      }
      if (!transborda(secao)) {
        ocorrencias.push({ slide: saida.length, titulo, acao: 'reduzida', fonte, partes: 1 });
        secao.remove(); saida.push(secao); continue;
      }

      // Divisão em slides sucessivos, com o cabeçalho repetido
      const linhas = Array.from(tabela.tBodies[0]?.rows || []);
      const modelo = secao.cloneNode(true);
      const partes = [];
      let atual = secao;
      let corpo = tabela.tBodies[0];
      corpo.replaceChildren();
      for (const linha of linhas) {
        corpo.append(linha);
        if (transborda(atual) && corpo.rows.length > 1) {
          linha.remove();
          partes.push(atual);
          atual.remove();
          atual = criarContinuacao(modelo, titulo);
          palco.append(atual);
          corpo = atual.querySelector('table[data-paginada]').tBodies[0];
          corpo.append(linha);
        }
      }
      partes.push(atual);
      atual.remove();
      ocorrencias.push({ slide: saida.length, titulo, acao: 'dividida', fonte: minimo, partes: partes.length, linhas: linhas.length });
      saida.push(...partes);
    }
    return { secoes: O.slides.renumerar(saida), ocorrencias };

    function criarContinuacao(modeloSecao, tituloOriginal) {
      const nova = modeloSecao.cloneNode(true);
      const conteudo = nova.querySelector('.o-conteudo');
      const tab = Array.from(nova.querySelectorAll('.o-conteudo table:not(.o-grafico-dados)')).sort((a, b) => b.rows.length - a.rows.length)[0];
      tab.setAttribute('data-paginada', '');
      tab.style.setProperty('--o-tabela-fonte', `${pxDe(getComputedStyle(palco).getPropertyValue('--s-tabela-fonte-minima'), O.config.TABELA_FONTE_MINIMA)}px`);
      tab.tBodies[0].replaceChildren();
      // Continuação: somente título e tabela (os demais blocos ficam no primeiro slide)
      const tituloEl = conteudo.querySelector('.o-titulo');
      Array.from(conteudo.children).forEach((filho) => { if (filho !== tituloEl && !filho.contains(tab)) filho.remove(); });
      if (tituloEl) tituloEl.textContent = `${tituloOriginal} (continuação)`;
      else if (tituloOriginal === '') conteudo.prepend(Object.assign(document.createElement('h2'), { className: 'o-titulo', textContent: '(continuação)' }));
      nova.querySelectorAll('.o-notas').forEach((n) => n.remove()); // notas ficam só no primeiro slide
      nova.classList.add('o-continuacao');
      return nova;
    }
  };
})(window.Oratoria);
