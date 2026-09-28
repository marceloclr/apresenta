// js/slides/graficos-runtime.js — motorGraficos: desenha as figuras .o-grafico com Chart.js.
//
// FUNÇÃO AUTOSSUFICIENTE: reinjetada via toString() nas apresentações exportadas.
// Não pode referenciar nada fora de si além dos globais permitidos em tools/verificar.mjs.
//
//   const g = O.slides.motorGraficos(raiz, { animar: true });
//   g.atualizar();  // hidrata figuras novas
//   g.destruir();   // libera os gráficos (antes de refazer a pré-visualização)
//
// Cores, fontes e grade vêm das variáveis --s-* do tema, lidas no próprio elemento.
// Sem Chart.js, a figura mostra a tabela de dados (classe o-sem-grafico).
//
// Dimensionamento: os slides são escalados por transform: scale(), e o modo responsivo do
// Chart.js mede o contêiner com getBoundingClientRect (já escalado), o que encolheria o
// gráfico duas vezes. Por isso o gráfico é desenhado com responsive: false, no tamanho de
// layout do contêiner (offsetWidth/offsetHeight, na resolução de referência). Figuras ainda
// invisíveis (tamanho zero) ficam pendentes e são desenhadas no próximo atualizar().

(function (O) {
  'use strict';

  O.slides.motorGraficos = function motorGraficos(raiz, opcoes) {
    opcoes = opcoes || {};
    var TIPOS = { barras: 'bar', linhas: 'line', pizza: 'pie', rosca: 'doughnut' };
    var ROTULOS = { barras: 'Barras', linhas: 'Linhas', pizza: 'Pizza', rosca: 'Rosca' };
    var ORDEM = ['barras', 'linhas', 'pizza', 'rosca'];
    var instancias = [];
    var numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
    var compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
    var reduzir = false;
    try { reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduzir = false; }

    function variavel(estilo, nome, padrao) {
      var v = estilo.getPropertyValue(nome);
      return v && v.trim() ? v.trim() : padrao;
    }

    function paleta(estilo) {
      var cores = [];
      for (var i = 1; i <= 6; i++) cores.push(variavel(estilo, '--s-grafico-' + i, '#888888'));
      return cores;
    }

    function configuracao(g, tipo, estilo) {
      var cores = paleta(estilo);
      var eixo = variavel(estilo, '--s-grafico-eixo', '#666666');
      var grade = variavel(estilo, '--s-grafico-grade', 'rgba(0,0,0,.1)');
      var fundo = variavel(estilo, '--s-fundo', '#ffffff');
      var familia = variavel(estilo, '--s-fonte-corpo', 'sans-serif');
      var circular = tipo === 'pizza' || tipo === 'rosca';
      var series = circular ? g.series.slice(0, 1) : g.series;
      var conjuntos = series.map(function (s, i) {
        var cor = cores[i % cores.length];
        return {
          label: s.nome,
          data: s.valores,
          backgroundColor: circular ? g.rotulos.map(function (_, j) { return cores[j % cores.length]; }) : cor,
          borderColor: circular ? fundo : cor,
          borderWidth: circular ? 3 : (tipo === 'linhas' ? 5 : 0),
          borderRadius: tipo === 'barras' ? 6 : 0,
          pointRadius: tipo === 'linhas' ? 6 : 0,
          pointHoverRadius: 9,
          tension: 0.25,
          fill: false,
        };
      });
      var escalas = circular ? {} : {
        x: { stacked: !!g.empilhado, ticks: { color: eixo, font: { size: 22, family: familia } }, grid: { color: grade, drawBorder: false }, border: { color: grade } },
        y: {
          // Linhas mostram variação: eixo ajustado aos dados; barras partem do zero.
          stacked: !!g.empilhado, beginAtZero: tipo !== 'linhas',
          ticks: { color: eixo, font: { size: 22, family: familia }, callback: function (v) { return compacto.format(v); } },
          grid: { color: grade }, border: { display: false },
        },
      };
      return {
        type: TIPOS[tipo] || 'bar',
        data: { labels: g.rotulos, datasets: conjuntos },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
          animation: (reduzir || opcoes.animar === false) ? false : { duration: 500 },
          layout: { padding: 8 },
          cutout: tipo === 'rosca' ? '58%' : undefined,
          scales: escalas,
          plugins: {
            legend: {
              display: circular || series.length > 1,
              position: 'bottom',
              labels: { color: eixo, font: { size: 22, family: familia }, boxWidth: 22, boxHeight: 22, padding: 20 },
            },
            tooltip: {
              titleFont: { size: 20, family: familia }, bodyFont: { size: 20, family: familia }, padding: 12,
              callbacks: { label: function (c) { return ' ' + (c.dataset.label || '') + ': ' + numero.format(c.parsed && typeof c.parsed === 'object' ? c.parsed.y : c.parsed); } },
            },
          },
        },
      };
    }

    function desenhar(figura, tipo) {
      var reg = figura.__oGrafico;
      var area = figura.querySelector('.o-grafico-area');
      var largura = area.offsetWidth;
      var altura = area.offsetHeight;
      if (!largura || !altura) return false;
      if (reg.grafico) reg.grafico.destroy();
      var estilo = window.getComputedStyle(figura);
      var canvas = figura.querySelector('canvas');
      canvas.width = largura;
      canvas.height = altura;
      reg.tipo = tipo;
      reg.grafico = new window.Chart(canvas, configuracao(reg.dados, tipo, estilo));
      canvas.setAttribute('aria-label', canvas.getAttribute('aria-label').replace(/^Gráfico de [^:]+/, 'Gráfico de ' + ROTULOS[tipo].toLowerCase()));
      var botoes = figura.querySelectorAll('.o-grafico-tipos button');
      for (var i = 0; i < botoes.length; i++) botoes[i].setAttribute('aria-pressed', String(botoes[i].getAttribute('data-tipo') === tipo));
      return true;
    }

    function seletor(figura) {
      var grupo = document.createElement('div');
      grupo.className = 'o-grafico-tipos';
      grupo.setAttribute('role', 'group');
      grupo.setAttribute('aria-label', 'Tipo de gráfico');
      ORDEM.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = ROTULOS[t];
        b.setAttribute('data-tipo', t);
        b.setAttribute('data-dica', 'Exibe estes dados como gráfico de ' + ROTULOS[t].toLowerCase() + '.');
        b.setAttribute('title', 'Exibir como ' + ROTULOS[t].toLowerCase());
        b.addEventListener('click', function (ev) { ev.stopPropagation(); desenhar(figura, t); });
        grupo.appendChild(b);
      });
      figura.insertBefore(grupo, figura.querySelector('.o-grafico-area'));
    }

    function hidratar(figura) {
      if (figura.__oGrafico && figura.__oGrafico.grafico) return;
      if (!figura.__oGrafico) {
        var dados;
        try { dados = JSON.parse(figura.getAttribute('data-grafico')); } catch (e) { return; }
        figura.__oGrafico = { dados: dados, grafico: null, tipo: dados.tipo };
        if (typeof window.Chart === 'undefined') { figura.classList.add('o-sem-grafico'); return; }
        if (dados.alternavel) seletor(figura);
        instancias.push(figura);
      }
      if (typeof window.Chart !== 'undefined') desenhar(figura, figura.__oGrafico.tipo);
    }

    function atualizar() {
      var figuras = (raiz || document).querySelectorAll('figure.o-grafico');
      for (var i = 0; i < figuras.length; i++) hidratar(figuras[i]);
    }

    function destruir() {
      instancias.forEach(function (f) {
        if (f.__oGrafico && f.__oGrafico.grafico) f.__oGrafico.grafico.destroy();
        delete f.__oGrafico;
        var g = f.querySelector('.o-grafico-tipos');
        if (g) g.remove();
      });
      instancias = [];
    }

    atualizar();
    return { atualizar: atualizar, destruir: destruir };
  };
})(window.Oratoria);
