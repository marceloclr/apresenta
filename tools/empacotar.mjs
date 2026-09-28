// tools/empacotar.mjs — edições portáteis (etapa 9; decisão D41: tudo derivado do index.html).
//
//   dist/oratoria-pasta.zip        a aplicação completa numa pasta "apresenta/" (deflate, zlib
//                                  nativo), sem tools/, .github/, node_modules/, dist/,
//                                  package*.json, docs/planos/ e arquivos ocultos; inclui o
//                                  manual operacional em HTML (docs/manual-operacional.html)
//   dist/oratoria-portatil.html    arquivo único: folhas e scripts do index.html inline na mesma
//                                  ordem, @font-face geradas do embutível de fontes (D13),
//                                  embutíveis inline EXCETO os exemplos, sem manifest nem
//                                  service worker, faixa "Edição portátil · vX.Y.Z" e o manual
//   dist/manual-operacional.html   manual operacional autocontido
//
// Ao final, confere a sintaxe (node --check) de cada script do portátil e o balanceamento de tags.
// Uso: node tools/empacotar.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';
import * as acorn from 'acorn';
import { caminho, existe, formatarBytes, gravar, lerTexto, listarArquivos, literalSeguro, log, relativo, RAIZ } from './lib/comum.mjs';
import { manualHtml } from './lib/markdown-html.mjs';

const PASTA_ZIP = 'apresenta';
const EXCLUIR = ['tools', '.github', '.git', 'node_modules', 'dist', 'docs/planos', 'package.json', 'package-lock.json'];
/** Embutíveis inline no portátil (exemplos ficam de fora; o manifesto só serve à verificação). */
const EMBUTIVEIS_PORTATIL = ['embutiveis/chart-fonte.js'];
const TAGS_BALANCEADAS = ['div', 'section', 'template', 'aside', 'nav', 'main', 'header', 'script', 'style'];

const versao = JSON.parse(lerTexto(caminho('package.json'))).version;
let erros = 0;
const erro = (t) => { erros++; log.erro(t); };

// ─────────────────────────────────── ZIP ───────────────────────────────────────

function dataDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const data = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
}

/** ZIP com deflate e nomes UTF-8 (bit 11). entradas: [{ nome, dados: Buffer, data: Date }] */
export function criarZip(entradas) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const e of entradas) {
    const nome = Buffer.from(e.nome, 'utf8');
    const comprimido = deflateRawSync(e.dados, { level: 9 });
    const usarDeflate = comprimido.length < e.dados.length;
    const corpo = usarDeflate ? comprimido : e.dados;
    const crc = crc32(e.dados);
    const { hora, data } = dataDos(e.data || new Date());
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(usarDeflate ? 8 : 0, 8); local.writeUInt16LE(hora, 10); local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(corpo.length, 18); local.writeUInt32LE(e.dados.length, 22);
    local.writeUInt16LE(nome.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(usarDeflate ? 8 : 0, 10);
    central.writeUInt16LE(hora, 12); central.writeUInt16LE(data, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(corpo.length, 20); central.writeUInt32LE(e.dados.length, 24);
    central.writeUInt16LE(nome.length, 28); central.writeUInt32LE(deslocamento, 42);
    locais.push(local, nome, corpo);
    centrais.push(central, nome);
    deslocamento += local.length + nome.length + corpo.length;
  }
  const tamanhoCentral = centrais.reduce((t, b) => t + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(entradas.length, 8); fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12); fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, ...centrais, fim]);
}

function arquivosDaPasta() {
  return listarArquivos(RAIZ, { ignorar: EXCLUIR }).filter((abs) => !relativo(abs).split('/').some((p) => p.startsWith('.')));
}

// ────────────────────────────── Scripts inline ─────────────────────────────────

/**
 * Prepara um script para ficar dentro de <script>…</script>: "<!--", "<script" e "</script"
 * encerrariam ou confundiriam o elemento. Dentro de strings, templates e expressões regulares
 * o "<" vira \x3C (mesmo valor); em comentários, vira "&lt;". Em código, é erro.
 */
export function blindarScript(codigo, origem) {
  const perigo = /<(?=!--|\/?script)/gi;
  if (!perigo.test(codigo)) return codigo;
  const faixas = [];
  const opcoes = { ecmaVersion: 'latest', sourceType: 'script', onComment: (bloco, texto, ini, fim) => faixas.push({ ini, fim, tipo: 'comentario' }) };
  for (const t of acorn.tokenizer(codigo, opcoes)) {
    if (['string', 'template', 'regexp'].includes(t.type.label)) faixas.push({ ini: t.start, fim: t.end, tipo: 'literal' });
  }
  faixas.sort((a, b) => a.ini - b.ini);
  let saida = '';
  let ultimo = 0;
  perigo.lastIndex = 0;
  for (const m of codigo.matchAll(perigo)) {
    const faixa = faixas.find((f) => m.index >= f.ini && m.index < f.fim);
    if (!faixa) { erro(`${origem}: "<${codigo.substr(m.index + 1, 7)}" fora de literal; não é possível embuti-lo com segurança`); continue; }
    saida += codigo.slice(ultimo, m.index) + (faixa.tipo === 'literal' ? '\\x3C' : '&lt;');
    ultimo = m.index + 1;
  }
  return saida + codigo.slice(ultimo);
}

const blocoScript = (codigo, origem) => `<script>/* ${origem} */\n${blindarScript(codigo, origem)}\n</script>`;

// ─────────────────────────────────── Portátil ──────────────────────────────────

/** Gera @font-face a partir de O.embutiveis.fontes, sem duplicar os dados das fontes (D13). */
const FONTES_PORTATIL = `(function (O) {
  'use strict';
  const regras = (O.embutiveis.fontes || []).map((f) => "@font-face{font-family:'" + f.familia + "';font-style:" + f.estilo +
    ';font-weight:' + f.peso + ';font-display:swap;src:url(data:font/woff2;base64,' + f.base64 + ") format('woff2')}").join('\\n');
  const estilo = document.createElement('style');
  estilo.id = 'fontes-portatil';
  estilo.textContent = regras;
  document.head.append(estilo);
})(window.Oratoria);`;

const EDICAO_PORTATIL = `(function (O) {
  'use strict';
  O.config.EDICAO = 'portatil';
})(window.Oratoria);`;

function gerarPortatil(manual) {
  let html = lerTexto(caminho('index.html'));
  const scripts = [];
  html = html.replace(/[ \t]*<script\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*><\/script>[ \t]*\r?\n?/g, (_, src) => { scripts.push(src.replace(/^\.\//, '')); return ''; });
  let folhas = 0;
  html = html.replace(/[ \t]*<link\b([^>]*)>[ \t]*\r?\n?/g, (tag, attrs) => {
    const rel = (attrs.match(/\brel\s*=\s*"([^"]+)"/) || [])[1];
    const href = (attrs.match(/\bhref\s*=\s*"([^"]+)"/) || [])[1];
    if (rel === 'stylesheet') {
      if (href === 'css/fontes.css') return ''; // substituída pelas @font-face do embutível (D13)
      folhas++;
      const css = lerTexto(caminho(href));
      if (/url\(\s*['"]?(?!data:)/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) erro(`${href}: url() para arquivo externo não é suportada no portátil`);
      return `  <style>/* ${href} */\n${css.replace(/<\/style/gi, '<\\/style')}\n  </style>\n`;
    }
    if (rel === 'manifest' || rel === 'apple-touch-icon') return '';
    if (rel === 'icon') {
      if (!/\.svg$/.test(href)) return '';
      const svg = readFileSync(caminho(href)).toString('base64');
      return `  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${svg}">\n`;
    }
    return tag;
  });
  if (!scripts.length || scripts[0].startsWith('js/')) erro('index.html: scripts de vendor/ não encontrados na ordem esperada');

  // Faixa de identificação da edição, ao lado da versão na barra superior
  const faixa = `<span class="selo marca-edicao" data-estado="pendente" data-dica="Edição portátil: a aplicação inteira neste único arquivo, sem os exemplos. Os rascunhos ficam neste navegador, vinculados ao local do arquivo; para levar o trabalho a outro computador, exporte o projeto .oratoria.json.">Edição portátil · v${versao}</span>`;
  const antes = html;
  html = html.replace(/(<span class="marca-versao"[^>]*><\/span>)/, (m) => `${m}\n        ${faixa}`);
  if (html === antes) erro('index.html: marca-versao não encontrada para a faixa da edição portátil');

  // No <head>: namespace, fontes e @font-face (antes da primeira pintura)
  const cabeca = [
    blocoScript(lerTexto(caminho('js/nucleo/namespace.js')), 'js/nucleo/namespace.js'),
    blocoScript(lerTexto(caminho('embutiveis/fontes-base64.js')), 'embutiveis/fontes-base64.js'),
    blocoScript(FONTES_PORTATIL, 'fontes da edição portátil (D13)'),
    `<style>.marca-edicao { margin-left: 6px; }</style>`,
  ].join('\n');
  // Substituições por função: o código embutido contém "$&", "$'" etc., que uma string interpretaria.
  html = html.replace('</head>', () => `${cabeca}\n</head>`);

  // Fim do <body>: os scripts na ordem do index.html (DOM já analisado, como com defer)
  const corpo = [];
  for (const src of scripts) {
    if (src === 'js/nucleo/namespace.js') continue;
    corpo.push(blocoScript(lerTexto(caminho(src)), src));
    if (src === 'js/nucleo/config.js') {
      corpo.push(blocoScript(EDICAO_PORTATIL, 'edição portátil'));
      for (const e of EMBUTIVEIS_PORTATIL) corpo.push(blocoScript(lerTexto(caminho(e)), e));
      corpo.push(blocoScript(`(function (O) {\n  'use strict';\n  O.embutiveis.manual = ${literalSeguro(manual)};\n})(window.Oratoria);`, 'manual operacional'));
    }
  }
  html = html.replace(/<\/body>\s*<\/html>\s*$/, () => `${corpo.join('\n')}\n</body>\n</html>\n`);
  return { html, scripts: scripts.length, folhas };
}

function conferirPortatil(html, esperados) {
  const temp = mkdtempSync(join(tmpdir(), 'apresenta-portatil-'));
  try {
    const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    let falhas = 0;
    blocos.forEach((codigo, i) => {
      const arq = join(temp, `s${i}.js`);
      writeFileSync(arq, codigo);
      const r = spawnSync(process.execPath, ['--check', arq], { encoding: 'utf8' });
      if (r.status !== 0) { falhas++; erro(`script inline nº ${i} (${(codigo.match(/^\/\* (.+?) \*\//) || [])[1]}): ${(r.stderr || '').trim().split('\n').slice(0, 3).join(' ')}`); }
    });
    if (blocos.length < esperados) erro(`portátil com ${blocos.length} scripts inline; esperados ao menos ${esperados}`);
    if (!falhas) log.ok(`${blocos.length} scripts inline sem erro de sintaxe`);
    const limpo = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>').replace(/(<style\b[^>]*>)[\s\S]*?<\/style>/gi, '$1</style>');
    const desbalanceadas = TAGS_BALANCEADAS.filter((tag) => (limpo.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length !== (limpo.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length);
    if (desbalanceadas.length) erro(`tags desbalanceadas no portátil: ${desbalanceadas.join(', ')}`);
    else log.ok(`tags balanceadas (${TAGS_BALANCEADAS.map((t) => `<${t}>`).join(' ')})`);
    if (/<script\b[^>]*\bsrc=|<link\b[^>]*rel="(?:stylesheet|manifest)"/.test(limpo)) erro('portátil ainda referencia arquivos externos');
    if (/O\.embutiveis\.exemplos\s*=/.test(html)) erro('portátil inclui os exemplos (não deveria)');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

// ─────────────────────────────────── Execução ──────────────────────────────────

function executar() {
  log.titulo(`Empacotamento · v${versao}`);
  if (!existe(caminho('embutiveis/fontes-base64.js'))) { log.erro('embutíveis ausentes: execute node tools/gerar-embutiveis.mjs'); process.exit(1); }

  const manual = manualHtml(lerTexto(caminho('docs/manual-operacional.md')), { titulo: 'Apresenta — Manual operacional', versao });
  gravar(caminho('dist/manual-operacional.html'), manual);
  log.ok(`dist/manual-operacional.html   ${formatarBytes(Buffer.byteLength(manual))}`);

  const entradas = arquivosDaPasta().map((abs) => ({ nome: `${PASTA_ZIP}/${relativo(abs)}`, dados: readFileSync(abs), data: statSync(abs).mtime }));
  entradas.push({ nome: `${PASTA_ZIP}/docs/manual-operacional.html`, dados: Buffer.from(manual), data: new Date() });
  entradas.sort((a, b) => a.nome.localeCompare(b.nome));
  for (const obrigatorio of ['index.html', 'sw.js', 'manifest.webmanifest', 'embutiveis/exemplos.js']) {
    if (!entradas.some((e) => e.nome === `${PASTA_ZIP}/${obrigatorio}`)) erro(`zip sem ${obrigatorio}`);
  }
  const zip = criarZip(entradas);
  gravar(caminho('dist/oratoria-pasta.zip'), zip);
  const bruto = entradas.reduce((t, e) => t + e.dados.length, 0);
  log.ok(`dist/oratoria-pasta.zip        ${formatarBytes(zip.length)} (${entradas.length} arquivos, ${formatarBytes(bruto)} sem compressão)`);

  const { html, scripts, folhas } = gerarPortatil(manual);
  gravar(caminho('dist/oratoria-portatil.html'), html);
  log.ok(`dist/oratoria-portatil.html    ${formatarBytes(Buffer.byteLength(html))} (${scripts} scripts e ${folhas} folhas inline, sem exemplos)`);

  log.titulo('Conferência do portátil');
  conferirPortatil(html, scripts + 3);

  log.titulo('Resultado');
  if (erros) { log.erro(`${erros} erro(s) — empacotamento REPROVADO`); process.exit(1); }
  log.ok(`arquivos em ${basename(caminho('dist'))}/`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) executar();
