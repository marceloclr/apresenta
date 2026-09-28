# Apresenta

Composição de apresentações em HTML a partir de Markdown e imagens. Você escreve o texto; o Apresenta cuida da diagramação, das cores e da tipografia, e entrega **um único arquivo `.html`** que abre em qualquer navegador, sem internet e sem instalar nada.

- **Usar agora:** https://marceloclr.github.io/apresenta/ (instalável como aplicativo no Chrome e no Edge; funciona sem internet depois da primeira visita)
- **Levar no pendrive ou mandar por e-mail:** edições da página de [versões](https://github.com/marceloclr/apresenta/releases)
- **Manuais:** [operacional](docs/manual-operacional.md) (uso) · [técnico](docs/manual-tecnico.md)

JavaScript *vanilla*, sem *build*, sem servidor: a mesma pasta abre por duplo clique no `index.html` (`file://`) e publicada em `https`.

## Uso

1. Abra a aplicação (endereço acima, `index.html` da pasta ou o arquivo portátil).
2. Escreva no editor, arraste um `.md` para a janela ou abra um exemplo na aba **Composição**.
3. Acrescente imagens e planilhas CSV ao **Acervo** (arrastando, colando ou por **Abrir arquivos…**).
4. Escolha o tema na aba **Tema** e confira os avisos na aba **Conferência**.
5. **Apresentar** em tela cheia (há modo apresentador, com notas e cronômetro) ou **Exportar em HTML**, PDF, projeto `.oratoria.json`, Markdown ou zip.

O trabalho é guardado automaticamente no navegador. Para levá-lo a outro computador, use **Exportar projeto** (`.oratoria.json`).

## Sintaxe resumida

````markdown
---
titulo: Introdução ao Orçamento
autor: Marcelo
tema: aurora
numeracao: true
---

---

## Um slide de conteúdo

- Item
- Outro item

::: destaque
Texto em evidência, na cor de acento do tema.
:::

::: notas
Lembrete do orador; nunca aparece no slide.
:::

---

<!-- layout: duas-colunas -->
## Duas colunas

::: colunas
::: coluna
Texto à esquerda.
:::
::: coluna
![Descrição da imagem](paisagem.jpg)
:::
:::

---

## Tabela a partir de planilha

```tabela
fonte: execucao_2025.csv
colunas: Órgão, Dotação, Empenhado
ordenar: Dotação desc
limite: 8
```

---

## Gráfico

```grafico
tipo: barras
fonte: execucao_2025.csv
rotulos: Órgão
series: Dotação, Empenhado
```
````

- `---` numa linha isolada separa os slides; o primeiro slide vazio vira a capa, montada a partir do cabeçalho.
- Diretivas no início do slide: `<!-- layout: … -->`, `<!-- fundo: capa.jpg -->`, `<!-- transicao: nenhuma -->` (várias separadas por `;`).
- Blocos especiais: `::: fragmento` (revelação progressiva), `::: destaque`, `::: notas`, `::: colunas`.
- Imagens e planilhas são procuradas no **Acervo** pelo nome do arquivo; o texto entre colchetes descreve a imagem.

A referência completa, com todos os layouts, blocos e opções, está no [manual operacional](docs/manual-operacional.md#5-escrevendo-os-slides-guia-de-sintaxe) e na aba **Guia** da aplicação.

## Temas

Regra prática: **sala clara, fundo claro; sala escura, fundo escuro.**

| Tema | Fundo | Recomendado para |
|---|---|---|
| **Aurora** | claro, frio | Salas de aula e reuniões com luz plena; conteúdo técnico e institucional |
| **Marfim** | claro, quente | Aulas expositivas, humanidades, história e palestras de tom reflexivo; ambientes com luz quente |
| **Grafite** | escuro, frio | Auditórios, salas escurecidas e telas grandes; conteúdo técnico, dados e sistemas |
| **Nanquim** | escuro, quente, alto contraste | Grandes auditórios, projeção a distância, eventos e palestras de encerramento |

Os quatro atendem ao nível AA de contraste. Um tema novo é um arquivo `temas/<id>.js` e uma linha `<script>` no `index.html`.

## Distribuição

| Forma | Arquivo | Observações |
|---|---|---|
| Endereço na internet | https://marceloclr.github.io/apresenta/ | Aplicativo instalável (PWA); abre sem internet após a primeira visita |
| Pasta completa | `oratoria-pasta.zip` | **Extraia antes de abrir**; depois, duplo clique em `apresenta/index.html`. Pode ir para pendrive ou pasta de rede. Traz os exemplos e o manual em HTML |
| Arquivo portátil | `oratoria-portatil.html` | Um só arquivo (≈ 1,6 MB), ideal para e-mail; sem os exemplos |

As edições são geradas por `node tools/empacotar.mjs` e anexadas automaticamente à *release* quando o autor cria uma tag `v*`. Navegadores suportados: Chrome, Edge, Firefox e derivados (o Safari fica fora do escopo).

## Limitações do modo local (`file://`)

- **Rascunhos presos ao local de abertura:** o navegador guarda o trabalho por origem; movida a pasta, ou aberta de outro pendrive, os rascunhos não a acompanham. Use o projeto `.oratoria.json` para transportar.
- **Sem instalação e sem service worker:** só a versão publicada vira aplicativo; a pasta local já abre sem internet por natureza.
- **Abrir de dentro do zip não funciona:** extraia primeiro.
- **Recursos opcionais exigem internet:** fórmulas (KaTeX), diagramas (Mermaid) e planilhas `.xlsx`. O essencial — escrever, apresentar e exportar — funciona sem rede.
- **Pasta do computador na Biblioteca:** gravação direta só no Chrome e no Edge; no Firefox, os arquivos vão para os downloads.

## Estrutura

```
index.html              interface (todos os scripts com defer, na ordem de carregamento)
manifest.webmanifest    aplicativo instalável · sw.js + sw-recursos.js: uso sem internet (https)
css/                    estilo da interface (tokens --i-*)
js/nucleo/              namespace, configuração, estado, persistência, carregador
js/slides/              composição, temas, motor dos slides, apresentador
js/conteudo/            interpretador de Markdown, tabelas, gráficos, imagens
js/exportacao/          HTML, projeto, PDF, Markdown, ZIP, impressão
js/interface/           abas, editor, pré-visualização, painéis (app.js por último)
temas/                  um arquivo por tema
vendor/                 bibliotecas de terceiros (versões, licenças e hashes em VERSOES.md)
embutiveis/             recursos em forma de string para a exportação (gerados)
assets/                 fontes IBM Plex e ícones
exemplos/               uma apresentação completa por tema (dados fictícios)
docs/                   manual operacional, manual técnico, especificação, planos
tools/                  ferramentas de desenvolvimento (Node; não distribuídas)
```

## Desenvolvimento

Requer Node 20 ou superior. Não há etapa de *build*: os arquivos gerados (`vendor/`, `embutiveis/`, `sw-recursos.js`) são versionados.

```sh
npm ci                              # dependências fixadas
node tools/gerar-embutiveis.mjs     # após mudar index.html, vendor/, fontes ou exemplos
node tools/verificar.mjs            # obrigatório antes de cada commit
node tools/empacotar.mjs            # edições portáteis em dist/
node tools/icones.mjs               # após mudar assets/icones/icone.svg (usa Edge/Chrome)
```

Cada push roda a verificação no GitHub Actions; na `main`, a verificação aprovada publica o site no GitHub Pages. As convenções de código estão em [`CLAUDE.md`](CLAUDE.md) e a arquitetura, no [manual técnico](docs/manual-tecnico.md).

## Licença

Código sob licença MIT (`package.json`). Bibliotecas de terceiros e fontes IBM Plex (OFL-1.1) mantêm suas licenças, em `vendor/licencas/` e `assets/fontes/OFL.txt`.
