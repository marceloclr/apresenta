// js/exportacao/impressao.js — PDF pela impressão do navegador (§9.3).
//
//   O.exportacao.impressao.css(largura, altura)   → folha @media print (também embutida no .html)
//   await O.exportacao.impressao.imprimir(projeto) → monta os slides e abre window.print()
//
// Um slide por página (@page do tamanho da resolução de referência, sem margens), fragmentos
// revelados, sem controles. A mesma folha desfaz o palco do motor (posição, escala, visibilidade),
// de modo que Ctrl+P funciona também dentro da apresentação exportada. Gráficos saem como
// estão desenhados no canvas.
//
// No editor, os slides são montados num contêiner próprio (#o-impressao), fora da tela durante
// a preparação (para que os gráficos tenham tamanho e sejam desenhados) e o único visível na
// impressão; o contêiner e a folha são removidos em 'afterprint'.

(function (O) {
  'use strict';

  const IP = (O.exportacao.impressao = {});
  const S = O.slides;

  IP.css = function (largura, altura) {
    return `@media print {
  @page { size: ${largura}px ${altura}px; margin: 0; }
  html, body { height: auto !important; overflow: visible !important; background: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  #deck, .o-apresentacao, .o-apresentacao .o-palco { position: static !important; inset: auto !important; width: auto !important; height: auto !important; overflow: visible !important; background: none !important; }
  .o-apresentacao .o-trilho { position: static !important; transform: none !important; width: auto !important; height: auto !important; }
  .o-apresentacao .o-trilho > .o-slide, #o-impressao > .o-slide { position: relative !important; left: auto !important; top: auto !important; visibility: visible !important; animation: none !important; transform: none !important; break-after: page; page-break-after: always; break-inside: avoid; }
  .o-slide .o-fragmento { opacity: 1 !important; transform: none !important; transition: none !important; }
  .o-apresentacao .o-barra, .o-apresentacao .o-progresso, .o-apresentacao .o-cortina, .o-apresentacao .o-geral,
  .o-apresentacao .o-ir, .o-apresentacao .o-anuncio, .o-grafico-tipos { display: none !important; }
}`;
  };

  IP.imprimir = async function (projeto) {
    const r = await S.renderizar(projeto);
    if (!r.secoes.length) throw new Error('não há slides para imprimir');
    const { largura, altura } = S.dimensoes(r.meta.proporcao);

    const estilo = document.createElement('style');
    estilo.id = 'estilos-impressao';
    estilo.textContent = `${r.css}
${IP.css(largura, altura)}
#o-impressao { position: fixed; left: -100000px; top: 0; width: ${largura}px; }
@media print {
  body > :not(#o-impressao) { display: none !important; }
  #o-impressao { position: static !important; left: auto !important; }
}`;
    const contentor = document.createElement('div');
    contentor.id = 'o-impressao';
    contentor.dataset.tema = r.meta.tema;
    contentor.className = 'o-expandido';
    contentor.setAttribute('aria-hidden', 'true');
    contentor.style.setProperty('--s-largura', `${largura}px`);
    contentor.style.setProperty('--s-altura', `${altura}px`);
    r.secoes.forEach((s) => contentor.append(s));
    document.head.append(estilo);
    document.body.append(contentor);
    const graficos = S.motorGraficos(contentor, { animar: false });
    await new Promise((ok) => setTimeout(ok, 50));
    graficos.atualizar();

    const limpar = () => {
      graficos.destruir();
      contentor.remove();
      estilo.remove();
      window.removeEventListener('afterprint', limpar);
    };
    window.addEventListener('afterprint', limpar);
    window.print();
    // Navegadores em que print() não bloqueia: 'afterprint' ainda assim limpa; garantia extra
    setTimeout(() => { if (contentor.isConnected && !window.matchMedia('print').matches) limpar(); }, 60000);
    return { slides: r.secoes.length };
  };
})(window.Oratoria);
