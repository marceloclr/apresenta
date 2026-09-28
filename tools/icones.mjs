// tools/icones.mjs — rasteriza assets/icones/icone.svg nos PNG do manifest (decisão D39).
//
// Usa o Edge ou o Chrome instalados em modo headless (captura de tela de uma página
// mínima), sem dependência de biblioteca de imagem. O resultado é versionado: basta
// executar de novo quando o SVG mudar.
//
// Uso: node tools/icones.mjs            (ou NAVEGADOR=<caminho do executável> node tools/icones.mjs)

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { caminho, existe, gravar, log, formatarBytes } from './lib/comum.mjs';

/** Cor de acento da interface escura (--i-acento em css/app.css): fundo do ícone maskable. */
const ACENTO = '#6a9fcc';

/**
 * Variantes geradas. A maskable ocupa o quadro inteiro com a cor de acento e reduz o
 * símbolo para caber na zona segura (círculo de 80% do lado), como pede a especificação.
 */
export const ICONES = [
  { arquivo: 'assets/icones/icone-192.png', lado: 192, maskable: false },
  { arquivo: 'assets/icones/icone-512.png', lado: 512, maskable: false },
  { arquivo: 'assets/icones/icone-maskable-512.png', lado: 512, maskable: true },
];

const CANDIDATOS = [
  process.env.NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

/** Largura e altura lidas do cabeçalho IHDR de um PNG. */
export function dimensoesPng(dados) {
  if (dados.length < 24 || dados.toString('latin1', 1, 4) !== 'PNG') return null;
  return { largura: dados.readUInt32BE(16), altura: dados.readUInt32BE(20) };
}

function pagina(svg, { lado, maskable }) {
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const escala = maskable ? 0.8 : 1;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${lado}px;height:${lado}px;overflow:hidden;background:${maskable ? ACENTO : 'transparent'}}
body{display:grid;place-items:center}img{width:${lado * escala}px;height:${lado * escala}px;display:block}
</style></head><body><img src="${dataUrl}" alt=""></body></html>`;
}

function executar() {
  log.titulo('Ícones');
  const navegador = CANDIDATOS.find((c) => existe(c));
  if (!navegador) { log.erro('Edge ou Chrome não encontrado. Informe o executável em NAVEGADOR=…'); process.exit(1); }
  log.info(`navegador: ${navegador}`);
  const svg = readFileSync(caminho('assets/icones/icone.svg'), 'utf8');
  const temp = mkdtempSync(join(tmpdir(), 'apresenta-icones-'));
  let falhas = 0;
  try {
    for (const icone of ICONES) {
      const html = join(temp, `icone-${icone.lado}-${icone.maskable ? 'm' : 'n'}.html`);
      const png = join(temp, 'saida.png');
      writeFileSync(html, pagina(svg, icone));
      rmSync(png, { force: true });
      spawnSync(navegador, [
        '--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
        `--user-data-dir=${join(temp, 'perfil')}`, '--default-background-color=00000000',
        '--force-device-scale-factor=1', `--window-size=${icone.lado},${icone.lado}`,
        `--screenshot=${png}`, pathToFileURL(html).href,
      ], { encoding: 'utf8', timeout: 60000 });
      const dados = existe(png) ? readFileSync(png) : null;
      const dim = dados && dimensoesPng(dados);
      if (!dim || dim.largura !== icone.lado || dim.altura !== icone.lado) {
        falhas++;
        log.erro(`${icone.arquivo}: captura ${dim ? `${dim.largura}×${dim.altura}` : 'ausente'} (esperado ${icone.lado}×${icone.lado})`);
        continue;
      }
      gravar(caminho(icone.arquivo), dados);
      log.ok(`${icone.arquivo.padEnd(36)} ${icone.lado}×${icone.lado}  ${formatarBytes(dados.length)}`);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
  if (falhas) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) executar();
