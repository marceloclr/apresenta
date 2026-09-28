// tools/lib/comum.mjs — utilitários compartilhados pelas ferramentas de desenvolvimento.
// Somente Node nativo. Não é distribuído com a aplicação.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Caminho absoluto a partir da raiz do repositório. */
export const caminho = (...partes) => join(RAIZ, ...partes);

/** Caminho relativo à raiz, sempre com barras normais (estável entre Windows e Linux). */
export const relativo = (abs) => relative(RAIZ, abs).split(sep).join('/');

export const sha256 = (dados) => createHash('sha256').update(dados).digest('hex');

export const lerTexto = (abs) => readFileSync(abs, 'utf8');

export const existe = (abs) => existsSync(abs);

/** Grava criando as pastas intermediárias; normaliza fins de linha em LF. */
export function gravar(abs, conteudo) {
  mkdirSync(dirname(abs), { recursive: true });
  const dados = typeof conteudo === 'string' ? conteudo.replace(/\r\n/g, '\n') : conteudo;
  writeFileSync(abs, dados);
}

/** Lista arquivos recursivamente, ignorando pastas indicadas. Ordem determinística. */
export function listarArquivos(dirAbs, { extensoes = null, ignorar = [] } = {}) {
  const saida = [];
  if (!existsSync(dirAbs)) return saida;
  const visitar = (d) => {
    for (const nome of readdirSync(d).sort()) {
      const abs = join(d, nome);
      const rel = relativo(abs);
      if (ignorar.some((i) => rel === i || rel.startsWith(i + '/'))) continue;
      const st = statSync(abs);
      if (st.isDirectory()) visitar(abs);
      else if (!extensoes || extensoes.some((e) => nome.endsWith(e))) saida.push(abs);
    }
  };
  visitar(dirAbs);
  return saida;
}

/**
 * Converte um texto qualquer num literal de string JavaScript seguro para
 * ser inserido dentro de <script>: escapa "</script" e comentários HTML.
 */
export function literalSeguro(texto) {
  return JSON.stringify(texto)
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Formata bytes em pt-BR. */
export function formatarBytes(n) {
  const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${fmt.format(n / 1024)} KB`;
  return `${fmt.format(n / 1024 / 1024)} MB`;
}

const usarCor = process.stdout.isTTY && !process.env.NO_COLOR;
const cor = (c, t) => (usarCor ? `\x1b[${c}m${t}\x1b[0m` : t);
export const log = {
  titulo: (t) => console.log('\n' + cor('1', t)),
  ok: (t) => console.log(cor('32', '  ✔ ') + t),
  info: (t) => console.log(cor('36', '  • ') + t),
  aviso: (t) => console.log(cor('33', '  ▲ ') + t),
  erro: (t) => console.log(cor('31', '  ✖ ') + t),
};

/** Extrai referências de <script src> e <link href> de um HTML (ignora comentários). */
export function referenciasHtml(html) {
  const limpo = html.replace(/<!--[\s\S]*?-->/g, '');
  const scripts = [...limpo.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  const links = [...limpo.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  return { scripts, links };
}

export const ehExterno = (url) => /^(?:[a-z]+:)?\/\//i.test(url) || /^(data|blob|mailto):/i.test(url);
