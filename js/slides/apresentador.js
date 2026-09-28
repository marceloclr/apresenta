// js/slides/apresentador.js — motorApresentador: janela do modo apresentador.
//
// FUNÇÃO AUTOSSUFICIENTE: reinjetada via toString() nas apresentações exportadas.
// É chamada pelo motor (opção `apresentador`) e recebe um contexto:
//   { slides, total, largura, altura, titulo, documentoOrigem, tema, clonar(i), tituloDe(i),
//     comando(nome, indice) }   // nome: 'avancar' | 'voltar' | 'ir' | 'escurecer'
// Devolve { atualizar(indice, passo), fechar(), fechado(), focar() } ou null se a janela
// for bloqueada.
//
// Decisão D23 (revisa D10): a janela é aberta vazia (about:blank), herda a origem da janela
// principal e é montada e atualizada diretamente por ela. Funciona igualmente em file:// e
// https, no editor e no arquivo exportado, sem BroadcastChannel nem postMessage.

(function (O) {
  'use strict';

  O.slides.motorApresentador = function motorApresentador(ctx) {
    var w = null;
    try { w = window.open('', 'oratoria-apresentador', 'popup=yes,width=1280,height=800'); } catch (e) { w = null; }
    if (!w) return null;
    var d = w.document;
    var inicio = Date.now();
    var estado = { indice: 0, passo: 0 };
    var relogio = null;
    var tardio = null;

    // ── Documento ───────────────────────────────────────────────────────
    d.open();
    d.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title></title></head><body></body></html>');
    d.close();
    d.title = 'Apresentador · ' + ctx.titulo;
    var cabeca = d.head;
    var origens = ctx.documentoOrigem.querySelectorAll('style, link[rel="stylesheet"]');
    for (var i = 0; i < origens.length; i++) {
      var o = origens[i];
      if (o.tagName === 'LINK') { var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = o.href; cabeca.appendChild(l); }
      else { var s = d.createElement('style'); s.textContent = o.textContent; cabeca.appendChild(s); }
    }
    var css = d.createElement('style');
    css.textContent = [
      'html,body{margin:0;height:100%;background:#101318;color:#eceae6;font:15px/1.45 "IBM Plex Sans",system-ui,sans-serif}',
      '.ap{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;padding:12px;box-sizing:border-box}',
      '.ap-topo{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
      '.ap-titulo{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ap-medida{font:600 22px/1 "IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;padding:8px 12px;border-radius:9px;background:#1c222b}',
      '.ap-medida small{display:block;font:500 11px/1 system-ui,sans-serif;color:#a3a8af;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}',
      '.ap button{font:600 13px/1 system-ui,sans-serif;color:#eceae6;background:#232a35;border:1px solid #3d4550;border-radius:8px;padding:10px 12px;cursor:pointer}',
      '.ap button:hover{border-color:#6a9fcc}.ap button:focus-visible{outline:2px solid #6a9fcc;outline-offset:2px}',
      '.ap-corpo{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:12px;min-height:0}',
      '.ap-lado{display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;min-height:0}',
      '.ap-quadro{position:relative;overflow:hidden;border-radius:10px;background:#000;align-self:start}',
      '.ap-quadro>.o-slide{position:absolute;left:0;top:0;transform-origin:0 0}',
      '.ap-rotulo{font:600 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#a3a8af;margin:0 0 6px}',
      '.ap-atual .o-fragmento:not(.o-visivel){opacity:.28!important;transform:none!important}',
      '.ap-notas{overflow:auto;padding:14px 16px;border-radius:10px;background:#1a2029;font-size:22px;line-height:1.5}',
      '.ap-notas p{margin:0 0 .6em}.ap-vazio{color:#8b9097;font-style:italic;font-size:17px}',
      '.ap-aviso{font-size:13px;color:#e8b86a;margin-top:6px}',
    ].join('\n');
    cabeca.appendChild(css);

    function el(tag, classe, texto) { var e = d.createElement(tag); if (classe) e.className = classe; if (texto != null) e.textContent = texto; return e; }
    function botao(pai, texto, dica, acao) {
      var b = el('button', null, texto); b.type = 'button'; b.title = dica; b.setAttribute('aria-label', dica);
      b.addEventListener('click', acao); pai.appendChild(b); return b;
    }
    function medida(pai, rotulo) { var m = el('div', 'ap-medida'); m.appendChild(el('small', null, rotulo)); var v = el('span', null, '—'); m.appendChild(v); pai.appendChild(m); return v; }

    var raiz = el('div', 'ap');
    var topo = el('div', 'ap-topo');
    topo.appendChild(el('div', 'ap-titulo', ctx.titulo));
    var vContador = medida(topo, 'Slide');
    var vDecorrido = medida(topo, 'Decorrido');
    var vRelogio = medida(topo, 'Horário');
    botao(topo, '‹ Anterior', 'Volta um passo (←)', function () { ctx.comando('voltar'); });
    botao(topo, 'Próximo ›', 'Avança um passo (→ ou espaço)', function () { ctx.comando('avancar'); });
    botao(topo, 'Escurecer', 'Escurece a tela da plateia; repita para voltar (B)', function () { ctx.comando('escurecer'); });
    botao(topo, 'Zerar cronômetro', 'Reinicia a contagem do tempo decorrido', function () { inicio = Date.now(); tique(); });
    var corpo = el('div', 'ap-corpo');
    var colAtual = el('div');
    colAtual.appendChild(el('p', 'ap-rotulo', 'Na tela'));
    var qAtual = el('div', 'ap-quadro ap-atual');
    colAtual.appendChild(qAtual);
    var aviso = el('div', 'ap-aviso');
    colAtual.appendChild(aviso);
    var lado = el('div', 'ap-lado');
    var colProx = el('div');
    colProx.appendChild(el('p', 'ap-rotulo', 'A seguir'));
    var qProx = el('div', 'ap-quadro');
    colProx.appendChild(qProx);
    var colNotas = el('div');
    colNotas.style.cssText = 'display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0';
    colNotas.appendChild(el('p', 'ap-rotulo', 'Notas do orador'));
    var notas = el('div', 'ap-notas');
    notas.setAttribute('aria-live', 'polite');
    colNotas.appendChild(notas);
    lado.appendChild(colProx);
    lado.appendChild(colNotas);
    corpo.appendChild(colAtual);
    corpo.appendChild(lado);
    raiz.appendChild(topo);
    raiz.appendChild(corpo);
    if (ctx.tema) raiz.setAttribute('data-tema', ctx.tema);
    d.body.replaceChildren(raiz);

    // ── Desenho ─────────────────────────────────────────────────────────
    function encaixar(quadro) {
      var s = quadro.firstChild;
      if (!s) return;
      var larg = quadro.clientWidth;
      quadro.style.height = Math.round(larg * ctx.altura / ctx.largura) + 'px';
      s.style.transform = 'scale(' + (larg / ctx.largura) + ')';
    }
    function copiar(i, comEstado) {
      var c = ctx.clonar(i);
      if (comEstado) c.classList.remove('o-miniatura');
      return d.importNode(c, true);
    }
    function desenhar() {
      var i = estado.indice;
      qAtual.replaceChildren(copiar(i, true));
      if (i + 1 < ctx.total) qProx.replaceChildren(copiar(i + 1, false));
      else qProx.replaceChildren(el('div', 'ap-vazio', 'Fim da apresentação.'));
      var n = ctx.slides[i].querySelectorAll('.o-fragmento').length;
      aviso.textContent = estado.passo < n ? 'Ainda há ' + (n - estado.passo) + ' item(ns) a revelar neste slide.' : '';
      var fonte = ctx.slides[i].querySelector('.o-notas');
      if (fonte && fonte.innerHTML.trim()) notas.innerHTML = fonte.innerHTML;
      else notas.replaceChildren(el('p', 'ap-vazio', 'Sem notas para este slide.'));
      vContador.textContent = (i + 1) + ' / ' + ctx.total;
      encaixar(qAtual);
      encaixar(qProx);
    }
    function dois(n) { return (n < 10 ? '0' : '') + n; }
    function tique() {
      if (w.closed) { clearInterval(relogio); return; }
      var t = Math.floor((Date.now() - inicio) / 1000);
      vDecorrido.textContent = dois(Math.floor(t / 3600)) + ':' + dois(Math.floor(t / 60) % 60) + ':' + dois(t % 60);
      var agora = new Date();
      vRelogio.textContent = dois(agora.getHours()) + ':' + dois(agora.getMinutes());
    }
    relogio = setInterval(tique, 1000);
    tique();

    w.addEventListener('resize', function () { encaixar(qAtual); encaixar(qProx); });
    w.addEventListener('keydown', function (ev) {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.target && ev.target.closest && ev.target.closest('button') && (ev.key === ' ' || ev.key === 'Enter')) return;
      var k = ev.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') ctx.comando('avancar');
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') ctx.comando('voltar');
      else if (k === 'Home') ctx.comando('ir', 0);
      else if (k === 'End') ctx.comando('ir', ctx.total - 1);
      else if (k === 'b' || k === 'B' || k === '.') ctx.comando('escurecer');
      else return;
      ev.preventDefault();
    });

    return {
      atualizar: function (indice, passo) {
        if (w.closed) return;
        estado.indice = indice; estado.passo = passo;
        desenhar();
        clearTimeout(tardio);
        // Gráficos animados: redesenha a cópia após a animação terminar
        if (ctx.slides[indice].querySelector('canvas')) tardio = setTimeout(desenhar, 700);
      },
      fechar: function () { clearInterval(relogio); clearTimeout(tardio); if (!w.closed) w.close(); },
      fechado: function () { return w.closed; },
      focar: function () { if (!w.closed) w.focus(); },
    };
  };
})(window.Oratoria);
