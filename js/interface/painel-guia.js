// js/interface/painel-guia.js — aba Guia (§4, §5.2): referência da sintaxe com exemplos
// prontos para copiar ou inserir no cursor, e atalhos de apresentação. Remete ao manual
// operacional (docs/manual-operacional.md) para o percurso completo.
//
//   O.ui.guia.iniciar()   — monta o conteúdo na primeira ativação da aba

(function (O) {
  'use strict';

  const GU = (O.ui.guia = {});
  const U = O.util;
  const E = O.estado;

  const SECOES = [
    {
      titulo: 'Cabeçalho',
      texto: 'No início do texto, entre duas linhas ---. Define título, autoria, tema e opções gerais. O primeiro slide pode ficar vazio: a capa é montada com esses dados.',
      exemplo: '---\ntitulo: Introdução ao Orçamento Público\nsubtitulo: Conceitos e instrumentos\nautor: Seu nome\ndata: 2026-10-05\ntema: aurora\nproporcao: "16:9"\nrodape: "SEPLAG/CE · Uso educacional"\nnumeracao: true\ntransicao: suave\n---',
      inserivel: false,
    },
    {
      titulo: 'Separar slides',
      texto: 'Uma linha contendo só três hífens inicia um novo slide. Dentro de blocos de código, é texto comum.',
      exemplo: '## Primeiro slide\n\nTexto do primeiro slide.\n\n---\n## Segundo slide\n\nTexto do segundo slide.',
    },
    {
      titulo: 'Instruções por slide',
      texto: 'No início do slide, entre <!-- e -->; várias podem ir na mesma linha, separadas por ponto e vírgula. Layouts: titulo, secao, conteudo, duas-colunas, imagem-lateral, imagem-fundo, citacao, tabela, encerramento.',
      exemplo: '<!-- layout: imagem-lateral; lado: direita -->\n## Título do slide\n\n![Descreva a imagem](foto.jpg)\n\n- Ponto ao lado da imagem',
    },
    {
      titulo: 'Revelação, destaque e notas',
      texto: 'Contêineres marcados por três dois-pontos. No fragmento, uma lista aparece item a item. As notas só aparecem no modo apresentador.',
      exemplo: '::: fragmento\n- Aparece primeiro\n- Aparece depois\n:::\n\n::: destaque\nTexto em evidência.\n:::\n\n::: notas\nLembrete para quem apresenta.\n:::',
    },
    {
      titulo: 'Colunas',
      texto: 'Duas colunas dentro de qualquer slide. Com o layout duas-colunas, a proporção pode ser ajustada por <!-- colunas: 60/40 -->.',
      exemplo: '::: colunas\n::: coluna\nColuna da esquerda\n:::\n::: coluna\nColuna da direita\n:::\n:::',
    },
    {
      titulo: 'Imagens',
      texto: 'Procuradas no Acervo pelo nome do arquivo. A descrição entre colchetes é lida por leitores de tela. Estilos: .contida, .sombra, .borda, .redonda; tamanho com width=.',
      exemplo: '![Mapa do Ceará com as regiões de planejamento](mapa.png){.contida .sombra width=60%}',
    },
    {
      titulo: 'Tabelas',
      texto: 'Colunas separadas por barras; a segunda linha define o alinhamento (---: à direita, :---: ao centro). Estilos na linha logo abaixo. Tabelas longas são divididas em slides automaticamente.',
      exemplo: '| Órgão  | Dotação   | Empenhado |\n|--------|----------:|----------:|\n| SEPLAG | 1234567,5 | 987654,25 |\n| SEDUC  | 9876543   | 8765432   |\n{.zebra .numerica .destacar-linha-2}',
    },
    {
      titulo: 'Tabela de planilha',
      texto: 'Monta a tabela a partir de um CSV do Acervo, com colunas, ordenação e limite.',
      exemplo: '```tabela\nfonte: execucao_2025.csv\ncolunas: Órgão, Dotação, Empenhado\nordenar: Dotação desc\nlimite: 12\nclasses: zebra numerica\n```',
    },
    {
      titulo: 'Gráficos',
      texto: 'Tipos: barras, linhas, pizza, rosca. Durante a apresentação, botões trocam o tipo. Os dados vêm de um CSV do Acervo ou do próprio bloco.',
      exemplo: '```grafico\ntipo: rosca\ntitulo: Participação por área\ndados: |\n  Área,Participação\n  Educação,38\n  Saúde,27\n  Outras,35\n```',
    },
    {
      titulo: 'Código',
      texto: 'Blocos com realce para js, python, sql, bash, json, html e css.',
      exemplo: '```sql\nSELECT orgao, SUM(valor) AS total\nFROM despesa\nGROUP BY orgao;\n```',
    },
  ];

  const ATALHOS = [
    ['→ ↓ Espaço PageDown', 'Avança: revela o próximo item ou passa ao slide seguinte'],
    ['← ↑ PageUp', 'Volta'],
    ['Home / End', 'Primeiro / último slide'],
    ['G, número, Enter', 'Vai direto ao slide'],
    ['O', 'Visão geral em miniaturas'],
    ['P', 'Modo apresentador em outra janela'],
    ['B ou .', 'Escurece a tela'],
    ['F', 'Tela cheia'],
    ['Esc', 'Fecha a visão geral; no editor, encerra a apresentação'],
  ];

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (_) {
      const area = U.el('textarea', { style: 'position:fixed;left:-9999px', 'aria-hidden': 'true', 'data-dica-dispensada': '' });
      area.value = texto;
      document.body.append(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
      area.remove();
      return ok;
    }
  }

  function secao(s) {
    const botoes = [U.el('button', {
      type: 'button', class: 'botao botao-discreto',
      'data-dica': 'Copia o exemplo para a área de transferência.',
      onclick: async () => O.ui.notificar(await copiar(s.exemplo) ? `Exemplo "${s.titulo}" copiado.` : 'O navegador não permitiu copiar; selecione o exemplo e use Ctrl+C.', { gravidade: 'info' }),
    }, 'Copiar')];
    if (s.inserivel !== false) {
      botoes.push(U.el('button', {
        type: 'button', class: 'botao botao-discreto',
        'data-dica': 'Insere o exemplo no cursor do editor (Ctrl+Z desfaz).',
        onclick: () => O.ui.editor.inserirNoCursor(s.exemplo, { bloco: true }),
      }, 'Inserir no cursor'));
    } else {
      botoes.push(U.el('button', {
        type: 'button', class: 'botao botao-discreto',
        'data-dica': 'Acrescenta um cabeçalho no início do texto, se ainda não houver (Ctrl+Z desfaz).',
        onclick: () => {
          const texto = O.ui.editor.texto();
          if (Object.keys(O.conteudo.extrairFrontMatter(texto).meta || {}).length || /^﻿?---[ \t]*\n/.test(texto)) {
            O.ui.notificar('O texto já tem cabeçalho; edite-o diretamente ou pela aba Tema.', { gravidade: 'info' });
            return;
          }
          O.ui.editor.substituir(0, 0, `${s.exemplo}\n\n`, { selecao: 0, focarEditor: true });
        },
      }, 'Acrescentar ao texto'));
    }
    return U.el('section', { class: 'cartao guia-secao', 'data-cor': 'guia' },
      U.el('h3', null, s.titulo),
      U.el('p', { class: 'cartao-nota' }, s.texto),
      U.el('pre', { class: 'guia-exemplo', tabindex: '0', 'aria-label': `Exemplo: ${s.titulo}`, 'data-dica-dispensada': '' }, U.el('code', null, s.exemplo)),
      U.el('div', { class: 'grupo-botoes' }, ...botoes));
  }

  function montar() {
    const alvo = U.$('#conteudo-guia');
    if (!alvo || alvo.dataset.montado) return;
    alvo.dataset.montado = '1';
    const atalhos = U.el('section', { class: 'cartao', 'data-cor': 'guia' },
      U.el('h3', null, 'Atalhos durante a apresentação'),
      U.el('table', { class: 'tabela-simples' },
        U.el('tbody', null, ...ATALHOS.map(([tecla, efeito]) => U.el('tr', null, U.el('th', { scope: 'row' }, U.el('kbd', null, tecla)), U.el('td', null, efeito))))));
    const manual = U.el('section', { class: 'cartao', 'data-cor': 'guia' },
      U.el('h3', null, 'Manual de uso'),
      U.el('p', { class: 'cartao-nota' }, 'O percurso completo — do texto à apresentação, a escolha do tema conforme o ambiente e a solução de problemas — está no manual operacional, em docs/manual-operacional.md, na pasta da aplicação.'));
    alvo.replaceChildren(...SECOES.map(secao), atalhos, manual);
  }

  GU.iniciar = function () {
    E.ouvir('aba:ativada', ({ aba }) => { if (aba === 'guia') montar(); });
    if (O.ui.abas.atual() === 'guia') montar();
  };
})(window.Oratoria);
