# Bibliotecas e fontes de terceiros

> Arquivo **gerado** por `tools/vendor.mjs`. Não editar à mão.
> Todas as bibliotecas são gratuitas e de código aberto; o texto integral de cada
> licença está em `vendor/licencas/` e, para as fontes, em `assets/fontes/OFL.txt`.

## Núcleo (carregado na abertura, funciona sem rede)

| Pacote npm | Versão | Licença | Arquivo | Global | Tamanho | Origem no pacote | Finalidade | SHA-256 |
|---|---|---|---|---|---|---|---|---|
| markdown-it | 15.0.2 | MIT | `markdown-it.min.js` | `markdownit` | 112,4 KB | `dist/browser/markdown-it.umd.min.js` | Interpretação de Markdown | `635972b985228e8a…` |
| markdown-it-attrs | 5.0.1 | MIT | `markdown-it-attrs.iife.js` | `markdownItAttrs` | 36,2 KB | composto (IIFE) | Atributos {.classe} em blocos e imagens | `537bdecd03bae770…` |
| markdown-it-container | 4.0.0 | MIT | `markdown-it-container.min.js` | `markdownitContainer` | 1,6 KB | `dist/markdown-it-container.min.js` | Contêineres ::: colunas, notas, fragmento | `5bda29f8cc0e613e…` |
| dompurify | 3.4.16 | (MPL-2.0 OR Apache-2.0) | `purify.min.js` | `DOMPurify` | 28,2 KB | `dist/purify.min.js` | Sanitização de HTML e SVG | `2c90a9b46d6463f2…` |
| js-yaml | 5.4.2 | MIT | `js-yaml.min.js` | `jsyaml` | 60,4 KB | `dist/browser/js-yaml.umd.min.js` | Front-matter YAML | `774fe80200676359…` |
| papaparse | 5.7.0 | MIT | `papaparse.min.js` | `Papa` | 18,4 KB | `papaparse.min.js` | Leitura de CSV | `4d5d2d6e3282b66a…` |
| chart.js | 4.5.1 | MIT | `chart.umd.min.js` | `Chart` | 203,6 KB | `dist/chart.umd.min.js` | Gráficos dinâmicos | `48444a82d4edcb5b…` |
| @highlightjs/cdn-assets | 11.12.0 | BSD-3-Clause | `highlight.min.js` | `hljs` | 55,6 KB | composto (IIFE) | Realce de código (js, python, sql, bash, json, html, css) | `4b532fa95164106d…` |
| qrcode-generator | 2.0.4 | MIT | `qrcode.js` | `qrcode` | 55,4 KB | `dist/qrcode.js` | QR code local do layout de encerramento | `79ec86f82856005b…` |

## Fontes (IBM Plex, via @fontsource 5.3.0, licença OFL-1.1, subconjunto latin)

| Família | Peso | Estilo | Arquivo | Tamanho | SHA-256 |
|---|---|---|---|---|---|
| IBM Plex Sans | 400 | normal | `ibm-plex-sans-latin-400-normal.woff2` | 22,1 KB | `3b646991d30055a9…` |
| IBM Plex Sans | 400 | italic | `ibm-plex-sans-latin-400-italic.woff2` | 23,8 KB | `6de912e531b6c980…` |
| IBM Plex Sans | 600 | normal | `ibm-plex-sans-latin-600-normal.woff2` | 23,7 KB | `8960851d691c054e…` |
| IBM Plex Serif | 400 | normal | `ibm-plex-serif-latin-400-normal.woff2` | 19,1 KB | `cb2c5eee2c0a43ff…` |
| IBM Plex Serif | 400 | italic | `ibm-plex-serif-latin-400-italic.woff2` | 20,4 KB | `d3f861b1ca55e50c…` |
| IBM Plex Serif | 600 | normal | `ibm-plex-serif-latin-600-normal.woff2` | 20 KB | `e279e4f8baa0d463…` |
| IBM Plex Mono | 400 | normal | `ibm-plex-mono-latin-400-normal.woff2` | 14,4 KB | `08949f728dc52d52…` |
| IBM Plex Mono | 600 | normal | `ibm-plex-mono-latin-600-normal.woff2` | 15,3 KB | `0d1f0b8d0722224e…` |

## Módulos sob demanda (somente com rede; nunca exigidos pela apresentação exportada)

| Biblioteca | Licença | Origem prevista | Uso |
|---|---|---|---|
| SheetJS Community Edition | Apache-2.0 | cdn.sheetjs.com (distribuição oficial; a versão do npm está defasada) | Importação de .xlsx |
| KaTeX | MIT | cdn.jsdelivr.net/npm/katex | Fórmulas, exportadas como MathML estático |
| Mermaid | MIT | cdn.jsdelivr.net/npm/mermaid | Diagramas, exportados como SVG estático |

As versões exatas dos módulos sob demanda são fixadas em `js/nucleo/config.js`.
