// js/interface/painel-apresentar.js — aba Apresentar e exportar: apresentação no editor e
// exportações (HTML autocontido, projeto .oratoria.json, Markdown e pacote ZIP), além da
// abertura de projetos com confirmação (D35).
//
//   O.ui.apresentar.iniciar()
//   O.ui.apresentar.apresentar(doSlideAtual)
//   O.ui.apresentar.abrirProjeto(arquivo)   → lê, valida e oferece a substituição numa faixa

(function (O) {
  'use strict';

  const AP = (O.ui.apresentar = {});
  const U = O.util;
  const E = O.estado;
  const X = O.exportacao;

  let ocupado = false;

  // ═══════════════════════════ Apresentação ═══════════════════════════

  AP.apresentar = async function (doSlideAtual) {
    const projeto = E.obter('projeto');
    if (!(projeto.markdown || '').trim()) { O.ui.notificar('Não há slides para apresentar: escreva ou abra um texto primeiro.', { gravidade: 'aviso' }); return; }
    const indice = doSlideAtual ? O.ui.previa.secaoDoSlide(O.ui.previa.slideAtual()) : 0;
    await O.slides.apresentar(projeto, { indice, telaCheia: true });
  };

  // ═══════════════════════════ Exportações ═══════════════════════════

  function estado(texto) {
    const alvo = U.$('#estado-exportacao');
    if (alvo) alvo.textContent = texto;
  }

  /** Executa uma exportação com indicação de andamento e tratamento de erro uniforme. */
  async function exportar(rotulo, fn) {
    if (ocupado) { O.ui.notificar('Aguarde a exportação em andamento.', { gravidade: 'info' }); return; }
    const projeto = E.obter('projeto');
    if (!(projeto.markdown || '').trim()) { O.ui.notificar('Não há texto para exportar.', { gravidade: 'aviso' }); return; }
    ocupado = true;
    U.$('#painel-apresentar')?.setAttribute('aria-busy', 'true');
    estado(`${rotulo}: preparando…`);
    try {
      await fn(projeto);
    } catch (e) {
      O.ui.notificar(`${rotulo}: não foi possível exportar (${e.message}).`, { gravidade: 'erro' });
      estado(`${rotulo}: falhou.`);
      console.error(`[${O.config.APP_NOME}] ${rotulo}:`, e);
    } finally {
      ocupado = false;
      U.$('#painel-apresentar')?.removeAttribute('aria-busy');
    }
  }

  function estimativaAtual() {
    const v = U.$('#ind-tamanho [data-valor]');
    return v ? v.textContent.replace(/^≈\s*/, '') : '';
  }

  const acoes = {
    html: () => exportar('Apresentação em HTML', async (projeto) => {
      const r = await X.html.baixar(projeto, { aoProgredir: (etapa, fracao) => estado(`Apresentação em HTML: ${etapa.toLowerCase()} (${Math.round(fracao * 100)}%)`) });
      const est = estimativaAtual();
      estado(`Último arquivo: ${r.nome} · ${U.formatarBytes(r.bytes)} · ${r.slides} slides.`);
      O.ui.notificar(`"${r.nome}" gerado: ${U.formatarBytes(r.bytes)}${est ? ` (estimativa: ${est})` : ''}, ${r.slides} slides. Abre em qualquer navegador, sem internet.`, { gravidade: 'ok' });
      if (r.avisos.length) {
        const externas = r.avisos.filter((a) => a.codigo === 'imagem-externa').length;
        const ausentes = r.avisos.filter((a) => a.codigo === 'imagem-ausente').length;
        const outros = r.avisos.length - externas - ausentes;
        const partes = [];
        if (externas) partes.push(`${externas} imagem(ns) da internet não aparecerão`);
        if (ausentes) partes.push(`${ausentes} imagem(ns) ausente(s) do acervo`);
        if (outros) partes.push(`${outros} bloco(s) com problema`);
        O.ui.notificar(`Atenção no arquivo exportado: ${partes.join('; ')}. Detalhes na aba Conferência.`, { gravidade: 'aviso' });
      }
    }),
    projeto: () => exportar('Projeto', async (projeto) => {
      const r = X.projeto.baixar(projeto);
      estado(`Último arquivo: ${r.nome} · ${U.formatarBytes(r.bytes)}.`);
      O.ui.notificar(`Projeto "${r.nome}" gerado (${U.formatarBytes(r.bytes)}). Abra-o em qualquer computador com o Apresenta para continuar o trabalho.`, { gravidade: 'ok' });
    }),
    markdown: () => exportar('Texto em Markdown', async (projeto) => {
      const r = X.markdown.baixarTexto(projeto);
      estado(`Último arquivo: ${r.nome} · ${U.formatarBytes(r.bytes)}.`);
      O.ui.notificar(`Texto "${r.nome}" gerado. As imagens são citadas pelo nome; para levá-las junto, use o pacote ZIP.`, { gravidade: 'ok' });
    }),
    pdf: () => exportar('PDF', async (projeto) => {
      const escala = Number(U.$('#campo-resolucao-pdf')?.value) || 1;
      const r = await X.pdf.baixar(projeto, { escala, aoProgredir: (etapa, fracao) => estado(`PDF: ${etapa.toLowerCase()} (${Math.round(fracao * 100)}%)`) });
      estado(`Último arquivo: ${r.nome} · ${U.formatarBytes(r.blob.size)} · ${r.paginas} páginas.`);
      O.ui.notificar(`PDF "${r.nome}" gerado: ${r.paginas} páginas, ${U.formatarBytes(r.blob.size)}.`, { gravidade: 'ok' });
    }),
    imprimir: () => exportar('Impressão', async (projeto) => {
      estado('Impressão: preparando os slides…');
      const r = await X.impressao.imprimir(projeto);
      estado(`Impressão enviada ao navegador: ${r.slides} páginas.`);
    }),
    pacote: () => exportar('Pacote ZIP', async (projeto) => {
      const r = X.markdown.baixarPacote(projeto);
      estado(`Último arquivo: ${r.nome} · ${U.formatarBytes(r.bytes)} · ${r.arquivos} arquivos.`);
      O.ui.notificar(`Pacote "${r.nome}" gerado com o texto e ${r.arquivos - 1} arquivo(s) do acervo (${U.formatarBytes(r.bytes)}).`, { gravidade: 'ok' });
    }),
  };

  // ═══════════════════════════ Abrir projeto (D35) ═══════════════════════════

  AP.abrirProjeto = async function (arquivo) {
    let lido;
    try {
      lido = await X.projeto.ler(arquivo);
    } catch (e) {
      O.ui.notificar(`"${arquivo.name}" não pôde ser aberto: ${e.message}.`, { gravidade: 'erro' });
      return;
    }
    const titulo = lido.projeto.titulo || (O.conteudo.extrairFrontMatter(lido.projeto.markdown).meta || {}).titulo || arquivo.name;
    const temTrabalho = !!(E.obter('projeto.markdown') || '').trim();
    const carregar = async () => {
      if (temTrabalho) {
        // O trabalho substituído fica guardado à parte e é oferecido na próxima abertura
        await O.persistencia.gravar('rascunho', 'anterior', Object.assign(E.instantaneo('projeto'), { atualizadoEm: Date.now() })).catch(() => {});
      }
      E.carregarProjeto(lido.projeto);
      O.ui.editor.irParaLinha(1);
      O.ui.notificar(`Projeto "${titulo}" aberto, com ${Object.keys(lido.projeto.acervo).length} arquivo(s) no acervo.`, { gravidade: 'ok' });
      if (lido.avisos.length) O.ui.notificar(`Itens descartados na abertura: ${lido.avisos.join(' ')}`, { gravidade: 'aviso', duracao: 15000 });
    };
    if (!temTrabalho) { carregar(); return; }

    const faixa = U.$('#faixa-abrir-projeto');
    const origem = lido.origem.exportadoEm ? ` (exportado em ${U.formatarDataHora(lido.origem.exportadoEm)})` : '';
    U.$('[data-texto]', faixa).textContent = `Abrir o projeto "${titulo}"${origem} no lugar do trabalho atual? O trabalho atual fica guardado neste navegador e será oferecido para retomada na próxima abertura.`;
    faixa.hidden = false;
    const abrir = U.$('#botao-confirmar-projeto');
    abrir.onclick = () => { faixa.hidden = true; carregar(); };
    U.$('#botao-cancelar-projeto').onclick = () => { faixa.hidden = true; O.ui.anunciar('Abertura do projeto cancelada.'); };
    abrir.focus();
  };

  // ═══════════════════════════ Início ═══════════════════════════

  AP.iniciar = function () {
    U.$('#botao-apresentar')?.addEventListener('click', () => AP.apresentar(true));
    U.$('#botao-apresentar-inicio')?.addEventListener('click', () => AP.apresentar(false));
    U.$('#botao-apresentar-atual')?.addEventListener('click', () => AP.apresentar(true));
    U.$('#botao-previa-apresentar')?.addEventListener('click', () => AP.apresentar(true));
    // Ao encerrar, o editor acompanha o slide em que a apresentação parou
    E.ouvir('apresentacao:encerrada', ({ origem }) => { if (Number.isInteger(origem)) O.ui.previa.irParaSlide(origem); });

    U.$('#botao-exportar-html')?.addEventListener('click', acoes.html);
    U.$('#botao-exportar-projeto')?.addEventListener('click', acoes.projeto);
    U.$('#botao-exportar-md')?.addEventListener('click', acoes.markdown);
    U.$('#botao-exportar-zip')?.addEventListener('click', acoes.pacote);
    U.$('#botao-exportar-pdf')?.addEventListener('click', acoes.pdf);
    U.$('#botao-imprimir')?.addEventListener('click', acoes.imprimir);
    const resolucao = U.$('#campo-resolucao-pdf');
    if (resolucao) {
      const rotulos = { 1: 'Normal (1920 px)', 1.5: 'Alta (2880 px)' };
      resolucao.replaceChildren(...Object.values(O.config.PDF_RESOLUCOES).map((v) => U.el('option', { value: String(v) }, rotulos[v] || `${v}×`)));
      O.persistencia.preferencia('resolucaoPdf', '1').then((v) => { resolucao.value = String(v); });
      resolucao.addEventListener('change', () => O.persistencia.definirPreferencia('resolucaoPdf', resolucao.value));
    }
    U.$('#botao-abrir-projeto')?.addEventListener('click', () => U.$('#entrada-projeto')?.click());
    const entrada = U.$('#entrada-projeto');
    entrada?.addEventListener('change', () => {
      const f = entrada.files && entrada.files[0];
      entrada.value = '';
      if (f) AP.abrirProjeto(f);
    });
  };
})(window.Oratoria);
