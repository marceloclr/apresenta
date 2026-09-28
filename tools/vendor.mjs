// tools/vendor.mjs — copia os builds de navegador de node_modules/ para vendor/,
// copia as fontes IBM Plex para assets/fontes/ e registra origem, versão, licença
// e hash de cada arquivo em vendor/VERSOES.md.
//
// Uso: npm ci && node tools/vendor.mjs
//
// Quando uma biblioteca não publica build clássico (UMD/IIFE), este script compõe
// um IIFE a partir dos fontes publicados, sem minificar e sem ferramentas externas.
// O resultado é versionado; a aplicação continua sem etapa de build.

import { readFileSync, copyFileSync } from 'node:fs';
import { caminho, gravar, sha256, existe, log, formatarBytes } from './lib/comum.mjs';

const NM = (...p) => caminho('node_modules', ...p);

const pacote = (nome) => JSON.parse(readFileSync(NM(nome, 'package.json'), 'utf8'));

// ───────────────────────────────── Bibliotecas ─────────────────────────────────
// ordem = ordem de carregamento no index.html (dependências antes dos dependentes)
const BIBLIOTECAS = [
  { pacote: 'markdown-it', origem: 'dist/browser/markdown-it.umd.min.js', destino: 'markdown-it.min.js', global: 'markdownit', finalidade: 'Interpretação de Markdown' },
  { pacote: 'markdown-it-attrs', compor: comporAttrs, destino: 'markdown-it-attrs.iife.js', global: 'markdownItAttrs', finalidade: 'Atributos {.classe} em blocos e imagens' },
  { pacote: 'markdown-it-container', origem: 'dist/markdown-it-container.min.js', destino: 'markdown-it-container.min.js', global: 'markdownitContainer', finalidade: 'Contêineres ::: colunas, notas, fragmento' },
  { pacote: 'dompurify', origem: 'dist/purify.min.js', destino: 'purify.min.js', global: 'DOMPurify', finalidade: 'Sanitização de HTML e SVG' },
  { pacote: 'js-yaml', origem: 'dist/browser/js-yaml.umd.min.js', destino: 'js-yaml.min.js', global: 'jsyaml', finalidade: 'Front-matter YAML' },
  { pacote: 'papaparse', origem: 'papaparse.min.js', destino: 'papaparse.min.js', global: 'Papa', finalidade: 'Leitura de CSV' },
  { pacote: 'chart.js', origem: 'dist/chart.umd.min.js', destino: 'chart.umd.min.js', global: 'Chart', finalidade: 'Gráficos dinâmicos' },
  { pacote: '@highlightjs/cdn-assets', compor: comporHighlight, destino: 'highlight.min.js', global: 'hljs', finalidade: 'Realce de código (js, python, sql, bash, json, html, css)' },
  { pacote: 'qrcode-generator', origem: 'dist/qrcode.js', destino: 'qrcode.js', global: 'qrcode', finalidade: 'QR code local do layout de encerramento' },
];

// ─────────────────────────────────── Fontes ────────────────────────────────────
// Latin cobre integralmente o português. Itálicos 400: ênfase (*texto*) e citações.
const FONTES = [
  ['ibm-plex-sans', 'IBM Plex Sans', 400, 'normal'],
  ['ibm-plex-sans', 'IBM Plex Sans', 400, 'italic'],
  ['ibm-plex-sans', 'IBM Plex Sans', 600, 'normal'],
  ['ibm-plex-serif', 'IBM Plex Serif', 400, 'normal'],
  ['ibm-plex-serif', 'IBM Plex Serif', 400, 'italic'],
  ['ibm-plex-serif', 'IBM Plex Serif', 600, 'normal'],
  ['ibm-plex-mono', 'IBM Plex Mono', 400, 'normal'],
  ['ibm-plex-mono', 'IBM Plex Mono', 600, 'normal'],
];

// ─────────────────────────────── Composições IIFE ──────────────────────────────

/**
 * markdown-it-attrs 5.x publica apenas CommonJS (o "browser.js" embute uma cópia
 * inteira do markdown-it, ~370 KB). Compomos um IIFE com os três módulos próprios,
 * resolvendo require('markdown-it') para o global window.markdownit.
 */
function comporAttrs() {
  const base = NM('markdown-it-attrs');
  const modulos = { './utils.js': 'utils.js', './patterns.js': 'patterns.js', './index.js': 'index.js' };
  const corpos = Object.entries(modulos).map(([id, arq]) => {
    const fonte = readFileSync(`${base}/${arq}`, 'utf8');
    return `  ${JSON.stringify(id)}: function (module, exports, require) {\n${fonte}\n  }`;
  });
  const versao = pacote('markdown-it-attrs').version;
  return `/*! markdown-it-attrs ${versao} — IIFE composto por tools/vendor.mjs (Oratória) — MIT */
(function (global) {
  'use strict';
  var fabricas = {
${corpos.join(',\n')}
  };
  var cache = {};
  function exigir(id) {
    if (id === 'markdown-it') return global.markdownit;
    if (cache[id]) return cache[id].exports;
    var modulo = { exports: {} };
    cache[id] = modulo;
    fabricas[id](modulo, modulo.exports, exigir);
    return modulo.exports;
  }
  global.markdownItAttrs = exigir('./index.js');
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

/**
 * highlight.js: núcleo (ES module, 1 export) convertido em IIFE + 7 linguagens
 * (os arquivos de linguagem do cdn-assets já são IIFE que chamam hljs.registerLanguage).
 */
function comporHighlight() {
  const base = NM('@highlightjs/cdn-assets');
  let nucleo = readFileSync(`${base}/es/core.min.js`, 'utf8');
  const padrao = /export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/;
  if (!padrao.test(nucleo)) throw new Error('highlight.js: formato de exportação do núcleo mudou; revisar comporHighlight().');
  nucleo = nucleo.replace(padrao, 'window.hljs=$1;');
  const linguagens = ['javascript', 'python', 'sql', 'bash', 'json', 'xml', 'css'];
  const versao = pacote('@highlightjs/cdn-assets').version;
  const partes = [
    `/*! highlight.js ${versao} — subconjunto (${linguagens.join(', ')}) composto por tools/vendor.mjs (Oratória) — BSD-3-Clause */`,
    `(function(){${nucleo}})();`,
    ...linguagens.map((l) => readFileSync(`${base}/languages/${l}.min.js`, 'utf8')),
  ];
  return partes.join('\n') + '\n';
}

// ─────────────────────────────────── Execução ──────────────────────────────────

function licencaDe(nomePacote) {
  for (const n of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENCE']) {
    const p = NM(nomePacote, n);
    if (existe(p)) return readFileSync(p, 'utf8');
  }
  return null;
}

function executar() {
  if (!existe(NM())) {
    log.erro('node_modules/ ausente. Execute "npm ci" antes.');
    process.exit(1);
  }
  const linhas = [];
  log.titulo('Bibliotecas → vendor/');
  for (const b of BIBLIOTECAS) {
    const p = pacote(b.pacote);
    const conteudo = b.compor ? b.compor() : readFileSync(NM(b.pacote, b.origem), 'utf8');
    gravar(caminho('vendor', b.destino), conteudo);
    const lic = licencaDe(b.pacote);
    const arqLic = `licencas/${b.pacote.replace(/[@/]/g, (c) => (c === '/' ? '__' : ''))}.txt`;
    const repo = typeof p.repository === 'string' ? p.repository : p.repository?.url || p.homepage || '';
    gravar(caminho('vendor', arqLic), lic || `${b.pacote} ${p.version}\nLicença declarada no package.json: ${p.license}\nO pacote não inclui arquivo de licença; texto integral em ${repo}\n`);
    const bytes = Buffer.byteLength(conteudo);
    linhas.push(`| ${b.pacote} | ${p.version} | ${p.license} | \`${b.destino}\` | \`${b.global}\` | ${formatarBytes(bytes)} | ${b.compor ? 'composto (IIFE)' : '`' + b.origem + '`'} | ${b.finalidade} | \`${sha256(conteudo).slice(0, 16)}…\` |`);
    log.ok(`${b.destino.padEnd(30)} ${p.version.padEnd(9)} ${formatarBytes(bytes)}`);
  }

  log.titulo('Fontes → assets/fontes/');
  const linhasFontes = [];
  for (const [pac, familia, peso, estilo] of FONTES) {
    const arq = `${pac}-latin-${peso}-${estilo}.woff2`;
    copyFileSync(NM('@fontsource', pac, 'files', arq), caminho('assets', 'fontes', arq));
    const dados = readFileSync(caminho('assets', 'fontes', arq));
    linhasFontes.push(`| ${familia} | ${peso} | ${estilo} | \`${arq}\` | ${formatarBytes(dados.length)} | \`${sha256(dados).slice(0, 16)}…\` |`);
    log.ok(`${arq.padEnd(40)} ${formatarBytes(dados.length)}`);
  }
  const verFonte = pacote('@fontsource/ibm-plex-sans').version;
  const ofl = licencaDe('@fontsource/ibm-plex-sans');
  if (ofl) gravar(caminho('assets', 'fontes', 'OFL.txt'), ofl);

  const md = `# Bibliotecas e fontes de terceiros

> Arquivo **gerado** por \`tools/vendor.mjs\`. Não editar à mão.
> Todas as bibliotecas são gratuitas e de código aberto; o texto integral de cada
> licença está em \`vendor/licencas/\` e, para as fontes, em \`assets/fontes/OFL.txt\`.

## Núcleo (carregado na abertura, funciona sem rede)

| Pacote npm | Versão | Licença | Arquivo | Global | Tamanho | Origem no pacote | Finalidade | SHA-256 |
|---|---|---|---|---|---|---|---|---|
${linhas.join('\n')}

## Fontes (IBM Plex, via @fontsource ${verFonte}, licença OFL-1.1, subconjunto latin)

| Família | Peso | Estilo | Arquivo | Tamanho | SHA-256 |
|---|---|---|---|---|---|
${linhasFontes.join('\n')}

## Módulos sob demanda (somente com rede; nunca exigidos pela apresentação exportada)

| Biblioteca | Licença | Origem prevista | Uso |
|---|---|---|---|
| SheetJS Community Edition | Apache-2.0 | cdn.sheetjs.com (distribuição oficial; a versão do npm está defasada) | Importação de .xlsx |
| KaTeX | MIT | cdn.jsdelivr.net/npm/katex | Fórmulas, exportadas como MathML estático |
| Mermaid | MIT | cdn.jsdelivr.net/npm/mermaid | Diagramas, exportados como SVG estático |

As versões exatas dos módulos sob demanda são fixadas em \`js/nucleo/config.js\`.
`;
  gravar(caminho('vendor', 'VERSOES.md'), md);
  log.ok('vendor/VERSOES.md atualizado');
}

executar();
