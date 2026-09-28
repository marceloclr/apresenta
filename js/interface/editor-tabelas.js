// js/interface/editor-tabelas.js — aba Tabelas (§5.2): edição da tabela sob o cursor.
//
//   • tabela escrita (GFM, com a linha {.classes} opcional logo abaixo): grade de células,
//     alinhamento por coluna, linhas e colunas acrescentadas ou retiradas, classes de estilo;
//   • bloco ```tabela (dados de planilha do acervo): fonte, colunas, ordenação, limite e classes;
//   • fora de uma tabela: nova tabela, ou tabela a partir de uma planilha CSV do acervo.
// "Converter em gráfico" insere, logo após a tabela, um bloco ```grafico com os mesmos dados.
//
// As alterações ficam na grade até "Gravar no texto", que substitui somente as linhas da tabela
// (desfazível com Ctrl+Z). Se o texto da tabela mudar por fora durante a edição, a gravação é
// recusada com aviso, para não sobrescrever o que foi escrito.
//
//   O.ui.tabelas.iniciar() · O.ui.tabelas.localizar(texto, linha) · lerTabela(linhas) · escreverTabela(modelo)

(function (O) {
  'use strict';

  const TB = (O.ui.tabelas = {});
  const U = O.util;
  const E = O.estado;
  const R = O.rotulos;

  const CLASSES_SIMPLES = ['zebra', 'compacta', 'numerica'];
  const LIMITE_COLUNAS = 12;
  const LIMITE_LINHAS = 200;

  let painel = null;
  let alvo = null;       // { tipo: 'gfm'|'bloco', inicio, fim, original, modelo | spec }
  let sujo = false;

  // ═══════════════════════════ Leitura e escrita (puras) ═══════════════════════════

  const EH_LINHA_TABELA = /^\s*\|/;
  const EH_SEPARADOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  const EH_ATRIBUTOS = /^\s*\{[^{}]*\}\s*$/;

  function celulas(linha) {
    let s = linha.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const partes = [];
    let atual = '';
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\' && s[i + 1] === '|') { atual += '|'; i++; continue; }
      if (s[i] === '|') { partes.push(atual.trim()); atual = ''; continue; }
      atual += s[i];
    }
    partes.push(atual.trim());
    return partes;
  }

  function alinhamentoDe(celula) {
    const c = celula.trim();
    const esq = c.startsWith(':');
    const dir = c.endsWith(':');
    return esq && dir ? 'centro' : dir ? 'direita' : esq ? 'esquerda' : '';
  }

  /**
   * Localiza a tabela (ou bloco ```tabela) que contém a linha (1-based).
   * @returns { tipo, inicio, fim, original, ... } ou null
   */
  TB.localizar = function (texto, linha) {
    const linhas = texto.split('\n');
    // Blocos cercados: a linha pode estar dentro de um ```tabela
    let cerca = null;
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (!cerca) {
        const m = l.match(/^ {0,3}(`{3,}|~{3,})\s*(\S*)/);
        if (m) cerca = { marca: m[1], tipo: m[2], inicio: i + 1 };
      } else {
        const f = l.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (f && f[1][0] === cerca.marca[0] && f[1].length >= cerca.marca.length) {
          if (linha >= cerca.inicio && linha <= i + 1) {
            if (cerca.tipo !== 'tabela') return null;
            const corpo = linhas.slice(cerca.inicio, i).join('\n');
            const { spec } = O.conteudo.lerEspecificacao(corpo);
            return { tipo: 'bloco', inicio: cerca.inicio, fim: i + 1, original: linhas.slice(cerca.inicio - 1, i + 1).join('\n'), spec };
          }
          cerca = null;
        }
      }
      if (i + 1 > linha && !cerca) break;
    }
    if (cerca && linha >= cerca.inicio) return null; // bloco sem fechamento

    let i = linha - 1;
    if (EH_ATRIBUTOS.test(linhas[i] || '') && EH_LINHA_TABELA.test(linhas[i - 1] || '')) i--;
    if (!EH_LINHA_TABELA.test(linhas[i] || '')) return null;
    let a = i;
    while (a > 0 && EH_LINHA_TABELA.test(linhas[a - 1])) a--;
    let b = i;
    while (b < linhas.length - 1 && EH_LINHA_TABELA.test(linhas[b + 1])) b++;
    if (b - a < 1 || !EH_SEPARADOR.test(linhas[a + 1])) return null;
    let fim = b + 1;
    if (EH_ATRIBUTOS.test(linhas[b + 1] || '')) fim = b + 2;
    const trecho = linhas.slice(a, fim);
    return { tipo: 'gfm', inicio: a + 1, fim, original: trecho.join('\n'), modelo: TB.lerTabela(trecho) };
  };

  /** Linhas GFM (+ atributos) → { cabecalho, alinhamentos, linhas, classes, extras }. */
  TB.lerTabela = function (trecho) {
    const semAtributos = EH_ATRIBUTOS.test(trecho[trecho.length - 1]) ? trecho.slice(0, -1) : trecho;
    const atributos = semAtributos.length < trecho.length ? trecho[trecho.length - 1].trim().slice(1, -1).trim() : '';
    const cabecalho = celulas(semAtributos[0]);
    const n = Math.min(LIMITE_COLUNAS, Math.max(cabecalho.length, 1));
    const ajustar = (arr) => { const r = arr.slice(0, n); while (r.length < n) r.push(''); return r; };
    const alinhamentos = ajustar(celulas(semAtributos[1]).map(alinhamentoDe));
    const linhas = semAtributos.slice(2).map((l) => ajustar(celulas(l)));
    const tokens = atributos ? atributos.split(/\s+/) : [];
    const classes = tokens.filter((t) => /^\.[\w-]+$/.test(t)).map((t) => t.slice(1));
    const extras = tokens.filter((t) => !/^\.[\w-]+$/.test(t));
    return { cabecalho: ajustar(cabecalho), alinhamentos, linhas, classes, extras };
  };

  const escaparCelula = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

  /** Modelo → texto GFM com colunas alinhadas e a linha {.classes}, se houver. */
  TB.escreverTabela = function (m) {
    const n = m.cabecalho.length;
    const larguras = [];
    for (let j = 0; j < n; j++) {
      const valores = [m.cabecalho[j], ...m.linhas.map((l) => l[j])].map((v) => escaparCelula(v).length);
      larguras.push(Math.min(40, Math.max(3, ...valores)));
    }
    const pad = (s, j) => { const t = escaparCelula(s); return m.alinhamentos[j] === 'direita' ? t.padStart(larguras[j]) : t.padEnd(larguras[j]); };
    const linha = (arr) => `| ${arr.map(pad).join(' | ')} |`;
    const sep = `|${m.alinhamentos.map((al, j) => {
      const tracos = '-'.repeat(Math.max(3, larguras[j]));
      if (al === 'centro') return `:${tracos}:`;
      if (al === 'direita') return `-${tracos}:`;
      if (al === 'esquerda') return `:${tracos}-`;
      return `-${tracos}-`;
    }).join('|')}|`;
    const saida = [linha(m.cabecalho), sep, ...m.linhas.map(linha)];
    const atributos = [...m.classes.map((c) => `.${c}`), ...m.extras];
    if (atributos.length) saida.push(`{${atributos.join(' ')}}`);
    return saida.join('\n');
  };

  /** CSV (vírgula, aspas quando necessário) a partir de cabeçalho e linhas. */
  function paraCsv(cabecalho, linhas) {
    const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cabecalho, ...linhas].map((l) => l.map(q).join(',')).join('\n');
  }

  // ═══════════════════════════ Interface ═══════════════════════════

  function cabecalhoPainel(texto) { U.$('#tabelas-estado').textContent = texto; }

  function botao(rotulo, dica, acao, classe = 'botao') {
    return U.el('button', { type: 'button', class: classe, 'data-dica': dica, onclick: acao }, rotulo);
  }

  function marcarSujo() {
    sujo = true;
    U.$('#tabelas-pendente').hidden = false;
  }

  function limparSujo() {
    sujo = false;
    const p = U.$('#tabelas-pendente');
    if (p) p.hidden = true;
  }

  /** Grava o trecho no texto, conferindo se o original continua intacto. */
  function gravar(novoTrecho, { depois = '' } = {}) {
    const texto = O.ui.editor.texto();
    const inicio = O.ui.editor.inicioDaLinha(alvo.inicio);
    const fim = O.ui.editor.fimDaLinha(alvo.fim);
    if (texto.slice(inicio, fim) !== alvo.original) {
      O.ui.notificar('O texto da tabela mudou no editor desde que a edição começou. Recarregue a tabela antes de gravar.', { gravidade: 'aviso' });
      return false;
    }
    O.ui.editor.substituir(inicio, fim, novoTrecho + depois);
    alvo.original = novoTrecho;
    alvo.fim = alvo.inicio + novoTrecho.split('\n').length - 1;
    limparSujo();
    return true;
  }

  // ── Tabela escrita ─────────────────────────────────────────────────────
  function montarGrade() {
    const m = alvo.modelo;
    const n = m.cabecalho.length;
    const corpo = U.$('#tabelas-corpo');
    const tamanho = (v) => String(Math.max(6, Math.min(28, String(v || '').length + 2)));

    const campo = (valor, rotulo, aoMudar) => {
      const c = U.el('input', { type: 'text', class: 'entrada celula', value: valor, size: tamanho(valor), 'aria-label': rotulo, 'data-dica': `${rotulo}. A barra vertical é gravada protegida (\\|); quebras de linha viram espaço.` });
      c.addEventListener('input', () => {
        if (/[\r\n]/.test(c.value)) c.value = c.value.replace(/[\r\n]+/g, ' ');
        c.size = Number(tamanho(c.value));
        aoMudar(c.value);
        marcarSujo();
      });
      return c;
    };

    const tabela = U.el('table', { class: 'grade-tabela' });
    const thead = U.el('thead');
    thead.append(U.el('tr', null, U.el('th', { scope: 'col' }, ''), ...m.cabecalho.map((v, j) => U.el('th', { scope: 'col' },
      campo(v, `Cabeçalho da coluna ${j + 1}`, (x) => { m.cabecalho[j] = x; })))));
    const alinha = U.el('tr', { class: 'grade-alinhamentos' }, U.el('th', { scope: 'row' }, U.el('span', { class: 'sr-only' }, 'Alinhamento')));
    m.alinhamentos.forEach((al, j) => {
      const sel = U.el('select', { class: 'entrada', 'aria-label': `Alinhamento da coluna ${j + 1}`, 'data-dica': 'Alinhamento do conteúdo da coluna no slide.' },
        ...Object.entries(R.ROTULO_ALINHAMENTO).map(([k, rotulo]) => U.el('option', { value: k, selected: k === al }, rotulo)));
      sel.addEventListener('change', () => { m.alinhamentos[j] = sel.value; marcarSujo(); });
      const retirar = botao('×', `Retira a coluna ${j + 1} da grade (efetivado ao gravar).`, () => {
        if (m.cabecalho.length <= 1) return;
        m.cabecalho.splice(j, 1); m.alinhamentos.splice(j, 1); m.linhas.forEach((l) => l.splice(j, 1));
        marcarSujo(); montarGrade();
      }, 'botao botao-discreto botao-icone');
      retirar.setAttribute('aria-label', `Retirar a coluna ${j + 1}`);
      alinha.append(U.el('td', null, U.el('div', { class: 'grade-coluna' }, sel, retirar)));
    });
    thead.append(alinha);
    const tbody = U.el('tbody');
    m.linhas.forEach((l, i) => {
      const retirar = botao('×', `Retira a linha ${i + 1} da grade (efetivado ao gravar).`, () => { m.linhas.splice(i, 1); marcarSujo(); montarGrade(); }, 'botao botao-discreto botao-icone');
      retirar.setAttribute('aria-label', `Retirar a linha ${i + 1}`);
      tbody.append(U.el('tr', null, U.el('th', { scope: 'row' }, retirar),
        ...l.map((v, j) => U.el('td', null, campo(v, `Linha ${i + 1}, coluna ${j + 1}`, (x) => { m.linhas[i][j] = x; })))));
    });
    tabela.append(thead, tbody);

    const acoes = U.el('div', { class: 'grupo-botoes' },
      botao('+ Linha', 'Acrescenta uma linha vazia ao fim da grade.', () => {
        if (m.linhas.length >= LIMITE_LINHAS) return;
        m.linhas.push(new Array(n).fill('')); marcarSujo(); montarGrade();
        U.$('#tabelas-corpo tbody tr:last-child input')?.focus();
      }),
      botao('+ Coluna', `Acrescenta uma coluna à direita (até ${LIMITE_COLUNAS}).`, () => {
        if (n >= LIMITE_COLUNAS) return;
        m.cabecalho.push(`Coluna ${n + 1}`); m.alinhamentos.push(''); m.linhas.forEach((l) => l.push(''));
        marcarSujo(); montarGrade();
      }));

    const estilos = U.el('fieldset', { class: 'campo-grupo' }, U.el('legend', { class: 'campo-rotulo' }, 'Estilo'),
      ...CLASSES_SIMPLES.map((c) => {
        const caixa = U.el('input', { type: 'checkbox', checked: m.classes.includes(c), 'data-dica': dicaClasse(c) });
        caixa.addEventListener('change', () => {
          m.classes = caixa.checked ? Array.from(new Set([...m.classes, c])) : m.classes.filter((x) => x !== c);
          marcarSujo();
        });
        return U.el('label', { class: 'opcao' }, caixa, R.rotulo(R.ROTULO_CLASSE_TABELA, c));
      }),
      campoDestaque(m, 'linha', m.linhas.length),
      campoDestaque(m, 'coluna', n));

    corpo.replaceChildren(U.el('div', { class: 'grade-rolagem' }, tabela), acoes, estilos, acoesFinais(() => gravar(TB.escreverTabela(m)), () => converterGfmEmGrafico(m)));
  }

  function dicaClasse(c) {
    return {
      zebra: 'Linhas alternadas em tom mais escuro, para facilitar a leitura.',
      compacta: 'Reduz o espaço entre as linhas, para tabelas maiores.',
      numerica: 'Colunas só com números são formatadas no padrão brasileiro (1.234,50) e alinhadas à direita.',
    }[c];
  }

  function campoDestaque(m, eixo, maximo) {
    const prefixo = `destacar-${eixo}-`;
    const atual = m.classes.find((c) => c.startsWith(prefixo));
    const valor = atual ? Number(atual.slice(prefixo.length)) : 0;
    const campo = U.el('input', {
      type: 'number', class: 'entrada', min: '0', max: String(Math.min(20, maximo)), step: '1', value: String(valor), style: '--largura: 4ch', inputmode: 'numeric',
      'data-dica': `Número da ${eixo} a realçar (1 a ${Math.min(20, maximo)}); 0 para nenhuma. Aceita apenas algarismos.`,
    });
    campo.addEventListener('input', () => {
      campo.value = campo.value.replace(/\D/g, '');
      const n = Math.max(0, Math.min(Math.min(20, maximo), Number(campo.value) || 0));
      m.classes = m.classes.filter((c) => !c.startsWith(prefixo));
      if (n) m.classes.push(`${prefixo}${n}`);
      marcarSujo();
    });
    return U.el('label', { class: 'opcao' }, `Realçar ${eixo}`, campo);
  }

  function acoesFinais(aoGravar, aoConverter) {
    const gravarBtn = botao('Gravar no texto', 'Substitui a tabela no editor pelo conteúdo da grade. Ctrl+Z no editor desfaz.', () => {
      if (aoGravar()) O.ui.notificar('Tabela gravada no texto.', { gravidade: 'ok' });
    }, 'botao botao-primario');
    const converter = botao('Converter em gráfico', 'Insere, logo após a tabela, um gráfico alternável com os mesmos dados; a tabela permanece. Grave antes as alterações pendentes.', aoConverter);
    const recarregar = botao('Recarregar do texto', 'Descarta as alterações da grade e relê a tabela do editor.', () => { limparSujo(); atualizar(true); }, 'botao botao-discreto');
    return U.el('div', { class: 'grupo-botoes' }, gravarBtn, converter, recarregar);
  }

  function converterGfmEmGrafico(m) {
    if (sujo) { O.ui.notificar('Grave as alterações da tabela antes de convertê-la em gráfico.', { gravidade: 'aviso' }); return; }
    const csv = paraCsv(m.cabecalho, m.linhas).split('\n').map((l) => `  ${l}`).join('\n');
    const bloco = `\`\`\`grafico\ntipo: barras\nrotulos: ${m.cabecalho[0]}\ndados: |\n${csv}\n\`\`\``;
    O.ui.editor.irParaLinha(alvo.fim, { focar: false });
    O.ui.editor.substituir(O.ui.editor.fimDaLinha(alvo.fim), O.ui.editor.fimDaLinha(alvo.fim), `\n\n${bloco}`);
    O.ui.notificar('Gráfico inserido logo após a tabela.', { gravidade: 'ok' });
  }

  // ── Bloco ```tabela ────────────────────────────────────────────────────
  function csvsDoAcervo() {
    return Object.values(E.obter('projeto.acervo') || {}).filter((i) => i.tipo === 'csv');
  }

  function montarBloco() {
    const spec = Object.assign({}, alvo.spec || {});
    const corpo = U.$('#tabelas-corpo');
    const fontes = csvsDoAcervo();
    let colunasDisponiveis = [];
    const lerColunas = () => {
      try { colunasDisponiveis = O.conteudo.dados.obter(spec.fonte, U.criarBuscaPorNome(E.obter('projeto.acervo') || {})).colunas; } catch (_) { colunasDisponiveis = []; }
    };
    lerColunas();

    const fonte = U.el('select', { class: 'entrada', style: '--largura: 30ch', 'data-dica': 'Planilha CSV do acervo de onde vêm os dados.' },
      ...fontes.map((f) => U.el('option', { value: f.nome, selected: f.nome === spec.fonte }, f.nome)),
      fontes.some((f) => f.nome === spec.fonte) ? null : U.el('option', { value: spec.fonte || '', selected: true }, `${spec.fonte || '(nenhuma)'} — ausente do acervo`));
    const colunas = U.el('input', { type: 'text', class: 'entrada', style: '--largura: 40ch', value: O.conteudo.dados.lista(spec.colunas).join(', '), 'data-dica': 'Colunas a exibir, separadas por vírgula, na ordem desejada. Vazio: todas. Acentos e maiúsculas são indiferentes.' });
    const ordenar = U.el('input', { type: 'text', class: 'entrada', style: '--largura: 28ch', value: spec.ordenar || '', 'data-dica': 'Coluna pela qual ordenar, seguida de "desc" (maior primeiro) ou "asc". Vazio: ordem da planilha.' });
    const limite = U.el('input', { type: 'number', class: 'entrada', min: '0', max: '1000', style: '--largura: 6ch', inputmode: 'numeric', value: spec.limite || '', 'data-dica': 'Quantidade máxima de linhas; vazio ou 0 para todas. Tabelas longas são divididas em slides automaticamente.' });
    const disponiveis = U.el('p', { class: 'cartao-nota' });
    const mostrarDisponiveis = () => { disponiveis.textContent = colunasDisponiveis.length ? `Colunas da planilha: ${colunasDisponiveis.join(', ')}.` : 'Planilha não encontrada no acervo.'; };
    mostrarDisponiveis();
    fonte.addEventListener('change', () => { spec.fonte = fonte.value; lerColunas(); mostrarDisponiveis(); marcarSujo(); });
    colunas.addEventListener('input', () => { colunas.value = colunas.value.replace(/[\r\n|]/g, ''); marcarSujo(); });
    ordenar.addEventListener('input', () => { ordenar.value = ordenar.value.replace(/[\r\n|:]/g, ''); marcarSujo(); });
    limite.addEventListener('input', () => { limite.value = limite.value.replace(/\D/g, ''); marcarSujo(); });

    const classesAtuais = String(spec.classes || '').split(/[\s,]+/).filter(Boolean);
    const caixas = CLASSES_SIMPLES.map((c) => {
      const caixa = U.el('input', { type: 'checkbox', checked: classesAtuais.includes(c), 'data-dica': dicaClasse(c) });
      caixa.addEventListener('change', marcarSujo);
      return { c, caixa };
    });

    const escrever = () => {
      const linhas = ['```tabela', `fonte: ${fonte.value}`];
      if (colunas.value.trim()) linhas.push(`colunas: ${colunas.value.trim()}`);
      if (ordenar.value.trim()) linhas.push(`ordenar: ${ordenar.value.trim()}`);
      if (Number(limite.value) > 0) linhas.push(`limite: ${Number(limite.value)}`);
      const outras = classesAtuais.filter((c) => !CLASSES_SIMPLES.includes(c));
      const cls = [...caixas.filter((x) => x.caixa.checked).map((x) => x.c), ...outras];
      if (cls.length) linhas.push(`classes: ${cls.join(' ')}`);
      linhas.push('```');
      return linhas.join('\n');
    };

    const rotulado = (rotulo, campo) => U.el('label', { class: 'campo' }, U.el('span', { class: 'campo-rotulo' }, rotulo), campo);
    corpo.replaceChildren(
      rotulado('Planilha', fonte), disponiveis, rotulado('Colunas', colunas), rotulado('Ordenar por', ordenar), rotulado('Limite de linhas', limite),
      U.el('fieldset', { class: 'campo-grupo' }, U.el('legend', { class: 'campo-rotulo' }, 'Estilo'),
        ...caixas.map(({ c, caixa }) => U.el('label', { class: 'opcao' }, caixa, R.rotulo(R.ROTULO_CLASSE_TABELA, c)))),
      acoesFinais(() => gravar(escrever()), () => {
        if (sujo) { O.ui.notificar('Grave as alterações antes de converter em gráfico.', { gravidade: 'aviso' }); return; }
        const linhas = ['```grafico', 'tipo: barras', `fonte: ${fonte.value}`];
        const cols = O.conteudo.dados.lista(colunas.value);
        if (cols.length > 1) { linhas.push(`rotulos: ${cols[0]}`, `series: ${cols.slice(1).join(', ')}`); }
        if (ordenar.value.trim()) linhas.push(`ordenar: ${ordenar.value.trim()}`);
        linhas.push(`limite: ${Math.min(Number(limite.value) || 8, 12)}`, '```');
        O.ui.editor.substituir(O.ui.editor.fimDaLinha(alvo.fim), O.ui.editor.fimDaLinha(alvo.fim), `\n\n${linhas.join('\n')}`);
        O.ui.notificar('Gráfico inserido logo após a tabela.', { gravidade: 'ok' });
      }));
  }

  // ── Fora de tabela: nova tabela ou importação de planilha ──────────────
  function montarNova() {
    const corpo = U.$('#tabelas-corpo');
    const linhas = U.el('input', { type: 'number', class: 'entrada', min: '1', max: '50', value: '3', style: '--largura: 4ch', inputmode: 'numeric', 'data-dica': 'Quantidade de linhas de dados (1 a 50), além do cabeçalho.' });
    const colunas = U.el('input', { type: 'number', class: 'entrada', min: '1', max: String(LIMITE_COLUNAS), value: '3', style: '--largura: 4ch', inputmode: 'numeric', 'data-dica': `Quantidade de colunas (1 a ${LIMITE_COLUNAS}).` });
    [linhas, colunas].forEach((c) => c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, ''); }));
    const inserir = botao('Inserir tabela no cursor', 'Insere uma tabela vazia com o tamanho escolhido; depois, com o cursor nela, edite-a aqui (Ctrl+Z desfaz).', () => {
      const nl = Math.max(1, Math.min(50, Number(linhas.value) || 3));
      const nc = Math.max(1, Math.min(LIMITE_COLUNAS, Number(colunas.value) || 3));
      const m = { cabecalho: Array.from({ length: nc }, (_, j) => `Coluna ${j + 1}`), alinhamentos: new Array(nc).fill(''), linhas: Array.from({ length: nl }, () => new Array(nc).fill('')), classes: ['zebra'], extras: [] };
      O.ui.editor.inserirNoCursor(TB.escreverTabela(m), { bloco: true, cursor: 2 });
      atualizar(true);
    }, 'botao botao-primario');

    const fontes = csvsDoAcervo();
    const escolha = U.el('select', { class: 'entrada', style: '--largura: 30ch', 'data-dica': 'Planilha CSV do acervo a transformar em tabela.' },
      ...fontes.map((f) => U.el('option', { value: f.nome }, f.nome)));
    const limite = U.el('input', { type: 'number', class: 'entrada', min: '1', max: String(LIMITE_LINHAS), value: '12', style: '--largura: 5ch', inputmode: 'numeric', 'data-dica': `Quantidade máxima de linhas copiadas (até ${LIMITE_LINHAS}).` });
    limite.addEventListener('input', () => { limite.value = limite.value.replace(/\D/g, ''); });
    const comoBloco = botao('Como bloco de dados', 'Insere um bloco ```tabela que lê a planilha do acervo a cada exibição: atualizar a planilha atualiza o slide.', () => {
      if (!escolha.value) return;
      O.ui.editor.inserirNoCursor(`\`\`\`tabela\nfonte: ${escolha.value}\nlimite: ${Number(limite.value) || 12}\nclasses: zebra numerica\n\`\`\``, { bloco: true });
      atualizar(true);
    });
    const comoTexto = botao('Como tabela escrita', 'Copia as linhas da planilha para o texto, como tabela editável célula a célula.', () => {
      const item = fontes.find((f) => f.nome === escolha.value);
      if (!item) return;
      const d = O.conteudo.dados.lerCsv(item.texto);
      const cols = d.colunas.slice(0, LIMITE_COLUNAS);
      const n = Math.max(1, Math.min(LIMITE_LINHAS, Number(limite.value) || 12));
      const m = { cabecalho: cols, alinhamentos: new Array(cols.length).fill(''), linhas: d.linhas.slice(0, n).map((l) => cols.map((c) => l[c] ?? '')), classes: ['zebra', 'numerica'], extras: [] };
      O.ui.editor.inserirNoCursor(TB.escreverTabela(m), { bloco: true });
      atualizar(true);
    });
    if (!fontes.length) {
      [escolha, limite, comoBloco, comoTexto].forEach((c) => O.ui.dicas.indisponivel(c, 'Não há planilhas CSV no acervo. Acrescente uma pela aba Acervo ou arrastando o arquivo para a janela.'));
    }

    const rotulado = (rotulo, campo) => U.el('label', { class: 'opcao' }, rotulo, campo);
    corpo.replaceChildren(
      U.el('h3', null, 'Nova tabela'),
      U.el('div', { class: 'grupo-campos' }, rotulado('Linhas', linhas), rotulado('Colunas', colunas)),
      U.el('div', { class: 'grupo-botoes' }, inserir),
      U.el('h3', null, 'A partir de uma planilha'),
      U.el('div', { class: 'grupo-campos' }, U.el('label', { class: 'campo' }, U.el('span', { class: 'campo-rotulo' }, 'Planilha'), escolha), rotulado('Até', limite)),
      U.el('div', { class: 'grupo-botoes' }, comoBloco, comoTexto));
  }

  // ═══════════════════════════ Sincronização com o cursor ═══════════════════════════

  function atualizar(forcar = false) {
    if (!painel || O.ui.abas.atual() !== 'tabelas') return;
    if (sujo && !forcar) return; // edição em curso fica presa à tabela escolhida
    const texto = O.ui.editor.texto();
    const novo = TB.localizar(texto, O.ui.editor.linhaAtual());
    const mesmo = novo && alvo && novo.tipo === alvo.tipo && novo.inicio === alvo.inicio && novo.original === alvo.original;
    if (mesmo && !forcar) return;
    alvo = novo;
    limparSujo();
    if (!alvo) {
      cabecalhoPainel('O cursor não está numa tabela. Leve-o a uma tabela do texto para editá-la aqui, ou crie uma nova.');
      montarNova();
    } else if (alvo.tipo === 'gfm') {
      cabecalhoPainel(`Tabela escrita nas linhas ${alvo.inicio}–${alvo.fim}: ${alvo.modelo.cabecalho.length} coluna(s) × ${alvo.modelo.linhas.length} linha(s).`);
      montarGrade();
    } else {
      cabecalhoPainel(`Tabela de planilha (bloco de dados) nas linhas ${alvo.inicio}–${alvo.fim}.`);
      montarBloco();
    }
  }

  TB.iniciar = function () {
    painel = U.$('#painel-tabelas');
    if (!painel) return;
    const agendar = U.debounce(() => atualizar(), 250);
    E.ouvir('editor:cursor', agendar);
    E.observar('projeto.markdown', agendar);
    E.observar('projeto.acervo', () => { if (!sujo) atualizar(true); });
    E.ouvir('aba:ativada', ({ aba }) => { if (aba === 'tabelas') atualizar(true); });
    atualizar(true);
  };
})(window.Oratoria);
