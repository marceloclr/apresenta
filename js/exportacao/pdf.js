// js/exportacao/pdf.js — PDF direto a partir do editor: monta os slides num contêiner fora da
// tela (medidas reais, gráficos desenhados sem animação), reúne o CSS com as fontes embutidas
// e entrega tudo ao motorPdf (pdf-runtime.js), o mesmo usado nas apresentações exportadas.
//
//   const r = await O.exportacao.pdf.gerar(projeto, { escala, aoProgredir })  → { blob, nome, paginas }
//   await O.exportacao.pdf.baixar(projeto, opcoes)

(function (O) {
  'use strict';

  const PD = (O.exportacao.pdf = {});
  const S = O.slides;
  const C = O.config;

  PD.gerar = async function (projeto, { escala = 1, aoProgredir = () => {} } = {}) {
    aoProgredir('Montando os slides', 0);
    const r = await S.renderizar(projeto);
    if (!r.secoes.length) throw new Error('não há slides para exportar');
    const { largura, altura } = S.dimensoes(r.meta.proporcao);
    const faces = await O.carregador.embutivel('fontes');
    const css = `${O.exportacao.html.cssFontes(faces, O.temas.familiasUsadas(r.meta.tema))}\n${r.css}`;

    const estilo = document.createElement('style');
    estilo.textContent = r.css;
    const contentor = document.createElement('div');
    contentor.setAttribute('aria-hidden', 'true');
    contentor.dataset.tema = r.meta.tema;
    contentor.className = 'o-expandido';
    contentor.style.cssText = `position:fixed;left:-100000px;top:0;width:${largura}px;pointer-events:none;--s-largura:${largura}px;--s-altura:${altura}px`;
    contentor.append(estilo, ...r.secoes);
    document.body.append(contentor);
    const graficos = S.motorGraficos(contentor, { animar: false });
    try {
      // Temporizador, não requestAnimationFrame: este não dispara com a aba em segundo plano
      await new Promise((ok) => setTimeout(ok, 50));
      graficos.atualizar();
      const blob = await O.exportacao.motorPdf({
        slides: r.secoes, largura, altura, css, tema: r.meta.tema, escala, qualidade: C.PDF_QUALIDADE,
        titulo: r.meta.titulo || projeto.titulo || 'Apresentação', autor: r.meta.autor || '',
        produtor: `${C.APP_NOME} ${C.VERSAO}`,
        aoProgredir: (i, n) => aoProgredir(`Slide ${Math.min(i + 1, n)} de ${n}`, n ? i / n : 1),
      });
      return { blob, nome: O.exportacao.html.nomeArquivo(projeto, r.meta, '.pdf'), paginas: r.secoes.length };
    } finally {
      graficos.destruir();
      contentor.remove();
    }
  };

  PD.baixar = async function (projeto, opcoes) {
    const r = await PD.gerar(projeto, opcoes);
    O.util.baixar(r.blob, r.nome);
    return r;
  };
})(window.Oratoria);
