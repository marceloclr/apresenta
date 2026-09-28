// js/interface/app.js — orquestração da interface. ÚLTIMO script a carregar.
// Scripts com defer executam após a análise do documento: o DOM já está disponível.
//
// Responsabilidades: identidade, tema da interface, título do projeto, avisos na tela
// (O.ui.notificar), confirmação em dois toques (O.ui.doisToques), indicadores da barra
// superior, guarda automática e convite para retomar o último trabalho (D29), condições do
// ambiente (aba Conferência) e a inicialização dos módulos.

(function (O) {
  'use strict';

  const U = O.util;
  const C = O.config;
  const E = O.estado;

  // ── Anúncios para leitores de tela ─────────────────────────────────────
  const regiaoViva = U.$('#anuncios');
  O.ui.anunciar = function (texto) {
    if (!regiaoViva) return;
    regiaoViva.textContent = '';
    setTimeout(() => { regiaoViva.textContent = texto; }, 30);
  };

  // ── Avisos na tela (canto inferior direito) ────────────────────────────
  /** Mostra um aviso passageiro e o anuncia. gravidade: 'ok' | 'aviso' | 'erro' | 'info'. */
  O.ui.notificar = function (texto, { gravidade = 'info', duracao } = {}) {
    const pilha = U.$('#avisos-tela');
    O.ui.anunciar(texto);
    if (!pilha) return;
    const fechar = U.el('button', {
      type: 'button', class: 'botao botao-discreto botao-icone aviso-tela-fechar',
      'data-dica': 'Fecha este aviso. Nada é alterado no projeto.', 'aria-label': 'Fechar aviso',
    }, '×');
    const aviso = U.el('div', { class: 'aviso-tela', 'data-estado': gravidade, role: gravidade === 'erro' ? 'alert' : 'status' }, U.el('span', null, texto), fechar);
    const remover = () => aviso.remove();
    fechar.addEventListener('click', remover);
    pilha.append(aviso);
    while (pilha.children.length > 4) pilha.firstElementChild.remove();
    setTimeout(remover, duracao || (gravidade === 'erro' ? 12000 : 7000));
  };

  // ── Confirmação em dois toques ─────────────────────────────────────────
  /**
   * Ações irreversíveis sem janelas modais: o primeiro toque troca o rótulo por uma pergunta
   * (e a dica explica a consequência); o segundo, dentro de C.ATRASO_CONFIRMACAO_MS, confirma.
   * `exigir()` falso executa direto (ex.: nada a perder).
   */
  O.ui.doisToques = function (botao, pergunta, acao, { exigir = () => true } = {}) {
    let armado = null;
    let original = null;
    const desarmar = () => {
      if (!armado) return;
      clearTimeout(armado);
      armado = null;
      botao.classList.remove('botao-confirmar');
      botao.replaceChildren(...original);
    };
    botao.addEventListener('click', () => {
      if (armado) { desarmar(); acao(); return; }
      if (!exigir()) { acao(); return; }
      original = Array.from(botao.childNodes);
      botao.replaceChildren(pergunta);
      botao.classList.add('botao-confirmar');
      O.ui.anunciar(`${pergunta} Acione de novo para confirmar.`);
      armado = setTimeout(desarmar, C.ATRASO_CONFIRMACAO_MS);
    });
    botao.addEventListener('blur', () => setTimeout(desarmar, 150));
  };

  // ── Identidade (APP_NOME e versão vêm de config.js) ────────────────────
  function aplicarIdentidade() {
    document.title = C.APP_NOME;
    U.$$('[data-app-nome]').forEach((e) => { e.textContent = C.APP_NOME; });
    U.$$('[data-app-versao]').forEach((e) => { e.textContent = `v${C.VERSAO}`; });
  }

  // ── Tema da interface do editor ────────────────────────────────────────
  function aplicarTemaInterface(tema) {
    document.documentElement.setAttribute('data-interface', tema);
    E.definir('interface.tema', tema);
    const botao = U.$('#botao-tema-interface');
    if (botao) {
      const destino = tema === 'escuro' ? 'clara' : 'escura';
      botao.setAttribute('aria-label', `Passar para a interface ${destino}`);
      O.ui.dicas.definir(botao, {
        texto: `Passa a interface do editor para a versão ${destino}. Não altera o tema dos slides; a escolha fica guardada neste navegador.`,
      });
    }
  }

  function iniciarTemaInterface() {
    const inicial = document.documentElement.getAttribute('data-interface') || 'escuro';
    aplicarTemaInterface(inicial);
    U.$('#botao-tema-interface')?.addEventListener('click', () => {
      const novo = E.obter('interface.tema') === 'escuro' ? 'claro' : 'escuro';
      aplicarTemaInterface(novo);
      O.persistencia.definirPreferencia('temaInterface', novo);
      O.ui.anunciar(`Interface ${novo === 'escuro' ? 'escura' : 'clara'} ativada.`);
    });
  }

  // ── Título do projeto: validação em tempo real ─────────────────────────
  // Proibidos: caracteres de controle e os inválidos em nomes de arquivo (/ \ : * ? " < > |).
  const PROIBIDOS = /[\u0000-\u001f\u007f/\\:*?"<>|]/g;

  function iniciarTituloProjeto() {
    const campo = U.$('#campo-titulo-projeto');
    if (!campo) return;
    let avisoTimer = null;
    campo.addEventListener('input', () => {
      if (PROIBIDOS.test(campo.value)) {
        const pos = campo.selectionStart;
        const antes = campo.value.length;
        campo.value = campo.value.replace(PROIBIDOS, '');
        const removidos = antes - campo.value.length;
        campo.setSelectionRange(Math.max(0, pos - removidos), Math.max(0, pos - removidos));
        campo.setAttribute('aria-invalid', 'true');
        O.ui.anunciar('Caractere não permitido em título foi removido.');
        clearTimeout(avisoTimer);
        avisoTimer = setTimeout(() => campo.removeAttribute('aria-invalid'), 1200);
      }
      PROIBIDOS.lastIndex = 0;
      E.definir('projeto.titulo', campo.value.trim());
    });
    campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') campo.blur(); });
    // Projeto carregado (abrir, exemplo, retomar): reflete o título
    E.observar('projeto.titulo', (v) => { if (document.activeElement !== campo && (v || '') !== campo.value.trim()) campo.value = v || ''; });
    // Sem título próprio, o campo sugere o título do cabeçalho do texto
    E.ouvir('previa:interpretada', ({ r }) => { campo.placeholder = r.meta.titulo || 'Apresentação sem título'; });
  }

  // ── Indicadores da barra superior (§5.3) ───────────────────────────────
  let bytesFontes = null;   // { familia: bytes } do embutível de fontes
  let bytesChart = null;

  function lerEmbutiveisParaEstimativa() {
    if (bytesFontes) return;
    bytesFontes = {};
    O.carregador.embutivel('fontes').then((faces) => {
      for (const f of faces) bytesFontes[f.familia] = (bytesFontes[f.familia] || 0) + f.base64.length;
      atualizarTamanho();
    }).catch(() => { /* estimativa segue sem a parcela das fontes */ });
    O.carregador.embutivel('chart').then((codigo) => { bytesChart = codigo.length; atualizarTamanho(); }).catch(() => {});
  }

  function definirIndicador(id, valor, dica) {
    const el = U.$(`#${id}`);
    if (!el) return;
    const alvo = U.$('[data-valor]', el);
    if (alvo) alvo.textContent = valor;
    if (dica !== undefined) O.ui.dicas.definir(el, { texto: dica });
  }

  function totalDeSlides() {
    const completa = O.ui.previa.completa();
    const r = O.ui.previa.interpretacao();
    if (completa && r && completa.resultado.slides.length === r.slides.length) return completa.secoes.length;
    return r ? r.slides.length : 0;
  }

  function atualizarContagem() {
    const n = totalDeSlides();
    const fator = E.obter('projeto.opcoes.minutosPorSlide') || C.MINUTOS_POR_SLIDE;
    const completa = O.ui.previa.completa();
    const extras = completa ? completa.secoes.length - completa.resultado.slides.length : 0;
    definirIndicador('ind-slides', U.formatarNumero(n),
      `Quantidade de slides que a apresentação terá${extras > 0 ? `, incluídos ${extras} criado(s) pela divisão de tabelas longas` : ''}.`);
    definirIndicador('ind-tempo', U.formatarDuracao(n * fator),
      `Estimativa de duração da fala: ${U.formatarNumero(n)} slides × ${U.formatarDecimal(fator, 2)} min. O fator por slide é ajustável na aba Tema.`);
    O.ui.dicas.definir(U.$('#ind-tempo'), { formula: `slides × ${U.formatarDecimal(fator, 2)} min` });
  }

  function atualizarTamanho() {
    const r = O.ui.previa.completa();
    if (!r) return;
    if (!r.secoes.length) { definirIndicador('ind-tamanho', '—', 'Peso aproximado do HTML autocontido. Aparece quando houver slides.'); return; }
    const S = O.slides;
    const acervo = E.obter('projeto.acervo') || {};
    const buscar = U.criarBuscaPorNome(acervo);
    // Imagens efetivamente usadas: citadas no texto, fundos por diretiva e logotipo
    // (lidas do HTML interpretado: layouts como imagem-fundo convertem a <img> em fundo)
    const usadas = new Set();
    r.resultado.slides.forEach((s) => {
      for (const m of s.html.matchAll(/data-arquivo="([^"]+)"/g)) usadas.add(m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
      if (s.fundo) usadas.add(s.fundo);
    });
    if (r.meta.logotipo) usadas.add(String(r.meta.logotipo));
    const itens = new Set();
    usadas.forEach((nome) => { const item = buscar(nome); if (item && item.tipo === 'imagem') itens.add(item); });
    const imagens = Array.from(itens).reduce((t, i) => t + (i.bytes || 0), 0) * 4 / 3;
    const temGrafico = r.secoes.some((s) => s.querySelector('figure.o-grafico'));
    const motor = S.motorSlides.toString().length + S.motorApresentador.toString().length + (temGrafico ? S.motorGraficos.toString().length : 0);
    const tema = r.css.length;
    const conteudo = r.secoes.reduce((t, s) => t + s.outerHTML.replace(/data:[^"')\s]+/g, '').length, 0);
    const familias = O.temas.familiasUsadas(r.meta.tema);
    const fontes = bytesFontes ? familias.reduce((t, f) => t + (bytesFontes[f] || 0), 0) : 0;
    const chart = temGrafico ? (bytesChart || 0) : 0;
    const total = imagens + motor + tema + conteudo + fontes + chart;
    const pendente = !bytesFontes || !Object.keys(bytesFontes).length || (temGrafico && bytesChart === null);
    const partes = [
      `Imagens (${itens.size}): ${U.formatarBytes(imagens)}`,
      `Motor dos slides: ${U.formatarBytes(motor)}`,
      `Tema e layouts: ${U.formatarBytes(tema)}`,
      `Fontes (${familias.length} família${familias.length > 1 ? 's' : ''}): ${bytesFontes && Object.keys(bytesFontes).length ? U.formatarBytes(fontes) : 'em cálculo'}`,
      `Chart.js: ${temGrafico ? (bytesChart !== null ? U.formatarBytes(chart) : 'em cálculo') : 'não usado'}`,
      `Conteúdo dos slides: ${U.formatarBytes(conteudo)}`,
    ];
    definirIndicador('ind-tamanho', `${pendente ? '≈ ' : ''}${U.formatarBytes(total)}`,
      `Peso aproximado do HTML autocontido. Decomposição — ${partes.join(' · ')}. Somente as imagens usadas nos slides entram no arquivo.`);
  }

  function iniciarIndicadores() {
    E.ouvir('previa:interpretada', atualizarContagem);
    E.ouvir('previa:completa', () => { atualizarContagem(); lerEmbutiveisParaEstimativa(); atualizarTamanho(); });
    E.observar('projeto.opcoes', atualizarContagem);
  }

  // ── Guarda automática e "Retomar último trabalho" (§5.5, D29) ──────────
  async function iniciarGuarda() {
    await O.persistencia.iniciar();
    const encontrado = await O.persistencia.rascunhoDisponivel('atual');
    // O rascunho encontrado é posto à parte ('anterior'): o autossalvamento desta sessão
    // grava em 'atual' sem destruí-lo antes que o usuário decida.
    if (encontrado) await O.persistencia.gravar('rascunho', 'anterior', encontrado.projeto).catch(() => {});
    O.persistencia.ativarAutossalvamento();
    const anterior = encontrado || await O.persistencia.rascunhoDisponivel('anterior');
    if (anterior) oferecerRetomada(anterior);
  }

  function oferecerRetomada(r) {
    const faixa = U.$('#faixa-retomar');
    if (!faixa) return;
    const quando = r.atualizadoEm ? U.formatarDataHora(r.atualizadoEm) : 'data desconhecida';
    const titulo = r.projeto.titulo || (O.conteudo.extrairFrontMatter(r.projeto.markdown).meta || {}).titulo || 'sem título';
    U.$('[data-texto]', faixa).textContent = `Há um trabalho guardado neste navegador: "${titulo}", de ${quando} (${U.formatarNumero(r.caracteres)} caracteres, ${r.imagens} arquivo(s) no acervo).`;
    faixa.hidden = false;
    const retomar = U.$('#botao-retomar');
    const dispensar = U.$('#botao-dispensar-retomada');
    retomar.onclick = () => {
      E.carregarProjeto(r.projeto);
      faixa.hidden = true;
      O.ui.editor.irParaLinha(1);
      O.ui.notificar(`Trabalho "${titulo}" retomado.`, { gravidade: 'ok' });
    };
    dispensar.onclick = () => { faixa.hidden = true; O.ui.editor.focar(); };
  }

  // ── Condições do ambiente (aba Conferência) ────────────────────────────
  const BIBLIOTECAS = [
    ['markdownit', 'markdown-it', 'Interpretação do Markdown'],
    ['markdownItAttrs', 'markdown-it-attrs', 'Atributos {.classe}'],
    ['markdownitContainer', 'markdown-it-container', 'Contêineres :::'],
    ['DOMPurify', 'DOMPurify', 'Sanitização de HTML e SVG'],
    ['jsyaml', 'js-yaml', 'Front-matter'],
    ['Papa', 'PapaParse', 'Leitura de CSV'],
    ['Chart', 'Chart.js', 'Gráficos'],
    ['hljs', 'highlight.js', 'Realce de código'],
    ['qrcode', 'qrcode-generator', 'QR code'],
  ];

  const FAMILIAS = ['IBM Plex Sans', 'IBM Plex Serif', 'IBM Plex Mono'];

  function linhaVerificacao(rotulo, dica, estado, textoSelo, dicaSelo) {
    return U.el('li', null,
      U.el('span', { 'data-dica': dica }, rotulo),
      U.el('span', { class: 'selo', 'data-estado': estado, 'data-dica': dicaSelo || dica }, textoSelo));
  }

  async function conferirAmbiente() {
    const lista = U.$('#lista-ambiente');
    if (!lista) return;
    const linhas = [];
    const protocolo = location.protocol.replace(':', '');
    const rotuloModo = protocolo === 'file' ? 'Arquivo local' : protocolo === 'https' ? 'Publicado (https)' : protocolo;
    linhas.push(linhaVerificacao('Modo de abertura',
      'Como esta cópia foi aberta. Em arquivo local (file://) tudo funciona sem servidor; a instalação como aplicativo só existe na versão publicada.',
      'ok', rotuloModo));

    const ausentes = BIBLIOTECAS.filter(([g]) => !window[g]);
    linhas.push(linhaVerificacao('Bibliotecas locais',
      `Confere se as ${BIBLIOTECAS.length} bibliotecas de vendor/ foram carregadas: ${BIBLIOTECAS.map((b) => b[1]).join(', ')}.`,
      ausentes.length ? 'erro' : 'ok',
      ausentes.length ? `${ausentes.length} ausente(s)` : `${BIBLIOTECAS.length} de ${BIBLIOTECAS.length}`,
      ausentes.length ? `Ausentes: ${ausentes.map((b) => `${b[1]} (${b[2]})`).join('; ')}. Verifique se a pasta vendor/ acompanha a aplicação.` : null));

    let fontesOk = 0;
    try {
      await Promise.all(FAMILIAS.map((f) => document.fonts.load(`400 16px "${f}"`)));
      fontesOk = FAMILIAS.filter((f) => document.fonts.check(`400 16px "${f}"`)).length;
    } catch (_) { fontesOk = 0; }
    linhas.push(linhaVerificacao('Fontes IBM Plex',
      'Confere se Sans, Serif e Mono foram lidas de assets/fontes/. Na falta delas, o navegador usa fontes do sistema.',
      fontesOk === FAMILIAS.length ? 'ok' : 'aviso', `${fontesOk} de ${FAMILIAS.length}`));

    const modo = await O.persistencia.iniciar();
    const est = await O.persistencia.estimativa();
    const espaco = Number.isFinite(est.cota) ? ` Espaço em uso: ${U.formatarBytes(est.uso)} de ${U.formatarBytes(est.cota)} permitidos a esta origem.` : '';
    linhas.push(linhaVerificacao('Guarda automática',
      'Rascunhos guardados no próprio navegador (IndexedDB). Em arquivo local, ficam vinculados ao caminho de abertura: movida a pasta, não a acompanham; use o projeto .oratoria.json para transportar o trabalho.' + espaco,
      modo === 'indexeddb' ? 'ok' : 'aviso', O.rotulos.rotulo(O.rotulos.ROTULO_PERSISTENCIA, modo),
      modo === 'memoria' ? `O navegador recusou a guarda local (${O.persistencia.motivoMemoria()}). O trabalho se perderá ao fechar a página, salvo se exportado.` : null));

    let embutivel = 'pendente', textoEmb = 'não conferido', dicaEmb = null;
    try {
      const codigo = await O.carregador.embutivel('chart');
      embutivel = 'ok'; textoEmb = U.formatarBytes(codigo.length);
      dicaEmb = `Recurso lido com sucesso por injeção de script (${U.formatarBytes(codigo.length)}).`;
    } catch (e) { embutivel = 'erro'; textoEmb = 'falhou'; dicaEmb = e.message; }
    linhas.push(linhaVerificacao('Recursos de exportação',
      'Confere se a pasta embutiveis/ pode ser lida sob demanda; ela fornece o Chart.js e as fontes que vão dentro das apresentações exportadas.',
      embutivel, textoEmb, dicaEmb));

    const itemRede = linhaVerificacao('Conexão com a internet',
      'Necessária apenas para recursos opcionais (fórmulas, diagramas, planilhas .xlsx, serviços externos e publicação). A composição e a exportação funcionam sem rede.',
      'pendente', 'conferindo…');
    linhas.push(itemRede);
    lista.replaceChildren(...linhas);

    const online = await O.carregador.sondarRede();
    E.definir('ambiente.rede', online);
    const selo = itemRede.querySelector('.selo');
    selo.dataset.estado = online ? 'ok' : 'aviso';
    selo.textContent = online ? 'disponível' : 'indisponível';
  }

  // ── Preferências salvas ────────────────────────────────────────────────
  async function aplicarPreferencias() {
    await O.persistencia.iniciar();
    const tema = await O.persistencia.preferencia('temaInterface', null);
    if (tema === 'claro' || tema === 'escuro') aplicarTemaInterface(tema);
    const aba = await O.persistencia.preferencia('abaAtiva', null);
    if (aba && O.rotulos.ROTULO_ABA[aba]) O.ui.abas.ativar(aba);
  }

  // ── Inicialização ──────────────────────────────────────────────────────
  function iniciar() {
    aplicarIdentidade();
    O.ui.dicas.iniciar();
    iniciarTemaInterface();
    iniciarTituloProjeto();
    O.ui.abas.iniciar(U.$('[role="tablist"]'), E.obter('interface.abaAtiva'));

    O.ui.editor.iniciar();
    O.ui.previa.iniciar();
    O.ui.miniaturas.iniciar();
    O.ui.ingestao.iniciar();
    O.ui.acervo.iniciar();
    O.ui.tabelas.iniciar();
    O.ui.tema.iniciar();
    O.ui.conferencia.iniciar();
    O.ui.guia.iniciar();
    O.ui.composicao.iniciar();
    O.ui.apresentar.iniciar();
    iniciarIndicadores();

    let ambienteConferido = false;
    E.ouvir('aba:ativada', ({ aba }) => {
      if (aba === 'conferencia' && !ambienteConferido) { ambienteConferido = true; conferirAmbiente(); }
    });
    if (O.ui.abas.atual() === 'conferencia') { ambienteConferido = true; conferirAmbiente(); }
    U.$('#botao-reconferir-ambiente')?.addEventListener('click', () => { conferirAmbiente(); O.ui.anunciar('Conferência do ambiente refeita.'); });

    iniciarGuarda().catch((e) => console.error(`[${C.APP_NOME}] guarda automática:`, e));

    aplicarPreferencias().finally(() => {
      if (C.DESENVOLVIMENTO) {
        console.info(`[${C.APP_NOME}] v${C.VERSAO} · ${location.protocol} · guarda: ${O.persistencia.modo()}`);
        setTimeout(() => O.ui.dicas.auditar(), 1500);
      }
    });

    // Service worker: somente em https (registrado a partir da etapa 8, quando sw.js existir).
  }

  iniciar();
})(window.Oratoria);
