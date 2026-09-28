// tools/lib/markdown-html.mjs — converte um manual em Markdown num HTML autocontido
// (fontes IBM Plex em data URL, estilo claro/escuro, títulos com âncoras e sumário com links).
// Usa o markdown-it das devDependencies. Não é distribuído com a aplicação.
//
//   import { manualHtml } from './lib/markdown-html.mjs';
//   manualHtml(textoMd, { titulo: 'Apresenta — Manual operacional', versao: '0.1.0' }) → string

import { readFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { caminho } from './comum.mjs';

const FONTES = [
  ['IBM Plex Sans', 400, 'normal', 'ibm-plex-sans-latin-400-normal.woff2'],
  ['IBM Plex Sans', 400, 'italic', 'ibm-plex-sans-latin-400-italic.woff2'],
  ['IBM Plex Sans', 600, 'normal', 'ibm-plex-sans-latin-600-normal.woff2'],
  ['IBM Plex Mono', 400, 'normal', 'ibm-plex-mono-latin-400-normal.woff2'],
];

const escaparHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Âncora estável a partir do texto do título: "5.3 Instruções por slide" → "5-3-instrucoes-por-slide". */
export function ancora(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'secao';
}

function faces() {
  return FONTES.map(([familia, peso, estilo, arquivo]) => {
    const b64 = readFileSync(caminho('assets/fontes', arquivo)).toString('base64');
    return `@font-face{font-family:'${familia}';font-style:${estilo};font-weight:${peso};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
}

const ESTILO = `
:root{color-scheme:light dark;--fundo:#f6f7f9;--papel:#ffffff;--texto:#1d232b;--suave:#55606e;--linha:#d5dae2;--acento:#2f5f8f;--codigo:#eef1f6}
@media (prefers-color-scheme:dark){:root{--fundo:#0f1318;--papel:#151b22;--texto:#e3e8ee;--suave:#a4afbd;--linha:#2a333e;--acento:#8fb9df;--codigo:#1c232c}}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--texto);font:17px/1.6 'IBM Plex Sans',system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:40px 28px 80px;background:var(--papel);min-height:100vh}
h1{font-size:2rem;line-height:1.2;margin:0 0 .6em}
h2{font-size:1.45rem;margin:2.2em 0 .6em;padding-top:.6em;border-top:1px solid var(--linha)}
h3{font-size:1.15rem;margin:1.8em 0 .5em}
h2,h3{scroll-margin-top:16px}
a{color:var(--acento)}
code,kbd,pre{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.88em}
code{background:var(--codigo);padding:.1em .35em;border-radius:5px}
pre{background:var(--codigo);padding:14px 16px;border-radius:8px;overflow:auto;line-height:1.45}
pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:.4em 1em;border-left:3px solid var(--acento);color:var(--suave)}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.94em;display:block;overflow-x:auto}
th,td{border:1px solid var(--linha);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--codigo)}
hr{border:0;border-top:1px solid var(--linha);margin:2em 0}
img{max-width:100%}
.rodape{margin-top:3em;color:var(--suave);font-size:.85em}
@media print{body{background:#fff;color:#000}main{padding:0;max-width:none}a{color:inherit}h2{break-before:auto}}
`;

export function manualHtml(markdown, { titulo, versao }) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  const usadas = new Map();
  md.core.ruler.push('ancoras', (estado) => {
    const tokens = estado.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'heading_open' || !['h2', 'h3'].includes(t.tag)) continue;
      let id = ancora(tokens[i + 1].content);
      const n = usadas.get(id) || 0;
      usadas.set(id, n + 1);
      if (n) id = `${id}-${n + 1}`;
      t.attrSet('id', id);
    }
  });
  // Links externos abrem em outra janela
  const padraoLink = md.renderer.rules.link_open || ((tk, i, op, env, self) => self.renderToken(tk, i, op));
  md.renderer.rules.link_open = (tk, i, op, env, self) => {
    if (/^https?:/i.test(tk[i].attrGet('href') || '')) { tk[i].attrSet('target', '_blank'); tk[i].attrSet('rel', 'noopener'); }
    return padraoLink(tk, i, op, env, self);
  };
  let corpo = md.render(markdown);
  // Sumário: itens cujo texto coincide com um título de seção viram links
  const secoes = new Map([...corpo.matchAll(/<h2 id="([^"]+)">(\d+)\. /g)].map((m) => [m[2], m[1]]));
  corpo = corpo.replace(/(<h2 id="sumario">Sumário<\/h2>\s*<ol>)([\s\S]*?)(<\/ol>)/, (_, a, itens, c) => {
    let n = 0;
    return a + itens.replace(/<li>([^<]+)<\/li>/g, (m, texto) => { n++; const id = secoes.get(String(n)); return id ? `<li><a href="#${id}">${texto}</a></li>` : m; }) + c;
  });
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>${escaparHtml(titulo)}</title>
<style>
${faces()}
${ESTILO}</style>
</head>
<body>
<main>
${corpo}
<p class="rodape">${escaparHtml(titulo)} · versão ${escaparHtml(versao)} · documento gerado a partir de docs/manual-operacional.md.</p>
</main>
</body>
</html>
`;
}
