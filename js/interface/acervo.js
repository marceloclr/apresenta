// js/interface/acervo.js — aba Acervo (§5.2): imagens e planilhas carregadas, com miniatura,
// peso original × comprimido, decisão de compressão, texto alternativo, uso no texto,
// inserção no cursor, remoção e qualidade de compressão.
//
//   O.ui.acervo.iniciar()
//
// A lista só é reconstruída quando o conjunto de arquivos muda (assinatura do acervo): editar
// o texto alternativo não a redesenha, para não tirar o foco do campo. As contagens de uso
// acompanham o texto com atraso de 500 ms.

(function (O) {
  'use strict';

  const AC = (O.ui.acervo = {});
  const U = O.util;
  const C = O.config;
  const E = O.estado;
  const R = O.rotulos;

  let lista = null;
  let resumo = null;
  let filtro = null;
  let assinatura = null;

  const acervo = () => E.obter('projeto.acervo') || {};
  const ALT_PROIBIDOS = /[\[\]\n\r]/g;

  /** Quantas vezes o arquivo é citado no texto (pelo nome, com ou sem pasta). */
  function usos(nome, texto) {
    const alvo = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (texto.match(new RegExp(`(^|[\\s(/:])${alvo}(?=[\\s)#{"']|$)`, 'gmi')) || []).length;
  }

  function referencia(item) {
    if (item.tipo === 'imagem') return `![${item.alt || ''}](${item.nome})`;
    return `\`\`\`tabela\nfonte: ${item.nome}\nlimite: 10\nclasses: zebra numerica\n\`\`\``;
  }

  function reducao(item) {
    if (!item.bytesOriginais || item.bytesOriginais === item.bytes) return '';
    const p = 1 - item.bytes / item.bytesOriginais;
    return p > 0 ? ` (−${U.formatarPercentual(p, 0)})` : '';
  }

  // ═══════════════════════════ Cartões ═══════════════════════════

  function cartao(item) {
    const pesado = item.tipo === 'imagem' && item.bytes > C.IMAGEM_ALERTA_BYTES;
    const miniatura = item.tipo === 'imagem'
      ? U.el('img', { class: 'acervo-miniatura', src: item.dataUrl, alt: '', loading: 'lazy' })
      : U.el('span', { class: 'acervo-miniatura acervo-miniatura-dados', 'aria-hidden': 'true' }, 'CSV');
    let detalhe = '';
    if (item.tipo === 'imagem' && item.largura) detalhe = `${item.largura}×${item.altura} px · `;
    if (item.tipo === 'csv') {
      try { const d = O.conteudo.dados.lerCsv(item.texto); detalhe = `${d.colunas.length} colunas · ${d.linhas.length} linhas · `; } catch (_) { /* CSV ilegível: sem detalhe */ }
    }
    const peso = U.el('span', {
      class: 'acervo-peso',
      'data-dica-titulo': 'Peso no acervo',
      'data-dica': `${item.decisao ? `${item.decisao.charAt(0).toUpperCase()}${item.decisao.slice(1)}. ` : ''}Original: ${U.formatarBytes(item.bytesOriginais || item.bytes)}; no acervo: ${U.formatarBytes(item.bytes)}. No arquivo exportado, a imagem ocupa cerca de 4/3 desse peso (codificação base64).`,
      'data-dica-formula': 'redução = 1 − comprimido ÷ original',
    }, `${detalhe}${U.formatarBytes(item.bytes)}${reducao(item)}`);

    const uso = U.el('span', {
      class: 'selo', 'data-uso': item.nome,
      'data-dica': 'Quantas vezes o arquivo é citado no texto, pelo nome. Arquivos não citados não entram na apresentação exportada.',
    }, '…');

    const cabeca = U.el('div', { class: 'acervo-cabeca' },
      miniatura,
      U.el('div', { class: 'acervo-dados' },
        U.el('strong', { class: 'acervo-nome', title: item.nome }, item.nome),
        U.el('span', { class: 'acervo-tipo' }, R.rotulo(R.ROTULO_TIPO_ACERVO, item.tipo)),
        peso),
      U.el('div', { class: 'acervo-selos' }, uso,
        pesado ? U.el('span', { class: 'selo', 'data-estado': 'aviso', 'data-dica': `Acima de ${U.formatarBytes(C.IMAGEM_ALERTA_BYTES)}: deixa o arquivo exportado pesado. Reduza a qualidade de compressão ou use uma imagem menor.` }, 'pesada') : null));

    const partes = [cabeca];
    if (item.tipo === 'imagem') {
      const id = `alt-${U.normalizarNome(item.nome)}`;
      const campo = U.el('input', {
        id, class: 'entrada', type: 'text', maxlength: String(C.TEXTO_ALTERNATIVO_MAXIMO), style: '--largura: 44ch',
        value: item.alt || '', placeholder: 'Descreva o que a imagem mostra',
        'data-dica': `Texto alternativo: descreve a imagem para quem usa leitor de tela. É usado ao inserir a imagem pelo botão abaixo e nos fundos de slide. Até ${C.TEXTO_ALTERNATIVO_MAXIMO} caracteres; colchetes e quebras de linha não são aceitos.`,
      });
      const ajuda = U.el('span', { class: 'campo-ajuda', 'aria-live': 'polite' }, '');
      campo.addEventListener('input', () => {
        if (ALT_PROIBIDOS.test(campo.value)) {
          const pos = campo.selectionStart;
          const antes = campo.value.length;
          campo.value = campo.value.replace(ALT_PROIBIDOS, '');
          const p = Math.max(0, pos - (antes - campo.value.length));
          campo.setSelectionRange(p, p);
          ajuda.textContent = 'Colchetes e quebras de linha não são aceitos.';
          ajuda.dataset.estado = 'erro';
        } else {
          ajuda.textContent = `${campo.value.length} de ${C.TEXTO_ALTERNATIVO_MAXIMO} caracteres`;
          delete ajuda.dataset.estado;
        }
        ALT_PROIBIDOS.lastIndex = 0;
        const alt = campo.value.trim();
        E.atualizar('projeto.acervo', (a) => (a[item.nome] ? Object.assign({}, a, { [item.nome]: Object.assign({}, a[item.nome], { alt }) }) : a));
      });
      partes.push(U.el('label', { class: 'campo' }, U.el('span', { class: 'campo-rotulo' }, 'Texto alternativo'), campo, ajuda));
    }

    const acoes = U.el('div', { class: 'grupo-botoes' },
      U.el('button', {
        type: 'button', class: 'botao',
        'data-dica': item.tipo === 'imagem'
          ? 'Cita a imagem no cursor do editor, com o texto alternativo acima (Ctrl+Z desfaz).'
          : 'Insere no cursor uma tabela montada a partir desta planilha (Ctrl+Z desfaz).',
        onclick: () => { O.ui.editor.inserirNoCursor(referencia(acervo()[item.nome] || item), { bloco: true }); },
      }, item.tipo === 'imagem' ? 'Inserir no cursor' : 'Inserir tabela'),
      item.tipo === 'csv' ? U.el('button', {
        type: 'button', class: 'botao',
        'data-dica': 'Insere no cursor um gráfico de barras alternável a partir desta planilha (Ctrl+Z desfaz).',
        onclick: () => O.ui.editor.inserirNoCursor(`\`\`\`grafico\ntipo: barras\nfonte: ${item.nome}\nlimite: 8\n\`\`\``, { bloco: true }),
      }, 'Inserir gráfico') : null);
    const remover = U.el('button', {
      type: 'button', class: 'botao botao-discreto',
      'data-dica': 'Retira o arquivo do acervo. As citações no texto passam a acusar arquivo ausente. Pede confirmação com um segundo toque; não pode ser desfeito.',
    }, 'Remover');
    O.ui.doisToques(remover, 'Remover do acervo?', () => {
      E.atualizar('projeto.acervo', (a) => { const n = Object.assign({}, a); delete n[item.nome]; return n; });
      O.ui.ingestao.esquecerOriginal(item.nome);
      O.ui.notificar(`"${item.nome}" retirado do acervo.`, { gravidade: 'info' });
    });
    acoes.append(remover);
    partes.push(acoes);

    return U.el('li', { class: 'cartao acervo-item', 'data-cor': 'acervo', 'data-nome': item.nome.toLowerCase() }, ...partes);
  }

  // ═══════════════════════════ Lista e resumo ═══════════════════════════

  function atualizarUsos() {
    const texto = E.obter('projeto.markdown') || '';
    U.$$('[data-uso]', lista).forEach((selo) => {
      const n = usos(selo.getAttribute('data-uso'), texto);
      selo.textContent = n ? `citado ${n}×` : 'não citado';
      selo.dataset.estado = n ? 'ok' : 'pendente';
    });
  }
  const agendarUsos = U.debounce(atualizarUsos, 500);

  function aplicarFiltro() {
    const termo = (filtro.value || '').trim().toLowerCase();
    U.$$('.acervo-item', lista).forEach((li) => { li.hidden = !!termo && !li.dataset.nome.includes(termo); });
  }

  function atualizarResumo() {
    const itens = Object.values(acervo());
    const imagens = itens.filter((i) => i.tipo === 'imagem');
    const original = itens.reduce((t, i) => t + (i.bytesOriginais || i.bytes || 0), 0);
    const atual = itens.reduce((t, i) => t + (i.bytes || 0), 0);
    resumo.textContent = itens.length
      ? `${itens.length} arquivo(s): ${imagens.length} imagem(ns) e ${itens.length - imagens.length} planilha(s) · ${U.formatarBytes(atual)} (originais: ${U.formatarBytes(original)})`
      : 'Nenhum arquivo. Arraste imagens e planilhas para a janela ou use os botões abaixo.';
    const recomprimir = U.$('#botao-recomprimir');
    const pendentes = imagens.filter((i) => O.ui.ingestao.original(i.nome) && i.mime !== 'image/svg+xml' && i.mime !== 'image/gif').length;
    if (recomprimir) {
      if (pendentes) O.ui.dicas.disponivel(recomprimir);
      else O.ui.dicas.indisponivel(recomprimir, 'Só as imagens acrescentadas nesta sessão guardam o original necessário para recomprimir. Imagens vindas de exemplos, projetos ou rascunhos retomados mantêm a compressão atual.');
      recomprimir.textContent = pendentes ? `Recomprimir ${pendentes} imagem(ns)` : 'Recomprimir';
    }
  }

  function reconstruir() {
    const a = acervo();
    const nova = O.slides.assinaturaAcervo(a);
    atualizarResumo();
    if (nova === assinatura) return;
    assinatura = nova;
    const itens = Object.values(a).sort((x, y) => (x.tipo === y.tipo ? x.nome.localeCompare(y.nome, 'pt-BR') : x.tipo === 'imagem' ? -1 : 1));
    lista.replaceChildren(...itens.map(cartao));
    aplicarFiltro();
    atualizarUsos();
  }

  // ═══════════════════════════ Qualidade ═══════════════════════════

  function iniciarQualidade() {
    const faixa = U.$('#campo-qualidade');
    const saida = U.$('#saida-qualidade');
    if (!faixa) return;
    const [min, max] = C.IMAGEM_QUALIDADE_LIMITES;
    faixa.min = String(Math.round(min * 100));
    faixa.max = String(Math.round(max * 100));
    const mostrar = () => { saida.textContent = `${faixa.value}%`; };
    const sincronizar = () => { faixa.value = String(Math.round((E.obter('projeto.opcoes.qualidadeImagem') || C.IMAGEM_QUALIDADE) * 100)); mostrar(); };
    faixa.addEventListener('input', () => {
      mostrar();
      E.atualizar('projeto.opcoes', (o) => Object.assign({}, o, { qualidadeImagem: Number(faixa.value) / 100 }));
    });
    E.observar('projeto.opcoes', sincronizar);
    sincronizar();

    U.$('#botao-recomprimir')?.addEventListener('click', async () => {
      const qualidade = E.obter('projeto.opcoes.qualidadeImagem') || C.IMAGEM_QUALIDADE;
      const alvos = Object.values(acervo()).filter((i) => i.tipo === 'imagem' && O.ui.ingestao.original(i.nome));
      const novos = {};
      for (const i of alvos) {
        try {
          const r = await O.conteudo.imagens.processar(O.ui.ingestao.original(i.nome), { qualidade, nome: i.nome });
          novos[i.nome] = Object.assign({}, i, r, { alt: i.alt });
        } catch (e) { O.ui.notificar(`${i.nome}: ${e.message}`, { gravidade: 'erro' }); }
      }
      E.atualizar('projeto.acervo', (a) => Object.assign({}, a, novos));
      O.ui.notificar(`${Object.keys(novos).length} imagem(ns) recomprimida(s) com qualidade ${Math.round(qualidade * 100)}%.`, { gravidade: 'ok' });
    });
  }

  // ═══════════════════════════ Início ═══════════════════════════

  AC.iniciar = function () {
    lista = U.$('#lista-acervo');
    resumo = U.$('#acervo-resumo');
    filtro = U.$('#campo-filtro-acervo');
    if (!lista) return;
    U.$('#botao-acervo-arquivos')?.addEventListener('click', () => O.ui.ingestao.escolherArquivos());
    U.$('#botao-acervo-pasta')?.addEventListener('click', () => O.ui.ingestao.escolherPasta());
    filtro?.addEventListener('input', aplicarFiltro);
    E.observar('projeto.acervo', reconstruir);
    E.observar('projeto.markdown', agendarUsos);
    iniciarQualidade();
    reconstruir();
  };
})(window.Oratoria);
