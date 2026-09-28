// js/interface/ingestao.js — entrada de arquivos (§5.4): arrastar e soltar em qualquer ponto
// da janela (inclusive pastas), seleção de arquivos, seleção de pasta e colagem de imagens.
//
//   await O.ui.ingestao.processar(arquivos, { inserirReferencias })  → resumo
//   O.ui.ingestao.escolherArquivos() · escolherPasta()
//   O.ui.ingestao.original(nome)   → File original (somente nesta sessão), para recomprimir
//
// Destino de cada tipo:
//   .md/.markdown/.txt → texto do editor (substituição desfazível com Ctrl+Z);
//   imagens            → acervo, recomprimidas (O.conteudo.imagens);
//   .csv               → acervo, como fonte de dados;
//   documentos (§16)   → avisados: a importação chega na etapa 6-B.
// Tudo é lido localmente por FileReader; nada sai do computador.

(function (O) {
  'use strict';

  const IG = (O.ui.ingestao = {});
  const U = O.util;
  const C = O.config;
  const E = O.estado;
  const IM = O.conteudo.imagens;

  const TEXTO = ['.md', '.markdown', '.txt'];
  const LIMITE_ARQUIVOS = 500;
  const originais = new Map(); // nome → File original (memória da sessão)

  IG.original = (nome) => originais.get(nome) || null;
  IG.esquecerOriginal = (nome) => originais.delete(nome);

  const classificar = (f) => {
    const ext = U.extensao(f.name);
    if (/\.oratoria\.json$/i.test(f.name) || ext === '.json') return 'projeto';
    if (TEXTO.includes(ext)) return 'texto';
    if (IM.ehImagem(f.name) || /^image\//.test(f.type)) return 'imagem';
    if (IM.ehCsv(f.name)) return 'csv';
    if (C.TIPOS_DOCUMENTO.includes(ext)) return 'documento';
    return 'ignorado';
  };

  /**
   * Processa uma lista de arquivos. Com `inserirReferencias`, as imagens recebidas são
   * citadas no cursor do editor (![](nome)). Devolve um resumo e notifica o usuário.
   */
  IG.processar = async function (arquivos, { inserirReferencias = false } = {}) {
    const lista = Array.from(arquivos || []).filter((f) => !/^\./.test(f.name)).slice(0, LIMITE_ARQUIVOS);
    const grupos = { projeto: [], texto: [], imagem: [], csv: [], documento: [], ignorado: [] };
    lista.forEach((f) => grupos[classificar(f)].push(f));
    // Um projeto .oratoria.json substitui tudo: é tratado sozinho, com confirmação (D35)
    if (grupos.projeto.length) {
      if (lista.length > 1) O.ui.notificar('Um projeto (.oratoria.json) foi recebido com outros arquivos: só o projeto será aberto.', { gravidade: 'aviso' });
      O.ui.apresentar.abrirProjeto(grupos.projeto[0]);
      return { imagens: 0, planilhas: 0, texto: null, substituidos: [], falhas: [], documentos: [], ignorados: [], projeto: grupos.projeto[0].name };
    }
    const resumo = { imagens: 0, planilhas: 0, texto: null, substituidos: [], falhas: [], documentos: grupos.documento.map((f) => f.name), ignorados: grupos.ignorado.map((f) => f.name) };
    const midia = grupos.imagem.concat(grupos.csv);
    if (!lista.length) return resumo;

    const acervo = E.obter('projeto.acervo') || {};
    const novos = {};
    const qualidade = E.obter('projeto.opcoes.qualidadeImagem') || C.IMAGEM_QUALIDADE;
    let feitos = 0;
    for (const f of midia) {
      E.emitir('ingestao:progresso', { feitos, total: midia.length, nome: f.name });
      try {
        const item = classificar(f) === 'csv' ? await IM.lerPlanilhaCsv(f) : await IM.processar(f, { qualidade });
        item.alt = acervo[item.nome]?.alt || '';
        item.adicionadoEm = Date.now();
        if (acervo[item.nome]) resumo.substituidos.push(item.nome);
        novos[item.nome] = item;
        if (item.tipo === 'imagem') { originais.set(item.nome, f); resumo.imagens++; } else resumo.planilhas++;
      } catch (e) {
        resumo.falhas.push(`${f.name}: ${e.message}`);
      }
      feitos++;
    }
    E.emitir('ingestao:progresso', { feitos, total: midia.length, concluido: true });
    if (Object.keys(novos).length) E.atualizar('projeto.acervo', (a) => Object.assign({}, a, novos));

    if (grupos.texto.length) {
      const f = grupos.texto.find((a) => U.extensao(a.name) !== '.txt') || grupos.texto[0];
      const texto = (await U.lerTexto(f)).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
      O.ui.editor.aplicarTexto(texto, { focarEditor: true });
      O.ui.editor.irParaLinha(1);
      resumo.texto = f.name;
      if (!E.obter('projeto.titulo')) {
        const titulo = (O.conteudo.extrairFrontMatter(texto).meta || {}).titulo;
        if (titulo) E.definir('projeto.titulo', String(titulo));
      }
    }

    if (inserirReferencias) {
      const imagens = Object.values(novos).filter((i) => i.tipo === 'imagem');
      if (imagens.length) {
        const refs = imagens.map((i) => `![${i.alt || ''}](${i.nome})`).join('\n\n');
        const alt = imagens.length === 1 && !imagens[0].alt;
        O.ui.editor.inserirNoCursor(refs, { bloco: true, cursor: alt ? 2 : null });
      }
    }

    notificarResumo(resumo);
    E.emitir('ingestao:concluida', resumo);
    return resumo;
  };

  function notificarResumo(r) {
    const partes = [];
    if (r.texto) partes.push(`texto de "${r.texto}" aberto (Ctrl+Z desfaz)`);
    if (r.imagens) partes.push(`${r.imagens} imagem(ns) no acervo`);
    if (r.planilhas) partes.push(`${r.planilhas} planilha(s) no acervo`);
    if (r.substituidos.length) partes.push(`${r.substituidos.length} substituída(s) por ter o mesmo nome`);
    if (partes.length) O.ui.notificar(`${partes.join('; ')}.`, { gravidade: 'ok' });
    if (r.documentos.length) {
      O.ui.notificar(`A conversão de documentos (${r.documentos.join(', ')}) em slides chega na próxima versão. Por ora, copie o texto e cole no editor.`, { gravidade: 'aviso' });
    }
    if (r.falhas.length) O.ui.notificar(`Não foi possível ler: ${r.falhas.join('; ')}.`, { gravidade: 'erro' });
    if (r.ignorados.length) O.ui.notificar(`Arquivos de tipo não aceito foram ignorados: ${r.ignorados.slice(0, 5).join(', ')}${r.ignorados.length > 5 ? '…' : ''}.`, { gravidade: 'aviso' });
  }

  // ═══════════════════════════ Seleção por diálogo ═══════════════════════════

  IG.escolherArquivos = () => U.$('#entrada-arquivos')?.click();
  IG.escolherPasta = () => U.$('#entrada-pasta')?.click();

  // ═══════════════════════════ Arrastar e soltar ═══════════════════════════

  /** Lê recursivamente uma entrada de pasta arrastada (webkitGetAsEntry). */
  async function lerEntrada(entrada, saida) {
    if (saida.length >= LIMITE_ARQUIVOS || /^\./.test(entrada.name)) return;
    if (entrada.isFile) {
      saida.push(await new Promise((resolver, rejeitar) => entrada.file(resolver, rejeitar)));
    } else if (entrada.isDirectory) {
      const leitor = entrada.createReader();
      let lote;
      do {
        lote = await new Promise((resolver, rejeitar) => leitor.readEntries(resolver, rejeitar));
        for (const e of lote) await lerEntrada(e, saida);
      } while (lote.length);
    }
  }

  async function arquivosDoArraste(dt) {
    const itens = Array.from(dt.items || []);
    const entradas = itens.map((i) => (i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
    if (entradas.some((e) => e && e.isDirectory)) {
      const saida = [];
      for (const e of entradas) if (e) await lerEntrada(e, saida);
      return saida;
    }
    return Array.from(dt.files || []);
  }

  const temArquivos = (ev) => Array.from(ev.dataTransfer?.types || []).includes('Files');

  function iniciarArraste() {
    const camada = U.$('#camada-soltar');
    let profundidade = 0;
    const mostrar = (sim) => { if (camada) camada.hidden = !sim; };
    document.addEventListener('dragenter', (ev) => {
      if (!temArquivos(ev)) return;
      ev.preventDefault();
      profundidade++;
      mostrar(true);
    });
    document.addEventListener('dragover', (ev) => {
      if (!temArquivos(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', (ev) => {
      if (!temArquivos(ev)) return;
      profundidade = Math.max(0, profundidade - 1);
      if (!profundidade) mostrar(false);
    });
    document.addEventListener('drop', async (ev) => {
      if (!temArquivos(ev)) return;
      ev.preventDefault();
      profundidade = 0;
      mostrar(false);
      const sobreEditor = !!ev.target.closest?.('#zona-editor');
      const arquivos = await arquivosDoArraste(ev.dataTransfer);
      IG.processar(arquivos, { inserirReferencias: sobreEditor });
    });
  }

  // ═══════════════════════════ Colar imagem (Ctrl+V) ═══════════════════════════

  function nomeColado(mime, indice) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const carimbo = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    return `colada-${carimbo}${indice ? `-${indice + 1}` : ''}${IM.extensaoDoMime(mime)}`;
  }

  function iniciarColagem() {
    const area = O.ui.editor.elemento();
    if (!area) return;
    area.addEventListener('paste', (ev) => {
      const arquivos = Array.from(ev.clipboardData?.files || []).filter((f) => /^image\//.test(f.type));
      if (!arquivos.length) return; // texto: comportamento nativo
      ev.preventDefault();
      const renomeados = arquivos.map((f, i) => new File([f], nomeColado(f.type, arquivos.length > 1 ? i : 0), { type: f.type }));
      IG.processar(renomeados, { inserirReferencias: true });
    });
  }

  // ═══════════════════════════ Início ═══════════════════════════

  IG.iniciar = function () {
    for (const id of ['#entrada-arquivos', '#entrada-pasta']) {
      const entrada = U.$(id);
      entrada?.addEventListener('change', () => {
        const arquivos = Array.from(entrada.files || []);
        entrada.value = '';
        IG.processar(arquivos);
      });
    }
    iniciarArraste();
    iniciarColagem();
  };
})(window.Oratoria);
