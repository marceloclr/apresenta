# Apresenta — Manual técnico

> Destinado a quem mantém ou estende o sistema. Atualizado a cada etapa, na mesma alteração
> que muda o código (CLAUDE.md §1). Versão do documento: **0.1.0 · etapa 6**.
> Convenções obrigatórias: `CLAUDE.md`. Especificação: `docs/especificacao.md`.

## Sumário

1. Visão geral e restrições de projeto
2. Namespace e ordem de carregamento
3. Inventário de módulos
4. Fluxo de dados: do Markdown ao slide
5. Temas
6. Layouts
7. Blocos cercados especiais
8. Funções autossuficientes
9. Persistência, carregador e embutíveis
10. Interface: dicas, abas e tokens
11. Ferramentas de desenvolvimento
12. Empacotamento, publicação e *release*
13. Decisões de projeto
14. Limitações conhecidas
15. Procedimentos frequentes

---

## 1. Visão geral e restrições de projeto

O Apresenta é uma aplicação web estática, em JavaScript *vanilla*, sem etapa de *build*. A mesma pasta funciona de três modos:

| Modo | Protocolo | Particularidades |
|---|---|---|
| Publicada no GitHub Pages | `https:` | PWA instalável; service worker ativo |
| Pasta local, pendrive ou zip extraído | `file:` | abre por duplo clique; sem service worker |
| Edição portátil (arquivo único) | `file:` | tudo embutido num `.html`; sem manifest nem service worker |

O modo `file://` impõe as restrições que moldam toda a arquitetura:

| Restrição do navegador em `file://` | Consequência de projeto |
|---|---|
| Módulos ES (`type="module"`) bloqueados por CORS | Scripts clássicos com `defer`, namespace global único |
| `fetch`/`XMLHttpRequest` a arquivos locais bloqueados | Dados e temas são `.js` que se registram; embutíveis em forma de string |
| Conteúdo de folhas `.css` externas ilegível por script | CSS da exportação vive em JavaScript (`estilos-base.js`, `temas-css.js`) |
| Service worker indisponível | Registrado somente em `https:` |
| IndexedDB vinculado à origem de abertura | Rascunhos não acompanham a pasta movida; transporte por `.oratoria.json` |

Injetar `<script src>` dinamicamente **funciona** em `file://`; é o mecanismo do carregador sob demanda.

## 2. Namespace e ordem de carregamento

`js/nucleo/namespace.js` cria `window.Oratoria` (abreviado `O` nos IIFEs):

| Subespaço | Conteúdo |
|---|---|
| `O.config` | Constantes e parâmetros (`config.js`) |
| `O.rotulos` | Mapas de rótulos e funções `rotuloX(chave)` |
| `O.util` | Utilidades puras |
| `O.estado` | Estado central, observadores e eventos |
| `O.persistencia` | IndexedDB com recuo para memória |
| `O.carregador` | Carregamento sob demanda |
| `O.slides` | CSS dos slides, montagem, motor e apresentador |
| `O.layouts` | Registro de layouts |
| `O.temas` | Registro de temas, geração de CSS e contraste |
| `O.conteudo` | Interpretador, blocos, tabelas, gráficos, imagens |
| `O.exportacao` | HTML, projeto, PDF, Markdown, impressão |
| `O.servicos` | Serviços externos opcionais |
| `O.embutiveis` | Recursos em forma de string (carregados sob demanda) |
| `O.ui` | Componentes de interface |

Ordem no `index.html` (todos com `defer`, que preserva a ordem de execução):

1. `vendor/*` — bibliotecas de terceiros, expõem globais (`markdownit`, `DOMPurify`…).
2. `js/nucleo/*` — `namespace.js` primeiro, `config.js` em seguida; os demais dependem de ambos.
3. `js/slides/*` — `estilos-base.js` (registro de layouts), `temas-css.js` (define `O.temas.registrar`), `composicao.js`.
4. `temas/*` — cada arquivo chama `O.temas.registrar`, já definido.
5. `js/conteudo/*` — depende de layouts e temas registrados.
6. `js/exportacao/*`, 7. `js/servicos/*`.
8. `js/interface/*` — `app.js` por último: orquestra tudo, com o DOM já analisado.

`embutiveis/*` não são carregados na abertura.

## 3. Inventário de módulos

> `tools/verificar.mjs` exige que todo `.js` de `js/` e `temas/` apareça nesta seção.

### 3.1 Núcleo

**`js/nucleo/namespace.js`** — cria `window.Oratoria` e seus subespaços; idempotente (preserva o objeto se já existir, como na edição portátil).

**`js/nucleo/config.js`** — `APP_NOME`, `APP_SLUG`, `VERSAO` (conferida contra `package.json`), proporções e margens de referência, pisos tipográficos, atrasos (prévia 300 ms, autossalvamento 2 s, dica 350 ms), fator de minutos por slide, parâmetros de imagem e PDF, nome do banco, módulos de rede com versões fixadas (`MODULOS_REDE`), URL da sonda de rede, caminhos dos embutíveis e `DESENVOLVIMENTO` (ativo com `?dev` ou em `localhost`).

**`js/nucleo/rotulos.js`** — mapas `ROTULO_LAYOUT`, `ROTULO_ABA`, `ROTULO_AMBIENTE`, `ROTULO_TRANSICAO`, `ROTULO_GRAFICO`, `ROTULO_PROPORCAO`, `ROTULO_TEMA_INTERFACE`, `ROTULO_GRAVIDADE`, `ROTULO_PERSISTENCIA`; `rotulo(mapa, chave)` e atalhos (`rotuloLayout`, `rotuloAba`…). Regra: muda-se o rótulo, nunca a chave.

**`js/nucleo/utilidades.js`** (`O.util`)
- Tempo: `debounce(fn, ms)` (com `.cancelar()` e `.agora()`), `throttle`, `esperar`, `comTempoLimite(promessa, ms)`.
- Formatação pt-BR: `formatarNumero`, `formatarDecimal`, `formatarMoeda`, `formatarPercentual`, `formatarBytes`, `formatarDuracao`, `formatarData`, `formatarDataHora`, `dataIso`; `lerNumero(texto)` aceita "1.234,56", "1234.56", "R$ 10", "12%".
- Texto: `removerAcentos`, `normalizarNome` (nome de arquivo), `escaparHtml`, `gerarId`.
- DOM: `el(tag, atributos, ...filhos)`, `$`, `$$`, `focalizaveis`, `focarPrimeiroCampo(painel)`.
- Arquivos: `baixar(conteudo, nome, tipo)`, `lerTexto`, `lerDataUrl`, `lerBinario`, `bytesDeDataUrl`, `extensao`, `nomeBase`.
- Cor e contraste WCAG: `lerCor`, `corHex`, `comporCor`, `luminancia`, `razaoContraste(texto, fundo)`, `MINIMO_AA`, `atendeAA`, `ajustarContraste(cor, fundo, alvo)` (preserva matiz e saturação, ajusta a luminosidade), `formatarRazao`.

**`js/nucleo/estado.js`** (`O.estado`) — árvore `{ projeto, interface, ambiente }`; `obter(caminho)`, `definir(caminho, valor)`, `atualizar(caminho, fn)`, `observar(caminho, fn)` (avisa mudanças no caminho, ancestrais e descendentes), `carregarProjeto`, `instantaneo` (cópia profunda), `reiniciar`; barramento `ouvir(evento, fn)` / `emitir(evento, dados)`. Eventos em uso: `aba:ativada`, `temas:registrado`, `carregador:progresso`, `persistencia:salvo`, `persistencia:falha`.

**`js/nucleo/persistencia.js`** (`O.persistencia`) — ver §9.1.

**`js/nucleo/carregador.js`** (`O.carregador`) — ver §9.2.

### 3.2 Slides

**`js/slides/estilos-base.js`** — CSS base dos slides em *template literal* (tipografia, listas, código com cores `hljs` derivadas do tema, imagens, tabelas e classes, contêineres, fragmentos, rodapé, grade de fundo e vinheta) e registro dos nove layouts (§6). API: `O.layouts.registrar/obter/existe/lista`; `O.slides.cssSlides()` (CSS base + layouts) e `O.slides.dimensoes(proporcao)`.

**`js/slides/temas-css.js`** — registro de temas e conversão em CSS (§5). API: `O.temas.registrar(tema)`, `obter`, `existe`, `lista`, `aplicarAjustes(id, ajustes)`, `gerarCss(id, ajustes)`, `familiasUsadas(id)`, `relatorioContraste(id, ajustes)`, `relatarContrastes()`, constantes `VARIAVEIS_OBRIGATORIAS` e `PARES_CONTRASTE`.

**`js/slides/motor.js`** — `O.slides.motorSlides(raiz, opcoes)`, função autossuficiente (§8), o runtime único das apresentações no editor e nos arquivos exportados. Envolve as `<section class="o-slide">` num palco escalado por `transform: scale()` (letterbox em `--s-fundo`, `ResizeObserver`) e injeta uma única vez seus estilos (`#o-motor-estilos`). Opções: `largura`, `altura`, `indice`, `hash` (sincroniza `#/N`, 1-based), `transicao`, `titulo`, `apresentador` (função), `graficos` (função), `aoMudar(indice, passo)`, `sair()`, `tecladoGlobal`. Recursos: navegação (→ ↓ espaço PageDown Enter; ← ↑ PageUp Backspace; Home/End), fragmentos (avançar revela o próximo; voltar recolhe; voltar de outro slide o mostra completo), transições `suave`/`deslizar`/`nenhuma` por animação CSS, barra de progresso, cortina (**B** ou `.`), **G** + número, visão geral (**O**; miniaturas clonadas, com gráficos convertidos em imagem; setas movem o foco por linha e coluna), tela cheia (**F**), modo apresentador (**P**), gestos de deslizar, barra de controles que surge ao mover o mouse, região viva que anuncia "Slide N de M: título". Cliques em links, botões, campos e gráficos não avançam (D9). Devolve `{ ir, avancar, voltar, atual, passo, total, visaoGeral, escurecer, telaCheia, abrirApresentador, escalar, destruir }`.

**`js/slides/apresentador.js`** — `O.slides.motorApresentador(ctx)`, função autossuficiente chamada pelo motor. Abre uma janela vazia (`about:blank`, mesma origem) e monta nela: título, contador, tempo decorrido, horário, botões (anterior, próximo, escurecer, zerar cronômetro), o slide em exibição (fragmentos ainda ocultos aparecem esmaecidos), o seguinte e as notas do orador (`aside.o-notas` do slide). Copia as folhas de estilo da janela principal. Teclas na janela do apresentador comandam a apresentação. Devolve `{ atualizar, fechar, fechado, focar }`, ou `null` se o navegador bloquear a janela (o motor anuncia o bloqueio). Decisão D23.

**`js/slides/renderizador.js`** — encadeamento completo. `O.slides.renderizar(projeto, { paginar })` → `{ meta, resultado, secoes, css, paginacao, avisos }`: interpreta, gera o CSS (slides + tema com `ajustesTema`), espera as fontes, monta e pagina as tabelas no hospedeiro de medição; acrescenta avisos `tabela-dividida` e `tabela-reduzida`. `O.slides.apresentar(projeto, { indice, telaCheia, aoMudar })` apresenta numa sobreposição de tela inteira no editor (Esc encerra e devolve o foco), emitindo `apresentacao:iniciada` e `apresentacao:encerrada`. `O.slides.assinaturaAcervo(acervo)` invalida o cache do interpretador quando o acervo muda.

**`js/slides/graficos-runtime.js`** — `O.slides.motorGraficos(raiz, { animar })`, função autossuficiente (§8) que desenha as figuras `figure.o-grafico` com Chart.js, lendo cores, grade, eixos e fonte das variáveis `--s-*` do tema; cria o seletor de tipo (Barras, Linhas, Pizza, Rosca) quando `alternavel`; respeita `prefers-reduced-motion`; sem Chart.js, mostra a tabela de dados. Desenha com `responsive: false` no tamanho de layout do contêiner (a escala por `transform` falsearia a medição responsiva); figuras de tamanho zero ficam pendentes para o próximo `atualizar()`. Devolve `{ atualizar, destruir }`.

**`js/slides/composicao.js`** — monta o `<section class="o-slide">` de cada slide: layout e seu preparo estrutural, fundo por diretiva, classes, rodapé (texto, logotipo, numeração "N / M"; ausente no slide de título) e atributos de acessibilidade (`aria-roledescription="slide"`, `aria-label="Slide N de M"`) e `data-origem` (índice do slide no texto, preservado nas continuações; D32). API: `O.slides.montarSlide(slide, ctx)`, `montarTodos(resultado, opcoes)`, `resolvedorDoAcervo(acervo)` (imagens: caminho exato e, na falta, nome do arquivo sem distinguir maiúsculas), `renumerar(secoes)` (índices, rótulos acessíveis e "N / M" após paginação ou reordenação) e `hospedeDeMedicao(css, temaId, proporcao)` (palco fora da tela, na resolução de referência, para medir slides com o CSS real).

### 3.3 Conteúdo

**`js/conteudo/interpretador.js`** — ver §4. API: `O.conteudo.interpretar(markdown, opcoes)`, `extrairFrontMatter`, `separarSlides`, `contarSlides`, `lerDiretivas`, `preprocessar`, `lerEspecificacao`, `sanitizar`, `markdownIt()`, `slideDaLinha(resultado, linha)`, `limparCache()`, as edições estruturais puras `definirMeta(texto, chave, valor)` (grava ou remove uma chave do front-matter, criando-o se preciso; D25) e `reordenarSlides(texto, de, para)` → `{ texto, linha }` (D27), e o registro `O.conteudo.blocos.registrar(tipo, fn)`.

**`js/conteudo/tabelas.js`** — fontes de dados e tabelas.
- `O.conteudo.dados`: `lerCsv(texto)` (PapaParse, separador automático, BOM removido), `obter(referencia, resolverArquivo)` (CSV do acervo ou `arquivo.xlsx#Planilha`), `lista(v)`, `coluna(dados, nome)` (sem acentos nem maiúsculas), `selecionar(dados, { colunas, ordenar, limite })` (ordenação numérica quando ambos os valores são números; senão, alfabética pt-BR).
- Bloco ```` ```tabela ```` (`fonte`, `colunas`, `ordenar`, `limite`, `classes`).
- `O.conteudo.tabelas.htmlTabela(sel, classes, fonte)` e `paginar(secoes, palco)`: mede cada slide com tabela no palco de medição; se transbordar, reduz `--o-tabela-fonte` 1 px por vez até `--s-tabela-fonte-minima`; persistindo, divide as linhas em slides de continuação (cabeçalho repetido, "(continuação)" no título, somente título e tabela) e devolve `{ secoes, ocorrencias }` para a Conferência e para o indicador de slides. A tabela alternativa dos gráficos é ignorada.

**`js/conteudo/imagens.js`** (`O.conteudo.imagens`) — preparo de arquivos para o acervo (§5.4 da especificação). `processar(arquivo, { qualidade, ladoMaximo, nome })` → `{ tipo: 'imagem', nome, mime, dataUrl, bytes, bytesOriginais, largura, altura, decisao }`: reduz o lado maior a 1920 px, converte em WebP (sem suporte: JPEG, ou PNG se houver transparência), preserva o original quando a conversão não reduzir o peso e a imagem não precisar ser reduzida, preserva GIF (animação) e sanitiza SVG com o DOMPurify (perfil SVG, sem `script`, `foreignObject` e `style`). `decisao` explica, em português, o que foi feito. Também: `lerPlanilhaCsv(arquivo)`, `sanitizarSvg(texto)`, `ehImagem`, `ehCsv`, `extensaoDoMime`, `suportaWebp`.

**`js/conteudo/graficos.js`** — bloco ```` ```grafico ```` (`tipo`, `fonte` ou `dados` inline em CSV ou lista YAML, `rotulos`, `series`, `ordenar`, `limite`, `alternavel` — padrão sim —, `titulo`, `empilhado`). `O.conteudo.graficos.preparar(spec, ctx)` normaliza a especificação (séries padrão: colunas numéricas) e `html(g)` produz a figura estática: `data-grafico` com o JSON, `<canvas>` com rótulo acessível e tabela alternativa `.o-grafico-dados`.

### 3.4 Interface

**`js/interface/dicas.js`** — componente de dicas (§10.1). API: `O.ui.dicas.iniciar()`, `definir(el, { texto, titulo, formula, posicao })`, `indisponivel(el, motivo)`, `disponivel(el)`, `ocultar()`, `auditar(raiz)`.

**`js/interface/abas.js`** — abas de trabalho no padrão WAI-ARIA (§10.2). API: `O.ui.abas.iniciar(lista, abaInicial)`, `ativar(id, { focarCampo, focarAba })`, `atual()`.

**`js/interface/editor.js`** (`O.ui.editor`) — editor de Markdown: `<textarea>` com texto transparente sobre uma camada `<pre>` de realce, com as mesmas métricas (fonte, recuo, `pre-wrap`); a largura da barra de rolagem é compensada no `<pre>` e a rolagem é espelhada. Cada linha lógica é um bloco numerado por contador CSS, de modo que a numeração acompanha as quebras de linha. O realce usa só cor e estilo, nunca peso (que mudaria a largura dos caracteres). API: `texto()`, `aplicarTexto(novo, { preservarCursor })` (altera só o trecho diferente; com `preservarCursor`, o cursor e a rolagem ficam onde estavam), `substituir(inicio, fim, texto, { selecao, focarEditor })`, `inserirNoCursor(texto, { bloco, cursor })`, `inserirAposLinha(linha, texto)`, `irParaLinha(n, { focar })`, `linhaAtual`, `linhaDe`, `inicioDaLinha`, `fimDaLinha`, `linhas`, `marcarSlide(inicio, fim)`, `focar`, `elemento`. Toda alteração programática passa por `document.execCommand('insertText')`, que preserva o desfazer (Ctrl+Z); sem suporte, recorre a `setRangeText`. Espelha o texto em `projeto.markdown`; carregamentos externos chegam pelo observador. Emite `editor:cursor` `{ linha, coluna }`. Teclado: Tab recua, Shift+Tab desfaz o recuo, Esc seguido de Tab sai do editor.

**`js/interface/previa.js`** (`O.ui.previa`) — pré-visualização e renderização completa (D26). A velocidade rápida (300 ms) interpreta o texto e monta só o slide sob o cursor, escalado por `transform` ao palco, com fragmentos revelados (`.o-expandido`) e gráficos desenhados; a completa (1 s) chama `O.slides.renderizar` e emite `previa:completa`. Mantém o CSS dos slides em `<style id="estilos-slides">`, compartilhado com as miniaturas. API: `interpretacao()`, `completa()`, `slideAtual()`, `irParaSlide(i)`, `secaoDoSlide(origem)`, `contexto()`, `atualizarAgora()`. Eventos: `previa:interpretada`, `previa:slide`, `previa:completa`.

**`js/interface/miniaturas.js`** (`O.ui.miniaturas`) — faixa inferior de miniaturas, reconstruída a cada `previa:completa`: uma por seção (inclusive continuações, com borda tracejada), ligada ao texto por `data-origem` (D32). O clone escalado de cada slide só é inserido quando a miniatura se torna visível (`IntersectionObserver`); gráficos aparecem como moldura. Clique leva o cursor ao slide; setas, Home e End percorrem (tabulação itinerante); arraste (HTML5, tipo `application/x-apresenta-slide`) ou Alt+←/→ reordenam por `O.conteudo.reordenarSlides` (D27), com o foco acompanhando o slide movido. A roda do mouse rola a faixa na horizontal. API: `iniciar()`.

**`js/interface/ingestao.js`** (`O.ui.ingestao`) — entrada de arquivos: arrastar e soltar em toda a janela (inclusive pastas, lidas por `webkitGetAsEntry`), `<input multiple>`, `<input webkitdirectory>` e colagem de imagens no editor. `.md`, `.markdown` e `.txt` substituem o texto (desfazível); imagens e CSV vão ao acervo, preparados por `imagens.js`; documentos (§16) recebem aviso de que a conversão chega na etapa 6-B. Imagens soltas sobre o editor ou coladas são citadas no cursor. Guarda os arquivos originais só na memória da sessão (`original(nome)`), para recompressão. API: `processar(arquivos, { inserirReferencias })`, `escolherArquivos`, `escolherPasta`, `original`, `esquecerOriginal`. Eventos: `ingestao:progresso`, `ingestao:concluida`.

**`js/interface/acervo.js`** (`O.ui.acervo`) — aba Acervo: um cartão por arquivo (miniatura, dimensões ou colunas e linhas, peso no acervo e redução sobre o original, com a decisão de compressão na dica; selo "citado N×" calculado sobre o texto, com 500 ms de atraso; selo "pesada" acima de `IMAGEM_ALERTA_BYTES`), campo de texto alternativo validado em tempo real (sem colchetes nem quebras; até `TEXTO_ALTERNATIVO_MAXIMO`), inserção no cursor (imagem, tabela ou gráfico de CSV) e remoção em dois toques. A lista só é reconstruída quando a assinatura do acervo muda, para não tirar o foco do campo em edição. Filtro por nome; qualidade de compressão (`projeto.opcoes.qualidadeImagem`) e recompressão das imagens cujo original está na memória da sessão (`O.ui.ingestao.original`). API: `iniciar()`.

**`js/interface/editor-tabelas.js`** (`O.ui.tabelas`) — aba Tabelas, sincronizada com o cursor (250 ms). Funções puras: `localizar(texto, linha)` → `{ tipo: 'gfm' | 'bloco', inicio, fim, original, modelo | spec }` ou `null` (reconhece a linha `{.classes}` logo abaixo da tabela e blocos ```` ```tabela ````; ignora outros blocos cercados); `lerTabela(linhas)` → `{ cabecalho, alinhamentos, linhas, classes, extras }` (barras protegidas `\|` respeitadas; até 12 colunas); `escreverTabela(modelo)` (colunas alinhadas com espaços, separador com o alinhamento, atributos preservados). Interface: grade de células com alinhamento por coluna, acréscimo e retirada de linhas e colunas, classes (`zebra`, `compacta`, `numerica`, `destacar-linha-N`, `destacar-coluna-N`); formulário do bloco de dados (planilha, colunas, ordenação, limite, classes); fora de tabela, nova tabela ou tabela a partir de CSV do acervo (como bloco de dados ou como texto). "Converter em gráfico" insere um ```` ```grafico ```` após a tabela (dados inline em CSV, ou a mesma fonte). A edição fica presa à tabela escolhida enquanto houver alterações pendentes; "Gravar no texto" confere se o trecho original continua intacto antes de substituí-lo (desfazível).

**`js/interface/painel-tema.js`** (`O.ui.tema`) — aba Tema: modelos registrados como grupo de opções (nome, ambiente, amostras de cor, recomendação), gravados no front-matter por `definirMeta` com o cursor preservado (D25); ajustes finos em `projeto.ajustesTema` (acento com a nota de correção de contraste de `aplicarAjustes().correcoes`, grade ligada e intensidade de 0 a 150%, escala de 90 a 115%, "Restaurar padrão do modelo"); cabeçalho (proporção, transição, rodapé com gravação após 600 ms, numeração, logotipo do acervo); minutos por slide (`projeto.opcoes.minutosPorSlide`, validado entre `MINUTOS_POR_SLIDE_LIMITES`). A comparação monta o slide sob o cursor em cada tema, com o CSS de todos os temas em `<style id="estilos-comparacao">`; clicar aplica o tema. Os controles refletem o estado sem sobrescrever o campo em edição. API: `iniciar()`.

**`js/interface/conferencia.js`** (`O.ui.conferencia`) — aba Conferência, recalculada a cada `previa:completa`: advertências do interpretador e da paginação (os avisos de paginação, indexados pela seção, são levados ao slide de origem via `data-origem`), pares de contraste abaixo de AA (`O.temas.relatorioContraste` com os ajustes; código `contraste-insuficiente`), imagens acima de `IMAGEM_ALERTA_BYTES` (`imagem-pesada`) e arquivos do acervo não citados (`arquivo-nao-citado`). Ordena por gravidade e linha; cada item leva ao texto, ao acervo (filtrado) ou à aba Tema. Mantém um contador de impedimentos e advertências na aba (`.aba-contador`, refletido no `aria-label`) e a tabela "Contraste do tema". O cartão "Condições do ambiente" continua em `app.js`. API: `iniciar()`, `advertencias()`.

**`js/interface/painel-guia.js`** (`O.ui.guia`) — aba Guia, montada na primeira ativação: seções da sintaxe (cabeçalho, separação, diretivas, contêineres, colunas, imagens, tabelas, tabela de planilha, gráficos, código), cada uma com exemplo, "Copiar" (`navigator.clipboard`, com recuo para `execCommand('copy')`) e "Inserir no cursor" (o cabeçalho só é acrescentado se o texto ainda não tiver um); atalhos de apresentação; remissão ao manual operacional. API: `iniciar()`.

**`js/interface/painel-composicao.js`** (`O.ui.composicao`) — aba Composição: abrir arquivos ou pasta, novo projeto (confirmação em dois toques), exemplos (D22, lidos sob demanda do embutível) e blocos prontos. Os layouts entram como novo slide após o slide sob o cursor (`MODELOS_LAYOUT`); os blocos de conteúdo, no cursor (`BLOCOS`), com modelos que citam o primeiro arquivo adequado do acervo. API: `iniciar`, `novoProjeto`, `abrirExemplo(id)`.

**`js/interface/app.js`** — orquestração: identidade (nome e versão), tema da interface, validação do título do projeto, `O.ui.anunciar(texto)` (região viva), `O.ui.notificar(texto, { gravidade })` (avisos passageiros no canto da tela), `O.ui.doisToques(botao, pergunta, acao, { exigir })` (confirmação sem janela modal), indicadores da barra (§5.3), guarda automática e convite "Retomar" (D29), botões de apresentação (ao encerrar, o editor vai ao slide em que a apresentação parou), preferências salvas, painel "Condições do ambiente" e auditorias em modo de desenvolvimento. Inicializa os demais módulos da interface.

## 4. Fluxo de dados: do Markdown ao slide

```
Markdown ──► extrairFrontMatter ──► normalizarMeta ─────────────────────────┐
         └─► separarSlides ('---' fora de cercas) ──► por slide:            │
               lerDiretivas ──► preprocessar ──► markdown-it (+plugins,     │
               imagens, blocos) ──► DOMPurify ──► posProcessar (notas,      │
               fragmentos, tabelas numéricas)                               │
                                    │                                       ▼
                        resultado { meta, slides[], avisos[] }  ──►  montarTodos (composicao.js)
                                                                        │ layout.preparar
                                                                        ▼
                                          <section class="o-slide" data-layout …>
                          + CSS: O.slides.cssSlides() + O.temas.gerarCss(meta.tema, ajustes)
                          sob um contêiner com data-tema="<id>"
```

**Front-matter.** Bloco YAML entre `---` no início do texto (js-yaml). Chaves reconhecidas: `titulo`, `subtitulo`, `autor`, `data`, `tema`, `proporcao`, `rodape`, `numeracao`, `logotipo`, `transicao`, `idioma`. Datas YAML são formatadas por extenso em UTC (evita o deslocamento de fuso: 2026-10-05 não vira dia 4).

**Separação (D7).** Linha `---` isolada, fora de blocos cercados (``` ou ~~~, respeitando o comprimento da cerca), separa slides. Slides vazios no fim são descartados; **o primeiro slide vazio é preservado** e vira o slide de título montado do front-matter.

**Diretivas.** Comentários `<!-- chave: valor -->` no início do slide, um por linha ou vários separados por `;`. Válidas: `layout`, `fundo`, `classe`, `transicao`, `colunas` (ex.: `60/40`), `lado` (`esquerda`|`direita`, para `imagem-lateral`). Desconhecidas geram aviso.

**Pré-processamento.**
- Atributos de tabela na linha seguinte (`{.zebra}`): insere-se a linha em branco que o markdown-it-attrs exige.
- Contêineres aninhados com marcadores iguais: o markdown-it-container fecharia o externo no primeiro `:::`. Os marcadores externos são reescritos com `2 + altura` dois-pontos, de modo que o autor escreve como no §4.3 da especificação.

**markdown-it.** `html: true`, `linkify`, `typographer` com aspas “” ‘’; realce por highlight.js no próprio render (D1); plugins `markdown-it-attrs` (atributos permitidos: `id`, `class`, `width`, `height`, `title`, `lang`, `data-*`) e `markdown-it-container` (`colunas`, `coluna`, `fragmento`, `notas` → `<aside class="o-notas">`, `destaque`). Regras substituídas: `image` (resolução no acervo e avisos), `link_open` (externos em nova janela, `noopener noreferrer`), `fence` (blocos especiais, §7).

**Sanitização (D11).** DOMPurify com `canvas`, `figure` e `figcaption` adicionais; proíbe `style`, `script`, `iframe`, `object`, `embed`, formulários, `link`, `meta`, `base` e `srcset`; URIs pela regra padrão (data: apenas em mídia).

**Pós-processamento.** Notas extraídas para `slide.notas`; `::: fragmento` com uma única lista torna cada item um fragmento, caso contrário o bloco inteiro; tabelas `.numerica`: colunas inteiramente numéricas são formatadas em pt-BR (mantém `R$` e `%`, até 2 casas conforme o original) e recebem `.o-num` (alinhamento à direita).

**Cache.** O resultado de cada slide é memorizado pelo texto do slide (e se é o primeiro). Qualquer mudança no front-matter ou em `opcoes.assinatura` (que o chamador altera quando o acervo muda) limpa o cache.

**Avisos.** `{ gravidade, codigo, mensagem, slide, linha }`. Códigos atuais: `frontmatter-invalido`, `meta-desconhecida`, `tema-desconhecido`, `proporcao-invalida`, `diretiva-desconhecida`, `layout-desconhecido`, `transicao-invalida`, `alt-ausente`, `imagem-ausente`, `imagem-externa`, `bloco-invalido`, `bloco-indisponivel`, `bloco-falhou`, `interpretacao-falhou`, `titulo-ausente`.

## 5. Temas

Cada tema é um arquivo `temas/<id>.js`:

```js
(function (O) {
  'use strict';
  O.temas.registrar({
    id: 'aurora', nome: 'Aurora', ambiente: 'claro',
    descricao: '…', recomendacao: '…',
    fontes: { titulo: 'IBM Plex Sans', corpo: 'IBM Plex Sans', mono: 'IBM Plex Mono', pesoTitulo: 600, fatorTitulo: 1, espacamentoCorpo: 'normal' },
    variaveis: { '--s-fundo': '#f5f7fb', /* … */ },
    grade: { ativa: true, menor: 0.015, maior: 0.15, cruz: 0.01, intensidadeCor: '16%' },
    extras: '& .o-slide thead th { … }',   // opcional; & = [data-tema="aurora"]
  });
})(window.Oratoria);
```

**Composição das variáveis** (ordem de precedência crescente): complementares padrão (`--s-escala`, `--s-tabela-fonte-minima`, `--s-sobreposicao`, `--s-textura`, `--s-grade-exibir`) → derivadas das fontes (`--s-fonte-*`, `--s-peso-titulo`, `--s-fator-titulo`, `--s-espacamento-corpo`) → `variaveis` do tema. As cores da grade (`--s-grade-menor/maior/cruz`) são derivadas de `grade` quando o tema não as declara: a cor da tela é escurecida (tema claro) ou clareada (tema escuro) em `intensidadeCor`, e `menor`/`maior`/`cruz` são as opacidades dos traços.

**Validação.** `registrar` confere `VARIAVEIS_OBRIGATORIAS` (fundos, texto, bordas, acentos, estados, fontes, tabela, seis cores de gráfico, eixo e grade do gráfico, grade de fundo e vinheta) e acusa no console as ausentes.

**Ajustes finos** (`projeto.ajustesTema`, sem criar tema novo): `acento` (se o acento não atingir 4,5:1 como texto sobre fundo e superfície, `--s-acento-texto` recebe variante ajustada, registrada em `correcoes`), `grade.ativa`, `grade.intensidade` (0 a 1,5, multiplica as opacidades) e `escala` (0,9 a 1,15).

**Contraste.** `relatorioContraste(id, ajustes)` avalia os pares de `PARES_CONTRASTE` (texto e texto secundário sobre fundo e superfície, acento-texto, cabeçalho e zebra de tabela, estados, eixos e títulos como texto grande); cores translúcidas são compostas sobre o fundo. `relatarContrastes()` imprime uma tabela por tema no console.

**Um tema novo** exige apenas o arquivo e sua linha `<script defer>` no bloco "4. Temas" do `index.html`. Temas não precisam constar deste manual (descrevem-se no próprio objeto); a verificação só os lista como informação. O critério foi testado com um quinto tema.

### 5.1 Temas incluídos

| Arquivo | Ambiente | Particularidades (`extras` e variáveis) | Menor contraste de texto corrente |
|---|---|---|---|
| `temas/aurora.js` | claro, frio | Grade ativa (16%); aviso ajustado de `#a8621a` para `#a45f19` (4,42 → AA) | 4,63:1 |
| `temas/marfim.js` | claro, quente | Títulos e citações em Plex Serif; filete de latão sob o cabeçalho de tabela; textura de papel (`--s-textura`); grade desligada | 4,71:1 |
| `temas/grafite.js` | escuro, frio | Grade ativa (44%); cabeçalho de tabela em Mono maiúsculo na cor de acento, sem fundo; só filetes superiores entre linhas; `h3` e ordinais em Mono maiúsculo; faixa bicolor antes do título | 5,80:1 |
| `temas/nanquim.js` | escuro, quente | Títulos Serif 8% maiores; corpo com `letter-spacing: .005em`; cabeçalho de tabela em latão; piso de tabela 22 px; halo radial de latão no lugar da grade | 6,68:1 |

O fundo do slide é `--s-fundo`; com a grade ativa, `::before` pinta `--s-tela` e as linhas. Por isso o relatório de contraste também avalia texto, texto secundário e acento sobre a tela.

## 6. Layouts

Registrados em `estilos-base.js` com `{ id, css, preparar(secao, ctx) }`; no CSS, `&` vira `.o-slide[data-layout="id"]`. `ctx` = `{ meta, diretivas, ordinalSecao, indice, total }`.

| Layout | Preparo estrutural |
|---|---|
| `titulo` | Gera `h1` do front-matter se ausente; primeiro parágrafo vira subtítulo; acrescenta autor e data; sem rodapé |
| `secao` | Insere ordinal em Mono (`01`, `02`…, contado entre slides `secao`) |
| `conteudo` | — (padrão) |
| `duas-colunas` | Usa `::: colunas`; se ausente, divide os blocos após o título ao meio; aplica `colunas: 60/40` |
| `imagem-lateral` | Move a primeira imagem para `.o-midia` (45%); `lado: direita` inverte |
| `imagem-fundo` | Primeira imagem (ou diretiva `fundo`) vira `.o-fundo` em *cover*, com `--s-sobreposicao` |
| `citacao` | Autoria: último parágrafo da citação iniciado por travessão, ou parágrafo seguinte; versalete |
| `tabela` | Envolve a tabela em `.o-tabela-contentor` (área útil máxima) |
| `encerramento` | Centralizado; espaço para `.o-qr` |

Área de referência 1920×1080 (ou 1440×1080), margens de 96 px (laterais) e 80 px (vertical); corpo 32 px × escala (piso de 28 px); títulos 60–72 px × escala × fator do tema.

**Um layout novo** pode ser registrado em arquivo próprio em `js/slides/` (carregado após `estilos-base.js`) e acrescentado a `ROTULO_LAYOUT`.

## 7. Blocos cercados especiais

Blocos ```` ```tipo ```` cujo corpo é YAML (`chave: valor`). Tipos reservados: `tabela`, `grafico`, `diagrama`, `formula`. Registro:

```js
O.conteudo.blocos.registrar('tabela', function (spec, ctx) {
  // ctx: { resolverArquivo(nome), avisar(gravidade, codigo, mensagem), slide, meta }
  return '<table>…</table>'; // será sanitizado
});
```

Tipo reservado sem renderizador registrado produz aviso `bloco-indisponivel` e um marcador visível no slide. Renderizadores registrados: `tabela` (`tabelas.js`) e `grafico` (`graficos.js`). Previstos: `diagrama` e `formula` (módulos de rede, com exportação estática).

Avisos dos blocos: `csv-irregular`, `classe-tabela-desconhecida`, `grafico-tipo-invalido`, `grafico-valor-invalido`, `grafico-pizza-series`.

## 8. Funções autossuficientes

`motorSlides`, `motorApresentador`, `motorGraficos` e `motorPdf` (etapa 7) são reinjetadas via `toString()` na exportação; não podem referenciar nada além dos globais permitidos listados em `tools/verificar.mjs` (`GLOBAIS_PERMITIDOS`). Metas de tamanho: 25 KB, 14 KB, 12 KB e 20 KB (atuais: 20,3 KB, 8,6 KB e 6,5 KB).

Como se relacionam no arquivo exportado (etapa 7):

```js
var motorSlides = function motorSlides(raiz, opcoes) { … };
var motorApresentador = function motorApresentador(ctx) { … };
var motorGraficos = function motorGraficos(raiz, opcoes) { … };
motorSlides(document.getElementById('deck'), {
  largura: 1920, altura: 1080, hash: true, titulo: '…',
  apresentador: motorApresentador, graficos: motorGraficos,
});
```

As dependências entre elas são passadas como opções, nunca referenciadas por nome — é o que as mantém autossuficientes. Um teste desta etapa gerou um arquivo nesse formato com CSP `default-src 'none'`: abriu em `#/12`, desenhou os gráficos e não fez nenhuma requisição externa.

**Notas do orador.** `composicao.js` guarda as notas em `<aside class="o-notas" aria-hidden="true">` dentro de cada slide (ocultas pelo CSS base); o apresentador as lê dali. Continuações de tabela paginada não repetem as notas.

## 9. Persistência, carregador e embutíveis

### 9.1 Persistência (`O.persistencia`)

Banco `oratoria`, versão 1, lojas chave-valor criadas de uma vez: `rascunho` (`'atual'`, gravado pelo autossalvamento com `atualizadoEm` do momento da guarda; `'anterior'`, cópia do rascunho encontrado na abertura, oferecida pelo convite "Retomar" — D29), `preferencias`, `biblioteca`, `pastas`, `segredos`. `iniciar()` abre o banco com tempo-limite de 4 s e faz uma sonda de escrita; em falha, passa ao modo `memoria` (motivo em `motivoMemoria()`). API: `obter`, `gravar`, `remover`, `listar`, `limpar`, `estimativa`, `preferencia`, `definirPreferencia`, `rascunhoDisponivel`, `ativarAutossalvamento` (observa `projeto`, salva após 2 s de inatividade e no `pagehide`).

### 9.2 Carregador (`O.carregador`)

`script(url, { pronto, tempoLimite, externo })` injeta `<script>` e guarda uma promessa por URL (falhas são removidas para permitir nova tentativa). `embutivel(nome)` resolve de imediato se o recurso já estiver no namespace (edição portátil). `modulo(nome)` carrega KaTeX, Mermaid ou SheetJS das URLs fixadas em `config.js`. `sondarRede()` carrega um SVG de 1 KB, sem executar código de terceiros.

### 9.3 Embutíveis

`tools/gerar-embutiveis.mjs` produz `embutiveis/fontes-base64.js` (oito faces IBM Plex), `embutiveis/chart-fonte.js` (Chart.js como string, com `</script` escapado), `embutiveis/MANIFESTO.js` (hashes das origens e da saída) e `sw-recursos.js` (lista e nome do cache do service worker, derivados do `index.html`). `embutiveis/exemplos.js` reúne os decks de `exemplos/<tema>/` (Markdown, CSV como texto e imagens como data URL) numa string JSON, lida com `JSON.parse` quando o usuário abre um exemplo. Saída determinística; versionada no Git.

### 9.4 Exemplos

`exemplos/aurora|marfim|grafite|nanquim/` contêm `apresentacao.md` e os arquivos de acervo (ilustrações originais em SVG e JPEG, `execucao_2025.csv` com 60 órgãos fictícios e `receita_mensal.csv`). Cada deck exercita título, seção, lista com destaque e notas, duas colunas, imagem lateral com fragmentos, imagem de fundo, citação (textos em domínio público), tabela zebrada, tabela CSV paginada (3 slides), gráfico de linhas e gráfico de barras alternáveis, e encerramento.

## 10. Interface: dicas, abas e tokens

### 10.1 Dicas

Atributos: `data-dica` (texto), `data-dica-titulo`, `data-dica-formula` (bloco em Mono), `data-dica-posicao` (`acima`|`abaixo`|`direita`|`esquerda`). Cada alvo recebe `aria-describedby` apontando para uma descrição permanente em `#dicas-descricoes`; alvos não focalizáveis recebem `tabindex="0"`. Exibição: ponteiro (após 350 ms), foco por teclado (imediato, só com `:focus-visible`); persiste sob o ponteiro; Esc fecha. Um `MutationObserver` vincula elementos criados depois. Controles indisponíveis usam `aria-disabled="true"` (não `disabled`, que suprime eventos) e `data-dica-motivo`; um ouvinte em captura bloqueia a ação e mostra a dica.

### 10.2 Abas

`role="tablist"` com `aria-orientation="vertical"`; tabulação itinerante (`tabindex` 0/−1); setas, Home e End percorrem; clique, Enter ou Espaço ativam e levam o foco ao primeiro campo do painel. A aba ativa é guardada nas preferências.

### 10.3 Tokens da interface (D12)

`css/app.css` define `--i-*` para `[data-interface="escuro"]` e `[data-interface="claro"]`; cada aba tem `--i-cor-<aba>`, aplicada como faixa de 3 px e tinta em baixa opacidade (`--i-opacidade-tinta`). Todos os pares de texto atingem 4,5:1 nos dois temas.

## 11. Ferramentas de desenvolvimento

| Ferramenta | Função |
|---|---|
| `tools/vendor.mjs` | Copia bibliotecas de `node_modules/` para `vendor/`; compõe IIFEs quando o pacote não publica build clássico (markdown-it-attrs 5.x; subconjunto do highlight.js); copia fontes; grava `VERSOES.md` e licenças |
| `tools/gerar-embutiveis.mjs` | Gera `embutiveis/*` e `sw-recursos.js` |
| `tools/verificar.mjs` | Validações (tabela abaixo) |
| `tools/lib/comum.mjs` | Utilitários compartilhados (hash, listagem, `literalSeguro`, referências do HTML) |

Checagens do `verificar.mjs`:

| # | Garante |
|---|---|
| 1 | Sintaxe (`node --check`) de `js/`, `temas/`, `embutiveis/`, `sw*.js`, `tools/` |
| 2 | Balanceamento de `<div>`, `<section>`, `<template>`, `<aside>`, `<nav>` no `index.html` e de chaves nos `.css` |
| 3 | Referências locais existentes; todo `<script src>` com `defer` e sem `type="module"`; `namespace.js` primeiro e `app.js` último |
| 4 | Nenhum `.js` órfão em `js/` ou `temas/` |
| 5 | Embutíveis e `sw-recursos.js` idênticos à recomposição (distingue origem alterada de edição manual) |
| 6 | Sem `import`/`export`, `fetch(`, `XMLHttpRequest` (exceto `js/servicos/`) ou `type="module"` em strings; nada fora de IIFE no nível superior (análise por acorn, D5) |
| 7 | Funções autossuficientes sem identificadores externos e dentro da meta de tamanho |
| 8 | Versão coerente; controles e indicadores do `index.html` com dica; arquivos de convenção presentes; **todo `.js` de `js/` descrito neste manual** (temas apenas informados); manual operacional presente |

## 12. Empacotamento, publicação e *release*

*(Etapas 8 e 9.)* `tools/empacotar.mjs` gerará `dist/oratoria-pasta.zip` e `dist/oratoria-portatil.html` (com o manual operacional também em HTML). Workflows: `verificar.yml`, `publicar.yml` (raiz no Pages, sem `tools/`, `.github/`, `node_modules/`, `dist/`, `package*.json`) e `release.yml` (tag `v*`).

## 13. Decisões de projeto

As decisões D1 a D13, o PDF direto, a Biblioteca e os ajustes de execução estão registrados em `CLAUDE.md` §5. Acréscimos desta etapa:

- **D14** Primeiro slide vazio preservado como slide de título do front-matter.
- **D15** Marcadores de contêiner aninhados reescritos automaticamente conforme a profundidade.
- **D16** Fragmento com uma única lista revela item a item; outros conteúdos, o bloco inteiro.
- **D17** Montagem dos slides em `js/slides/composicao.js` (arquivo não previsto na árvore original), com preparo estrutural declarado por layout.
- **D18** Importação de documentos (especificação §16), na etapa 6-B.
- **D19** Temas dispensados do inventário deste manual, para que um tema novo não exija alterar outro arquivo.
- **D20** Gráficos desenhados com `responsive: false` no tamanho de layout (imunes à escala por `transform`); gráficos alternáveis por padrão. Barras partem do zero; linhas ajustam o eixo aos dados, para evidenciar a variação.
- **D21** Continuações de tabela paginada levam somente o título e a tabela; o restante do conteúdo fica no primeiro slide.
- **D22** Exemplos oferecidos dentro da aplicação por meio do embutível `exemplos.js`.
- **D23** (revisa D10) Modo apresentador numa janela `about:blank` montada e atualizada diretamente pela janela principal, de mesma origem. Motivo: no editor a página é o `index.html`, não a apresentação, e reabri-la com `#apresentador/N` não reproduziria o deck. A solução funciona igualmente em `file://` e `https`, no editor e no exportado, dispensando `BroadcastChannel` e `postMessage`. Limitação: se a janela principal for recarregada, a do apresentador precisa ser reaberta (**P**).
- **D24** Cliques sobre a área de um gráfico não avançam o slide (o gráfico é interativo: legendas e dicas); use as teclas ou clique fora dele.

Acréscimos da etapa 6 (interface do editor), com o enunciado completo em `CLAUDE.md` §5:

- **D25** Front-matter como fonte de verdade das escolhas de apresentação; ajustes finos em `projeto.ajustesTema`.
- **D26** Renderização em duas velocidades (slide sob o cursor em 300 ms; completa em 1 s).
- **D27** Reordenação por blocos de texto, com título e front-matter fixos.
- **D28** Indicador de tamanho a partir dos embutíveis reais.
- **D29** Guarda automática desde a etapa 6, com o rascunho encontrado preservado em `rascunho/anterior`.
- **D30** Edições programáticas desfazíveis (`execCommand('insertText')`) e confirmação em dois toques.
- **D31** Nome **Apresenta**; identificadores `Oratoria`/`oratoria` mantidos.
- **D32** `data-origem` em cada seção montada.

## 14. Limitações conhecidas

- Referências de link no estilo `[texto][ref]` só se resolvem dentro do mesmo slide (cada slide é interpretado isoladamente).
- Títulos *setext* (texto sublinhado por `---`) não são suportados (D7).
- Imagens externas (`https://…`) aparecem no editor, mas são bloqueadas na apresentação exportada.
- A paginação divide apenas a maior tabela do slide; slides com várias tabelas grandes devem ser separados pelo autor.
- Gráficos de pizza e rosca mostram somente a primeira série.
- Em `file://`, rascunhos no IndexedDB ficam vinculados ao caminho de abertura.

## 15. Procedimentos frequentes

**Atualizar uma biblioteca.** `npm install <pacote>@<versão> --save-exact` → `npm run preparar` → testar → registrar a mudança.

**Criar um arquivo `.js`.** Criar como IIFE → acrescentar `<script defer>` na posição correta do `index.html` → descrevê-lo no §3 deste manual → `node tools/gerar-embutiveis.mjs` (atualiza `sw-recursos.js`) → `node tools/verificar.mjs`.

**Mudar um rótulo da interface.** Alterar o mapa em `rotulos.js`; nunca a chave.
