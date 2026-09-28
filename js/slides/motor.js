// js/slides/motor.js — motorSlides: o runtime único das apresentações (editor e exportação).
//
// FUNÇÃO AUTOSSUFICIENTE: reinjetada via toString() nas apresentações exportadas; não pode
// referenciar nada fora de si além dos globais permitidos em tools/verificar.mjs. Meta: < 25 KB.
//
//   const m = O.slides.motorSlides(raiz, {
//     largura: 1920, altura: 1080,       // resolução de referência
//     indice: 0,                         // slide inicial (o hash #/N prevalece, se hash: true)
//     hash: true,                        // sincroniza #/N (1-based) com a URL
//     transicao: 'suave',                // padrão; cada slide pode trazer data-transicao
//     titulo: 'Título da apresentação',
//     apresentador: motorApresentador,   // função do modo apresentador (apresentador.js)
//     graficos: motorGraficos,           // função de gráficos (graficos-runtime.js), opcional
//     aoMudar: (indice, fragmento) => {},
//     sair: () => {},                    // Esc fora da tela cheia (editor); ausente no exportado
//   });
//   m.ir(i) · m.avancar() · m.voltar() · m.atual() · m.total · m.visaoGeral() · m.escurecer()
//   m.telaCheia() · m.abrirApresentador() · m.destruir()
//
// `raiz` contém as <section class="o-slide"> já montadas; o motor as envolve num palco
// escalado por transform: scale() com letterbox na cor --s-fundo.

(function (O) {
  'use strict';

  O.slides.motorSlides = function motorSlides(raiz, opcoes) {
    opcoes = opcoes || {};
    var L = opcoes.largura || 1920;
    var A = opcoes.altura || 1080;
    var doc = raiz.ownerDocument;
    var janela = doc.defaultView || window;
    var reduzir = false;
    try { reduzir = janela.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduzir = false; }

    // ── Estilos do motor (uma vez por documento) ─────────────────────────
    var CSS = [
      '.o-apresentacao{position:relative;width:100%;height:100%;overflow:hidden;background:var(--s-fundo,#000);outline:none;touch-action:pan-y}',
      '.o-apresentacao .o-palco{position:absolute;inset:0;overflow:hidden}',
      '.o-apresentacao .o-trilho{position:absolute;left:0;top:0;transform-origin:0 0}',
      '.o-apresentacao .o-trilho>.o-slide{position:absolute;left:0;top:0;visibility:hidden}',
      '.o-apresentacao .o-trilho>.o-slide.o-atual{visibility:visible;z-index:2}',
      '.o-apresentacao .o-trilho>.o-slide.o-anim-suave{animation:o-surgir .42s ease both}',
      '.o-apresentacao .o-trilho>.o-slide.o-anim-frente{animation:o-frente .46s cubic-bezier(.2,.7,.2,1) both}',
      '.o-apresentacao .o-trilho>.o-slide.o-anim-tras{animation:o-tras .46s cubic-bezier(.2,.7,.2,1) both}',
      '@keyframes o-surgir{from{opacity:0}to{opacity:1}}',
      '@keyframes o-frente{from{opacity:0;transform:translateX(5%)}to{opacity:1;transform:none}}',
      '@keyframes o-tras{from{opacity:0;transform:translateX(-5%)}to{opacity:1;transform:none}}',
      '.o-apresentacao .o-progresso{position:absolute;left:0;bottom:0;height:5px;background:var(--s-acento,#6a9fcc);z-index:5;transition:width .35s ease}',
      '.o-apresentacao .o-cortina{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:8;transition:opacity .35s ease}',
      '.o-apresentacao.o-escuro .o-cortina{opacity:1;pointer-events:auto}',
      '.o-apresentacao .o-barra{position:absolute;right:14px;bottom:16px;z-index:6;display:flex;gap:4px;padding:4px;border-radius:10px;background:rgba(20,24,30,.72);opacity:0;transition:opacity .25s ease}',
      '.o-apresentacao.o-mostrar .o-barra,.o-apresentacao .o-barra:focus-within{opacity:1}',
      '.o-apresentacao .o-barra button,.o-apresentacao .o-geral-fechar{font:600 13px/1 system-ui,sans-serif;color:#f1f1f1;background:transparent;border:0;border-radius:7px;padding:8px 10px;cursor:pointer}',
      '.o-apresentacao .o-barra button:hover{background:rgba(255,255,255,.14)}',
      '.o-apresentacao button:focus-visible{outline:2px solid var(--s-acento,#6a9fcc);outline-offset:2px}',
      '.o-apresentacao .o-geral{position:absolute;inset:0;z-index:7;display:none;overflow:auto;padding:28px;gap:18px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));align-content:start;background:var(--s-fundo,#111)}',
      '.o-apresentacao .o-geral.o-aberta{display:grid}',
      '.o-apresentacao .o-geral>button{position:relative;padding:0;overflow:hidden;cursor:pointer;background:var(--s-tela,#222);border:2px solid var(--s-borda,#444);border-radius:10px}',
      '.o-apresentacao .o-geral>button[aria-current="true"]{border-color:var(--s-acento,#6a9fcc);box-shadow:0 0 0 3px var(--s-acento,#6a9fcc)}',
      '.o-apresentacao .o-geral>button>.o-slide{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}',
      '.o-apresentacao .o-geral>button>span{position:absolute;left:6px;top:6px;z-index:3;font:600 12px/1 system-ui,sans-serif;padding:4px 7px;border-radius:6px;background:rgba(0,0,0,.66);color:#fff}',
      '.o-apresentacao .o-ir{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:9;display:none;padding:14px 18px;border-radius:12px;background:rgba(20,24,30,.92);color:#fff;font:600 16px system-ui,sans-serif}',
      '.o-apresentacao .o-ir.o-aberta{display:block}',
      '.o-apresentacao .o-ir input{width:6ch;margin-left:10px;font:600 22px ui-monospace,monospace;padding:4px 8px;border-radius:6px;border:0}',
      '.o-apresentacao .o-anuncio{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
      '@media (prefers-reduced-motion:reduce){.o-apresentacao *{animation:none!important;transition:none!important}}',
    ].join('\n');
    if (!doc.getElementById('o-motor-estilos')) {
      var est = doc.createElement('style');
      est.id = 'o-motor-estilos';
      est.textContent = CSS;
      doc.head.appendChild(est);
    }

    // ── Estrutura ──────────────────────────────────────────────────────────
    function el(tag, classe, texto) {
      var e = doc.createElement(tag);
      if (classe) e.className = classe;
      if (texto != null) e.textContent = texto;
      return e;
    }
    var slides = Array.prototype.slice.call(raiz.querySelectorAll('.o-slide'));
    var total = slides.length;
    raiz.classList.add('o-apresentacao');
    raiz.setAttribute('tabindex', '0');
    raiz.setAttribute('role', 'region');
    raiz.setAttribute('aria-roledescription', 'apresentação');
    raiz.setAttribute('aria-label', opcoes.titulo || 'Apresentação');
    var palco = el('div', 'o-palco');
    var trilho = el('div', 'o-trilho');
    trilho.style.width = L + 'px';
    trilho.style.height = A + 'px';
    slides.forEach(function (s) { trilho.appendChild(s); });
    palco.appendChild(trilho);
    var progresso = el('div', 'o-progresso');
    var cortina = el('div', 'o-cortina');
    var anuncio = el('div', 'o-anuncio');
    anuncio.setAttribute('aria-live', 'polite');
    anuncio.setAttribute('aria-atomic', 'true');
    var geral = el('div', 'o-geral');
    geral.setAttribute('role', 'dialog');
    geral.setAttribute('aria-label', 'Visão geral dos slides');
    var ir = el('div', 'o-ir', 'Ir para o slide');
    var campoIr = el('input');
    campoIr.setAttribute('inputmode', 'numeric');
    campoIr.setAttribute('aria-label', 'Número do slide');
    ir.appendChild(campoIr);
    var barra = el('div', 'o-barra');
    barra.setAttribute('role', 'toolbar');
    barra.setAttribute('aria-label', 'Controles da apresentação');
    raiz.replaceChildren(palco, progresso, barra, geral, ir, cortina, anuncio);

    function botao(pai, texto, rotulo, acao) {
      var b = el('button', null, texto);
      b.type = 'button';
      b.title = rotulo;
      b.setAttribute('aria-label', rotulo);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); acao(); });
      pai.appendChild(b);
      return b;
    }
    botao(barra, '‹', 'Slide anterior (←)', function () { voltar(); });
    botao(barra, '›', 'Próximo slide (→ ou espaço)', function () { avancar(); });
    botao(barra, 'Visão geral', 'Visão geral de todos os slides (O)', function () { visaoGeral(); });
    if (opcoes.apresentador) botao(barra, 'Apresentador', 'Abrir o modo apresentador em outra janela (P)', function () { abrirApresentador(); });
    botao(barra, 'Tela cheia', 'Alternar tela cheia (F)', function () { telaCheia(); });
    if (opcoes.sair) botao(barra, 'Sair', 'Encerrar a apresentação (Esc)', function () { opcoes.sair(); });

    // ── Estado ────────────────────────────────────────────────────────────
    var atual = -1;
    var passo = 0; // fragmentos visíveis no slide atual
    var ouvintes = [];
    var grafs = null;
    var apresentador = null;

    function fragmentos(i) { return slides[i] ? Array.prototype.slice.call(slides[i].querySelectorAll('.o-fragmento')) : []; }

    function aplicarFragmentos() {
      fragmentos(atual).forEach(function (f, k) { f.classList.toggle('o-visivel', k < passo); });
    }

    function tituloDe(i) {
      var t = slides[i] && slides[i].querySelector('.o-titulo, h1, h2');
      return t ? t.textContent.trim() : '';
    }

    function ir_(i, fragmento, direcao) {
      i = Math.max(0, Math.min(total - 1, i | 0));
      var mudou = i !== atual;
      if (mudou) {
        var anterior = slides[atual];
        if (anterior) { anterior.classList.remove('o-atual', 'o-anim-suave', 'o-anim-frente', 'o-anim-tras'); anterior.setAttribute('aria-hidden', 'true'); }
        var s = slides[i];
        var t = s.getAttribute('data-transicao') || opcoes.transicao || 'suave';
        s.classList.remove('o-anim-suave', 'o-anim-frente', 'o-anim-tras');
        if (!reduzir && atual >= 0 && t !== 'nenhuma') {
          void s.offsetWidth; // reinicia a animação
          s.classList.add(t === 'deslizar' ? (direcao < 0 ? 'o-anim-tras' : 'o-anim-frente') : 'o-anim-suave');
        }
        s.classList.add('o-atual');
        s.removeAttribute('aria-hidden');
        atual = i;
      }
      var n = fragmentos(i).length;
      passo = fragmento === 'todos' ? n : Math.max(0, Math.min(n, fragmento | 0));
      aplicarFragmentos();
      progresso.style.width = (total > 1 ? ((atual + 1) / total) * 100 : 100) + '%';
      if (mudou) {
        anuncio.textContent = 'Slide ' + (atual + 1) + ' de ' + total + (tituloDe(atual) ? ': ' + tituloDe(atual) : '');
        if (opcoes.hash && janela.history && janela.history.replaceState) {
          try { janela.history.replaceState(null, '', '#/' + (atual + 1)); } catch (e) { /* file:// restrito */ }
        }
        if (grafs) grafs.atualizar();
      }
      if (typeof opcoes.aoMudar === 'function') opcoes.aoMudar(atual, passo);
      if (apresentador) apresentador.atualizar(atual, passo);
    }

    function avancar() {
      if (passo < fragmentos(atual).length) { passo++; aplicarFragmentos(); if (apresentador) apresentador.atualizar(atual, passo); if (opcoes.aoMudar) opcoes.aoMudar(atual, passo); return; }
      if (atual < total - 1) ir_(atual + 1, 0, 1);
    }
    function voltar() {
      if (passo > 0) { passo--; aplicarFragmentos(); if (apresentador) apresentador.atualizar(atual, passo); if (opcoes.aoMudar) opcoes.aoMudar(atual, passo); return; }
      if (atual > 0) ir_(atual - 1, 'todos', -1);
    }

    // ── Escala e letterbox ────────────────────────────────────────────────
    function escalar() {
      var w = palco.clientWidth, h = palco.clientHeight;
      if (!w || !h) return;
      var e = Math.min(w / L, h / A);
      trilho.style.transform = 'translate(' + Math.round((w - L * e) / 2) + 'px,' + Math.round((h - A * e) / 2) + 'px) scale(' + e + ')';
      if (geral.classList.contains('o-aberta')) escalarMiniaturas();
    }
    var observador = null;
    if (typeof janela.ResizeObserver === 'function') { observador = new janela.ResizeObserver(escalar); observador.observe(palco); }
    else ouvir(janela, 'resize', escalar);

    // ── Visão geral ───────────────────────────────────────────────────────
    function clonar(i) {
      var c = slides[i].cloneNode(true);
      c.classList.remove('o-atual', 'o-anim-suave', 'o-anim-frente', 'o-anim-tras');
      c.classList.add('o-miniatura');
      c.removeAttribute('aria-hidden');
      c.setAttribute('aria-hidden', 'true');
      var origens = slides[i].querySelectorAll('canvas');
      var copias = c.querySelectorAll('canvas');
      for (var k = 0; k < copias.length; k++) {
        try {
          var img = el('img');
          img.src = origens[k].toDataURL('image/png');
          img.alt = '';
          img.style.cssText = 'width:100%;height:100%;object-fit:contain';
          copias[k].replaceWith(img);
        } catch (e) { /* canvas indisponível */ }
      }
      var t = c.querySelector('.o-grafico-tipos');
      if (t) t.remove();
      return c;
    }
    function escalarMiniaturas() {
      Array.prototype.forEach.call(geral.children, function (b) {
        var s = b.querySelector('.o-slide');
        if (s) { b.style.height = Math.round(b.clientWidth * A / L) + 'px'; s.style.transform = 'scale(' + (b.clientWidth / L) + ')'; }
      });
    }
    function visaoGeral(abrir) {
      var aberta = geral.classList.contains('o-aberta');
      if (abrir === undefined) abrir = !aberta;
      if (abrir === aberta) return;
      if (abrir) {
        geral.replaceChildren();
        for (var i = 0; i < total; i++) {
          (function (i) {
            var b = el('button');
            b.type = 'button';
            b.setAttribute('aria-label', 'Slide ' + (i + 1) + (tituloDe(i) ? ': ' + tituloDe(i) : ''));
            if (i === atual) b.setAttribute('aria-current', 'true');
            b.appendChild(el('span', null, String(i + 1)));
            b.appendChild(clonar(i));
            b.addEventListener('click', function (ev) { ev.stopPropagation(); visaoGeral(false); ir_(i, 0, i >= atual ? 1 : -1); });
            geral.appendChild(b);
          })(i);
        }
        geral.classList.add('o-aberta');
        escalarMiniaturas();
        var corrente = geral.children[atual];
        if (corrente) { corrente.focus(); corrente.scrollIntoView({ block: 'center' }); }
      } else {
        geral.classList.remove('o-aberta');
        geral.replaceChildren();
        raiz.focus();
      }
    }
    function colunasGeral() {
      var b = geral.children[0];
      return b ? Math.max(1, Math.round(geral.clientWidth / (b.offsetWidth + 18))) : 1;
    }

    // ── Cortina, tela cheia, ir para ─────────────────────────────────────
    function escurecer(ligar) {
      var ativo = raiz.classList.contains('o-escuro');
      raiz.classList.toggle('o-escuro', ligar === undefined ? !ativo : !!ligar);
    }
    function telaCheia() {
      var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (fs) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      else if (raiz.requestFullscreen) raiz.requestFullscreen().catch(function () {});
      else if (raiz.webkitRequestFullscreen) raiz.webkitRequestFullscreen();
    }
    function abrirIr() { ir.classList.add('o-aberta'); campoIr.value = ''; campoIr.focus(); }
    function fecharIr() { ir.classList.remove('o-aberta'); raiz.focus(); }
    campoIr.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { var n = parseInt(campoIr.value, 10); fecharIr(); if (n >= 1 && n <= total) ir_(n - 1, 0, n - 1 >= atual ? 1 : -1); }
      else if (ev.key === 'Escape') fecharIr();
    });
    campoIr.addEventListener('input', function () { campoIr.value = campoIr.value.replace(/\D/g, '').slice(0, 4); });

    // ── Modo apresentador ─────────────────────────────────────────────────
    function abrirApresentador() {
      if (!opcoes.apresentador) return;
      if (apresentador && !apresentador.fechado()) { apresentador.focar(); return; }
      apresentador = opcoes.apresentador({
        slides: slides, total: total, largura: L, altura: A, titulo: opcoes.titulo || 'Apresentação',
        documentoOrigem: doc, tema: raiz.getAttribute('data-tema') || (raiz.closest('[data-tema]') || raiz).getAttribute('data-tema'),
        clonar: clonar, tituloDe: tituloDe,
        comando: function (c, i) {
          if (c === 'avancar') avancar(); else if (c === 'voltar') voltar();
          else if (c === 'ir') ir_(i, 0, i >= atual ? 1 : -1);
          else if (c === 'escurecer') escurecer();
        },
      });
      if (apresentador) apresentador.atualizar(atual, passo);
      else anuncio.textContent = 'O navegador bloqueou a janela do apresentador. Permita janelas pop-up para este arquivo.';
    }

    // ── Eventos ───────────────────────────────────────────────────────────
    function ouvir(alvo, tipo, fn, op) { alvo.addEventListener(tipo, fn, op); ouvintes.push([alvo, tipo, fn, op]); }
    var INTERATIVO = 'a,button,input,select,textarea,label,summary,[contenteditable],.o-grafico canvas,.o-grafico-tipos';

    function teclado(ev) {
      if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      var alvo = ev.target;
      if (alvo && alvo.closest && alvo !== raiz && alvo.closest('input,textarea,select,[contenteditable]')) return;
      var noBotao = alvo && alvo.closest && alvo.closest('button');
      var k = ev.key;
      if (geral.classList.contains('o-aberta')) {
        var bs = Array.prototype.slice.call(geral.children);
        var f = bs.indexOf(doc.activeElement);
        var c = colunasGeral();
        var mover = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: c, ArrowUp: -c }[k];
        if (mover && f >= 0) { ev.preventDefault(); var d = bs[Math.max(0, Math.min(bs.length - 1, f + mover))]; d.focus(); return; }
        if (k === 'Escape' || k === 'o' || k === 'O') { ev.preventDefault(); visaoGeral(false); }
        return;
      }
      if (noBotao && (k === ' ' || k === 'Enter')) return;
      var tratado = true;
      switch (k) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': case 'Enter': avancar(); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': voltar(); break;
        case 'Home': ir_(0, 0, -1); break;
        case 'End': ir_(total - 1, 'todos', 1); break;
        case 'o': case 'O': visaoGeral(); break;
        case 'f': case 'F': telaCheia(); break;
        case 'p': case 'P': abrirApresentador(); break;
        case 'b': case 'B': case '.': escurecer(); break;
        case 'g': case 'G': abrirIr(); break;
        case 'Escape':
          if (raiz.classList.contains('o-escuro')) escurecer(false);
          else if (!(doc.fullscreenElement || doc.webkitFullscreenElement) && typeof opcoes.sair === 'function') opcoes.sair();
          else tratado = false;
          break;
        default: tratado = false;
      }
      if (tratado) ev.preventDefault();
    }
    ouvir(opcoes.tecladoGlobal === false ? raiz : doc, 'keydown', teclado);

    ouvir(palco, 'click', function (ev) {
      if (ev.target.closest && ev.target.closest(INTERATIVO)) return;
      var sel = janela.getSelection && janela.getSelection();
      if (sel && String(sel).length) return;
      raiz.focus();
      avancar();
    });

    var toqueX = null, toqueY = null;
    ouvir(palco, 'touchstart', function (ev) { var t = ev.changedTouches[0]; toqueX = t.clientX; toqueY = t.clientY; }, { passive: true });
    ouvir(palco, 'touchend', function (ev) {
      if (toqueX === null) return;
      var t = ev.changedTouches[0], dx = t.clientX - toqueX, dy = t.clientY - toqueY;
      toqueX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) avancar(); else voltar(); }
    }, { passive: true });

    var ocultar = null;
    ouvir(raiz, 'mousemove', function () {
      raiz.classList.add('o-mostrar');
      clearTimeout(ocultar);
      ocultar = setTimeout(function () { raiz.classList.remove('o-mostrar'); }, 2200);
    });

    if (opcoes.hash) {
      ouvir(janela, 'hashchange', function () {
        var m = /^#\/(\d+)/.exec(janela.location.hash);
        if (m) { var n = parseInt(m[1], 10) - 1; if (n !== atual) ir_(n, 0, n >= atual ? 1 : -1); }
      });
    }
    ouvir(janela, 'pagehide', function () { if (apresentador) apresentador.fechar(); });

    // ── Início ────────────────────────────────────────────────────────────
    var inicial = opcoes.indice || 0;
    if (opcoes.hash) { var mh = /^#\/(\d+)/.exec(janela.location.hash || ''); if (mh) inicial = parseInt(mh[1], 10) - 1; }
    escalar();
    if (total) ir_(inicial, 0, 1);
    if (typeof opcoes.graficos === 'function') grafs = opcoes.graficos(trilho, { animar: !reduzir });

    function destruir() {
      ouvintes.forEach(function (o) { o[0].removeEventListener(o[1], o[2], o[3]); });
      ouvintes = [];
      if (observador) observador.disconnect();
      if (grafs) grafs.destruir();
      if (apresentador) apresentador.fechar();
      clearTimeout(ocultar);
    }

    return {
      ir: function (i, f) { ir_(i, f || 0, i >= atual ? 1 : -1); },
      avancar: avancar, voltar: voltar,
      atual: function () { return atual; }, passo: function () { return passo; },
      total: total, visaoGeral: visaoGeral, escurecer: escurecer, telaCheia: telaCheia,
      abrirApresentador: abrirApresentador, escalar: escalar, destruir: destruir,
    };
  };
})(window.Oratoria);
