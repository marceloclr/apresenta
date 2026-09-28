// js/interface/abas.js — abas de trabalho (padrão WAI-ARIA "tabs", ativação automática).
//
// Marcação esperada:
//   <div role="tablist" aria-orientation="vertical">
//     <button role="tab" data-aba="composicao" aria-controls="painel-composicao">
//       <span class="aba-rotulo"></span></button> …
//   </div>
//   <section role="tabpanel" id="painel-composicao" data-aba="composicao"> … </section>
//
// Os rótulos vêm de O.rotulos.ROTULO_ABA (identificador estável = data-aba).
// Teclado: ↑/↓ (ou ←/→) percorrem, Home/End vão aos extremos; Enter/Espaço ou clique ativam
// e levam o foco ao primeiro campo do painel.

(function (O) {
  'use strict';

  const A = (O.ui.abas = {});
  const U = O.util;
  let lista = null;

  const abas = () => U.$$('[role="tab"]', lista);
  const painelDe = (aba) => document.getElementById(aba.getAttribute('aria-controls'));

  /** Ativa a aba pelo identificador; `focarCampo` leva o foco ao primeiro campo do painel. */
  A.ativar = function (id, { focarCampo = false, focarAba = false } = {}) {
    const alvo = abas().find((a) => a.dataset.aba === id) || abas()[0];
    if (!alvo) return;
    for (const a of abas()) {
      const ativa = a === alvo;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      const painel = painelDe(a);
      if (painel) painel.hidden = !ativa;
    }
    document.documentElement.dataset.abaAtiva = alvo.dataset.aba;
    if (focarAba) alvo.focus();
    if (focarCampo) { const p = painelDe(alvo); if (p) U.focarPrimeiroCampo(p); }
    if (O.estado.obter('interface.abaAtiva') !== alvo.dataset.aba) {
      O.estado.definir('interface.abaAtiva', alvo.dataset.aba);
      O.persistencia.definirPreferencia('abaAtiva', alvo.dataset.aba);
    }
    O.estado.emitir('aba:ativada', { aba: alvo.dataset.aba });
  };

  A.atual = () => lista && abas().find((a) => a.getAttribute('aria-selected') === 'true')?.dataset.aba;

  function aoTeclar(ev) {
    const todas = abas();
    const i = todas.indexOf(document.activeElement);
    if (i < 0) return;
    let destino = null;
    switch (ev.key) {
      case 'ArrowDown': case 'ArrowRight': destino = todas[(i + 1) % todas.length]; break;
      case 'ArrowUp': case 'ArrowLeft': destino = todas[(i - 1 + todas.length) % todas.length]; break;
      case 'Home': destino = todas[0]; break;
      case 'End': destino = todas[todas.length - 1]; break;
      case 'Enter': case ' ': ev.preventDefault(); A.ativar(todas[i].dataset.aba, { focarCampo: true }); return;
      default: return;
    }
    ev.preventDefault();
    A.ativar(destino.dataset.aba, { focarAba: true });
  }

  A.iniciar = function (elementoLista, abaInicial) {
    lista = elementoLista;
    for (const a of abas()) {
      const rotulo = O.rotulos.rotuloAba(a.dataset.aba);
      const alvoTexto = U.$('.aba-rotulo', a) || a;
      alvoTexto.textContent = rotulo;
      const painel = painelDe(a);
      if (painel) { painel.setAttribute('aria-labelledby', a.id); painel.setAttribute('tabindex', '-1'); }
    }
    lista.addEventListener('click', (ev) => {
      const aba = ev.target.closest('[role="tab"]');
      if (aba && lista.contains(aba)) A.ativar(aba.dataset.aba, { focarCampo: true });
    });
    lista.addEventListener('keydown', aoTeclar);
    A.ativar(abaInicial || abas()[0].dataset.aba);
  };
})(window.Oratoria);
