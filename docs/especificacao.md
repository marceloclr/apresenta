# PROMPT — Implementação do "Oratória": gerador de apresentações HTML a partir de Markdown

> **Instrução inicial obrigatória:** trabalhe em **modo planejamento**. Antes de escrever qualquer código, leia integralmente este documento. Em seguida, apresente o plano de implementação com a estrutura de arquivos, a ordem das etapas e os riscos identificados. Aguarde minha aprovação explícita. Só então implemente, etapa por etapa, reportando ao fim de cada uma.

---

## 1. Contexto

Sou desenvolvedor e analista na SEPLAG/CE. Quero uma aplicação web que gere apresentações em HTML a partir de arquivos Markdown e imagens, com suporte robusto a tabelas, personalização visual e comportamento dinâmico.

- **Finalidade:** conteúdo **público e educacional**. Não haverá dados restritos, então serviços externos abertos são admissíveis, desde que sejam opcionais.
- **Arquitetura:** **modular, em múltiplos arquivos**, com `index.html` como porta de entrada. A **mesma pasta, sem nenhuma etapa de build**, deve funcionar:
  1. hospedada no **GitHub Pages**, como PWA instalável;
  2. aberta localmente via `file://`, a partir de um pendrive ou de um zip descompactado.
- **Edições portáteis:** a partir dessa pasta, um script de empacotamento gera, a cada release:
  - `oratoria-pasta.zip`, com a estrutura completa;
  - `oratoria-portatil.html`, com tudo embutido num arquivo único, para envio por e-mail. Filtros de e-mail costumam bloquear `.js`, mesmo dentro de zip.
- **Arquivos gerados nunca são editados à mão.** A fonte de verdade é sempre a estrutura modular.
- **Apresentações exportadas:** são sempre arquivos `.html` **únicos e autocontidos**, sem nenhuma dependência de rede.
- **Nome provisório da aplicação:** **Oratória**. Deve ser fácil de alterar via `Oratoria.config.APP_NOME`.

## 2. Convenções de trabalho (inegociáveis)

Registre estas regras num arquivo `CLAUDE.md` na raiz do repositório, para que valham em sessões futuras.

### 2.1 Restrições impostas pelo `file://`

A aplicação precisa abrir por duplo clique no `index.html`, sem servidor. Por isso:

1. **Proibido usar `<script type="module">`, `import` ou `export`.** Use **scripts clássicos com `defer`**, carregados em ordem explícita no `index.html`.
2. **Namespace global único.**
   - `js/nucleo/namespace.js` é o primeiro script e cria `window.Oratoria` com os subespaços `config`, `estado`, `temas`, `layouts`, `embutiveis`, `servicos` e `ui`.
   - Todo arquivo seguinte é um IIFE: `(function (O) { 'use strict'; … })(window.Oratoria);`.
3. **Proibido usar `fetch` ou `XMLHttpRequest` para arquivos locais.**
   - Configurações, temas e dados embutíveis são arquivos **`.js` que se registram** ao carregar, como `Oratoria.temas.registrar({...})`.
   - Nunca use `.json` para essas finalidades.
4. **O CSS necessário à exportação vive em JavaScript**, porque em `file://` o conteúdo de folhas de estilo externas não é legível.
   - O CSS dos layouts de slide fica em *template literal*.
   - Os temas ficam como objetos de variáveis.
   - O CSS **exclusivo do editor** permanece em arquivos `.css` normais.
5. **O runtime dos slides** é uma função autossuficiente, sem referências a variáveis externas. Seu código-fonte é obtido por `motorSlides.toString()` para ser reinjetado na exportação.
6. **Carregamento sob demanda de recursos locais:** injete `<script src>` dinamicamente, o que funciona em `file://`. Use isso para os embutíveis (§3.3).
7. **Sem Web Workers de arquivo e sem service worker em `file://`.** Registre o `sw.js` **somente** quando `location.protocol === 'https:'`.

### 2.2 Regras gerais

1. **Pilha:** JavaScript vanilla (ES2020+), sem frameworks e sem TypeScript. O CSS é puro, com variáveis customizadas.
2. **Entrega:** sempre entregue arquivos completos, nunca trechos soltos para colar.
3. **Validação antes de concluir cada etapa:** execute `node tools/verificar.mjs` (§3.4). Ele inclui `node --check` em todos os `.js`.
4. **Mudanças não triviais:** antes de implementá-las, apresente seu entendimento da alteração e aguarde confirmação.
5. **Identificadores estáveis:** não renomeie identificadores quando apenas um rótulo mudar. Use mapas de rótulos em `js/nucleo/rotulos.js`, como `ROTULO_LAYOUT = { 'duas-colunas': 'Duas colunas', … }` e `rotuloLayout(chave)`.
6. **Vocabulário:** a interface usa **vocabulário elegante e culto** em português do Brasil.
   - Exemplos: "Compor", "Pré-visualizar", "Conferir", "Exportar", "Acervo de imagens", "Paleta".
   - Evite jargões técnicos na interface.
7. **Tooltips obrigatórias:** **todo** botão, controle e indicador calculado deve ter tooltip.
   - Botões: a tooltip explica a função e a consequência da ação.
   - Indicadores: a tooltip explica a fórmula de cálculo.
   - Implemente um componente próprio (atributo `data-dica`), acessível via teclado e com `aria-describedby`. Não use apenas o `title` nativo.
8. **Visual da interface:**
   - paleta discreta;
   - abas, cards e blocos de informação **diferenciados por cor**;
   - tema claro/escuro alternável (a própria interface do editor, independente do tema dos slides);
   - estética moderna macOS/Linux: linhas limpas, cantos arredondados de 8 a 10 px, glassmorfismo sutil (`backdrop-filter` com baixa intensidade);
   - tipografia **IBM Plex** (Sans, Serif e Mono).
9. **Gráficos:** sempre dinâmicos (Chart.js), com botão ou seletor para alternar o tipo de visualização.
10. **Formulários:**
    - largura de campo proporcional ao dado esperado;
    - validação de caracteres em tempo real;
    - foco automático no primeiro campo de cada painel.
11. **Novo arquivo `.js`:** exige, na mesma alteração, a respectiva linha `<script defer>` no `index.html`, na posição correta da ordem de carregamento.

## 3. Estrutura do repositório

### 3.1 Árvore

```
oratoria/
├── index.html                 ← porta de entrada; abre direto, sem build
├── manifest.webmanifest       ← PWA (ativo apenas no Pages)
├── sw.js                      ← service worker (registrado só em https)
├── LEIA-ME.txt                ← instruções para quem recebe por pendrive/zip
├── CLAUDE.md                  ← convenções do §2
├── README.md                  ← uso, sintaxe, temas, publicação, limitações
├── docs/
│   ├── especificacao.md       ← esta especificação (versionada)
│   ├── manual-tecnico.md      ← arquitetura e manutenção (§15.1)
│   └── manual-operacional.md  ← uso passo a passo (§15.2)
├── package.json               ← apenas scripts e devDependencies das ferramentas
├── css/
│   ├── app.css                ← tokens e layout da interface do editor
│   ├── componentes.css        ← abas, cards, botões, campos, dicas
│   └── fontes.css             ← @font-face apontando para assets/fontes/*.woff2
├── js/
│   ├── nucleo/
│   │   ├── namespace.js       ← cria window.Oratoria (1º a carregar)
│   │   ├── config.js          ← APP_NOME, versão, limites, fatores
│   │   ├── rotulos.js         ← mapas de rótulos
│   │   ├── utilidades.js      ← debounce, formatação pt-BR, contraste WCAG
│   │   ├── estado.js          ← estado central + eventos de mudança
│   │   ├── persistencia.js    ← IndexedDB
│   │   └── carregador.js      ← injeção dinâmica de <script> (embutíveis, CDN)
│   ├── slides/
│   │   ├── estilos-base.js    ← CSS dos layouts de slide como string
│   │   ├── temas-css.js       ← converte o objeto de tema em CSS [data-tema]
│   │   ├── motor.js           ← runtime autossuficiente (embutido no export)
│   │   └── apresentador.js    ← modo apresentador
│   ├── conteudo/
│   │   ├── importadores/      ← documentos → Markdown (§16), um arquivo por formato
│   │   ├── interpretador.js   ← markdown-it + front-matter + diretivas
│   │   ├── tabelas.js         ← CSV → tabela, classes, paginação
│   │   ├── graficos.js        ← blocos ```grafico → Chart.js
│   │   └── imagens.js         ← recompressão via canvas; mapa nome → dataURL
│   ├── interface/
│   │   ├── dicas.js           ← componente de tooltip
│   │   ├── abas.js
│   │   ├── editor.js          ← textarea + camada de realce
│   │   ├── previa.js          ← pré-visualização e miniaturas
│   │   ├── acervo.js
│   │   ├── editor-tabelas.js
│   │   ├── painel-tema.js
│   │   ├── conferencia.js
│   │   └── app.js             ← orquestração (último a carregar)
│   ├── exportacao/
│   │   ├── html.js            ← apresentação autocontida
│   │   ├── projeto.js         ← .oratoria.json
│   │   ├── markdown.js
│   │   └── impressao.js       ← PDF via impressão
│   └── servicos/
│       └── registro.js        ← serviços externos opcionais (§10)
├── temas/
│   ├── aurora.js              ← Oratoria.temas.registrar({ … })
│   ├── marfim.js
│   ├── grafite.js
│   └── nanquim.js
├── vendor/                    ← builds UMD minificados, versões fixadas
│   ├── markdown-it.min.js
│   ├── markdown-it-attrs.browser.min.js
│   ├── markdown-it-container.min.js
│   ├── purify.min.js
│   ├── js-yaml.min.js
│   ├── papaparse.min.js
│   ├── chart.umd.min.js
│   ├── highlight.min.js       ← subconjunto: js, python, sql, bash, json, html, css
│   └── VERSOES.md             ← origem, versão e licença de cada biblioteca
├── embutiveis/                ← GERADOS por tools/; nunca editar à mão
│   ├── fontes-base64.js       ← Oratoria.embutiveis.fontes = { … }
│   ├── chart-fonte.js         ← Oratoria.embutiveis.chart = "…"
│   ├── highlight-fonte.js     ← Oratoria.embutiveis.highlight = "…"
│   └── MANIFESTO.js           ← hashes de origem, para checar sincronia
├── assets/
│   ├── fontes/                ← IBM Plex woff2 (400/600, latin)
│   └── icones/                ← ícones do app e do PWA (SVG + PNG)
├── exemplos/
│   ├── aurora/                ← deck .md + imagens + CSV
│   ├── marfim/
│   ├── grafite/
│   └── nanquim/
├── tools/                     ← somente desenvolvimento; não distribuído
│   ├── vendor.mjs             ← copia de node_modules → vendor/ e atualiza VERSOES.md
│   ├── gerar-embutiveis.mjs   ← gera embutiveis/*.js a partir de vendor/ e assets/fontes/
│   ├── verificar.mjs          ← validações (§3.4)
│   └── empacotar.mjs          ← gera as edições portáteis (§3.5)
├── dist/                      ← saída do empacotamento; no .gitignore
└── .github/workflows/
    ├── verificar.yml          ← valida cada push e pull request
    ├── publicar.yml           ← publica a raiz no Pages (sem tools/, .github/)
    └── release.yml            ← em tag v*: empacota e anexa à release
```

### 3.2 Ordem de carregamento no `index.html`

Todos os scripts levam `defer`, e a ordem é a seguinte:
1. `vendor/*`;
2. `js/nucleo/*`, com `namespace.js` primeiro e `config.js` em seguida;
3. `js/slides/*`;
4. `temas/*`;
5. `js/conteudo/*`;
6. `js/exportacao/*`;
7. `js/servicos/*`;
8. `js/interface/*`, com `app.js` por último.

Os arquivos de `embutiveis/` **não** são carregados na abertura. `carregador.js` os injeta sob demanda, no momento da exportação, e mantém uma promessa por recurso para não repetir o carregamento.

**Adicionar um tema novo** exige apenas criar `temas/<id>.js` e acrescentar sua linha `<script>`. Nenhum outro arquivo deve precisar de alteração. Garanta isso na implementação.

### 3.3 Embutíveis: por que existem

A exportação precisa inserir no arquivo final o código do Chart.js, do highlight.js e as fontes em base64. Em `file://`, não é possível ler `vendor/chart.umd.min.js` como texto. Por isso, `tools/gerar-embutiveis.mjs` produz versões desses recursos **já em forma de string**, registradas no namespace:

- os arquivos gerados são **versionados no Git**, para que a aplicação funcione sem Node;
- o `MANIFESTO.js` guarda o hash SHA-256 de cada origem;
- `verificar.mjs` falha se algum embutível estiver dessincronizado com o `vendor/` ou com `assets/fontes/`.

### 3.4 `tools/verificar.mjs`

O script usa apenas o Node nativo e faz o seguinte:
1. executa `node --check` em todo `.js` de `js/`, `temas/`, `embutiveis/`, `sw.js` e `tools/`;
2. verifica o balanceamento de tags (`<div>`, `<section>`, `<template>`, `<aside>`, `<nav>`) no `index.html`, e de chaves `{}` nos `.css`;
3. confirma que todo `<script src>` e `<link href>` do `index.html` aponta para arquivo existente;
4. lista **arquivos órfãos**, isto é, `.js` em `js/` ou `temas/` não referenciados no `index.html`;
5. confere a sincronia dos embutíveis (§3.3);
6. procura usos proibidos em `js/` e `temas/`: `type="module"`, `import `, `export `, `fetch(` e `XMLHttpRequest`. A única exceção permitida é `js/servicos/`, que acessa APIs remotas;
7. confirma que `motorSlides.toString()` não referencia identificadores externos, por meio de uma lista de identificadores livres permitidos.

### 3.5 `tools/empacotar.mjs`

1. **`dist/oratoria-pasta.zip`:** a raiz do projeto sem `tools/`, `.github/`, `node_modules/`, `dist/` e `package*.json`. Usa `zlib` nativo ou implementa o formato ZIP (método *store/deflate*) sem dependências externas.
2. **`dist/oratoria-portatil.html`:** arquivo único gerado a partir do `index.html`.
   - Cada `<link rel="stylesheet">` é substituído pelo conteúdo inline.
   - Cada `<script src>` é substituído pelo conteúdo inline, preservando a ordem.
   - As `url()` de fontes viram `data:font/woff2;base64,…`.
   - Os ícones viram data URIs.
   - Os embutíveis são incluídos inline, porque no arquivo único não haverá pasta de onde carregá-los.
   - O manifest e o service worker são **removidos**.
   - Uma faixa discreta no rodapé indica "Edição portátil · vX.Y.Z".
3. Ao final, executa `node --check` nos blocos `<script>` extraídos do arquivo portátil e valida o balanceamento de tags.

### 3.6 `LEIA-ME.txt`

É escrito em linguagem simples, para quem recebe a pasta e não é técnico. Deve orientar:
- a **extrair o zip antes de abrir**, porque abrir o `index.html` de dentro do zip, sem extrair, quebra a aplicação;
- a abrir o `index.html` no Chrome, Edge ou Firefox;
- que a pasta pode ser copiada para pendrive sem prejuízo;
- que os recursos online (§10) só funcionam com internet.

### 3.7 Bibliotecas

Baixe via npm, fixe versões e copie os builds UMD minificados para `vendor/` com `tools/vendor.mjs`:
- `markdown-it`, `markdown-it-attrs`, `markdown-it-container`;
- `dompurify`;
- `js-yaml`;
- `papaparse`;
- `chart.js`;
- `highlight.js`;
- fontes via `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-serif` e `@fontsource/ibm-plex-mono`, usando somente os pesos 400 e 600, subconjunto latin, copiadas para `assets/fontes/`.

**Módulos de carregamento sob demanda do jsDelivr** (fora do núcleo), usados apenas quando houver rede, em qualquer modo de abertura:
- `SheetJS` (XLSX);
- `KaTeX`;
- `Mermaid`.

Sem rede, esses recursos ficam desabilitados, com tooltip explicando o motivo. Na exportação, fórmulas e diagramas são convertidos em HTML/SVG estático e embutidos, para que a apresentação não dependa desses módulos.

**Motor de slides:** é **próprio**. Não use Reveal.js.

## 4. Sintaxe Markdown estendida

Documente toda a sintaxe no README e também numa aba "Guia" dentro da aplicação.

### 4.1 Front-matter (YAML)

```yaml
---
titulo: Introdução ao Orçamento Público
autor: Marcelo
data: 2026-10-05
tema: aurora              # aurora | marfim | grafite | nanquim
proporcao: "16:9"         # 16:9 | 4:3
rodape: "SEPLAG/CE · Uso educacional"
numeracao: true
logotipo: logo.png        # opcional, resolvido no acervo de imagens
transicao: suave          # nenhuma | suave | deslizar
---
```

### 4.2 Separação e diretivas de slide

- **Separação:** `---` numa linha isolada, fora de blocos de código, separa os slides.
- **Diretivas por slide:** são escritas em comentários HTML no início do slide.
  - `<!-- layout: titulo | secao | conteudo | duas-colunas | imagem-lateral | imagem-fundo | citacao | tabela | encerramento -->`
  - `<!-- fundo: capa.jpg -->`
  - `<!-- classe: destaque -->`
  - `<!-- transicao: nenhuma -->`
- **Layout padrão:** quando a diretiva estiver ausente, o layout é `conteudo`. O primeiro slide assume `titulo` automaticamente.

### 4.3 Contêineres (markdown-it-container)

- `::: colunas` … `::: coluna` … `:::` … `:::` define colunas.
- `::: fragmento` … `:::` define revelação progressiva.
- `::: notas` … `:::` define notas do orador. Elas nunca aparecem no slide.
- `::: destaque` … `:::` define um bloco de ênfase, com a cor de acento do tema.

### 4.4 Imagens

- **Referência:** `![Texto alternativo](pasta/foto.png)` é resolvido pelo **nome do arquivo** no acervo. O caminho é ignorado quando não há correspondência exata.
- **Atributos:** `{.contida .sombra width=60%}` via markdown-it-attrs.
- **Texto alternativo ausente:** gera um aviso de acessibilidade no painel "Conferência".

### 4.5 Tabelas

- **GFM nativo:** tabelas pipe, com alinhamento por `:---:`.
- **Classes via atributos** na linha seguinte à tabela, por exemplo `{.zebra .compacta .destacar-coluna-2 .numerica}`:
  - `.zebra`: linhas alternadas;
  - `.compacta`: espaçamento reduzido;
  - `.destacar-linha-N` / `.destacar-coluna-N`: destaque de linha ou coluna;
  - `.numerica`: formatação pt-BR com `Intl.NumberFormat` e alinhamento à direita em colunas numéricas.
- **Tabela a partir de CSV** do acervo, com separador detectado automaticamente pelo PapaParse:
  ````
  ```tabela
  fonte: execucao_2025.csv
  colunas: Órgão, Dotação, Empenhado
  ordenar: Dotação desc
  limite: 12
  classes: zebra numerica
  ```
  ````
- **Paginação automática:**
  - se a tabela exceder a área útil do slide, reduza a fonte progressivamente até o piso de **18 px**;
  - abaixo disso, divida-a em slides sucessivos, repetindo o cabeçalho e marcando "(continuação)" no título.

### 4.6 Gráficos

````
```grafico
tipo: barras                 # barras | linhas | pizza | rosca
fonte: execucao_2025.csv     # ou dados inline
rotulos: Órgão
series: Dotação, Empenhado
alternavel: true             # exibe seletor de tipo no slide
```
````

- **Cores:** vêm da paleta de gráficos do tema ativo (§6).
- **Conversão:** qualquer tabela pode virar gráfico por um botão na aba "Tabelas".

## 5. Interface do editor

### 5.1 Disposição

- **Barra superior:** nome do projeto, alternância de tema da interface, indicadores e ações principais.
- **Coluna esquerda:** abas de trabalho.
- **Área central:** editor Markdown com numeração de linhas e destaque simples de sintaxe (camada `<pre>` sobreposta a um `<textarea>`).
- **Área direita:** pré-visualização ao vivo, com *debounce* de 300 ms, escalada e sincronizada com o slide sob o cursor.
- **Faixa inferior:** miniaturas reordenáveis por arraste. Reordenar miniaturas reescreve a ordem dos blocos no Markdown.

### 5.2 Abas, cada uma com cor própria e discreta

Aplique a cor como faixa lateral de 3 px e fundo em baixa opacidade.

| Aba | Cor-base (interface escura / clara) | Conteúdo |
|---|---|---|
| **Composição** | `#6a9fcc` / `#2f5f8f` | Abrir, colar ou arrastar `.md`; editor; inserir blocos prontos (layouts, tabela, gráfico) |
| **Acervo** | `#5db87a` / `#3f7a55` | Imagens e CSVs carregados: miniaturas, peso original × comprimido, texto alternativo, remoção |
| **Tabelas** | `#c9a45c` / `#8a6a2e` | Editor tabular, importação CSV, classes, converter em gráfico |
| **Tema** | `#a3a473` / `#6b6c3f` | Escolha entre os modelos registrados, ajustes finos (acento, tipografia, grade de fundo, rodapé, logotipo) |
| **Conferência** | `#e8993a` / `#a8621a` | Avisos: texto alternativo ausente, contraste insuficiente, tabela paginada, imagem pesada; serviços externos |
| **Apresentar / Exportar** | `#b86b52` / `#8c4a3c` | Tela cheia, modo apresentador, exportar HTML, exportar/importar projeto JSON, imprimir PDF |
| **Guia** | `#9fa4ab` / `#475569` | Referência da sintaxe com exemplos copiáveis |

### 5.3 Indicadores com tooltip de fórmula

- **Tamanho estimado do arquivo exportado.**
  - Fórmula: `Σ(bytes das imagens comprimidas) × 4/3 + bytes do runtime + bytes do tema + bytes das fontes + bytes do Chart.js/highlight.js (se usados)`.
  - A tooltip mostra a fórmula e a decomposição de cada parcela.
- **Número de slides:** conta os separadores `---`, mais os slides gerados por paginação de tabela.
- **Tempo estimado de exposição:** `slides × 1,5 min`. O fator é ajustável na aba Tema.

### 5.4 Ingestão de arquivos

- **Formas de entrada:** arrastar e soltar, `<input multiple>` e seleção de pasta (`webkitdirectory`), sempre via `FileReader`.
- **Tipos aceitos:** `.md`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg` e `.csv` como conteúdo e acervo; `.pdf`, `.doc`, `.docx`, `.odt`, `.xls` e `.xlsx` como **documentos de origem**, convertidos em Markdown editável pela importação (§16).
- **SVG:** sanitize com DOMPurify antes de embutir.
- **Recompressão de imagens:**
  - reduza o lado maior a no máximo **1920 px**;
  - converta para WebP com qualidade 0,85 (JPEG como alternativa se não houver suporte);
  - preserve PNG e GIF com transparência quando a conversão aumentar o peso;
  - a qualidade é ajustável, com tooltip explicando o compromisso entre nitidez e peso.
- **Colar da área de transferência:** Ctrl+V com imagem adiciona ao acervo e insere a referência no cursor.

### 5.5 Persistência

- **Autossalvamento:** IndexedDB, a cada 2 s de inatividade, guardando o Markdown, o acervo e as configurações.
- **Continuidade:** um botão "Retomar último trabalho" aparece na abertura.
- **Limitação a documentar:** em `file://`, o IndexedDB fica vinculado ao caminho de abertura. Se a pasta for movida para outro local ou pendrive, os rascunhos não acompanham. Documente isso no README e no LEIA-ME, e recomende o `.oratoria.json` para transporte.
- **Projeto `.oratoria.json`:** exportação e importação de tudo, com imagens em base64.

## 6. Os quatro modelos de apresentação

**Princípio ambiental:**
- **Ambientes claros** (salas iluminadas, luz natural, projetores de baixa luminosidade) favorecem **fundo claro e texto escuro**, pois o fundo escuro "lava" e perde contraste sob luz ambiente.
- **Ambientes escuros** (auditórios, salas com luz reduzida, telas grandes) favorecem **fundo escuro**, que reduz ofuscamento e fadiga visual.

**Requisitos comuns aos quatro modelos:**
- contraste **WCAG AA** no mínimo: 4,5:1 para texto corrente e 3:1 para títulos grandes;
- corpo de texto com no mínimo **28 px** na resolução de referência de 1920×1080;
- títulos entre 56 e 72 px;
- respeito a `prefers-reduced-motion`.

**Formato de cada tema:** um arquivo `temas/<id>.js` que chama `Oratoria.temas.registrar({...})` com o objeto:

```js
{
  id: 'aurora',
  nome: 'Aurora',
  ambiente: 'claro',            // claro | escuro
  descricao: 'Claro, frio, institucional…',
  recomendacao: 'Salas de aula e reuniões com luz plena…',
  fontes: { titulo: 'IBM Plex Sans', corpo: 'IBM Plex Sans', mono: 'IBM Plex Mono', pesoTitulo: 600 },
  variaveis: { '--s-fundo': '#f5f7fb', … },
  grade: { ativa: true, menor: 0.015, maior: 0.15, cruz: 0.01, intensidadeCor: '16%' }
}
```

`js/slides/temas-css.js` converte esse objeto em CSS `[data-tema="id"] { … }`. O mesmo CSS gerado serve à pré-visualização e à exportação. `registrar()` valida a presença de todas as variáveis obrigatórias e acusa as ausentes no console.

**Variáveis obrigatórias por tema:**
- fundos: `--s-fundo`, `--s-tela`, `--s-superficie`, `--s-superficie-2`;
- texto e bordas: `--s-texto`, `--s-texto-2`, `--s-borda`;
- acentos: `--s-acento`, `--s-acento-texto`, `--s-acento-2`;
- estados: `--s-sucesso`, `--s-aviso`, `--s-erro`;
- tipografia: `--s-fonte-titulo`, `--s-fonte-corpo`, `--s-fonte-mono`;
- tabelas: `--s-tabela-cabecalho-fundo`, `--s-tabela-cabecalho-texto`, `--s-tabela-zebra`, `--s-tabela-destaque`;
- gráficos: `--s-grafico-1` a `--s-grafico-6`, `--s-grafico-eixo`, `--s-grafico-grade`;
- grade de fundo: `--s-grade-menor`, `--s-grade-maior`, `--s-grade-cruz`, `--s-vinheta`.

### 6.1 AURORA · claro · frio · institucional

Derivado do tema claro dos meus sistemas.

- **Uso:** salas de aula e reuniões com luz plena; conteúdo técnico e institucional.
- **Fundos:**
  - fundo `#f5f7fb`;
  - tela `#eaeff8` (base da grade);
  - superfície `#ffffff`;
  - superfície-2 `#f1f5f9`.
- **Texto e bordas:** texto `#1e293b`, texto-2 `#475569`, borda `#cbd5e1`.
- **Acentos:**
  - acento decorativo `#6a9fcc` (faixas, marcadores, bordas);
  - **acento-texto `#2f5f8f`**, para links e texto em cor, garantindo contraste AA;
  - acento-2 `#4b607c`.
- **Estados:** sucesso `#3f7a55`, aviso `#a8621a`, erro `#b54a32`.
- **Tipografia:** títulos em IBM Plex Sans 600; corpo em IBM Plex Sans 400.
- **Tabela:** cabeçalho com fundo `#1e293b` e texto `#f1f5f9`; zebra `#f1f5f9`; destaque `rgba(106,159,204,.18)`.
- **Gráficos:** `#2f5f8f #5d8a6a #b0763a #8a5a8c #3f8c8c #a34f4f`; eixo `#475569`; grade `rgba(15,23,42,.10)`.
- **Grade de fundo:** ativa. Parâmetros já calibrados nos meus sistemas: menor `0.015`, maior `0.15`, cruz `0.01`, escurecimento `16%`, desenhada sobre `--s-tela`.

### 6.2 MARFIM · claro · quente · acadêmico-clássico

- **Uso:** aulas expositivas, humanidades, história, palestras de tom reflexivo; ambientes com luz quente.
- **Fundos:**
  - fundo `#f7f3ea` (marfim);
  - tela `#efe8d8`;
  - superfície `#fffdf8`;
  - superfície-2 `#f1ead9`.
- **Texto e bordas:** texto `#1f2328` (tinta), texto-2 `#55504a`, borda `#d8ccb4`.
- **Acentos:**
  - acento decorativo `#a07a3c` (latão);
  - **acento-texto `#7d5a24`**;
  - acento-2 `#5f7050` (musgo).
- **Estados:** sucesso `#4f6b3f`, aviso `#9a5f1c`, erro `#9c3f2e`.
- **Tipografia:**
  - títulos em **IBM Plex Serif 600**;
  - corpo em IBM Plex Sans 400;
  - citações em IBM Plex Serif itálico.
- **Tabela:**
  - cabeçalho com fundo `#3a342c` e texto `#f7f3ea`;
  - zebra `#f3ecdd`;
  - destaque `rgba(160,122,60,.16)`;
  - filete inferior de latão no cabeçalho.
- **Gráficos:** `#7d5a24 #5f7050 #3f5f7a #8c4a3c #6b5a8a #a07a3c`; eixo `#55504a`; grade `rgba(31,35,40,.10)`.
- **Grade de fundo:** desativada por padrão (fundo liso com leve textura de papel via `radial-gradient`). Pode ser ativada na aba Tema.

### 6.3 GRAFITE · escuro · frio · técnico

É **exatamente** o tema escuro que já uso no SEJUD.

- **Uso:** auditórios, salas escurecidas, telas grandes; conteúdo técnico, dados, sistemas.
- **Fundos:**
  - fundo `#0d1116`;
  - tela `#161d27` (base da grade);
  - superfície `#1a2029`;
  - superfície-2 `#232a35`.
- **Texto e bordas:** texto `#ebe7e4` (branco quente), texto-2 `#9fa4ab`, borda `#3d4550`.
- **Acentos:** acento e acento-texto `#6a9fcc`; acento-2 `#4b607c`.
- **Estados:** sucesso `#5db87a`, aviso `#e8993a`, erro `#e8704f`.
- **Tipografia:**
  - títulos em IBM Plex Sans 600;
  - corpo em IBM Plex Sans 400;
  - rótulos de seção em IBM Plex Mono maiúsculo, com espaçamento de letras de 0,08 em.
- **Tabela:**
  - cabeçalho em texto pequeno, Mono, maiúsculo, na cor de acento, **sem grade cheia**;
  - apenas `border-top` entre linhas;
  - zebra `rgba(255,255,255,.03)`;
  - destaque `rgba(106,159,204,.16)`.
- **Gráficos:** `#6a9fcc #5db87a #e8993a #e8704f #a3a473 #b86b52`; eixo `#9fa4ab`; grade `rgba(255,255,255,.06)`.
- **Grade de fundo:** ativa. Parâmetros calibrados: menor `0.01`, maior `0.17`, cruz `0.03`, claridade `44%`, sobre `--s-tela`.
- **Detalhes:**
  - vinheta superior→inferior;
  - faixa bicolor (acento → acento-2) como marcador do título.

### 6.4 NANQUIM · escuro · quente · alto contraste para auditório

- **Uso:** grandes auditórios, projeção a distância, eventos e palestras de encerramento; máxima legibilidade no escuro.
- **Fundos:**
  - fundo `#121412` (nanquim esverdeado);
  - tela `#181b18`;
  - superfície `#1f231f`;
  - superfície-2 `#2a2f29`.
- **Texto e bordas:** texto `#efece6`, texto-2 `#b5b0a5`, borda `#3a4038`.
- **Acentos:** acento e acento-texto `#c9a45c` (latão claro); acento-2 `#8fa37a` (musgo claro).
- **Estados:** sucesso `#8fa37a`, aviso `#d9a35a`, erro `#d08b6a`.
- **Tipografia:**
  - títulos em **IBM Plex Serif 600**, 8% maiores que nos demais temas;
  - corpo em IBM Plex Sans 400 com `letter-spacing: .005em` para reforço de legibilidade.
- **Tabela:**
  - cabeçalho com fundo `#c9a45c` e texto `#121412`;
  - zebra `rgba(239,236,230,.04)`;
  - destaque `rgba(201,164,92,.18)`;
  - fonte da tabela nunca abaixo de 22 px.
- **Gráficos:** `#c9a45c #8fa37a #7fa6c4 #d08b6a #b39cc9 #d9c9a3`; eixo `#b5b0a5`; grade `rgba(239,236,230,.07)`.
- **Grade de fundo:** desativada por padrão. Em seu lugar, um halo radial muito sutil de latão no canto superior esquerdo.

### 6.5 Grade de fundo (técnica já validada nos meus sistemas)

Ela é gerada **exclusivamente por gradientes CSS**, sem imagens:
- `::before` do contêiner do slide: grade em duas escalas (menor e maior), feita com `linear-gradient` empilhados, mais um `radial-gradient` nos cruzamentos;
- `::after`: vinheta vertical.

Use `position: relative; z-index: 1` no conteúdo para evitar sobreposição dos pseudo-elementos. Os parâmetros vêm das variáveis `--s-grade-*` de cada tema.

### 6.6 Ajustes finos na aba Tema

Os ajustes são sobreposições de variáveis salvas no projeto, sem criar um tema novo:
- **Cor de acento:** seletor de cor. Se o contraste do acento-texto cair abaixo de AA, a interface recalcula automaticamente uma variante escurecida ou clareada e explica o ajuste na tooltip.
- **Grade de fundo:** ligada ou desligada, com intensidade de 0 a 150%.
- **Escala tipográfica:** de 90 a 115%.
- **Rodapé, numeração e logotipo.**
- **Botão "Restaurar padrão do modelo".**

Também haverá uma pré-visualização lado a lado de todos os modelos registrados com o slide atual, para escolha comparativa.

## 7. Layouts de slide (`js/slides/estilos-base.js`)

| Layout | Descrição |
|---|---|
| `titulo` | Título grande, subtítulo, autor e data vindos do front-matter; faixa de acento |
| `secao` | Divisor de seção: número ordinal em Mono e título centralizado |
| `conteudo` | Título e corpo (listas, parágrafos, código); padrão |
| `duas-colunas` | Grid 1fr 1fr, ou proporções `60/40` via `<!-- colunas: 60/40 -->` |
| `imagem-lateral` | Imagem ocupando 45% da largura, com texto ao lado; lado configurável |
| `imagem-fundo` | Imagem em *cover* com camada escurecida (tema escuro) ou clareada (tema claro) para legibilidade |
| `citacao` | Citação em Serif grande, com autoria em versalete |
| `tabela` | Maximiza a área útil da tabela; título compacto |
| `encerramento` | Agradecimento, contato e QR code opcional do link publicado (§10) |

- **Área de referência:** todos os slides são compostos em **1920×1080** (ou 1440×1080 em 4:3) e escalados via `transform: scale()` ao contêiner disponível, com *letterbox* na cor `--s-fundo`.
- **Área útil:** margens internas de 96 px nas laterais e 80 px no topo e na base.
- **Registro:** os layouts ficam em `Oratoria.layouts`, para que novos layouts possam ser acrescentados em arquivo próprio no futuro.

## 8. Motor de slides e modos de exibição (`js/slides/motor.js`)

- **Navegação:**
  - avançar: →, ↓, espaço, PageDown e clique;
  - voltar: ←, ↑ e PageUp;
  - Home/End vão ao início/fim;
  - `G` + número vai direto ao slide;
  - `O` abre a visão geral em grade de miniaturas;
  - `F` ativa tela cheia;
  - `P` abre o modo apresentador;
  - `B` escurece a tela;
  - toques de deslizar funcionam em dispositivos móveis.
- **Fragmentos:** revelação progressiva antes de avançar o slide.
- **Endereçamento:** o hash da URL (`#/7`) permite abrir diretamente num slide.
- **Modo apresentador:**
  - `window.open` abre uma janela com o slide atual, o próximo, as notas, um cronômetro (decorrido e relógio) e o contador;
  - a janela do apresentador é aberta vazia (`about:blank`), herda a origem da janela principal e é montada e atualizada diretamente por ela, o que funciona igualmente em https e em `file://`, no editor e no arquivo exportado (decisão D23, que substitui a sincronização por `BroadcastChannel`/`postMessage`).
- **Transições:** CSS puro (`opacity` / `transform`), anuladas sob `prefers-reduced-motion`.
- **Barra de progresso:** fina, na cor de acento.
- **Um único runtime:** a função `motorSlides(raiz, opcoes)` é autossuficiente e usada tanto na apresentação em tela cheia do editor quanto nas apresentações exportadas, via `toString()`. Mantenha-a enxuta (meta: menos de 25 KB, sem dependências).

## 9. Exportação (`js/exportacao/`)

1. **HTML autocontido (`html.js`).** O arquivo contém:
   - os slides renderizados (HTML já sanitizado);
   - o CSS de `estilos-base.js` e **somente** o tema escolhido, gerado por `temas-css.js` com os ajustes finos aplicados;
   - as fontes efetivamente usadas pelo tema, vindas de `embutiveis/fontes-base64.js`;
   - as imagens em base64;
   - o runtime, via `motorSlides.toString()`;
   - `embutiveis/chart-fonte.js` **apenas se** houver gráfico;
   - `embutiveis/highlight-fonte.js` **apenas se** houver código;
   - uma CSP em `<meta>` que bloqueia qualquer requisição externa.

   Os embutíveis são carregados sob demanda pelo `carregador.js`, com indicador de progresso. O nome do arquivo é `titulo-normalizado_AAAA-MM-DD.html`.
2. **Projeto `.oratoria.json` (`projeto.js`)**, para reedição.
3. **PDF via impressão (`impressao.js`).** Uma folha `@media print` com `@page { size: 1920px 1080px; margin: 0 }` produz um slide por página, com fragmentos expandidos e sem controles. O botão abre `window.print()`, e a tooltip orienta a escolher "Salvar como PDF" e desativar cabeçalhos do navegador.
4. **Markdown consolidado (`markdown.js`):** o `.md` final, com as imagens referenciadas por nome.

## 10. Serviços externos abertos (arquitetura preparada, implementação na fase 2)

Crie em `js/servicos/registro.js` um **registro de serviços**. Cada entrada declara:
- nome;
- finalidade;
- dados enviados;
- URL-base;
- se exige rede;
- uma função `disponivel()`, que testa `navigator.onLine` e faz uma sonda leve com tempo-limite.

A aba **Conferência** ganha a seção "Serviços externos", onde cada serviço pode ser habilitado ou desabilitado individualmente. Tudo o que for obtido online é **incorporado em base64 na exportação**, e a apresentação final nunca depende de rede. Sem rede, os serviços aparecem desabilitados, com tooltip explicativa.

Deixe prontos os pontos de extensão, com implementação mínima quando for trivial. Cada serviço futuro deve caber em arquivo próprio em `js/servicos/`:

- **Openverse API:** busca de imagens com licença aberta, inserção no acervo e crédito automático (autor e licença) no rodapé do slide.
- **Iconify API:** sintaxe `:icone[mdi:school]:` para inserir ícones SVG.
- **Kroki:** blocos ` ```diagrama ` com o tipo declarado (plantuml, graphviz, mermaid), renderizados em SVG.
- **LanguageTool** (API pública): revisão ortográfica e gramatical pt-BR, com sublinhado no editor, respeitando os limites de uso.
- **GitHub Gists:** salvar e abrir decks com token pessoal informado pelo usuário e guardado apenas no IndexedDB, com aviso claro.
- **QR code:** biblioteca local em `vendor/`, sem serviço externo, para gerar o QR do link publicado no layout `encerramento`.

## 11. PWA, publicação e distribuição

- **PWA:** `manifest.webmanifest` e `sw.js` na raiz.
  - Estratégia *cache-first* para o núcleo e *network-first* para serviços externos.
  - A lista de arquivos do cache é gerada por `tools/verificar.mjs` a partir do `index.html`, para nunca ficar desatualizada.
  - O registro do service worker ocorre apenas em https.
- **`verificar.yml`:** em todo push e pull request, executa checkout, Node LTS, `npm ci` e `node tools/verificar.mjs`.
- **`publicar.yml`:** na branch principal, após a verificação, publica a **raiz do repositório** no Pages, excluindo `tools/`, `.github/`, `node_modules/`, `dist/` e `package*.json`. Não há build.
- **`release.yml`:** em tag `v*`, executa `node tools/empacotar.mjs` e anexa `oratoria-pasta.zip` e `oratoria-portatil.html` à release.

## 12. Acessibilidade e qualidade

- **Painel "Conferência"** lista:
  - imagens sem texto alternativo;
  - contraste abaixo de AA (calculado a partir das variáveis do tema e dos ajustes);
  - títulos ausentes;
  - tabelas paginadas;
  - imagens acima de 800 KB após a compressão.
- **Semântica:** cada slide é uma `<section>` com `aria-roledescription="slide"` e `aria-label="Slide N de M"`.
- **Leitores de tela:** uma região viva anuncia a troca de slide.
- **Foco:** anel de foco visível (`:focus-visible`) na cor de acento, em toda a interface.
- **Desempenho:** um deck de 100 slides com 30 imagens deve se manter fluido. A pré-visualização renderiza apenas o slide sob o cursor e seus vizinhos imediatos.

## 13. Entregáveis e ordem sugerida

1. `CLAUDE.md`, a árvore de pastas, `package.json`, `tools/vendor.mjs` com o *vendor* baixado e fixado, `tools/gerar-embutiveis.mjs` com os embutíveis gerados, e `tools/verificar.mjs`.
2. `index.html` com a ordem de carregamento, o núcleo (`namespace`, `config`, `rotulos`, `utilidades`, `estado`, `persistencia`, `carregador`) e o componente de dicas.
3. Interpretador (Markdown + front-matter + diretivas + contêineres), `estilos-base.js` com todos os layouts e `temas-css.js`.
4. Os **quatro temas** e um deck de exemplo por tema em `exemplos/`, cada um contendo título, seção, duas colunas, imagem, citação, tabela zebrada, tabela CSV paginada, gráfico alternável e encerramento.
5. Motor de slides, visão geral e modo apresentador.
6. Interface do editor: abas coloridas, ingestão, acervo com compressão, editor tabular, pré-visualização, miniaturas, conferência.
7. Exportações (HTML, JSON, PDF, MD) e persistência em IndexedDB.
8. PWA e os três workflows.
9. `tools/empacotar.mjs`, `LEIA-ME.txt` e o teste das edições portáteis.
10. Registro de serviços externos com os pontos de extensão (§10).

**Etapa 6-B (entre 6 e 7): importação de documentos (§16)** — leitor ZIP e leitor CFB próprios, importadores DOCX, ODT, PDF, DOC, XLS/XLSX, assistente de importação e testes com documentos reais de cada formato.

Em **todas** as etapas, os manuais técnico e operacional (§15) são atualizados na mesma alteração que muda o comportamento ou a estrutura do sistema.

## 14. Critérios de aceite

- [ ] `node tools/verificar.mjs` passa sem erros: sintaxe, balanceamento, referências, ausência de órfãos, sincronia dos embutíveis e ausência de usos proibidos.
- [ ] A **pasta do repositório**, aberta por duplo clique no `index.html` via `file://`, sem rede, carrega, edita, apresenta e exporta no Chrome, no Edge e no Firefox.
- [ ] A mesma pasta, copiada para outro diretório ou pendrive, continua funcionando sem ajuste algum.
- [ ] `oratoria-pasta.zip`, extraído, funciona igualmente.
- [ ] `oratoria-portatil.html`, arquivo único aberto sem rede, oferece as mesmas funcionalidades da pasta, e seus scripts passam em `node --check`.
- [ ] A versão publicada no Pages é instalável como PWA e funciona offline após o primeiro acesso.
- [ ] Uma apresentação exportada, aberta sem rede, exibe fontes, imagens, tabelas e gráficos corretamente, e o DevTools não registra nenhuma requisição externa.
- [ ] Os quatro temas atingem contraste AA em texto corrente, verificado por função própria de contraste com relatório no console de desenvolvimento.
- [ ] Um quinto tema de teste, criado apenas com `temas/teste.js` e sua linha `<script>`, aparece e funciona sem alteração em nenhum outro arquivo.
- [ ] Todo botão e todo indicador calculado possui tooltip funcional via mouse e via teclado.
- [ ] Uma tabela CSV de 60 linhas é paginada automaticamente com o cabeçalho repetido.
- [ ] O modo apresentador sincroniza corretamente em https e em `file://`.
- [ ] Documentos PDF, DOC, DOCX, ODT, XLS e XLSX, carregados sem rede e em `file://`, geram Markdown editável e slides coerentes; imagens e tabelas extraídas vão ao acervo; nenhum conteúdo sai do computador.
- [ ] `docs/manual-tecnico.md` e `docs/manual-operacional.md` estão completos e coerentes com o código; `verificar.mjs` confirma que todo `.js` de `js/` e `temas/` está descrito no manual técnico.
- [ ] As edições portáteis incluem o manual operacional também em HTML autocontido, legível por duplo clique.
- [ ] O `README.md` documenta a sintaxe, os temas (com recomendação ambiental de cada um), a estrutura de pastas, a publicação, a distribuição por pendrive, zip e arquivo portátil, e as limitações do modo local.

## 15. Documentação: manuais técnico e operacional

Os dois manuais são entregáveis permanentes, escritos em português culto, mantidos em `docs/` e **atualizados a cada etapa** junto com o código que alteram. O `README.md` é a porta de entrada e remete a ambos.

### 15.1 Manual técnico (`docs/manual-tecnico.md`)

Destina-se a quem mantém ou estende o sistema. Deve conter:
- visão geral da arquitetura, restrições do `file://` e suas consequências de projeto;
- o namespace `Oratoria` e seus subespaços; a ordem de carregamento e o motivo de cada posição;
- **inventário de módulos**: cada arquivo `.js` de `js/` e `temas/`, com responsabilidade, API pública e dependências;
- fluxo de dados: do Markdown ao slide renderizado (interpretação, sanitização, montagem, temas, pré-visualização, exportação);
- formato dos temas, dos layouts e das funções autossuficientes; como criar um tema, um layout, um bloco (` ```tipo `) e um serviço externo;
- persistência (lojas do IndexedDB), carregador sob demanda e embutíveis;
- ferramentas de `tools/` e o que cada checagem do `verificar.mjs` garante;
- empacotamento, publicação no Pages, workflows e procedimento de *release*;
- registro das decisões de projeto (D1 a D13 e posteriores) e das limitações conhecidas.

### 15.2 Manual operacional (`docs/manual-operacional.md`)

Destina-se a quem usa o sistema, sem conhecimento técnico. Deve conter:
- formas de obter e abrir a aplicação (Pages, instalação como aplicativo, pasta, pendrive, zip, arquivo portátil);
- percurso guiado: primeira apresentação, do texto à exportação;
- cada aba da interface, seus controles e indicadores (com as fórmulas);
- sintaxe com exemplos: front-matter, separação, diretivas, contêineres, imagens, tabelas, gráficos;
- escolha do tema conforme o ambiente de projeção;
- apresentação: atalhos de teclado, modo apresentador, visão geral;
- exportações (HTML, PDF direto e por impressão, projeto, Markdown) e Biblioteca (navegador, pasta, publicação);
- guarda automática e suas limitações; transporte do trabalho entre computadores;
- solução de problemas frequentes e glossário.

O manual operacional é também oferecido em **HTML autocontido** nas edições portáteis (gerado por `tools/empacotar.mjs`), e a aba "Guia" remete a ele.

## 16. Importação de documentos (PDF, DOC, DOCX, ODT, XLS, XLSX)

O usuário pode carregar um documento existente como **ponto de partida**. O sistema o converte em Markdown estendido, dividido em slides, que abre no editor para revisão. Todo o processamento ocorre **no navegador**: nenhum arquivo é enviado a servidor, e tudo funciona sem rede e em `file://`.

### 16.1 Formatos, bibliotecas e fidelidade

| Formato | Meio de leitura | Licença | Estrutura preservada | Limitações |
|---|---|---|---|---|
| **DOCX** | mammoth.js (→ HTML) + Turndown com plugin GFM (→ Markdown) | BSD-2 / MIT | Títulos por estilo, listas, negrito/itálico, tabelas, imagens, links | Caixas de texto e cabeçalhos/rodapés do Word são ignorados |
| **ODT** | Leitor próprio: ZIP (`DecompressionStream`) + `content.xml` | — | Títulos por nível de estrutura, listas, tabelas, imagens | Estilos de parágrafo sem nível de estrutura viram texto comum |
| **PDF** | pdf.js (Mozilla) | Apache-2.0 | Modo **texto**: títulos inferidos pelo tamanho da fonte, parágrafos, listas por marcadores. Modo **páginas**: cada página vira imagem num slide | Tabelas não são reconstruídas; PDF digitalizado (imagem) só no modo páginas |
| **DOC** (Word 97–2003) | Leitor próprio de CFB + tabela de peças do `WordDocument` | — | Texto e parágrafos | Sem títulos, imagens ou tabelas; recomenda-se salvar como DOCX |
| **XLSX / XLS** | SheetJS Community Edition (distribuição oficial) | Apache-2.0 | Cada planilha vira fonte de dados do acervo, utilizável em ` ```tabela ` e ` ```grafico `; opcionalmente, um slide de tabela por planilha | Fórmulas entram pelo valor calculado salvo; formatação visual ignorada |

As bibliotecas de importação ficam em `vendor/`, com versões fixadas, e são **carregadas sob demanda** pelo `carregador.js` (injeção de `<script>`), nunca na abertura. O `sw-recursos.js` as inclui no cache do PWA, e a edição portátil as embute.

**pdf.js:** as versões 4 em diante são publicadas apenas como módulos ES. Decisão: compor, em `tools/vendor.mjs`, um IIFE a partir da versão vigente (como feito com o highlight.js), usando o *worker* no próprio processo principal via `globalThis.pdfjsWorker`. Se essa composição se mostrar inviável, usar a 3.11.174 (último build clássico) com `isEvalSupported: false`, que neutraliza a vulnerabilidade CVE-2024-4367.

**SheetJS:** a versão publicada no npm está defasada e tem vulnerabilidades conhecidas. `tools/vendor.mjs` obtém o pacote da distribuição oficial (`cdn.sheetjs.com`) e registra o hash em `VERSOES.md`.

### 16.1-A Segurança, limites e desempenho

- Todo HTML intermediário passa pelo DOMPurify; SVG extraído é sanitizado como no acervo.
- Limites: 50 MB por arquivo e 200 MB descompactados (proteção contra arquivos-bomba em ZIP e CFB).
- pdf.js sempre com `isEvalSupported: false`; nenhuma conversão usa a rede.
- As bibliotecas de importação somam cerca de 3,5 MB e só são carregadas na primeira importação, com indicador de progresso e opção de cancelar. A abertura da aplicação e as apresentações exportadas não são afetadas; a edição portátil cresce na mesma medida.
- Ao fim, a Conferência lista o que foi convertido, o que foi descartado e as advertências (por exemplo, "PDF sem texto: use o modo páginas").

### 16.2 Conversão em slides

Um assistente de importação mostra as opções antes de gerar o Markdown:

- **Nível que inicia um slide:** Título 1, 2 ou 3. O nível imediatamente superior gera slides `secao`.
- **Limite por slide:** número máximo de palavras ou de blocos. Acima dele, o conteúdo continua em slide seguinte com "(continuação)" no título.
- **Tabelas:** vão para slides com layout `tabela`, com a paginação automática do §4.5.
- **Imagens:** vão ao acervo, com recompressão (§5.4); a imagem sozinha num trecho gera slide `imagem-lateral`.
- **Primeiro título do documento:** vira `titulo` no front-matter.
- **Documento sem títulos:** divisão por quantidade de parágrafos, com advertência.
- **PDF:** escolha entre modo texto e modo páginas.

O resultado passa pelo interpretador como qualquer texto. Os avisos da importação (títulos inferidos, tabelas descartadas, imagens ausentes) aparecem na Conferência.

### 16.3 Organização do código

`js/conteudo/importadores/` contém `registro.js` (registro por extensão e o fluxo comum), `zip.js` (leitor ZIP próprio), `cfb.js` (leitor de arquivos compostos OLE), `estruturador.js` (Markdown estruturado → slides) e um arquivo por formato (`docx.js`, `odt.js`, `pdf.js`, `doc.js`, `planilhas.js`). Um formato novo exige apenas um arquivo que chame `O.conteudo.importadores.registrar({ extensoes, rotulo, bibliotecas, converter })`, mais sua linha `<script>`.

---

**Lembrete final:** comece pelo **plano**. Apresente a estrutura, as decisões que tomar onde este documento for omisso (sinalizadas como "decisão proposta") e os riscos. Só implemente após minha aprovação.
