# Plano aprovado — Etapas 8 e 9 (PWA, publicação e edições portáteis)

> Aprovado em 28/09/2026. Executar numa única rodada, um commit verificado por passo
> (`node tools/verificar.mjs` + manuais atualizados + push), e relatar ao final.
> Etapas 1 a 7 concluídas (último commit da etapa 7: `80e198b`).

## Respostas do autor

1. "7 e 8 numa rodada só" = **Etapas 8 e 9** da especificação (§13). Confirmado.
2. **Autorizado** mudar o GitHub Pages do modo antigo (branch `main`, raiz) para o modo
   **"GitHub Actions"** (`gh api -X PUT repos/marceloclr/apresenta/pages -f build_type=workflow`).
   Hoje: `https://marceloclr.github.io/apresenta/`, `build_type: legacy`.
3. A edição portátil **não** inclui os exemplos (`embutiveis/exemplos.js` fica de fora; a aba
   Composição deve mostrar a lista de exemplos como indisponível, com dica explicando).

## Etapa 8 — PWA e publicação

| Arquivo | Conteúdo |
|---|---|
| `assets/icones/` | `icone.svg` (símbolo da barra sobre a cor de acento), PNG 192, 512 e 512 *maskable*, gerados por `tools/icones.mjs` rasterizando o SVG com o Edge/Chrome instalado em modo headless (D39); resultado versionado |
| `manifest.webmanifest` | nome "Apresenta", `display: standalone`, `lang: pt-BR`, cores do tema escuro da interface, ícones |
| `sw.js` | `importScripts('sw-recursos.js')`; *cache-first* para o núcleo, *network-first* para `MODULOS_REDE`; nova versão ativa na recarga seguinte, com aviso "Nova versão disponível" na interface; remove caches antigos; não guarda dados do usuário (D40) |
| `index.html`, `app.js` | `<link rel="manifest">`, ícones; registro do SW **somente** em `https:`; Condições do ambiente: "Instalado como aplicativo", "Disponível sem internet" |
| `.github/workflows/verificar.yml` | push e PR: checkout, Node LTS, `npm ci`, `node tools/verificar.mjs` |
| `.github/workflows/publicar.yml` | `main`, após verificar: artefato do Pages sem `tools/`, `.github/`, `node_modules/`, `dist/`, `package*.json`; `actions/deploy-pages` |

Obs.: `tools/gerar-embutiveis.mjs` já gera `sw-recursos.js` (lista e nome do cache, D6); incluir
manifest e ícones na lista.

## Etapa 9 — Edições portáteis

| Arquivo | Conteúdo |
|---|---|
| `tools/empacotar.mjs` | `dist/oratoria-pasta.zip` (raiz sem `tools/`, `.github/`, `node_modules/`, `dist/`, `package*.json`, `docs/planos/`; `zlib` nativo, deflate) e `dist/oratoria-portatil.html` (arquivo único a partir do `index.html`: `<link>` e `<script src>` inline na mesma ordem, `url()` de fontes e ícones em data URL — ou `@font-face` a partir do embutível de fontes (D13) —, embutíveis inline **exceto exemplos**, manifest e SW removidos, faixa "Edição portátil · vX.Y.Z"); ao final, `node --check` nos scripts extraídos e balanceamento de tags |
| `tools/lib/markdown-html.mjs` | manual operacional em HTML autocontido (markdown-it das devDependencies) → `dist/manual-operacional.html`, incluído no zip e oferecido no portátil |
| `.github/workflows/release.yml` | tag `v*`: `npm ci`, `node tools/empacotar.mjs`, anexa zip, portátil e manual à release (a tag só é criada pelo autor — D42) |
| `LEIA-ME.txt` | linguagem simples: extrair o zip antes de abrir; Chrome, Edge ou Firefox; pendrive; rascunhos ligados à pasta (usar `.oratoria.json`); recursos online opcionais |
| `README.md` | uso, sintaxe resumida, temas com recomendação ambiental, estrutura, publicação, distribuição (pendrive, zip, portátil), limitações do modo local, links para os manuais |
| `tools/verificar.mjs` | passa a exigir manifest, `sw.js`, ícones, README e LEIA-ME; confere ícones citados no manifest |

## Ordem

1. Ícones, manifest, `sw.js`, registro — testar por localhost (cache, offline, atualização).
2. Workflows; trocar o modo do Pages (autorizado); push; conferir o site publicado e a instalação.
3. `empacotar.mjs`, manual em HTML, `release.yml` — testar portátil e pasta extraída via `file://`
   (Edge e Firefox headless).
4. `LEIA-ME.txt`, `README.md`, verificação endurecida, manuais, `CLAUDE.md` (D39–D42).

## Decisões propostas e aceitas

- **D39** Ícones PNG rasterizados pelo navegador instalado (sem dependência de imagem), versionados.
- **D40** O service worker guarda só os arquivos da aplicação; nada do trabalho do usuário.
- **D41** O portátil deriva do mesmo `index.html` pelo empacotador; nada editado à mão.
- **D42** Release só a partir de tag criada pelo autor; nunca criar tags ou releases sem pedido.

## Riscos

- Portátil de ~1,6 MB sem os exemplos: aceitável para e-mail.
- Pages em subpasta (`/apresenta/`): conferir caminhos relativos no site publicado.
- Firefox não instala PWA no computador; testar só o funcionamento offline.
