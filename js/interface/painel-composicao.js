// js/interface/painel-composicao.js — aba Composição: origem do texto (abrir arquivos ou pasta,
// novo projeto, exemplos) e inserção de blocos prontos (layouts de slide e blocos de conteúdo).
//
//   O.ui.composicao.iniciar()
//   O.ui.composicao.novoProjeto()          → projeto em branco com cabeçalho mínimo
//   await O.ui.composicao.abrirExemplo(id) → carrega um deck de exemplo (D22)
//
// Os layouts são inseridos como NOVO slide logo após o slide sob o cursor; os blocos de
// conteúdo, no cursor, entre linhas em branco. Toda inserção é desfazível (Ctrl+Z).

(function (O) {
  'use strict';

  const PC = (O.ui.composicao = {});
  const U = O.util;
  const E = O.estado;
  const R = O.rotulos;

  // ═══════════════════════════ Modelos ═══════════════════════════

  /** Modelo de slide por layout. `cursor`: posição do cursor dentro do texto inserido. */
  const MODELOS_LAYOUT = {
    'secao': { texto: '<!-- layout: secao -->\n# Título da seção\n\nSubtítulo opcional\n', dica: 'Divisor de seção: número de ordem e título centralizado.' },
    'conteudo': { texto: '## Título do slide\n\n- Primeiro ponto\n- Segundo ponto\n', dica: 'Título e corpo (listas, parágrafos, código). É o layout padrão.' },
    'duas-colunas': { texto: '<!-- layout: duas-colunas -->\n## Título do slide\n\n::: colunas\n::: coluna\n### À esquerda\nTexto da primeira coluna.\n:::\n::: coluna\n### À direita\nTexto da segunda coluna.\n:::\n:::\n', dica: 'Duas colunas lado a lado; a proporção pode ser alterada com colunas: 60/40.' },
    'imagem-lateral': { texto: '<!-- layout: imagem-lateral -->\n## Título do slide\n\n![Descreva a imagem](nome-da-imagem.jpg)\n\n- Ponto ao lado da imagem\n', dica: 'Imagem ocupando 45% da largura, com o texto ao lado. Troque o nome pelo de uma imagem do acervo.' },
    'imagem-fundo': { texto: '<!-- layout: imagem-fundo; fundo: nome-da-imagem.jpg -->\n# Título sobre a imagem\n', dica: 'Imagem em tela inteira, com camada que garante a leitura do título.' },
    'citacao': { texto: '<!-- layout: citacao -->\n> A frase citada, em destaque.\n>\n> — Autoria\n', dica: 'Citação em letra serifada grande, com a autoria em versalete.' },
    'tabela': { texto: '<!-- layout: tabela -->\n## Título da tabela\n\n| Coluna A | Coluna B |\n|----------|---------:|\n| Texto    | 1.234,50 |\n| Texto    | 678      |\n{.zebra .numerica}\n', dica: 'Aproveita toda a área útil para a tabela; tabelas longas são paginadas.' },
    'encerramento': { texto: '<!-- layout: encerramento -->\n# Obrigado\n\ncontato@exemplo.gov.br\n', dica: 'Agradecimento e contato, centralizados.' },
  };

  function primeiroDoAcervo(tipo) {
    const acervo = E.obter('projeto.acervo') || {};
    return Object.values(acervo).find((i) => i.tipo === tipo) || null;
  }

  /** Blocos de conteúdo inseridos no cursor. `texto` pode ser função (depende do acervo). */
  const BLOCOS = [
    { chave: 'fragmento', texto: '::: fragmento\n- Aparece primeiro\n- Aparece em seguida\n- Aparece por último\n:::', dica: 'Lista revelada item a item durante a apresentação.' },
    { chave: 'destaque', texto: '::: destaque\nTexto em evidência, na cor de acento do tema.\n:::', dica: 'Bloco de ênfase na cor de acento do tema.' },
    { chave: 'notas', texto: '::: notas\nLembretes para quem apresenta; nunca aparecem no slide.\n:::', dica: 'Notas do orador, visíveis apenas no modo apresentador.' },
    { chave: 'colunas', texto: '::: colunas\n::: coluna\nColuna da esquerda\n:::\n::: coluna\nColuna da direita\n:::\n:::', dica: 'Duas colunas dentro do slide atual.' },
    {
      chave: 'imagem',
      texto: () => { const img = primeiroDoAcervo('imagem'); return `![${img?.alt || 'Descreva a imagem'}](${img ? img.nome : 'nome-da-imagem.jpg'}){.contida}`; },
      dica: 'Referência a uma imagem do acervo (a primeira, se houver). Descreva-a entre os colchetes.',
    },
    { chave: 'tabela', texto: '| Coluna A | Coluna B |\n|----------|---------:|\n| Texto    | 1.234,50 |\n| Texto    | 678      |\n{.zebra .numerica}', dica: 'Tabela escrita à mão, com linhas alternadas e números em padrão brasileiro. Edite-a na aba Tabelas.' },
    {
      chave: 'tabela-dados',
      texto: () => { const csv = primeiroDoAcervo('csv'); return `\`\`\`tabela\nfonte: ${csv ? csv.nome : 'dados.csv'}\nlimite: 10\nclasses: zebra numerica\n\`\`\``; },
      dica: 'Tabela montada a partir de uma planilha CSV do acervo (a primeira, se houver).',
    },
    {
      chave: 'grafico',
      texto: () => {
        const csv = primeiroDoAcervo('csv');
        if (csv) return `\`\`\`grafico\ntipo: barras\nfonte: ${csv.nome}\nlimite: 8\ntitulo: Título do gráfico\n\`\`\``;
        return '```grafico\ntipo: barras\ntitulo: Título do gráfico\ndados: |\n  Categoria,Valor\n  Primeira,38\n  Segunda,27\n  Terceira,35\n```';
      },
      dica: 'Gráfico alternável (barras, linhas, pizza, rosca), a partir de uma planilha do acervo ou de dados escritos no próprio bloco.',
    },
    { chave: 'codigo', texto: '```sql\nSELECT orgao, SUM(valor) AS total\nFROM despesa\nGROUP BY orgao;\n```', dica: 'Bloco de código com realce (js, python, sql, bash, json, html, css).' },
  ];

  // ═══════════════════════════ Inserção ═══════════════════════════

  function inserirLayout(id) {
    const modelo = MODELOS_LAYOUT[id];
    const r = O.ui.previa.interpretacao();
    if (!r || !r.slides.length) {
      O.ui.editor.inserirNoCursor(modelo.texto, { bloco: true });
    } else {
      const atual = r.slides[O.ui.previa.slideAtual()] || r.slides[r.slides.length - 1];
      O.ui.editor.inserirAposLinha(atual.linhaFim, modelo.texto);
    }
    O.ui.anunciar(`Slide "${R.rotuloLayout(id)}" inserido após o slide atual.`);
  }

  function inserirBloco(bloco) {
    const texto = typeof bloco.texto === 'function' ? bloco.texto() : bloco.texto;
    O.ui.editor.inserirNoCursor(texto, { bloco: true });
    O.ui.anunciar(`${R.rotuloBloco(bloco.chave)} inserido no cursor.`);
  }

  function montarBotoes() {
    const layouts = U.$('#lista-layouts');
    if (layouts) {
      const ids = O.layouts.lista().filter((id) => id !== 'titulo' && MODELOS_LAYOUT[id]);
      layouts.replaceChildren(...ids.map((id) => U.el('button', {
        type: 'button', class: 'botao botao-bloco', 'data-layout': id,
        'data-dica': `${MODELOS_LAYOUT[id].dica} Insere um novo slide logo após o slide sob o cursor (Ctrl+Z desfaz).`,
        onclick: () => inserirLayout(id),
      }, R.rotuloLayout(id))));
    }
    const blocos = U.$('#lista-blocos');
    if (blocos) {
      blocos.replaceChildren(...BLOCOS.map((b) => U.el('button', {
        type: 'button', class: 'botao botao-bloco', 'data-bloco': b.chave,
        'data-dica': `${b.dica} Inserido no cursor (Ctrl+Z desfaz).`,
        onclick: () => inserirBloco(b),
      }, R.rotuloBloco(b.chave))));
    }
  }

  // ═══════════════════════════ Projeto ═══════════════════════════

  function modeloNovo() {
    return [
      '---',
      'titulo: Nova apresentação',
      'autor: ',
      `data: ${U.dataIso()}`,
      `tema: ${O.config.TEMA_PADRAO}`,
      'numeracao: true',
      '---',
      '',
      '---',
      '## Primeiro assunto',
      '',
      '- Um ponto',
      '- Outro ponto',
      '',
    ].join('\n');
  }

  PC.novoProjeto = function () {
    E.carregarProjeto({ markdown: modeloNovo(), titulo: '' });
    O.ui.editor.irParaLinha(2);
    O.ui.anunciar('Projeto novo criado.');
  };

  let exemplos = null;
  async function carregarExemplos() {
    if (exemplos) return exemplos;
    const bruto = await O.carregador.embutivel('exemplos');
    exemplos = JSON.parse(bruto);
    return exemplos;
  }

  PC.abrirExemplo = async function (id) {
    const lista = await carregarExemplos();
    const ex = lista.find((e) => e.id === id);
    if (!ex) return;
    const acervo = {};
    for (const [nome, a] of Object.entries(ex.arquivos || {})) {
      const bytes = a.tipo === 'csv' ? new TextEncoder().encode(a.texto).length : U.bytesDeDataUrl(a.dataUrl);
      acervo[nome] = Object.assign({ nome, alt: '', bytes, bytesOriginais: bytes, decisao: 'arquivo de exemplo, sem recompressão', adicionadoEm: Date.now() }, a);
    }
    E.carregarProjeto({ markdown: ex.markdown, acervo, titulo: ex.titulo });
    O.ui.editor.irParaLinha(1);
    O.ui.notificar(`Exemplo "${ex.titulo}" aberto, com ${Object.keys(acervo).length} arquivo(s) no acervo.`, { gravidade: 'ok' });
  };

  async function montarExemplos() {
    const alvo = U.$('#lista-exemplos');
    if (!alvo || alvo.dataset.montado) return;
    alvo.dataset.montado = '1';
    try {
      const lista = await carregarExemplos();
      alvo.replaceChildren(...lista.map((ex) => {
        const tema = O.temas.obter(ex.tema);
        const botao = U.el('button', {
          type: 'button', class: 'botao botao-exemplo', 'data-exemplo': ex.id,
          'data-dica': `Abre o exemplo "${ex.titulo}" no tema ${tema?.nome || ex.tema} (${R.rotuloAmbiente(tema?.ambiente)}), com imagens e planilhas. Substitui o projeto atual — exporte-o antes, se quiser guardá-lo.`,
        }, U.el('span', { class: 'exemplo-tema' }, tema?.nome || ex.tema), U.el('span', { class: 'exemplo-titulo' }, ex.titulo));
        O.ui.doisToques(botao, 'Substituir o projeto atual?', () => PC.abrirExemplo(ex.id), { exigir: () => !!(E.obter('projeto.markdown') || '').trim() });
        return botao;
      }));
    } catch (e) {
      alvo.replaceChildren(U.el('p', { class: 'cartao-nota' }, `Exemplos indisponíveis: ${e.message}`));
    }
  }

  // ═══════════════════════════ Início ═══════════════════════════

  PC.iniciar = function () {
    montarBotoes();
    U.$('#botao-abrir-arquivos')?.addEventListener('click', () => O.ui.ingestao.escolherArquivos());
    U.$('#botao-abrir-pasta')?.addEventListener('click', () => O.ui.ingestao.escolherPasta());
    const novo = U.$('#botao-novo-projeto');
    if (novo) O.ui.doisToques(novo, 'Descartar o texto atual?', PC.novoProjeto, { exigir: () => !!(E.obter('projeto.markdown') || '').trim() });
    E.ouvir('aba:ativada', ({ aba }) => { if (aba === 'composicao') montarExemplos(); });
    if (O.ui.abas.atual() === 'composicao') montarExemplos();
  };
})(window.Oratoria);
