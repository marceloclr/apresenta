// js/slides/estilos-base.js — CSS dos slides (como string, para caber na exportação) e
// registro de layouts em O.layouts.
//
// Cada layout declara:
//   { id, css, preparar?(secao, contexto) }
// `css` usa o seletor & = .o-slide[data-layout="id"]; `preparar` reorganiza o DOM do slide
// já sanitizado (ex.: mover a imagem para a lateral). Um layout novo pode ser registrado em
// arquivo próprio: O.layouts.registrar({ id: 'meu-layout', css: '…', preparar() {…} }).
//
// Resolução de referência: 1920×1080 (16:9) ou 1440×1080 (4:3); o slide é escalado por
// transform: scale() no contêiner (pré-visualização e motor).

(function (O) {
  'use strict';

  const L = O.layouts;
  const S = O.slides;
  const C = O.config;
  const registro = new Map();

  L.registrar = function (layout) {
    if (!layout || !/^[a-z0-9-]+$/.test(layout.id || '')) { console.error(`[${C.APP_NOME}] Layout inválido`, layout); return; }
    registro.set(layout.id, Object.freeze(Object.assign({ css: '', preparar: null }, layout)));
  };
  L.obter = (id) => registro.get(id) || registro.get(C.LAYOUT_PADRAO);
  L.existe = (id) => registro.has(id);
  L.lista = () => Array.from(registro.keys());

  // ═══════════════════════════════ CSS base ═══════════════════════════════

  const LIMITE_DESTAQUE = 20; // .destacar-linha-1 … -20 e .destacar-coluna-1 … -20

  function cssDestaques() {
    const r = [];
    for (let n = 1; n <= LIMITE_DESTAQUE; n++) {
      r.push(`.o-slide table.destacar-linha-${n} tbody tr:nth-child(${n}) > * { background: var(--s-tabela-destaque); font-weight: 600; }`);
      r.push(`.o-slide table.destacar-coluna-${n} tbody tr > :nth-child(${n}) { background: var(--s-tabela-destaque); font-weight: 600; }`);
    }
    return r.join('\n');
  }

  const CSS_BASE = String.raw`
/* ═══ Oratória · slides ═══ */
.o-slide, .o-slide *, .o-slide *::before, .o-slide *::after { box-sizing: border-box; }

.o-slide {
  --o-corpo: calc(32px * var(--s-escala, 1));
  --o-titulo: calc(60px * var(--s-escala, 1) * var(--s-fator-titulo, 1));
  --o-titulo-grande: calc(72px * var(--s-escala, 1) * var(--s-fator-titulo, 1));
  --o-margem-x: ${C.MARGEM_LATERAL}px;
  --o-margem-y: ${C.MARGEM_VERTICAL}px;
  position: relative;
  width: var(--s-largura, 1920px);
  height: var(--s-altura, 1080px);
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: var(--o-margem-y) var(--o-margem-x);
  background: var(--s-fundo);
  color: var(--s-texto);
  font-family: var(--s-fonte-corpo);
  font-size: var(--o-corpo);
  font-weight: 400;
  line-height: 1.42;
  letter-spacing: var(--s-espacamento-corpo, normal);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  font-kerning: normal;
  font-variant-numeric: lining-nums;
}

/* Grade de fundo: somente gradientes; opacidade controlada por --s-grade-exibir (0/1). */
.o-slide::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  opacity: var(--s-grade-exibir, 0);
  background-color: var(--s-tela);
  background-image:
    radial-gradient(circle at 0 0, var(--s-grade-cruz) 0 3px, transparent 3.5px),
    linear-gradient(var(--s-grade-maior) 1px, transparent 1px),
    linear-gradient(90deg, var(--s-grade-maior) 1px, transparent 1px),
    linear-gradient(var(--s-grade-menor) 1px, transparent 1px),
    linear-gradient(90deg, var(--s-grade-menor) 1px, transparent 1px);
  background-size: 240px 240px, 240px 240px, 240px 240px, 48px 48px, 48px 48px;
  background-position: -1px -1px;
}
/* Textura alternativa (quando a grade está desligada) e vinheta vertical */
.o-slide::after {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: linear-gradient(180deg, transparent 0%, transparent 55%, var(--s-vinheta) 100%), var(--s-textura, none);
}
.o-slide > * { position: relative; z-index: 1; }

.o-conteudo { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 28px; }
.o-conteudo > * { margin: 0; }

/* ── Tipografia ── */
.o-slide h1, .o-slide h2, .o-slide h3, .o-slide h4 {
  font-family: var(--s-fonte-titulo);
  font-weight: var(--s-peso-titulo, 600);
  line-height: 1.12;
  letter-spacing: -0.005em;
  color: var(--s-texto);
  margin: 0;
  text-wrap: balance;
}
.o-slide .o-titulo { font-size: var(--o-titulo); margin-bottom: 8px; }
.o-slide h1:not(.o-titulo) { font-size: var(--o-titulo); }
.o-slide h2:not(.o-titulo) { font-size: calc(44px * var(--s-escala, 1)); }
.o-slide h3:not(.o-titulo) { font-size: calc(36px * var(--s-escala, 1)); }
.o-slide h4:not(.o-titulo) { font-size: var(--o-corpo); }
.o-slide p { margin: 0; text-wrap: pretty; }
.o-slide strong { font-weight: 600; }
.o-slide em { font-style: italic; }
.o-slide a { color: var(--s-acento-texto); text-decoration-thickness: 2px; text-underline-offset: 4px; }
.o-slide small { font-size: 0.8em; color: var(--s-texto-2); }
.o-slide mark { background: var(--s-tabela-destaque); color: inherit; padding: 0 .15em; border-radius: 4px; }

.o-slide ul, .o-slide ol { margin: 0; padding-left: 1.3em; display: grid; gap: 14px; }
.o-slide li > ul, .o-slide li > ol { margin-top: 12px; font-size: 0.9em; }
.o-slide ul > li::marker { color: var(--s-acento); }
.o-slide ol > li::marker { color: var(--s-acento-texto); font-family: var(--s-fonte-mono); font-weight: 600; font-size: 0.9em; }

.o-slide blockquote {
  margin: 0; padding: 8px 0 8px 36px;
  border-left: 6px solid var(--s-acento);
  color: var(--s-texto);
  font-family: var(--s-fonte-titulo);
}

.o-slide hr { border: 0; height: 2px; background: var(--s-borda); }

/* ── Código ── */
.o-slide code { font-family: var(--s-fonte-mono); font-size: 0.9em; padding: 0.08em 0.3em; border-radius: 6px; background: var(--s-superficie-2); }
.o-slide pre {
  margin: 0; padding: 28px 32px; overflow: hidden;
  background: var(--s-superficie); border: 1px solid var(--s-borda); border-radius: 14px;
  font-size: calc(28px * var(--s-escala, 1)); line-height: 1.45;
}
.o-slide pre code { padding: 0; background: none; font-size: inherit; white-space: pre-wrap; word-break: break-word; }
.o-slide .hljs-keyword, .o-slide .hljs-selector-tag, .o-slide .hljs-built_in, .o-slide .hljs-literal { color: var(--s-acento-texto); font-weight: 600; }
.o-slide .hljs-string, .o-slide .hljs-attr, .o-slide .hljs-template-variable { color: var(--s-sucesso); }
.o-slide .hljs-number, .o-slide .hljs-symbol, .o-slide .hljs-variable { color: var(--s-aviso); }
.o-slide .hljs-comment, .o-slide .hljs-quote, .o-slide .hljs-meta { color: var(--s-texto-2); font-style: italic; }
.o-slide .hljs-title, .o-slide .hljs-section, .o-slide .hljs-name, .o-slide .hljs-selector-class { color: var(--s-acento-2); font-weight: 600; }
.o-slide .hljs-type, .o-slide .hljs-params, .o-slide .hljs-property { color: var(--s-texto); }
.o-slide .hljs-deletion { color: var(--s-erro); }
.o-slide .hljs-addition { color: var(--s-sucesso); }

/* ── Imagens ── */
.o-slide img { max-width: 100%; max-height: 100%; display: block; border-radius: 12px; }
.o-slide p > img:only-child { margin: 0 auto; }
.o-slide img.contida { object-fit: contain; }
.o-slide img.sombra { box-shadow: 0 18px 48px rgba(0, 0, 0, .28), 0 2px 6px rgba(0, 0, 0, .18); }
.o-slide img.borda { border: 2px solid var(--s-borda); }
.o-slide img.redonda { border-radius: 50%; }
.o-slide figure { margin: 0; display: grid; gap: 12px; }
.o-slide figcaption, .o-slide .o-credito { font-size: 20px; color: var(--s-texto-2); }
.o-imagem-ausente {
  display: grid; place-items: center; min-height: 200px; padding: 24px;
  border: 3px dashed var(--s-aviso); border-radius: 14px; color: var(--s-aviso); font-size: 24px; text-align: center;
}

/* ── Tabelas ── */
.o-slide table {
  width: 100%; border-collapse: collapse;
  font-size: var(--o-tabela-fonte, calc(28px * var(--s-escala, 1)));
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.o-slide th, .o-slide td { padding: 0.45em 0.7em; text-align: left; vertical-align: top; border-bottom: 1px solid var(--s-borda); }
.o-slide thead th {
  background: var(--s-tabela-cabecalho-fundo); color: var(--s-tabela-cabecalho-texto);
  font-weight: 600; vertical-align: bottom;
}
.o-slide thead th:first-child { border-top-left-radius: 10px; }
.o-slide thead th:last-child { border-top-right-radius: 10px; }
.o-slide table.zebra tbody tr:nth-child(even) > * { background: var(--s-tabela-zebra); }
.o-slide table.compacta th, .o-slide table.compacta td { padding: 0.22em 0.55em; }
.o-slide td.o-num, .o-slide th.o-num { text-align: right; white-space: nowrap; }
.o-slide caption { caption-side: bottom; padding-top: 12px; font-size: 20px; color: var(--s-texto-2); text-align: left; }
${cssDestaques()}

/* ── Gráficos (desenhados por motorGraficos) ── */
.o-slide .o-grafico { flex: 1 1 auto; min-height: 360px; margin: 0; display: flex; flex-direction: column; gap: 12px; position: relative; }
.o-slide .o-grafico-titulo { font-family: var(--s-fonte-titulo); font-weight: 600; font-size: calc(30px * var(--s-escala, 1)); color: var(--s-texto); }
.o-slide .o-grafico-area { position: relative; flex: 1 1 auto; min-height: 280px; }
.o-slide .o-grafico-dados { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.o-slide .o-grafico.o-sem-grafico .o-grafico-area { display: none; }
.o-slide .o-grafico.o-sem-grafico .o-grafico-dados { position: static; width: 100%; height: auto; clip: auto; overflow: visible; white-space: normal; }
.o-slide .o-grafico-tipos { align-self: flex-end; display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--s-borda); border-radius: 12px; background: var(--s-superficie); }
.o-slide .o-grafico-tipos button {
  font: 600 20px/1 var(--s-fonte-corpo); color: var(--s-texto-2); background: transparent;
  border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer;
}
.o-slide .o-grafico-tipos button[aria-pressed="true"] { background: var(--s-acento); color: var(--s-fundo); }
.o-slide .o-grafico-tipos button:focus-visible { outline: 3px solid var(--s-acento); outline-offset: 2px; }
.o-slide .o-bloco-pendente { padding: 20px 28px; border: 2px dashed var(--s-borda); border-radius: 14px; color: var(--s-texto-2); font-size: 24px; }

/* ── Contêineres ── */
.o-slide .colunas { display: grid; grid-template-columns: var(--o-colunas, repeat(auto-fit, minmax(0, 1fr))); gap: 64px; align-items: start; min-height: 0; }
.o-slide .coluna { min-width: 0; display: flex; flex-direction: column; gap: 24px; }
.o-slide .destaque {
  padding: 28px 36px; border-radius: 16px;
  background: color-mix(in srgb, var(--s-acento) 12%, var(--s-superficie));
  border: 1px solid color-mix(in srgb, var(--s-acento) 45%, var(--s-borda));
  box-shadow: inset 8px 0 0 var(--s-acento);
  display: flex; flex-direction: column; gap: 16px;
}
.o-slide .o-notas { display: none !important; }

/* ── Fragmentos (revelação progressiva) ── */
.o-fragmento { opacity: 0; transform: translateY(14px); transition: opacity 320ms ease, transform 320ms ease; }
.o-fragmento.o-visivel, .o-expandido .o-fragmento, .o-slide.o-miniatura .o-fragmento { opacity: 1; transform: none; }

/* ── Rodapé, numeração e logotipo ── */
.o-rodape {
  position: absolute; left: var(--o-margem-x); right: var(--o-margem-x); bottom: 26px; z-index: 2;
  display: flex; align-items: center; gap: 24px;
  font-size: 20px; color: var(--s-texto-2); line-height: 1;
}
.o-rodape-texto { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.o-numero { font-family: var(--s-fonte-mono); font-variant-numeric: tabular-nums; }
.o-logotipo { height: 36px; width: auto; border-radius: 0; }

/* ── Sobreposição de legibilidade (imagem de fundo) ── */
.o-fundo {
  position: absolute !important; inset: 0; z-index: 0 !important;
  background-size: cover; background-position: center;
}
.o-fundo::after { content: ''; position: absolute; inset: 0; background: var(--s-sobreposicao); }

/* ── Movimento reduzido ── */
@media (prefers-reduced-motion: reduce) {
  .o-fragmento { transition: none; transform: none; }
}
`;

  // ═══════════════════════════ Auxiliares de preparo ═══════════════════════════

  /** Primeira imagem "de conteúdo" (fora de tabelas), removida de seu parágrafo se ficar vazio. */
  function extrairPrimeiraImagem(conteudo) {
    const img = conteudo.querySelector(':scope img:not(table img)');
    if (!img) return null;
    const pai = img.parentElement;
    img.remove();
    if (pai && pai !== conteudo && pai.tagName === 'P' && !pai.textContent.trim() && !pai.children.length) pai.remove();
    return img;
  }

  /** Divide os blocos após o título em duas colunas, se o autor não usou ::: colunas. */
  function garantirColunas(conteudo, doc) {
    if (conteudo.querySelector(':scope > .colunas')) return;
    const titulo = conteudo.querySelector(':scope > .o-titulo');
    const blocos = Array.from(conteudo.children).filter((e) => e !== titulo);
    if (blocos.length < 2) return;
    const meio = Math.ceil(blocos.length / 2);
    const grade = doc.createElement('div');
    grade.className = 'colunas o-colunas-automaticas';
    for (const grupo of [blocos.slice(0, meio), blocos.slice(meio)]) {
      const col = doc.createElement('div');
      col.className = 'coluna';
      grupo.forEach((b) => col.append(b));
      grade.append(col);
    }
    conteudo.append(grade);
  }

  // ═══════════════════════════════ Layouts ═══════════════════════════════

  L.registrar({
    id: 'titulo',
    css: `
& .o-conteudo { justify-content: center; gap: 24px; max-width: 1500px; }
& .o-conteudo::before {
  content: ''; display: block; width: 180px; height: 10px; border-radius: 5px; margin-bottom: 28px;
  background: linear-gradient(90deg, var(--s-acento) 0 60%, var(--s-acento-2) 60% 100%);
}
& .o-titulo { font-size: var(--o-titulo-grande); line-height: 1.06; }
& .o-subtitulo { font-size: calc(40px * var(--s-escala, 1)); color: var(--s-texto-2); line-height: 1.3; max-width: 1400px; }
& .o-meta { margin-top: 36px; display: flex; flex-wrap: wrap; align-items: center; font-size: var(--o-corpo); color: var(--s-texto-2); }
& .o-meta span + span::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--s-acento); margin: 0 24px; vertical-align: middle; }
`,
    preparar(secao, ctx) {
      const conteudo = secao.querySelector('.o-conteudo');
      const doc = secao.ownerDocument;
      const meta = ctx.meta || {};
      if (!conteudo.querySelector('.o-titulo') && meta.titulo) {
        const h1 = doc.createElement('h1');
        h1.className = 'o-titulo';
        h1.textContent = meta.titulo;
        conteudo.prepend(h1);
      }
      const titulo = conteudo.querySelector('.o-titulo');
      const seguinte = titulo && titulo.nextElementSibling;
      if (seguinte && seguinte.tagName === 'P') seguinte.classList.add('o-subtitulo');
      else if (titulo && meta.subtitulo) {
        const p = doc.createElement('p'); p.className = 'o-subtitulo'; p.textContent = meta.subtitulo; titulo.after(p);
      }
      const partes = [meta.autor, meta.dataFormatada].filter(Boolean);
      if (partes.length && !conteudo.querySelector('.o-meta')) {
        const m = doc.createElement('p');
        m.className = 'o-meta';
        partes.forEach((t) => { const s = doc.createElement('span'); s.textContent = t; m.append(s); });
        conteudo.append(m);
      }
    },
  });

  L.registrar({
    id: 'secao',
    css: `
& .o-conteudo { justify-content: center; align-items: center; text-align: center; gap: 28px; }
& .o-ordinal {
  font-family: var(--s-fonte-mono); font-weight: 600; font-size: 40px; letter-spacing: 0.08em;
  color: var(--s-acento-texto);
}
& .o-ordinal::after { content: ''; display: block; width: 72px; height: 4px; margin: 20px auto 0; border-radius: 2px; background: var(--s-acento); }
& .o-titulo { font-size: var(--o-titulo-grande); max-width: 1500px; }
& .o-conteudo > p { color: var(--s-texto-2); font-size: calc(36px * var(--s-escala, 1)); max-width: 1300px; }
`,
    preparar(secao, ctx) {
      const conteudo = secao.querySelector('.o-conteudo');
      const ord = secao.ownerDocument.createElement('div');
      ord.className = 'o-ordinal';
      ord.setAttribute('aria-hidden', 'true');
      ord.textContent = String(ctx.ordinalSecao || 1).padStart(2, '0');
      conteudo.prepend(ord);
    },
  });

  L.registrar({ id: 'conteudo', css: '' });

  L.registrar({
    id: 'duas-colunas',
    css: `
& .o-conteudo > .colunas { flex: 1; }
`,
    preparar(secao, ctx) {
      const conteudo = secao.querySelector('.o-conteudo');
      garantirColunas(conteudo, secao.ownerDocument);
      const prop = ctx.diretivas && ctx.diretivas.colunas;
      const m = prop && String(prop).match(/^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
      if (m) conteudo.querySelectorAll(':scope > .colunas').forEach((g) => g.style.setProperty('--o-colunas', `${m[1]}fr ${m[2]}fr`));
    },
  });

  L.registrar({
    id: 'imagem-lateral',
    css: `
& { padding: 0; grid-template-columns: 45% minmax(0, 1fr); }
&[data-lado="direita"] { grid-template-columns: minmax(0, 1fr) 45%; }
&[data-lado="direita"] .o-midia { order: 2; }
& .o-midia { position: relative; min-height: 0; overflow: hidden; background: var(--s-superficie-2); }
& .o-midia img { width: 100%; height: 100%; object-fit: cover; border-radius: 0; }
& .o-midia img.contida { object-fit: contain; padding: 48px; }
& .o-conteudo { padding: var(--o-margem-y) var(--o-margem-x) calc(var(--o-margem-y) + 24px) 80px; justify-content: center; }
&[data-lado="direita"] .o-conteudo { padding-left: var(--o-margem-x); padding-right: 80px; }
& .o-rodape { left: calc(45% + 80px); }
&[data-lado="direita"] .o-rodape { left: var(--o-margem-x); right: calc(45% + 80px); }
`,
    preparar(secao, ctx) {
      const conteudo = secao.querySelector('.o-conteudo');
      const img = extrairPrimeiraImagem(conteudo);
      const midia = secao.ownerDocument.createElement('div');
      midia.className = 'o-midia';
      if (img) midia.append(img);
      else midia.innerHTML = '<div class="o-imagem-ausente">Inclua uma imagem neste slide para ocupar a lateral.</div>';
      secao.insertBefore(midia, conteudo);
      secao.dataset.lado = (ctx.diretivas && ctx.diretivas.lado === 'direita') ? 'direita' : 'esquerda';
    },
  });

  L.registrar({
    id: 'imagem-fundo',
    css: `
& .o-conteudo { justify-content: flex-end; gap: 20px; max-width: 1400px; }
& .o-titulo { font-size: var(--o-titulo-grande); }
& .o-conteudo > p { font-size: calc(36px * var(--s-escala, 1)); }
`,
    preparar(secao) {
      const conteudo = secao.querySelector('.o-conteudo');
      if (secao.querySelector('.o-fundo')) return; // já definido pela diretiva <!-- fundo: … -->
      const img = extrairPrimeiraImagem(conteudo);
      if (!img) return;
      const fundo = secao.ownerDocument.createElement('div');
      fundo.className = 'o-fundo';
      fundo.setAttribute('role', 'img');
      fundo.setAttribute('aria-label', img.getAttribute('alt') || '');
      fundo.style.backgroundImage = `url("${img.getAttribute('src')}")`;
      secao.prepend(fundo);
    },
  });

  L.registrar({
    id: 'citacao',
    css: `
& .o-conteudo { justify-content: center; max-width: 1560px; margin: 0 auto; gap: 36px; }
& blockquote {
  position: relative; border: 0; padding: 0 0 0 120px;
  font-family: var(--s-fonte-citacao, 'IBM Plex Serif', Georgia, serif); font-style: italic; font-weight: 400;
  font-size: calc(52px * var(--s-escala, 1)); line-height: 1.32; color: var(--s-texto);
}
& blockquote::before {
  content: '\\201C'; position: absolute; left: 0; top: -36px;
  font: 600 200px/1 'IBM Plex Serif', Georgia, serif; font-style: normal; color: var(--s-acento);
}
& blockquote p + p { margin-top: 24px; }
& .o-autoria {
  padding-left: 120px; font-family: var(--s-fonte-corpo); font-style: normal;
  font-variant: small-caps; letter-spacing: 0.06em; font-size: calc(34px * var(--s-escala, 1)); color: var(--s-texto-2);
}
`,
    preparar(secao) {
      const conteudo = secao.querySelector('.o-conteudo');
      const bq = conteudo.querySelector('blockquote');
      if (!bq) return;
      // Autoria: último parágrafo da citação iniciado por travessão, ou parágrafo após a citação.
      const ultimo = bq.querySelector(':scope > p:last-of-type');
      if (ultimo && /^\s*[—–-]\s*/.test(ultimo.textContent) && bq.querySelectorAll(':scope > p').length > 1) {
        ultimo.classList.add('o-autoria');
        ultimo.innerHTML = ultimo.innerHTML.replace(/^\s*[—–-]\s*/, '');
        bq.after(ultimo);
      } else {
        const depois = bq.nextElementSibling;
        if (depois && depois.tagName === 'P') { depois.classList.add('o-autoria'); depois.innerHTML = depois.innerHTML.replace(/^\s*[—–-]\s*/, ''); }
      }
    },
  });

  L.registrar({
    id: 'tabela',
    css: `
& .o-conteudo { gap: 20px; }
& .o-titulo { font-size: calc(44px * var(--s-escala, 1) * var(--s-fator-titulo, 1)); margin: 0; }
& .o-tabela-contentor { flex: 1; min-height: 0; overflow: hidden; }
`,
    preparar(secao) {
      const conteudo = secao.querySelector('.o-conteudo');
      const tabela = conteudo.querySelector(':scope > table, :scope > .o-bloco-tabela');
      if (!tabela || tabela.parentElement.classList.contains('o-tabela-contentor')) return;
      const caixa = secao.ownerDocument.createElement('div');
      caixa.className = 'o-tabela-contentor';
      tabela.replaceWith(caixa);
      caixa.append(tabela);
    },
  });

  L.registrar({
    id: 'encerramento',
    css: `
& .o-conteudo { justify-content: center; align-items: center; text-align: center; gap: 28px; }
& .o-conteudo::before {
  content: ''; width: 120px; height: 8px; border-radius: 4px;
  background: linear-gradient(90deg, var(--s-acento) 0 60%, var(--s-acento-2) 60% 100%);
}
& .o-titulo { font-size: var(--o-titulo-grande); }
& .o-conteudo > p { color: var(--s-texto-2); }
& .o-qr { width: 240px; height: 240px; padding: 16px; background: #fff; border-radius: 16px; }
& .o-qr svg { width: 100%; height: 100%; display: block; }
`,
  });

  // ═══════════════════════════════ API ═══════════════════════════════

  /** CSS base + CSS de todos os layouts registrados (seletor & substituído). */
  S.cssSlides = function () {
    const partes = [CSS_BASE];
    for (const layout of registro.values()) {
      if (!layout.css) continue;
      partes.push(`/* layout: ${layout.id} */\n` + layout.css.replace(/&/g, `.o-slide[data-layout="${layout.id}"]`));
    }
    return partes.join('\n');
  };

  /** Dimensões da resolução de referência para a proporção. */
  S.dimensoes = (proporcao) => C.PROPORCOES[proporcao] || C.PROPORCOES[C.PROPORCAO_PADRAO];
})(window.Oratoria);
