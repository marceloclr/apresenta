// js/interface/conferencia.js — aba Conferência (§5.2, §12): advertências sobre o conteúdo e
// relatório de contraste do tema. O cartão "Condições do ambiente" continua em app.js.
//
// Fontes das advertências, recalculadas a cada renderização completa:
//   • interpretador e paginação (renderizar().avisos): cabeçalho, diretivas, imagens sem texto
//     alternativo ou ausentes, títulos ausentes, blocos com erro, tabelas reduzidas ou divididas;
//   • contraste do tema com os ajustes (O.temas.relatorioContraste): pares abaixo de AA;
//   • acervo: imagens acima de IMAGEM_ALERTA_BYTES e arquivos não citados no texto.
// Cada advertência com posição leva ao texto ("Ir ao texto"). A aba exibe um contador de
// impedimentos e advertências.
//
//   O.ui.conferencia.iniciar() · O.ui.conferencia.advertencias() → lista atual

(function (O) {
  'use strict';

  const CF = (O.ui.conferencia = {});
  const U = O.util;
  const C = O.config;
  const E = O.estado;
  const R = O.rotulos;

  const ORDEM = ['erro', 'aviso', 'info'];
  let atuais = [];

  CF.advertencias = () => atuais.slice();

  function coletar(r) {
    const lista = r.avisos.map((a) => Object.assign({}, a));
    const ajustes = E.obter('projeto.ajustesTema') || {};
    const tema = O.temas.obter(r.meta.tema);
    for (const par of O.temas.relatorioContraste(r.meta.tema, ajustes)) {
      if (par.aprovado) continue;
      lista.push({
        gravidade: 'aviso', codigo: 'contraste-insuficiente', slide: null, linha: null,
        mensagem: `Contraste insuficiente no tema ${tema.nome}: ${par.rotulo.toLowerCase()} tem ${U.formatarRazao(par.razao)}, abaixo do mínimo de ${U.formatarDecimal(par.minimo, 1)}:1. Revise a cor de acento na aba Tema.`,
      });
    }
    const texto = E.obter('projeto.markdown') || '';
    for (const item of Object.values(E.obter('projeto.acervo') || {})) {
      if (item.tipo === 'imagem' && item.bytes > C.IMAGEM_ALERTA_BYTES) {
        lista.push({ gravidade: 'aviso', codigo: 'imagem-pesada', slide: null, linha: null, arquivo: item.nome, mensagem: `Imagem "${item.nome}" tem ${U.formatarBytes(item.bytes)} mesmo após a compressão (limite recomendado: ${U.formatarBytes(C.IMAGEM_ALERTA_BYTES)}). Reduza a qualidade na aba Acervo ou use uma imagem menor.` });
      }
      if (!texto.includes(item.nome)) {
        lista.push({ gravidade: 'info', codigo: 'arquivo-nao-citado', slide: null, linha: null, arquivo: item.nome, mensagem: `"${item.nome}" está no acervo, mas não é citado no texto; não entrará na apresentação exportada.` });
      }
    }
    // Linha dos avisos de paginação: início do slide de origem
    const slides = r.resultado.slides;
    lista.forEach((a) => {
      if (a.linha == null && Number.isInteger(a.slide)) {
        const secao = r.secoes[a.slide];
        const origem = secao ? Number(secao.dataset.origem) : a.slide;
        if (slides[origem]) { a.origem = origem; a.linha = slides[origem].linhaInicio; }
      } else if (Number.isInteger(a.slide)) a.origem = a.slide;
    });
    return lista.sort((a, b) => ORDEM.indexOf(a.gravidade) - ORDEM.indexOf(b.gravidade) || (a.linha || 0) - (b.linha || 0));
  }

  function item(a) {
    const onde = Number.isInteger(a.origem) ? `Slide ${a.origem + 1}${a.linha ? ` · linha ${a.linha}` : ''}`
      : a.linha ? `Cabeçalho · linha ${a.linha}` : a.arquivo ? 'Acervo' : a.codigo === 'contraste-insuficiente' ? 'Tema' : 'Apresentação';
    const acoes = [];
    if (a.linha) {
      acoes.push(U.el('button', {
        type: 'button', class: 'botao botao-discreto',
        'data-dica': `Leva o cursor do editor à linha ${a.linha}, no início do slide em questão.`,
        onclick: () => { O.ui.editor.irParaLinha(a.linha); },
      }, 'Ir ao texto'));
    } else if (a.arquivo) {
      acoes.push(U.el('button', {
        type: 'button', class: 'botao botao-discreto',
        'data-dica': 'Abre a aba Acervo filtrada por este arquivo.',
        onclick: () => {
          O.ui.abas.ativar('acervo');
          const f = U.$('#campo-filtro-acervo');
          if (f) { f.value = a.arquivo; f.dispatchEvent(new Event('input')); f.focus(); }
        },
      }, 'Ver no acervo'));
    } else if (a.codigo === 'contraste-insuficiente') {
      acoes.push(U.el('button', {
        type: 'button', class: 'botao botao-discreto',
        'data-dica': 'Abre a aba Tema, onde ficam a cor de acento e o botão para restaurar o padrão do modelo.',
        onclick: () => O.ui.abas.ativar('tema', { focarCampo: true }),
      }, 'Abrir Tema'));
    }
    return U.el('li', { class: 'advertencia', 'data-estado': a.gravidade },
      U.el('span', { class: 'selo', 'data-estado': a.gravidade === 'info' ? 'pendente' : a.gravidade, 'data-dica': `Gravidade: ${R.rotuloGravidade(a.gravidade)}. Código: ${a.codigo}.` }, R.rotuloGravidade(a.gravidade)),
      U.el('div', { class: 'advertencia-texto' }, U.el('span', { class: 'advertencia-onde' }, onde), U.el('span', null, a.mensagem)),
      ...acoes);
  }

  function atualizarContador(lista) {
    const aba = U.$('#aba-conferencia');
    if (!aba) return;
    const n = lista.filter((a) => a.gravidade !== 'info').length;
    let selo = U.$('.aba-contador', aba);
    if (!selo) { selo = U.el('span', { class: 'aba-contador' }); aba.append(selo); }
    selo.hidden = !n;
    selo.textContent = String(n);
    selo.dataset.estado = lista.some((a) => a.gravidade === 'erro') ? 'erro' : 'aviso';
    aba.setAttribute('aria-label', `${R.rotuloAba('conferencia')}${n ? `, ${n} advertência${n > 1 ? 's' : ''}` : ''}`);
  }

  function renderizar(r) {
    atuais = coletar(r);
    atualizarContador(atuais);
    const alvo = U.$('#lista-advertencias');
    const resumo = U.$('#resumo-advertencias');
    if (!alvo) return;
    const conta = (g) => atuais.filter((a) => a.gravidade === g).length;
    const plural = (s) => (s.endsWith('ão') ? `${s.slice(0, -2)}ões` : `${s}s`);
    resumo.textContent = atuais.length
      ? ORDEM.map((g) => { const n = conta(g); const r = R.rotuloGravidade(g).toLowerCase(); return `${n} ${n === 1 ? r : plural(r)}`; }).join(' · ')
      : (r.secoes.length ? 'Nenhuma advertência. A apresentação está em ordem.' : 'Sem slides para conferir.');
    alvo.replaceChildren(...atuais.map(item));
    renderizarContraste(r);
  }

  function renderizarContraste(r) {
    const corpo = U.$('#tabela-contraste tbody');
    if (!corpo) return;
    const rel = O.temas.relatorioContraste(r.meta.tema, E.obter('projeto.ajustesTema') || {});
    U.$('#titulo-contraste').textContent = `Contraste do tema ${O.temas.obter(r.meta.tema).nome}`;
    corpo.replaceChildren(...rel.map((p) => U.el('tr', null,
      U.el('th', { scope: 'row' }, p.rotulo),
      U.el('td', { class: 'numero' }, U.formatarRazao(p.razao)),
      U.el('td', null, U.el('span', {
        class: 'selo', 'data-estado': p.aprovado ? 'ok' : 'erro',
        'data-dica': `${p.texto} sobre ${p.fundo}. Mínimo exigido: ${U.formatarDecimal(p.minimo, 1)}:1 (${p.minimo === 3 ? 'texto grande' : 'texto corrente'}).`,
        'data-dica-formula': 'razão = (L₁ + 0,05) ÷ (L₂ + 0,05)',
      }, p.aprovado ? 'AA' : 'abaixo')))));
  }

  CF.iniciar = function () {
    E.ouvir('previa:completa', renderizar);
  };
})(window.Oratoria);
