// tools/gerar-embutiveis.mjs — gera embutiveis/*.js a partir de vendor/ e assets/fontes/,
// o manifesto de sincronia e a lista de recursos do service worker (sw-recursos.js).
//
// Por que existem: em file:// a aplicação não consegue ler vendor/*.js nem fontes como
// texto. Estes arquivos trazem esses recursos já como strings registradas no namespace,
// carregadas sob demanda por js/nucleo/carregador.js no momento da exportação.
//
// Saída determinística (sem datas), para que o Git só acuse mudança real.
//
// Uso: node tools/gerar-embutiveis.mjs            → gera
//      import { planejar } from './gerar-embutiveis.mjs' → usado por verificar.mjs

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readdirSync, statSync } from 'node:fs';
import { ICONES } from './icones.mjs';
import { caminho, gravar, sha256, existe, lerTexto, log, formatarBytes, literalSeguro, referenciasHtml, ehExterno, listarArquivos, relativo } from './lib/comum.mjs';

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const listarPastas = (abs) => (existe(abs) ? readdirSync(abs).filter((n) => statSync(`${abs}/${n}`).isDirectory()).sort() : []);

const CABECALHO = (origens) =>
  `// ARQUIVO GERADO por tools/gerar-embutiveis.mjs — NÃO EDITAR À MÃO.\n// Origem: ${origens.join(', ')}\n`;

const FONTES = [
  ['IBM Plex Sans', 400, 'normal', 'ibm-plex-sans-latin-400-normal.woff2'],
  ['IBM Plex Sans', 400, 'italic', 'ibm-plex-sans-latin-400-italic.woff2'],
  ['IBM Plex Sans', 600, 'normal', 'ibm-plex-sans-latin-600-normal.woff2'],
  ['IBM Plex Serif', 400, 'normal', 'ibm-plex-serif-latin-400-normal.woff2'],
  ['IBM Plex Serif', 400, 'italic', 'ibm-plex-serif-latin-400-italic.woff2'],
  ['IBM Plex Serif', 600, 'normal', 'ibm-plex-serif-latin-600-normal.woff2'],
  ['IBM Plex Mono', 400, 'normal', 'ibm-plex-mono-latin-400-normal.woff2'],
  ['IBM Plex Mono', 600, 'normal', 'ibm-plex-mono-latin-600-normal.woff2'],
];

/** Gera, em memória, o conteúdo de cada embutível e suas origens. */
function planejarEmbutiveis() {
  const saida = [];

  // Fontes em base64 — [{ familia, peso, estilo, arquivo, base64 }]
  const origensFontes = {};
  const itens = FONTES.map(([familia, peso, estilo, arq]) => {
    const rel = `assets/fontes/${arq}`;
    const dados = readFileSync(caminho(rel));
    origensFontes[rel] = sha256(dados);
    return `    { familia: ${JSON.stringify(familia)}, peso: ${peso}, estilo: ${JSON.stringify(estilo)}, arquivo: ${JSON.stringify(arq)},\n      base64: ${JSON.stringify(dados.toString('base64'))} }`;
  });
  saida.push({
    arquivo: 'embutiveis/fontes-base64.js',
    origens: origensFontes,
    conteudo: `${CABECALHO(Object.keys(origensFontes))}(function (O) {\n  'use strict';\n  O.embutiveis.fontes = [\n${itens.join(',\n')}\n  ];\n})(window.Oratoria);\n`,
  });

  // Chart.js como string (inserido no HTML exportado somente se houver gráfico)
  const relChart = 'vendor/chart.umd.min.js';
  const chart = lerTexto(caminho(relChart));
  saida.push({
    arquivo: 'embutiveis/chart-fonte.js',
    origens: { [relChart]: sha256(chart) },
    conteudo: `${CABECALHO([relChart])}(function (O) {\n  'use strict';\n  O.embutiveis.chart = ${literalSeguro(chart)};\n})(window.Oratoria);\n`,
  });

  // Exemplos (decks de exemplos/<tema>/) — oferecidos pela aba Composição
  const origensEx = {};
  const exemplos = [];
  for (const dir of listarPastas(caminho('exemplos'))) {
    const arquivos = listarArquivos(caminho('exemplos', dir));
    const md = arquivos.find((a) => a.endsWith('.md'));
    if (!md) continue;
    const item = { id: dir, markdown: '', arquivos: {} };
    for (const abs of arquivos) {
      const rel = relativo(abs);
      const dados = readFileSync(abs);
      origensEx[rel] = sha256(dados);
      const nome = rel.split('/').pop();
      const ext = nome.slice(nome.lastIndexOf('.') + 1).toLowerCase();
      if (abs === md) item.markdown = dados.toString('utf8');
      else if (ext === 'csv') item.arquivos[nome] = { tipo: 'csv', texto: dados.toString('utf8') };
      else if (MIME[ext]) item.arquivos[nome] = { tipo: 'imagem', mime: MIME[ext], dataUrl: `data:${MIME[ext]};base64,${dados.toString('base64')}` };
    }
    item.titulo = (item.markdown.match(/^titulo:\s*(.+)$/m) || [, dir])[1].trim();
    item.tema = (item.markdown.match(/^tema:\s*(\S+)/m) || [, dir])[1].trim();
    exemplos.push(item);
  }
  saida.push({
    arquivo: 'embutiveis/exemplos.js',
    origens: origensEx,
    conteudo: `${CABECALHO(['exemplos/*/'])}(function (O) {\n  'use strict';\n  O.embutiveis.exemplos = ${literalSeguro(JSON.stringify(exemplos))};\n})(window.Oratoria);\n`,
  });

  // Decisão D1 (aprovada): o realce de código é pré-renderizado na exportação;
  // por isso não há embutível do highlight.js.

  // Manifesto — hashes das origens e da saída de cada embutível.
  const manifesto = {};
  for (const e of saida) manifesto[e.arquivo] = { origens: e.origens, saida: sha256(e.conteudo), bytes: Buffer.byteLength(e.conteudo) };
  saida.push({
    arquivo: 'embutiveis/MANIFESTO.js',
    origens: {},
    conteudo: `${CABECALHO(['embutiveis/*.js'])}// Usado por tools/verificar.mjs para acusar embutíveis dessincronizados.\n(function (O) {\n  'use strict';\n  O.embutiveis.manifesto = ${JSON.stringify(manifesto, null, 2).replace(/\n/g, '\n  ')};\n})(window.Oratoria);\n`,
  });
  return saida;
}

/**
 * Lista de recursos do service worker (decisão D6), derivada do index.html.
 * Os embutíveis recém-planejados entram na assinatura pelo conteúdo em memória:
 * todo script e folha local referenciados, os embutíveis (exportação offline no PWA),
 * as fontes, os ícones e o manifest; e as URLs dos módulos de rede (C.MODULOS_REDE). Retorna null se o index.html ainda não existir.
 */
function planejarRecursosSw(planejados = {}) {
  const indice = caminho('index.html');
  if (!existe(indice)) return null;
  const { scripts, links } = referenciasHtml(lerTexto(indice));
  const locais = [...scripts, ...links].filter((u) => !ehExterno(u)).map((u) => u.replace(/^\.\//, '').split(/[?#]/)[0]);
  const extras = [
    ...FONTES.map((f) => `assets/fontes/${f[3]}`),
    'embutiveis/fontes-base64.js',
    'embutiveis/chart-fonte.js',
    'embutiveis/exemplos.js',
    'embutiveis/MANIFESTO.js',
    'manifest.webmanifest',
    ...ICONES.map((i) => i.arquivo),
    'assets/icones/icone.svg',
  ];
  const lista = ['./', 'index.html', ...new Set([...locais, ...extras])].filter((u) => u === './' || existe(caminho(u)));
  const versao = JSON.parse(lerTexto(caminho('package.json'))).version;
  const hashDe = (u) => (u in planejados ? sha256(planejados[u]) : sha256(readFileSync(caminho(u))));
  const assinatura = sha256(lista.map((u) => (u === './' ? '' : hashDe(u))).join('|')).slice(0, 12);
  const rede = modulosRede();
  const conteudo = `${CABECALHO(['index.html', 'js/nucleo/config.js'])}// Importado por sw.js via importScripts(). A assinatura muda sempre que qualquer recurso muda.\nself.ORATORIA_CACHE = ${JSON.stringify(`oratoria-${versao}-${assinatura}`)};\nself.ORATORIA_RECURSOS = ${JSON.stringify(lista, null, 2)};\n// Módulos sob demanda (C.MODULOS_REDE): rede primeiro, com cópia guardada para uso sem internet.\nself.ORATORIA_REDE = ${JSON.stringify(rede, null, 2)};\n`;
  return { arquivo: 'sw-recursos.js', conteudo };
}

/** URLs de C.MODULOS_REDE, lidas do bloco correspondente de js/nucleo/config.js. */
function modulosRede() {
  const config = existe(caminho('js/nucleo/config.js')) ? lerTexto(caminho('js/nucleo/config.js')) : '';
  const bloco = (config.match(/MODULOS_REDE\s*=\s*\{([\s\S]*?)\n\s*\};/) || [])[1] || '';
  return [...bloco.matchAll(/\burl:\s*'(https:\/\/[^']+)'/g)].map((m) => m[1]);
}

export function planejar() {
  const itens = planejarEmbutiveis();
  const planejados = Object.fromEntries(itens.map((i) => [i.arquivo, i.conteudo]));
  const sw = planejarRecursosSw(planejados);
  if (sw) itens.push(sw);
  return itens;
}

function executar() {
  log.titulo('Embutíveis');
  for (const item of planejar()) {
    gravar(caminho(item.arquivo), item.conteudo);
    log.ok(`${item.arquivo.padEnd(32)} ${formatarBytes(Buffer.byteLength(item.conteudo))}`);
  }
  if (!existe(caminho('index.html'))) log.info('index.html ainda ausente: sw-recursos.js será gerado quando existir.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) executar();
