# CLAUDE.md — Convenções do Apresenta

Estas regras valem para toda sessão de trabalho neste repositório. Em caso de dúvida,
elas prevalecem sobre qualquer preferência momentânea. A especificação completa está
em `docs/especificacao.md` (cópia do prompt original) e as decisões aprovadas estão na seção 5.

## 1. Modo de trabalho

1. **Planejar antes de implementar.** Mudanças não triviais exigem apresentar o entendimento da alteração e aguardar confirmação.
2. **Entregar arquivos completos**, nunca trechos soltos para colar.
3. **Validar antes de concluir cada etapa:** `node tools/verificar.mjs` precisa terminar sem erros.
4. **Identificadores estáveis.** Quando só um rótulo mudar, altere o mapa em `js/nucleo/rotulos.js` (ex.: `ROTULO_LAYOUT`, `rotuloLayout(chave)`), nunca o identificador.
5. **Arquivos gerados nunca são editados à mão:** `vendor/`, `embutiveis/`, `sw-recursos.js`, `vendor/VERSOES.md`, `dist/`. Regere-os com as ferramentas de `tools/`.
6. **Novo `.js`** exige, na mesma alteração, a linha `<script defer>` no `index.html`, na posição correta (§3), e sua descrição no inventário do manual técnico.
7. **Manuais sempre atualizados:** toda alteração de comportamento ou estrutura atualiza, na mesma entrega, `docs/manual-tecnico.md` (arquitetura, módulos, APIs, procedimentos) e `docs/manual-operacional.md` (uso, sintaxe, telas). O `verificar.mjs` reprova módulo não descrito no manual técnico.

8. **Situação e próximos passos:** etapas 1 a 9 concluídas (8 = PWA e publicação no Pages por GitHub Actions; 9 = edições portáteis e *release*). Planos aprovados e ainda não executados ficam em `docs/planos/` — leia-os antes de começar (`etapas-8-9.md` está executado e fica como registro). Próximos: 6-B (importação de documentos, D18) e 10 (serviços externos e publicação da Biblioteca no GitHub, D34), ambos ainda sem plano aprovado.
9. **Idioma e fluxo com o autor:** português do Brasil; apresentar plano e aguardar aprovação antes de cada etapa; um commit verificado por passo, com push; relatar ao final de cada etapa.

## 2. Restrições impostas pelo `file://` (inegociáveis)

A aplicação abre por duplo clique no `index.html`, sem servidor e sem build.

1. **Proibido** `<script type="module">`, `import` e `export`. Use scripts clássicos com `defer`.
2. **Namespace global único** `window.Oratoria`, criado por `js/nucleo/namespace.js` (primeiro script), com os subespaços `config`, `estado`, `temas`, `layouts`, `embutiveis`, `servicos`, `ui`.
   Todo arquivo seguinte é um IIFE: `(function (O) { 'use strict'; … })(window.Oratoria);` — nada fica no nível superior.
3. **Proibido `fetch` e `XMLHttpRequest`** em `js/` e `temas/`. Configurações, temas e dados são `.js` que se registram (`Oratoria.temas.registrar({...})`), nunca `.json`. Única exceção: `js/servicos/`, que acessa APIs remotas.
4. **CSS da exportação vive em JavaScript** (layouts em *template literal*; temas como objetos de variáveis). Só o CSS exclusivo do editor fica em `css/*.css`.
5. **Funções autossuficientes** (`motorSlides`, `motorGraficos`, `motorPdf`) não referenciam nada externo além dos globais permitidos em `tools/verificar.mjs`; são reinjetadas via `toString()` na exportação.
6. **Recursos locais sob demanda:** injeção dinâmica de `<script src>` por `js/nucleo/carregador.js` (uma promessa por recurso).
7. **Sem Web Workers de arquivo.** O `sw.js` é registrado somente quando `location.protocol === 'https:'`.

## 3. Ordem de carregamento no `index.html` (todos com `defer`)

1. `vendor/*` → 2. `js/nucleo/*` (`namespace.js`, depois `config.js`) → 3. `js/slides/*` → 4. `temas/*` →
5. `js/conteudo/*` → 6. `js/exportacao/*` → 7. `js/servicos/*` → 8. `js/interface/*` (`app.js` por último).

`embutiveis/*` **não** são carregados na abertura. Um tema novo exige apenas `temas/<id>.js` e sua linha `<script>`.

## 4. Interface e estilo

- **Pilha:** JavaScript vanilla ES2020+, sem frameworks, sem TypeScript; CSS puro com variáveis.
- **Vocabulário elegante e culto** em português do Brasil ("Compor", "Pré-visualizar", "Conferir", "Exportar", "Acervo de imagens", "Paleta"); sem jargão técnico na interface.
- **Tooltips obrigatórias** em todo botão, controle e indicador calculado, pelo componente próprio `data-dica` (teclado + `aria-describedby`), nunca só `title`. Botões: função e consequência. Indicadores: fórmula.
- **Visual:** paleta discreta; abas, cards e blocos diferenciados por cor (faixa lateral de 3 px + fundo em baixa opacidade); tema claro/escuro da interface; cantos de 8–10 px; glassmorfismo sutil; IBM Plex Sans/Serif/Mono.
- **Tokens separados (D12):** interface usa `--i-*`; slides usam `--s-*`.
- **Gráficos** sempre dinâmicos (Chart.js), com seletor de tipo.
- **Formulários:** largura proporcional ao dado; validação de caracteres em tempo real; foco automático no primeiro campo de cada painel.
- **Acessibilidade:** contraste WCAG AA; `:focus-visible` na cor de acento; `prefers-reduced-motion` respeitado.

## 5. Decisões aprovadas

- **D1** Realce de código pré-renderizado na exportação; não há embutível do highlight.js.
- **D2** KaTeX renderizado como MathML (`output: 'mathml'`).
- **D3** Mermaid com `htmlLabels: false` (SVG puro).
- **D4** CSP do deck exportado: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:`.
- **D5** `acorn` e `acorn-walk` como devDependencies exclusivas de `tools/`.
- **D6** Lista de cache do service worker gerada em `sw-recursos.js` por `gerar-embutiveis.mjs`; `verificar.mjs` apenas confere.
- **D7** `---` isolado fora de blocos de código é sempre separador de slides (títulos *setext* não suportados).
- **D8** Piso tipográfico de tabela por tema: `--s-tabela-fonte-minima` (18 px padrão; 22 px no Nanquim).
- **D9** Cliques em botões, links, seletores e legendas não avançam o slide.
- **D10** Modo apresentador em `#apresentador/N`; `BroadcastChannel` com recuo para `postMessage` via `opener`.
- **D11** markdown-it com `html: true` e todo HTML resultante sanitizado pelo DOMPurify.
- **D12** Tokens `--i-*` (interface) e `--s-*` (slides).
- **D13** Na edição portátil, as `@font-face` são geradas a partir do embutível de fontes (sem duplicação).
- **PDF direto** (além da impressão): rasterização por SVG `foreignObject` → canvas → JPEG, escritor de PDF próprio, camada de texto invisível pesquisável. Disponível no editor **e nas apresentações exportadas** (`motorPdf`, autossuficiente).
- **Biblioteca** (aba própria, cor `#9b8ab8` / `#5e4f7a`): no navegador (IndexedDB), em pasta local (File System Access, com `indice.html` gerado; recuo para downloads no Firefox) e publicação no GitHub num repositório separado (`oratoria-acervo`) via API, com token *fine-grained* guardado só no IndexedDB. A publicação no GitHub fica para a etapa 10 (D34).
- **Atributos de tabela:** o interpretador aceita `{.classe}` na linha imediatamente seguinte à tabela, inserindo a linha em branco que o markdown-it-attrs exige.
- **Fontes:** além dos pesos 400/600, incluídos os itálicos 400 de Plex Sans (ênfase) e Plex Serif (citações).
- **D14** Primeiro slide vazio preservado como slide de título do front-matter.
- **D15** Marcadores de contêiner aninhados (`::: colunas` / `::: coluna`) reescritos automaticamente conforme a profundidade.
- **D16** `::: fragmento` com uma única lista revela item a item; outro conteúdo, o bloco inteiro.
- **D17** Montagem dos slides em `js/slides/composicao.js`, com preparo estrutural declarado por layout (`O.layouts.registrar({ id, css, preparar })`).
- **D18 Importação de documentos** (especificação §16): PDF, DOC, DOCX, ODT, XLS e XLSX convertidos em Markdown no próprio navegador, sem rede. Bibliotecas carregadas sob demanda (mammoth, Turndown, pdf.js, SheetJS); leitores próprios de ZIP e CFB para ODT e DOC. Implementação na etapa 6-B.
- **D19** Temas dispensados do inventário do manual técnico: um tema novo exige só o arquivo e sua linha `<script>` (e a regeneração de `sw-recursos.js`, arquivo gerado).
- **D20** Gráficos com `responsive: false` no tamanho de layout; alternáveis por padrão; barras partem do zero, linhas ajustam o eixo.
- **D21** Continuações de tabela paginada levam só o título e a tabela.
- **D22** Exemplos oferecidos na aplicação pelo embutível `exemplos.js`.
- **D23** (revisa D10) Modo apresentador em janela `about:blank` de mesma origem, montada e atualizada pela janela principal; funciona em `file://` e `https`, no editor e no exportado.
- **D24** Cliques sobre gráficos não avançam o slide.
- **Encadeamento** do projeto aos slides em `js/slides/renderizador.js` (`O.slides.renderizar`, `O.slides.apresentar`).
- **Controles indisponíveis** usam `aria-disabled="true"` + `data-dica-motivo` (via `O.ui.dicas.indisponivel`), nunca `disabled`, para que a dica explique o motivo.
- **D25** O cabeçalho do texto (front-matter) é a fonte de verdade: tema, proporção, rodapé, numeração, logotipo e transição escolhidos na interface são gravados nele (`O.conteudo.definirMeta`); acento, grade e escala ficam em `projeto.ajustesTema`. `projeto.temaId` apenas espelha `meta.tema`.
- **D26** Renderização em duas velocidades: pré-visualização do slide sob o cursor após 300 ms; renderização completa (paginação, miniaturas, indicadores, Conferência) após 1 s de inatividade.
- **D27** Reordenar slides (miniaturas) move blocos de texto; o front-matter e o slide 0 (título) ficam fixos; separadores normalizados como `---`; desfazível com Ctrl+Z.
- **D28** O indicador de tamanho usa o tamanho real dos embutíveis (fontes das famílias do tema, Chart.js se houver gráfico), lidos em segundo plano; até lá mostra "≈".
- **D29** Guarda automática ativa desde a etapa 6. O rascunho encontrado na abertura é copiado para `rascunho/anterior` antes de a nova sessão gravar, e o convite "Retomar" o restaura.
- **D30** Edições feitas pela interface passam por `document.execCommand('insertText')` para preservar o desfazer do navegador; ações irreversíveis (novo projeto, remover do acervo) usam confirmação em dois toques (`O.ui.doisToques`), sem janelas modais.
- **D31** Nome da aplicação: **Apresenta** (`APP_NOME`). Identificadores estáveis mantidos: `window.Oratoria`, `APP_SLUG = 'oratoria'`, banco `oratoria`, `.oratoria.json`, arquivos `oratoria-*`.
- **D33** Exportação do texto em `.md` e em pacote `.zip` (texto + acervo, nomes preservados), com gerador de ZIP próprio (`js/exportacao/zip.js`, método *store*, nomes UTF-8).
- **D34** Publicação da Biblioteca no GitHub adiada para a etapa 10, com os serviços externos (rede só em `js/servicos/`).
- **D35** Projeto `.oratoria.json` aberto (botão ou arraste) com confirmação numa faixa quando há trabalho em andamento; o trabalho substituído vai para `rascunho/anterior`. A importação trata o arquivo como não confiável: valida estrutura e tamanhos (`PROJETO_LIMITE_BYTES`), aceita só data URLs de imagem do acervo, sanitiza de novo todo SVG e neutraliza nomes com caminho.
- **D36** Na impressão e no PDF, gráficos são convertidos em imagem antes da rasterização (canvas não aparece em SVG `foreignObject`).
- **D37** O indicador de tamanho segue estimado; após cada exportação, o aviso mostra o tamanho real e a estimativa.
- **D38** Navegadores suportados: Chrome, Edge, Firefox e derivados (Chromium e Gecko). O Safari fica fora do escopo: nenhum recuo ou ajuste específico é mantido para ele.
- **D39** Ícones PNG do aplicativo rasterizados pelo navegador instalado (`tools/icones.mjs`, Edge/Chrome headless), sem dependência de imagem; versionados.
- **D40** O service worker guarda só os arquivos da aplicação (núcleo: cache primeiro; `MODULOS_REDE`: rede primeiro); nada do trabalho do usuário. Registro só em `https:` (testes: `?dev&sw` em localhost).
- **D41** A edição portátil deriva do mesmo `index.html` por `tools/empacotar.mjs` (`C.EDICAO = 'portatil'`, sem exemplos); nada editado à mão.
- **D42** *Release* só a partir de tag `v*` criada pelo autor; nunca criar tags ou releases sem pedido.
- **D32** Cada `<section>` montada leva `data-origem` (índice do slide no texto), preservado nas continuações de tabela: liga miniaturas, pré-visualização e apresentação ao editor.

## 6. Recursos de terceiros

Somente bibliotecas gratuitas e de código aberto, com versão fixada em `package.json`, origem, licença e hash em `vendor/VERSOES.md` e texto integral das licenças em `vendor/licencas/`. Atualizar: `npm install <pacote>@<versão> --save-exact`, depois `npm run preparar`.

## 7. Ferramentas

| Comando | Efeito |
|---|---|
| `npm ci` | Instala as dependências de desenvolvimento fixadas |
| `node tools/vendor.mjs` | Copia bibliotecas e fontes; atualiza `VERSOES.md` |
| `node tools/gerar-embutiveis.mjs` | Gera `embutiveis/*` e `sw-recursos.js` |
| `node tools/verificar.mjs` | Valida o repositório (obrigatório ao fim de cada etapa) |
| `node tools/empacotar.mjs` | Gera `dist/oratoria-pasta.zip`, `dist/oratoria-portatil.html` e `dist/manual-operacional.html` |
| `node tools/icones.mjs` | Rasteriza `assets/icones/icone.svg` nos PNG do manifest |

Publicação: push na `main` → workflow *Verificar* → *Publicar* (GitHub Pages em modo Actions). *Release*: tag `v*` → `release.yml`.
