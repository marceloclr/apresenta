// js/interface/app.js — orquestração da interface. ÚLTIMO script a carregar.
// Scripts com defer executam após a análise do documento: o DOM já está disponível.

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

  // ── Preferências salvas e rascunho ─────────────────────────────────────
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

    let ambienteConferido = false;
    E.ouvir('aba:ativada', ({ aba }) => {
      if (aba === 'conferencia' && !ambienteConferido) { ambienteConferido = true; conferirAmbiente(); }
    });
    if (O.ui.abas.atual() === 'conferencia') { ambienteConferido = true; conferirAmbiente(); }
    U.$('#botao-reconferir-ambiente')?.addEventListener('click', () => { conferirAmbiente(); O.ui.anunciar('Conferência do ambiente refeita.'); });

    aplicarPreferencias().finally(() => {
      if (C.DESENVOLVIMENTO) {
        console.info(`[${C.APP_NOME}] v${C.VERSAO} · ${location.protocol} · guarda: ${O.persistencia.modo()}`);
        O.ui.dicas.auditar();
      }
    });

    // Service worker: somente em https (registrado a partir da etapa 8, quando sw.js existir).
  }

  iniciar();
})(window.Oratoria);
