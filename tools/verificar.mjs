// tools/verificar.mjs — validações do repositório (CLAUDE.md §2 e prompt §3.4).
// Executar antes de concluir qualquer etapa:  node tools/verificar.mjs
//
// Usa o Node nativo e, por decisão D5, o acorn (devDependency exclusiva de tools/)
// para análise sintática — mais confiável que expressões regulares.
//
// Saída: ✔ aprovado · • informação · ▲ aviso (não reprova) · ✖ erro (reprova, código 1)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { caminho, relativo, existe, lerTexto, listarArquivos, log, referenciasHtml, ehExterno, formatarBytes } from './lib/comum.mjs';
import { planejar } from './gerar-embutiveis.mjs';

let acorn, walk;
try {
  acorn = await import('acorn');
  walk = await import('acorn-walk');
} catch {
  log.erro('acorn/acorn-walk ausentes. Execute "npm ci" antes de verificar.');
  process.exit(1);
}

// ───────────────────────────────── Configuração ────────────────────────────────

/** Funções autossuficientes reinjetadas via toString() na exportação. */
const AUTOSSUFICIENTES = [
  { arquivo: 'js/slides/motor.js', funcao: 'motorSlides', limiteBytes: 25 * 1024 },
  { arquivo: 'js/slides/graficos-runtime.js', funcao: 'motorGraficos', limiteBytes: 12 * 1024 },
  { arquivo: 'js/slides/apresentador.js', funcao: 'motorApresentador', limiteBytes: 14 * 1024 },
  { arquivo: 'js/exportacao/pdf-runtime.js', funcao: 'motorPdf', limiteBytes: 20 * 1024 },
];

/** Identificadores livres permitidos nas funções autossuficientes (globais do navegador). */
const GLOBAIS_PERMITIDOS = new Set([
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'performance', 'console',
  'Math', 'JSON', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Symbol', 'RegExp', 'Error', 'TypeError',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Intl', 'Reflect', 'Proxy',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN', 'undefined', 'arguments',
  'encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'matchMedia', 'getComputedStyle', 'CustomEvent', 'Event', 'BroadcastChannel', 'MessageChannel',
  'ResizeObserver', 'IntersectionObserver', 'MutationObserver',
  'URL', 'Blob', 'File', 'FileReader', 'Image', 'XMLSerializer', 'DOMParser',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Float32Array', 'ArrayBuffer', 'DataView', 'TextEncoder', 'TextDecoder',
  'HTMLElement', 'HTMLCanvasElement', 'Node', 'NodeFilter', 'Range',
  'Chart', // presente apenas quando o exportador embute o Chart.js; o código verifica typeof antes de usar
]);

/** Tags cujo balanceamento é conferido no index.html. */
const TAGS_BALANCEADAS = ['div', 'section', 'template', 'aside', 'nav'];

/** Pastas onde valem as proibições do file:// (exceção: js/servicos/). */
const PASTAS_RESTRITAS = ['js', 'temas'];
const EXCECAO_REDE = 'js/servicos/';

// ─────────────────────────────────── Estado ────────────────────────────────────

let erros = 0;
let avisos = 0;
const erro = (t) => { erros++; log.erro(t); };
const aviso = (t) => { avisos++; log.aviso(t); };
/** Aprovação da seção: ✔ só se nenhum erro surgiu desde `inicio`; caso contrário, apenas informa. */
const concluir = (inicio, texto) => (erros === inicio ? log.ok(texto) : log.info(texto));

const INDICE = caminho('index.html');
const temIndice = existe(INDICE);
const htmlIndice = temIndice ? lerTexto(INDICE) : '';
const refs = temIndice ? referenciasHtml(htmlIndice) : { scripts: [], links: [] };
const normalizar = (u) => u.replace(/^\.\//, '').split(/[?#]/)[0];

const arquivosApp = PASTAS_RESTRITAS.flatMap((p) => listarArquivos(caminho(p), { extensoes: ['.js'] }));

const analisar = (texto, arquivo) =>
  acorn.parse(texto, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: false, locations: true, sourceFile: arquivo });

// ─────────────────────────────────── 1. Sintaxe ────────────────────────────────

function verificarSintaxe() {
  log.titulo('1. Sintaxe (node --check)');
  const alvos = [
    ...arquivosApp,
    ...listarArquivos(caminho('embutiveis'), { extensoes: ['.js'] }),
    ...['sw.js', 'sw-recursos.js'].map((a) => caminho(a)).filter(existe),
    ...listarArquivos(caminho('tools'), { extensoes: ['.js', '.mjs'] }),
  ];
  let falhas = 0;
  for (const abs of alvos) {
    const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    if (r.status !== 0) { falhas++; erro(`${relativo(abs)}\n${(r.stderr || '').trim().split('\n').slice(0, 4).join('\n')}`); }
  }
  if (!falhas) log.ok(`${alvos.length} arquivos sem erro de sintaxe`);
}

// ─────────────────────────────── 2. Balanceamento ──────────────────────────────

function verificarBalanceamento() {
  log.titulo('2. Balanceamento de tags e chaves');
  if (!temIndice) log.info('index.html ainda ausente (criado na etapa 2).');
  else {
    const limpo = htmlIndice
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');
    let ok = true;
    for (const tag of TAGS_BALANCEADAS) {
      const abre = (limpo.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
      const fecha = (limpo.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
      if (abre !== fecha) { ok = false; erro(`index.html: <${tag}> abre ${abre} × fecha ${fecha}`); }
    }
    if (ok) log.ok(`index.html: ${TAGS_BALANCEADAS.map((t) => `<${t}>`).join(' ')} balanceadas`);
  }
  const inicioCss = erros;
  const folhas = listarArquivos(caminho('css'), { extensoes: ['.css'] });
  for (const abs of folhas) {
    const semComentario = lerTexto(abs).replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
    let nivel = 0, minimo = 0;
    for (const c of semComentario) { if (c === '{') nivel++; else if (c === '}') { nivel--; minimo = Math.min(minimo, nivel); } }
    if (nivel !== 0 || minimo < 0) erro(`${relativo(abs)}: chaves desbalanceadas (saldo ${nivel})`);
  }
  if (folhas.length) concluir(inicioCss, `${folhas.length} folha(s) .css conferida(s)`);
}

// ─────────────────────────────── 3. Referências ────────────────────────────────

function verificarReferencias() {
  log.titulo('3. Referências do index.html');
  if (!temIndice) return log.info('index.html ainda ausente.');
  const inicio = erros;
  let total = 0;
  for (const u of [...refs.scripts, ...refs.links]) {
    if (ehExterno(u)) { aviso(`referência externa no index.html: ${u} (a abertura sem rede deve funcionar)`); continue; }
    total++;
    if (!existe(caminho(normalizar(u)))) erro(`arquivo inexistente: ${u}`);
  }
  // Todo <script src> local deve ter defer (CLAUDE.md §2.1.1)
  const limpo = htmlIndice.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of limpo.matchAll(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>/gi)) {
    const attrs = m[1] + m[3];
    if (!/\bdefer\b/i.test(attrs)) erro(`<script src="${m[2]}"> sem defer`);
    if (/type\s*=\s*["']?module/i.test(attrs)) erro(`<script src="${m[2]}"> com type="module" (proibido)`);
  }
  if (/type\s*=\s*["']?module/i.test(limpo)) erro('index.html contém type="module" (proibido)');
  // Ordem: namespace.js antes de qualquer outro js/; app.js por último
  const js = refs.scripts.map(normalizar).filter((s) => s.startsWith('js/'));
  if (js.length) {
    if (js[0] !== 'js/nucleo/namespace.js') erro('js/nucleo/namespace.js deve ser o primeiro script de js/');
    if (js.includes('js/interface/app.js') && js[js.length - 1] !== 'js/interface/app.js') erro('js/interface/app.js deve ser o último script');
  }
  concluir(inicio, `${total} referência(s) local(is) conferida(s)`);
}

// ───────────────────────────────── 4. Órfãos ───────────────────────────────────

function verificarOrfaos() {
  log.titulo('4. Arquivos órfãos');
  if (!temIndice) return log.info(`index.html ainda ausente; ${arquivosApp.length} arquivos em js/ e temas/ aguardam referência.`);
  const referenciados = new Set(refs.scripts.map(normalizar));
  const orfaos = arquivosApp.map(relativo).filter((r) => !referenciados.has(r));
  for (const o of orfaos) erro(`órfão (sem <script defer> no index.html): ${o}`);
  if (!orfaos.length) log.ok(`nenhum órfão entre ${arquivosApp.length} arquivos`);
}

// ─────────────────────────────── 5. Embutíveis ─────────────────────────────────

function verificarEmbutiveis() {
  log.titulo('5. Sincronia dos embutíveis');
  let manifesto = {};
  const absManifesto = caminho('embutiveis/MANIFESTO.js');
  if (existe(absManifesto)) {
    const m = lerTexto(absManifesto).match(/manifesto = (\{[\s\S]*\});/);
    try { manifesto = m ? JSON.parse(m[1]) : {}; } catch { erro('MANIFESTO.js ilegível'); }
  }
  let planejados;
  try { planejados = planejar(); } catch (e) { return erro(`falha ao recompor embutíveis: ${e.message}`); }
  let ok = 0;
  for (const item of planejados) {
    const abs = caminho(item.arquivo);
    if (!existe(abs)) { erro(`${item.arquivo} ausente — execute node tools/gerar-embutiveis.mjs`); continue; }
    if (readFileSync(abs, 'utf8') === item.conteudo) { ok++; continue; }
    const registro = manifesto[item.arquivo];
    const origemMudou = registro && item.origens && Object.entries(item.origens).some(([o, h]) => registro.origens?.[o] !== h);
    erro(`${item.arquivo} dessincronizado (${origemMudou ? 'a origem mudou' : 'editado à mão ou índice alterado'}) — execute node tools/gerar-embutiveis.mjs`);
  }
  if (ok === planejados.length) log.ok(`${ok} arquivos gerados em sincronia com vendor/, assets/fontes/ e index.html`);
}

// ───────────────────────────── 6. Usos proibidos ───────────────────────────────

function verificarProibidos() {
  log.titulo('6. Usos proibidos em js/ e temas/ (file://)');
  const inicio = erros;
  let conferidos = 0;
  for (const abs of arquivosApp) {
    const rel = relativo(abs);
    const texto = lerTexto(abs);
    const permiteRede = rel.startsWith(EXCECAO_REDE);
    let ast;
    try { ast = analisar(texto, rel); } catch (e) {
      erro(`${rel}: não analisável como script clássico (${e.message}) — import/export são proibidos`);
      continue;
    }
    conferidos++;
    // 6a. Tokens proibidos
    const tokens = [...acorn.tokenizer(texto, { ecmaVersion: 'latest', sourceType: 'script', locations: true })];
    tokens.forEach((t, i) => {
      const linha = t.loc.start.line;
      const nome = t.type.label === 'name' ? t.value : t.type.keyword;
      if (nome === 'import' || nome === 'export') erro(`${rel}:${linha} uso de ${nome}`);
      if (!permiteRede && nome === 'fetch' && tokens[i + 1]?.type.label === '(' && tokens[i - 1]?.type.label !== '.') erro(`${rel}:${linha} uso de fetch()`);
      if (!permiteRede && nome === 'XMLHttpRequest') erro(`${rel}:${linha} uso de XMLHttpRequest`);
      if ((t.type.label === 'string' || t.type.label === 'template') && /type\s*=\s*\\?["']?module/i.test(String(t.value))) erro(`${rel}:${linha} string com type="module"`);
    });
    // 6b. Disciplina de namespace: no nível superior, somente IIFEs
    for (const st of ast.body) {
      const ehDiretiva = st.type === 'ExpressionStatement' && st.directive;
      let expr = st.type === 'ExpressionStatement' ? st.expression : null;
      if (expr?.type === 'UnaryExpression') expr = expr.argument;
      const ehIife = expr?.type === 'CallExpression' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(expr.callee.type);
      if (!ehDiretiva && !ehIife) erro(`${rel}:${st.loc.start.line} declaração fora de IIFE (${st.type}) — use (function (O) { 'use strict'; … })(window.Oratoria);`);
    }
  }
  concluir(inicio, `${conferidos} arquivo(s) analisado(s)${conferidos ? '' : ' (nenhum ainda)'}`);
}

// ────────────────────────── 7. Funções autossuficientes ────────────────────────

function coletarNomesDePadrao(no, destino) {
  if (!no) return;
  switch (no.type) {
    case 'Identifier': destino.add(no.name); break;
    case 'ObjectPattern': no.properties.forEach((p) => coletarNomesDePadrao(p.type === 'RestElement' ? p.argument : p.value, destino)); break;
    case 'ArrayPattern': no.elements.forEach((e) => coletarNomesDePadrao(e, destino)); break;
    case 'RestElement': coletarNomesDePadrao(no.argument, destino); break;
    case 'AssignmentPattern': coletarNomesDePadrao(no.left, destino); break;
  }
}

/** Identificadores livres: referências sem declaração em nenhum escopo interno da função. */
function identificadoresLivres(funcao) {
  const declarados = new Set();
  const referencias = new Map();
  if (funcao.id) declarados.add(funcao.id.name);
  walk.full(funcao, (no) => {
    if (/Function/.test(no.type)) { if (no.id) declarados.add(no.id.name); no.params.forEach((p) => coletarNomesDePadrao(p, declarados)); }
    if (no.type === 'VariableDeclarator') coletarNomesDePadrao(no.id, declarados);
    if (/^Class/.test(no.type) && no.id) declarados.add(no.id.name);
    if (no.type === 'CatchClause') coletarNomesDePadrao(no.param, declarados);
  });
  const registrar = (no) => { if (!referencias.has(no.name)) referencias.set(no.name, no.loc.start.line); };
  walk.simple(funcao, { Identifier: registrar, VariablePattern: registrar });
  return [...referencias].filter(([n]) => !declarados.has(n));
}

function verificarAutossuficientes() {
  log.titulo('7. Funções autossuficientes (reinjetadas via toString)');
  for (const alvo of AUTOSSUFICIENTES) {
    const abs = caminho(alvo.arquivo);
    if (!existe(abs)) { log.info(`${alvo.funcao} (${alvo.arquivo}) ainda não implementada`); continue; }
    const texto = lerTexto(abs);
    let ast;
    try { ast = analisar(texto, alvo.arquivo); } catch { continue; } // já acusado em 6
    let funcao = null;
    walk.full(ast, (no) => { if (!funcao && /^Function/.test(no.type) && no.id?.name === alvo.funcao) funcao = no; });
    if (!funcao) { erro(`${alvo.arquivo}: função nomeada ${alvo.funcao} não encontrada`); continue; }
    const livres = identificadoresLivres(funcao).filter(([n]) => !GLOBAIS_PERMITIDOS.has(n));
    for (const [nome, linha] of livres) erro(`${alvo.arquivo}:${linha} ${alvo.funcao} referencia identificador externo "${nome}"`);
    const bytes = Buffer.byteLength(texto.slice(funcao.start, funcao.end));
    if (bytes > alvo.limiteBytes) aviso(`${alvo.funcao}: ${formatarBytes(bytes)} excede a meta de ${formatarBytes(alvo.limiteBytes)}`);
    if (!livres.length) log.ok(`${alvo.funcao}: autossuficiente, ${formatarBytes(bytes)} (meta ${formatarBytes(alvo.limiteBytes)})`);
  }
}

// ─────────────────────────────── 8. Convenções ─────────────────────────────────

function verificarConvencoes() {
  log.titulo('8. Convenções e arquivos de apoio');
  // Versão de config.js = package.json
  const versaoPacote = JSON.parse(lerTexto(caminho('package.json'))).version;
  const config = existe(caminho('js/nucleo/config.js')) ? lerTexto(caminho('js/nucleo/config.js')) : '';
  const versaoConfig = (config.match(/VERSAO\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  if (!config) log.info('js/nucleo/config.js ainda ausente');
  else if (versaoConfig !== versaoPacote) erro(`VERSAO em config.js (${versaoConfig}) difere de package.json (${versaoPacote})`);
  else log.ok(`versão ${versaoPacote} coerente entre package.json e config.js`);
  // Controles estáticos do index.html com dica (os dinâmicos são auditados em tempo de execução)
  if (temIndice) {
    const limpo = htmlIndice.replace(/<!--[\s\S]*?-->/g, '');
    const controles = [...limpo.matchAll(/<(button|select|textarea|input)\b([^>]*)>/gi)].concat([...limpo.matchAll(/<(\w+)\b([^>]*\bclass\s*=\s*["'][^"']*\bindicador\b(?!-)[^"']*["'][^>]*)>/gi)]);
    const semDica = controles.filter(([, , attrs]) => !/\bdata-dica(-titulo|-formula)?\s*=/.test(attrs) && !/type\s*=\s*["']hidden/.test(attrs) && !/data-dica-dispensada/.test(attrs));
    for (const [tag, nome, attrs] of semDica) erro(`index.html: <${nome}${(attrs.match(/\bid\s*=\s*["'][^"']+["']/) || [''])[0] ? ' ' + attrs.match(/\bid\s*=\s*["'][^"']+["']/)[0] : ''}> sem dica (data-dica)`);
    if (!semDica.length) log.ok(`${controles.length} controles e indicadores do index.html com dica`);
  }
  // Manuais (especificação §15): todo módulo descrito no manual técnico
  const absTecnico = caminho('docs/manual-tecnico.md');
  if (!existe(absTecnico)) erro('docs/manual-tecnico.md ausente');
  else {
    const manual = lerTexto(absTecnico);
    // Módulos de js/ são obrigatórios no inventário. Temas se descrevem no próprio objeto
    // (descricao, recomendacao): um tema novo deve funcionar sem tocar em outro arquivo (§14).
    const modulos = arquivosApp.map(relativo).filter((r) => r.startsWith('js/'));
    const semDescricao = modulos.filter((r) => !manual.includes(r));
    for (const r of semDescricao) erro(`${r} não está descrito em docs/manual-tecnico.md (§3, inventário de módulos)`);
    if (!semDescricao.length) log.ok(`manual técnico descreve os ${modulos.length} módulos de js/`);
    const temasForaDoManual = arquivosApp.map(relativo).filter((r) => r.startsWith('temas/') && !manual.includes(r));
    if (temasForaDoManual.length) log.info(`temas não citados no manual (permitido): ${temasForaDoManual.join(', ')}`);
  }
  if (!existe(caminho('docs/manual-operacional.md'))) erro('docs/manual-operacional.md ausente');
  else log.ok('docs/manual-operacional.md presente');
  for (const a of ['CLAUDE.md', 'vendor/VERSOES.md', '.gitignore']) {
    if (existe(caminho(a))) log.ok(`${a} presente`); else erro(`${a} ausente`);
  }
  for (const a of ['README.md', 'LEIA-ME.txt', 'manifest.webmanifest', 'sw.js']) if (!existe(caminho(a))) log.info(`${a} ainda ausente (previsto em etapa posterior)`);
}

// ─────────────────────────────────── Execução ──────────────────────────────────

console.log(`Oratória · verificação · ${new Date().toLocaleString('pt-BR')}`);
verificarSintaxe();
verificarBalanceamento();
verificarReferencias();
verificarOrfaos();
verificarEmbutiveis();
verificarProibidos();
verificarAutossuficientes();
verificarConvencoes();

log.titulo('Resultado');
if (erros) { log.erro(`${erros} erro(s), ${avisos} aviso(s) — verificação REPROVADA`); process.exit(1); }
log.ok(`nenhum erro, ${avisos} aviso(s) — verificação aprovada`);
