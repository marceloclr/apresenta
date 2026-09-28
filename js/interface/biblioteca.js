// js/interface/biblioteca.js — aba Biblioteca: apresentações guardadas no navegador e numa
// pasta do computador. A publicação no GitHub fica para a etapa 10 (D34).
//
//   • Navegador: loja 'biblioteca' do IndexedDB, chave = id →
//       { id, nome, guardadoEm, projeto, resumo: { titulo, tema, slides, bytes } }
//     guardar cópia, abrir (com a confirmação de D35), atualizar com o trabalho atual,
//     exportar como .oratoria.json e remover (dois toques).
//   • Pasta (File System Access; Chrome, Edge e derivados): o identificador da pasta fica na
//     loja 'pastas' ('atual'); "Gravar na pasta" escreve <titulo>.oratoria.json e <titulo>.html e
//     regenera indice.html com a lista de apresentações da pasta. A permissão de escrita é
//     pedida a cada sessão, num gesto do usuário. Sem a API (Firefox), os mesmos dois arquivos
//     vão para os downloads.
//
//   O.ui.biblioteca.iniciar()

(function (O) {
  'use strict';

  const BI = (O.ui.biblioteca = {});
  const U = O.util;
  const C = O.config;
  const E = O.estado;
  const P = O.persistencia;
  const X = O.exportacao;

  const PROIBIDOS = /[\u0000-\u001f\u007f/\\:*?"<>|]/g;
  const temPasta = typeof window.showDirectoryPicker === 'function';
  let pasta = null; // FileSystemDirectoryHandle

  // ═══════════════════════════ Navegador ═══════════════════════════

  function resumoDo(projeto) {
    const r = O.ui.previa.interpretacao();
    const meta = O.conteudo.extrairFrontMatter(projeto.markdown || '').meta || {};
    return {
      titulo: String(meta.titulo || projeto.titulo || ''),
      tema: String(meta.tema || C.TEMA_PADRAO),
      slides: r ? r.slides.length : O.conteudo.contarSlides(projeto.markdown || ''),
      bytes: new TextEncoder().encode(JSON.stringify(projeto)).length,
    };
  }

  function nomePadrao() {
    const p = E.obter('projeto');
    return p.titulo || (O.conteudo.extrairFrontMatter(p.markdown || '').meta || {}).titulo || 'Apresentação sem título';
  }

  async function guardar() {
    const campo = U.$('#campo-nome-biblioteca');
    const projeto = E.instantaneo('projeto');
    if (!(projeto.markdown || '').trim()) { O.ui.notificar('Não há trabalho para guardar.', { gravidade: 'aviso' }); return; }
    const nome = (campo.value.trim() || nomePadrao()).slice(0, 80);
    const id = U.gerarId('bib');
    await P.gravar('biblioteca', id, { id, nome, guardadoEm: Date.now(), projeto, resumo: resumoDo(projeto) });
    campo.value = '';
    O.ui.notificar(`"${nome}" guardada na Biblioteca deste navegador.`, { gravidade: 'ok' });
    listar();
  }

  function item(e) {
    const r = e.resumo || {};
    const tema = O.temas.obter(r.tema);
    const botao = (rotulo, dica, acao, classe = 'botao botao-discreto') => U.el('button', { type: 'button', class: classe, 'data-dica': dica, onclick: acao }, rotulo);
    const abrir = botao('Abrir', 'Abre esta apresentação no editor. Se houver trabalho em andamento, pede confirmação; o trabalho substituído fica guardado para retomada.', () => {
      O.ui.apresentar.oferecerProjeto({ projeto: e.projeto, avisos: [], origem: { descricao: `guardada em ${U.formatarDataHora(e.guardadoEm)}` } }, e.nome);
    }, 'botao');
    const atualizar = botao('Atualizar', 'Substitui o conteúdo guardado pelo trabalho atual do editor, mantendo o nome. Pede confirmação com um segundo toque.');
    O.ui.doisToques(atualizar, 'Substituir pelo atual?', async () => {
      const projeto = E.instantaneo('projeto');
      await P.gravar('biblioteca', e.id, Object.assign({}, e, { guardadoEm: Date.now(), projeto, resumo: resumoDo(projeto) }));
      O.ui.notificar(`"${e.nome}" atualizada com o trabalho atual.`, { gravidade: 'ok' });
      listar();
    });
    const exportar = botao('Exportar', 'Gera o arquivo .oratoria.json desta apresentação, para levá-la a outro computador.', () => {
      const r2 = X.projeto.baixar(e.projeto);
      O.ui.notificar(`Projeto "${r2.nome}" gerado.`, { gravidade: 'ok' });
    });
    const remover = botao('Remover', 'Apaga esta apresentação da Biblioteca do navegador. Pede confirmação com um segundo toque; não pode ser desfeito.');
    O.ui.doisToques(remover, 'Apagar da Biblioteca?', async () => {
      await P.remover('biblioteca', e.id);
      O.ui.notificar(`"${e.nome}" apagada da Biblioteca.`, { gravidade: 'info' });
      listar();
    });
    return U.el('li', { class: 'cartao biblioteca-item', 'data-cor': 'biblioteca', 'data-nome': e.nome.toLowerCase() },
      U.el('div', { class: 'biblioteca-cabeca' },
        U.el('strong', { class: 'biblioteca-nome' }, e.nome),
        U.el('span', { class: 'biblioteca-dados' },
          `${U.formatarDataHora(e.guardadoEm)} · ${U.formatarNumero(r.slides || 0)} slides · ${tema ? tema.nome : r.tema || '—'} · ${U.formatarBytes(r.bytes)}`)),
      U.el('div', { class: 'grupo-botoes' }, abrir, atualizar, exportar, remover));
  }

  async function listar() {
    const alvo = U.$('#lista-biblioteca');
    if (!alvo) return;
    const todos = (await P.listar('biblioteca').catch(() => [])).map((x) => x.valor).filter((v) => v && v.projeto);
    todos.sort((a, b) => b.guardadoEm - a.guardadoEm);
    U.$('#biblioteca-resumo').textContent = todos.length
      ? `${todos.length} apresentação(ões) guardada(s) neste navegador.`
      : 'Nenhuma apresentação guardada neste navegador.';
    alvo.replaceChildren(...todos.map(item));
    filtrar();
  }

  function filtrar() {
    const termo = (U.$('#campo-filtro-biblioteca')?.value || '').trim().toLowerCase();
    U.$$('#lista-biblioteca > li').forEach((li) => { li.hidden = !!termo && !li.dataset.nome.includes(termo); });
  }

  // ═══════════════════════════ Pasta do computador ═══════════════════════════

  async function permissao(pedir) {
    if (!pasta) return 'ausente';
    const opcoes = { mode: 'readwrite' };
    let estado = await pasta.queryPermission(opcoes);
    if (estado === 'prompt' && pedir) estado = await pasta.requestPermission(opcoes);
    return estado;
  }

  async function escolherPasta() {
    try {
      pasta = await window.showDirectoryPicker({ id: 'apresenta-biblioteca', mode: 'readwrite' });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      O.ui.notificar(`Não foi possível usar a pasta: ${e.message}.`, { gravidade: 'erro' });
      return;
    }
    await P.gravar('pastas', 'atual', pasta).catch(() => { /* guarda em memória: vale só nesta sessão */ });
    O.ui.notificar(`Pasta "${pasta.name}" escolhida para a Biblioteca.`, { gravidade: 'ok' });
    atualizarPasta();
  }

  async function gravarArquivo(nome, conteudo) {
    const arquivo = await pasta.getFileHandle(nome, { create: true });
    const escrita = await arquivo.createWritable();
    await escrita.write(conteudo);
    await escrita.close();
  }

  /** indice.html: página estática, sem scripts, que lista as apresentações da pasta. */
  async function gerarIndice() {
    const itens = [];
    for await (const [nome, h] of pasta.entries()) {
      if (h.kind !== 'file' || !/\.html$/i.test(nome) || nome === 'indice.html') continue;
      const f = await h.getFile();
      // Título real, lido do <title> no início do arquivo; na falta, o nome do arquivo
      const inicio = await f.slice(0, 4096).text();
      const t = inicio.match(/<title>([^<]{1,200})<\/title>/i);
      const titulo = t ? t[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : nome.replace(/\.html$/i, '').replace(/[-_]+/g, ' ');
      itens.push({ nome, titulo, quando: f.lastModified, bytes: f.size });
    }
    itens.sort((a, b) => b.quando - a.quando);
    const e = U.escaparHtml;
    const linhas = itens.map((i) => `<li><a href="${encodeURI(i.nome)}">${e(i.titulo)}</a><span>${e(U.formatarDataHora(i.quando))} · ${e(U.formatarBytes(i.bytes))}</span></li>`).join('\n');
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="generator" content="${e(C.APP_NOME)} ${e(C.VERSAO)}">
<title>Apresentações · ${e(pasta.name)}</title>
<style>
body { margin: 0; padding: 40px 24px; font: 16px/1.5 system-ui, 'Segoe UI', sans-serif; color: #1e293b; background: #f5f7fb; }
main { max-width: 760px; margin: 0 auto; }
h1 { font: 600 28px/1.2 Georgia, serif; margin: 0 0 4px; }
p { color: #475569; margin: 0 0 24px; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: flex; justify-content: space-between; gap: 16px; padding: 12px 16px; background: #fff; border: 1px solid #cbd5e1; border-left: 3px solid #2f5f8f; border-radius: 8px; }
a { color: #2f5f8f; font-weight: 600; text-decoration: none; }
a:hover, a:focus-visible { text-decoration: underline; }
span { color: #475569; font-size: 14px; white-space: nowrap; }
@media (prefers-color-scheme: dark) { body { background: #0f1318; color: #ebe7e4; } li { background: #1a2029; border-color: #3d4550; border-left-color: #6a9fcc; } a { color: #8fb9df; } p, span { color: #a3a8af; } }
</style>
</head>
<body>
<main>
<h1>Apresentações</h1>
<p>${itens.length} apresentação(ões) nesta pasta. Cada uma abre sozinha, sem internet. Lista atualizada em ${e(U.formatarDataHora(Date.now()))}.</p>
<ul>
${linhas}
</ul>
</main>
</body>
</html>
`;
    await gravarArquivo('indice.html', new Blob([html], { type: 'text/html;charset=utf-8' }));
    return itens.length;
  }

  async function gravarNaPasta() {
    const projeto = E.obter('projeto');
    if (!(projeto.markdown || '').trim()) { O.ui.notificar('Não há trabalho para gravar.', { gravidade: 'aviso' }); return; }
    const estado = U.$('#estado-pasta');
    if (!temPasta) {
      estado.textContent = 'Gerando os arquivos…';
      const h = await X.html.baixar(projeto);
      const p = X.projeto.baixar(projeto);
      estado.textContent = `Enviados aos downloads: ${h.nome} e ${p.nome}.`;
      O.ui.notificar('Este navegador não grava direto em pastas: os arquivos foram para os downloads. Mova-os para a pasta desejada.', { gravidade: 'info' });
      return;
    }
    if (!pasta) { await escolherPasta(); if (!pasta) return; }
    if (await permissao(true) !== 'granted') { O.ui.notificar('Sem permissão de escrita na pasta. Escolha a pasta de novo ou autorize o acesso.', { gravidade: 'aviso' }); return; }
    estado.textContent = 'Gerando a apresentação…';
    const h = await X.html.gerar(projeto);
    const base = h.nome.replace(/_\d{4}-\d{2}-\d{2}\.html$/, '');
    const pj = X.projeto.serializar(projeto);
    await gravarArquivo(`${base}.html`, new Blob([h.html], { type: 'text/html;charset=utf-8' }));
    await gravarArquivo(`${base}.oratoria.json`, new Blob([pj.texto], { type: 'application/json;charset=utf-8' }));
    const n = await gerarIndice();
    estado.textContent = `Gravados em "${pasta.name}": ${base}.html e ${base}.oratoria.json. Índice com ${n} apresentação(ões).`;
    O.ui.notificar(`Apresentação gravada na pasta "${pasta.name}" e índice atualizado.`, { gravidade: 'ok' });
    listarPasta();
  }

  async function listarPasta() {
    const alvo = U.$('#lista-pasta');
    if (!alvo) return;
    if (!pasta || await permissao(false) !== 'granted') { alvo.replaceChildren(); return; }
    const itens = [];
    for await (const [nome, h] of pasta.entries()) {
      if (h.kind === 'file' && /\.oratoria\.json$/i.test(nome)) itens.push({ nome, h, quando: (await h.getFile()).lastModified });
    }
    itens.sort((a, b) => b.quando - a.quando);
    alvo.replaceChildren(...itens.map((i) => U.el('li', { class: 'pasta-item' },
      U.el('span', null, U.el('strong', null, i.nome.replace(/\.oratoria\.json$/i, '')), U.el('small', null, ` · ${U.formatarDataHora(i.quando)}`)),
      U.el('button', {
        type: 'button', class: 'botao botao-discreto',
        'data-dica': 'Abre este projeto da pasta no editor (com confirmação, se houver trabalho em andamento).',
        onclick: async () => O.ui.apresentar.abrirProjeto(await i.h.getFile()),
      }, 'Abrir'))));
    if (!itens.length) alvo.replaceChildren(U.el('li', { class: 'cartao-nota' }, 'Nenhum projeto nesta pasta ainda.'));
  }

  async function atualizarPasta() {
    const nome = U.$('#pasta-atual');
    const autorizar = U.$('#botao-autorizar-pasta');
    if (!nome) return;
    if (!temPasta) {
      nome.textContent = 'Este navegador não permite gravar diretamente numa pasta (recurso do Chrome e do Edge). "Gravar" envia os arquivos para os downloads.';
      U.$('#botao-escolher-pasta').hidden = true;
      autorizar.hidden = true;
      return;
    }
    const estado = await permissao(false);
    nome.textContent = pasta ? `Pasta: ${pasta.name}${estado === 'granted' ? '' : ' (acesso a autorizar nesta sessão)'}` : 'Nenhuma pasta escolhida.';
    autorizar.hidden = !pasta || estado === 'granted';
    listarPasta();
  }

  // ═══════════════════════════ Início ═══════════════════════════

  BI.iniciar = function () {
    if (!U.$('#painel-biblioteca')) return;
    const campo = U.$('#campo-nome-biblioteca');
    campo?.addEventListener('input', () => {
      if (PROIBIDOS.test(campo.value)) campo.value = campo.value.replace(PROIBIDOS, '');
      PROIBIDOS.lastIndex = 0;
    });
    campo?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') guardar(); });
    U.$('#botao-guardar-biblioteca')?.addEventListener('click', guardar);
    U.$('#campo-filtro-biblioteca')?.addEventListener('input', filtrar);
    U.$('#botao-escolher-pasta')?.addEventListener('click', escolherPasta);
    U.$('#botao-gravar-pasta')?.addEventListener('click', () => gravarNaPasta().catch((e) => O.ui.notificar(`Gravação na pasta falhou: ${e.message}.`, { gravidade: 'erro' })));
    U.$('#botao-autorizar-pasta')?.addEventListener('click', async () => { await permissao(true); atualizarPasta(); });
    E.ouvir('aba:ativada', ({ aba }) => {
      if (aba !== 'biblioteca') return;
      const c = U.$('#campo-nome-biblioteca');
      if (c) c.placeholder = nomePadrao();
      listar();
      atualizarPasta();
    });
    P.obter('pastas', 'atual').then((h) => { if (h && typeof h.queryPermission === 'function') pasta = h; }).catch(() => {}).finally(() => {
      if (O.ui.abas.atual() === 'biblioteca') { listar(); atualizarPasta(); }
    });
  };
})(window.Oratoria);
