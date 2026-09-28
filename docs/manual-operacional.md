# Apresenta — Manual operacional

> Guia de uso para quem compõe e apresenta. Não exige conhecimento técnico.
> Versão do documento: **0.1.0 · etapa 6**. Itens marcados *(em preparação)* ainda não estão disponíveis nesta versão.

## Sumário

1. O que é o Apresenta
2. Como abrir
3. A tela de trabalho
4. Sua primeira apresentação
5. Escrevendo os slides: guia de sintaxe
6. Escolhendo o tema conforme o ambiente
7. Apresentando
8. Exportando
9. Biblioteca *(em preparação)*
10. Guarda automática e transporte do trabalho
11. Conferência
12. Solução de problemas
13. Glossário

---

## 1. O que é o Apresenta

O Apresenta transforma um texto simples, escrito em **Markdown**, numa apresentação de slides em HTML. Você escreve títulos, listas, tabelas e referências a imagens; o sistema cuida da diagramação, das cores e da tipografia, conforme o tema escolhido.

A apresentação final é **um único arquivo `.html`**, que abre em qualquer navegador, sem internet e sem instalar nada.

## 2. Como abrir

| Forma | Como fazer | Observações |
|---|---|---|
| **Pasta no computador ou pendrive** | Abra a pasta e dê duplo clique em `index.html` | Funciona sem internet. Use Chrome, Edge, Firefox ou navegadores derivados deles (o Safari não é suportado) |
| **Arquivo zip recebido** | **Extraia o zip primeiro** (botão direito → "Extrair tudo"); depois abra `index.html` | Abrir de dentro do zip, sem extrair, **não funciona** |
| **Endereço na internet** *(em preparação)* | Acesse o endereço publicado | Pode ser instalado como aplicativo |
| **Arquivo portátil** *(em preparação)* | Dê duplo clique em `oratoria-portatil.html` | Um só arquivo, ideal para envio por e-mail |

A pasta pode ser copiada para qualquer lugar ou pendrive sem prejuízo.

## 3. A tela de trabalho

**Barra superior.** Título do projeto, três indicadores e o botão de tema da interface.

| Indicador | O que mostra | Cálculo |
|---|---|---|
| Slides | Quantidade de slides | separadores `---` + 1, mais os slides criados pela divisão de tabelas longas |
| Duração | Tempo estimado de fala | slides × 1,5 min (fator ajustável na aba Tema) |
| Arquivo | Peso aproximado do arquivo exportado | imagens comprimidas × 4/3 + motor + tema + fontes + gráficos |

Passe o mouse sobre qualquer botão ou indicador — ou alcance-o com a tecla **Tab** — para ler sua explicação. **Esc** fecha a explicação.

O título do projeto dá nome ao arquivo exportado e não aceita os caracteres `/ \ : * ? " < > |`, que são removidos enquanto você digita.

O botão com sol ou lua alterna a **interface** entre clara e escura. Isso não muda as cores dos slides.

**Coluna esquerda: abas de trabalho**, cada uma com sua cor:

| Aba | Para quê |
|---|---|
| Composição | Abrir, colar ou arrastar o texto; inserir blocos prontos |
| Acervo | Imagens e planilhas usadas na apresentação |
| Tabelas | Editar tabelas, importar CSV, converter em gráfico |
| Tema | Escolher o modelo visual e ajustar detalhes |
| Conferência | Advertências e condições do ambiente |
| Apresentar e exportar | Tela cheia, modo apresentador, arquivos finais |
| Biblioteca | Apresentações guardadas e publicadas |
| Guia | Referência rápida da sintaxe, com exemplos para copiar ou inserir no cursor, e atalhos de apresentação |

Navegue entre as abas com as setas **↑ ↓** e ative com **Enter**.

**Centro: texto.** Onde você escreve, com as linhas numeradas e cores que distinguem títulos, separadores, instruções e blocos. Uma faixa colorida na margem marca as linhas do slide em que está o cursor.

| Tecla no editor | Efeito |
|---|---|
| Tab / Shift+Tab | Recua / desfaz o recuo da linha |
| Esc e, em seguida, Tab | Sai do editor (para quem navega pelo teclado) |
| Ctrl+Z / Ctrl+Y | Desfaz / refaz — inclusive blocos inseridos pelos botões e a reordenação de slides |
| Ctrl+V com uma imagem copiada | Guarda a imagem no Acervo e a cita no ponto do cursor |

**Direita: pré-visualização** do slide em que está o cursor, atualizada enquanto você escreve. As setas **‹ ›** do cabeçalho levam o cursor ao slide anterior ou seguinte; **Apresentar daqui** abre a apresentação a partir dele. Na pré-visualização, os itens revelados aos poucos aparecem todos de uma vez.

**Faixa inferior: sequência de slides** em miniatura, com o número de cada slide e o atual destacado. Clique numa miniatura para levar o cursor ao slide. Para **mudar a ordem**, arraste a miniatura para outra posição — ou selecione-a com Tab e use **Alt+←** e **Alt+→**. O texto é reorganizado sozinho, e **Ctrl+Z** no editor desfaz. O slide de título fica sempre no início. Continuações de tabelas longas aparecem com borda tracejada e se movem junto com o slide de origem.

**Botão Apresentar** (barra superior): apresentação em tela cheia a partir do slide do cursor. Ao encerrar com **Esc**, o editor vai ao slide em que você parou.

## 4. Sua primeira apresentação

1. Na aba **Composição**, escolha **Novo projeto** — ou abra um **exemplo pronto** para ver tudo funcionando.
2. Preencha o cabeçalho (título, autor, data, tema) e escreva os slides, separados por uma linha com `---`.
3. Para acrescentar um slide já diagramado, use **Novo slide com layout**: ele entra logo após o slide do cursor. Para inserir uma lista progressiva, notas, colunas, tabela ou gráfico, use **Bloco no cursor**.
4. Arraste para a janela as imagens e planilhas que for usar; elas vão para o **Acervo** e podem ser citadas pelo nome.
5. Acompanhe o resultado na pré-visualização e os indicadores de slides, duração e peso na barra superior.
6. Clique em **Apresentar**.

Todos os botões de inserção podem ser desfeitos com **Ctrl+Z**. **Novo projeto** e a abertura de um exemplo substituem o trabalho atual: se houver texto, o botão pede um segundo toque para confirmar.

O esqueleto de qualquer apresentação é este:

```markdown
---
titulo: Introdução ao Orçamento Público
autor: Seu nome
data: 2026-10-05
tema: aurora
---

---
## Primeiro assunto

- Um ponto
- Outro ponto

---
## Segundo assunto

Texto corrido do slide.
```

O primeiro slide pode ficar vazio: o sistema monta a capa com o título, o autor e a data do cabeçalho.

### 4.1 Acervo: imagens e planilhas

Arraste imagens (PNG, JPEG, WebP, GIF, SVG) e planilhas CSV para qualquer ponto da janela, use **Acrescentar arquivos…** na aba **Acervo** ou cole uma imagem no editor com **Ctrl+V**. Tudo é lido no seu computador; nada vai para a internet.

- **Compressão automática.** Fotos com mais de 1.920 px no lado maior são reduzidas e convertidas para um formato mais leve. O cartão de cada arquivo mostra o peso final e quanto foi economizado; passe o mouse sobre o peso para ver o que foi feito. GIFs animados e desenhos SVG são mantidos como estão (o SVG passa por uma limpeza de segurança).
- **Qualidade.** O controle **Qualidade** equilibra nitidez e peso do arquivo final. Vale para as próximas imagens; **Recomprimir** reaplica às imagens acrescentadas desde que a página foi aberta.
- **Texto alternativo.** Descreva cada imagem no campo próprio: a descrição é usada ao inserir a imagem pelo botão **Inserir no cursor** e nos fundos de slide.
- **Citado N× / não citado.** Mostra se o arquivo é usado no texto. Só as imagens citadas entram na apresentação exportada.
- **Remover** pede um segundo toque para confirmar e não pode ser desfeito.

### 4.2 Aba Tabelas

Leve o cursor do editor para dentro de uma tabela e abra a aba **Tabelas**:

- **Tabela escrita:** cada célula vira um campo. Escolha o alinhamento de cada coluna, acrescente ou retire linhas e colunas e marque os estilos (linhas alternadas, compacta, números em padrão brasileiro, linha ou coluna realçada). Nada muda no texto até você clicar em **Gravar no texto** (Ctrl+Z desfaz). Enquanto houver alterações não gravadas, a aba continua presa a essa tabela, mesmo que o cursor saia dela.
- **Tabela de planilha** (bloco ```` ```tabela ````): escolha a planilha do acervo, as colunas, a ordenação, o limite de linhas e o estilo.
- **Fora de uma tabela:** crie uma tabela vazia com o número de linhas e colunas desejado, ou transforme uma planilha CSV do acervo em tabela — como **bloco de dados** (atualiza sozinho quando a planilha muda) ou como **tabela escrita** (editável célula a célula).
- **Converter em gráfico** insere, logo abaixo da tabela, um gráfico com os mesmos dados; a tabela permanece.

### 4.3 Aba Tema

- **Modelo:** escolha entre Aurora, Marfim, Grafite e Nanquim; cada cartão indica o ambiente recomendado. **Comparar com o slide atual** mostra o slide do cursor nos quatro modelos, lado a lado; clique num deles para aplicá-lo.
- **Ajustes finos:** cor de acento (se ela não for legível como texto, o sistema escurece ou clareia a cor dos links e explica o ajuste logo abaixo), grade de fundo e sua intensidade, e escala de todo o texto. **Restaurar padrão do modelo** desfaz esses ajustes.
- **Cabeçalho da apresentação:** proporção, transição, rodapé, numeração e logotipo. São gravados no início do texto, como se você os tivesse digitado (Ctrl+Z desfaz).
- **Minutos por slide:** fator do indicador de duração.

## 5. Escrevendo os slides: guia de sintaxe

### 5.1 Cabeçalho (front-matter)

Fica no início do texto, entre duas linhas `---`:

| Chave | Exemplo | Efeito |
|---|---|---|
| `titulo` | `Introdução ao Orçamento` | Título da capa e do arquivo |
| `subtitulo` | `Conceitos e instrumentos` | Linha abaixo do título na capa |
| `autor` | `Marcelo` | Exibido na capa |
| `data` | `2026-10-05` | Exibida por extenso: "5 de outubro de 2026" |
| `tema` | `aurora` | `aurora`, `marfim`, `grafite` ou `nanquim` |
| `proporcao` | `"16:9"` | `16:9` (panorâmica) ou `4:3` (clássica) |
| `rodape` | `"SEPLAG/CE · Uso educacional"` | Texto no pé de cada slide |
| `numeracao` | `true` | Mostra "3 / 12" no pé |
| `logotipo` | `logo.png` | Imagem do acervo no pé dos slides |
| `transicao` | `suave` | `nenhuma`, `suave` ou `deslizar` |

### 5.2 Separando slides

Uma linha contendo apenas `---` inicia um novo slide. Dentro de blocos de código, `---` é texto comum.

### 5.3 Instruções por slide (diretivas)

Escreva no **início** do slide, dentro de `<!-- -->`. Várias podem ir na mesma linha, separadas por `;`.

| Diretiva | Exemplo | Efeito |
|---|---|---|
| `layout` | `<!-- layout: duas-colunas -->` | Diagramação do slide (tabela abaixo) |
| `fundo` | `<!-- fundo: capa.jpg -->` | Imagem do acervo como fundo |
| `classe` | `<!-- classe: destaque -->` | Estilo adicional |
| `transicao` | `<!-- transicao: nenhuma -->` | Transição só deste slide |
| `colunas` | `<!-- layout: duas-colunas; colunas: 60/40 -->` | Proporção das colunas |
| `lado` | `<!-- layout: imagem-lateral; lado: direita -->` | Lado da imagem |

| Layout | Quando usar |
|---|---|
| `titulo` | Capa (automático no primeiro slide) |
| `secao` | Abertura de uma nova parte, com número de ordem |
| `conteudo` | Título e texto, listas ou código (padrão) |
| `duas-colunas` | Comparações, antes e depois |
| `imagem-lateral` | Imagem ocupando quase metade do slide, texto ao lado |
| `imagem-fundo` | Imagem em tela inteira, com título sobre ela |
| `citacao` | Uma frase em destaque, com autoria |
| `tabela` | Tabelas grandes, aproveitando toda a área |
| `encerramento` | Agradecimento e contato |

Uma diretiva com erro de digitação é ignorada e aparece como advertência na Conferência.

### 5.4 Texto

| Escreva | Resultado |
|---|---|
| `## Título do slide` | Título (o primeiro `#` ou `##` do slide) |
| `**negrito**`, `*itálico*` | **negrito**, *itálico* |
| `- item` | Lista com marcadores |
| `1. item` | Lista numerada |
| `> frase` | Citação |
| `[texto](https://…)` | Link (abre em nova janela) |

Aspas retas viram tipográficas (“assim”) automaticamente.

### 5.5 Blocos especiais

```markdown
::: destaque
Texto em evidência, com a cor de acento do tema.
:::

::: fragmento
- Aparece primeiro
- Aparece depois
:::

::: notas
Lembretes do orador. Nunca aparecem no slide.
:::

::: colunas
::: coluna
Coluna da esquerda
:::
::: coluna
Coluna da direita
:::
:::
```

No `fragmento`, uma lista revela **um item de cada vez**; qualquer outro conteúdo aparece de uma só vez.

### 5.6 Imagens

```markdown
![Mapa do Ceará com as regiões de planejamento](mapa.png){.contida .sombra width=60%}
```

- O texto entre colchetes **descreve a imagem** para quem não pode vê-la. Sem ele, a Conferência adverte.
- A imagem é procurada no **Acervo** pelo nome do arquivo; o caminho de pastas é indiferente.
- Estilos: `.contida` (sem cortes), `.sombra`, `.borda`, `.redonda`; tamanho com `width=`.
- Imagens da internet (`https://…`) não aparecem no arquivo exportado: acrescente-as ao Acervo.

### 5.7 Tabelas

```markdown
| Órgão  | Dotação   | Empenhado |
|--------|----------:|----------:|
| SEPLAG | 1234567,5 | 987654,25 |
| SEDUC  | 9876543   | 8765432   |
{.zebra .numerica .destacar-linha-2}
```

| Estilo | Efeito |
|---|---|
| `.zebra` | Linhas alternadas |
| `.compacta` | Menos espaço entre linhas |
| `.numerica` | Números no padrão brasileiro (1.234.567,50), alinhados à direita |
| `.destacar-linha-N` / `.destacar-coluna-N` | Realça a linha ou coluna N |

`:---:` centraliza e `---:` alinha à direita.

**Tabela a partir de um arquivo CSV do Acervo:**

````markdown
```tabela
fonte: execucao_2025.csv
colunas: Órgão, Dotação, Empenhado
ordenar: Dotação desc
limite: 12
classes: zebra numerica
```
````

| Linha | Significado |
|---|---|
| `fonte` | Nome do arquivo CSV no Acervo (separador `;` ou `,` é reconhecido sozinho) |
| `colunas` | Quais colunas mostrar, na ordem desejada (acentos e maiúsculas são indiferentes) |
| `ordenar` | Coluna e sentido: `desc` (maior primeiro) ou `asc` |
| `limite` | Quantidade máxima de linhas |
| `classes` | Os mesmos estilos das tabelas escritas à mão |

**Tabelas longas.** Se a tabela não couber no slide, o sistema reduz a letra aos poucos, até um mínimo legível (18 px; 22 px no tema Nanquim). Se ainda assim não couber, divide a tabela em slides seguidos, repete o cabeçalho e acrescenta "(continuação)" ao título. O indicador de slides já conta essas continuações.

### 5.8 Código

````markdown
```sql
SELECT orgao, SUM(valor) FROM despesa GROUP BY orgao;
```
````

Linguagens com cores: `js`, `python`, `sql`, `bash`, `json`, `html`, `css`.

### 5.9 Gráficos

````markdown
```grafico
tipo: barras
fonte: execucao_2025.csv
rotulos: Órgão
series: Dotação, Empenhado
ordenar: Dotação desc
limite: 6
titulo: Maiores dotações
```
````

| Linha | Significado |
|---|---|
| `tipo` | `barras`, `linhas`, `pizza` ou `rosca` |
| `fonte` | Arquivo CSV do Acervo (ou `dados`, abaixo) |
| `rotulos` | Coluna com os nomes das categorias (padrão: a primeira) |
| `series` | Colunas numéricas a desenhar (padrão: todas as numéricas) |
| `ordenar`, `limite` | Como nas tabelas |
| `alternavel` | `false` esconde o seletor de tipo (padrão: visível) |
| `titulo` | Legenda acima do gráfico |

Dados curtos podem ir no próprio bloco:

````markdown
```grafico
tipo: rosca
dados: |
  Área,Participação
  Educação,38
  Saúde,27
  Outras,35
```
````

Durante a apresentação, os botões **Barras · Linhas · Pizza · Rosca** trocam a forma do gráfico. As cores seguem o tema. Pizza e rosca mostram só a primeira série. Para quem usa leitor de tela, o gráfico traz uma tabela com os mesmos números.

### 5.10 Importando documentos *(em preparação)*

Um documento existente pode servir de ponto de partida. O Apresenta o converte em texto de slides, que você revisa antes de apresentar. Tudo acontece no seu computador: nada é enviado pela internet.

| Formato | O que é aproveitado |
|---|---|
| Word (`.docx`) e LibreOffice (`.odt`) | Títulos, listas, tabelas, imagens, negrito e itálico |
| Planilhas (`.xlsx`, `.xls`) | Cada planilha vira fonte de dados para tabelas e gráficos |
| PDF (`.pdf`) | Modo texto (títulos deduzidos pelo tamanho da letra) ou modo páginas (cada página vira um slide em imagem) |
| Word antigo (`.doc`) | Apenas o texto; prefira salvar como `.docx` antes |

Os títulos do documento definem onde começa cada slide; o nível é escolhido no assistente de importação.

## 6. Escolhendo o tema conforme o ambiente

| Tema | Fundo | Indicado para |
|---|---|---|
| **Aurora** | Claro, frio | Salas de aula e reuniões com luz plena; conteúdo técnico e institucional |
| **Marfim** | Claro, quente | Aulas expositivas, humanidades, palestras reflexivas; luz quente |
| **Grafite** | Escuro, frio | Auditórios e salas escurecidas; dados e sistemas |
| **Nanquim** | Escuro, quente, alto contraste | Grandes auditórios e projeção a distância |

Regra prática: **sala clara, fundo claro; sala escura, fundo escuro.** Sob luz ambiente, o fundo escuro "lava" e perde contraste; no escuro, o fundo claro ofusca.

Os quatro temas atendem ao nível AA de contraste em todos os textos. Cada um tem personalidade própria: o **Aurora** traz uma grade técnica discreta; o **Marfim**, títulos serifados, fundo que lembra papel e filete dourado nas tabelas; o **Grafite**, grade técnica, rótulos em letra de máquina e tabelas sem fundo no cabeçalho; o **Nanquim**, títulos maiores e serifados e um halo dourado no canto.

**Exemplos prontos.** A pasta `exemplos/` traz uma apresentação completa para cada tema, com imagens, planilhas e gráficos, que servem de modelo. Os dados são fictícios.

## 7. Apresentando

Use o botão **Apresentar** da barra superior (a partir do slide do cursor) ou a aba **Apresentar e exportar** (**Do início** ou **Do slide atual**). Os comandos abaixo valem no editor e nos arquivos exportados.

### 7.1 Atalhos de teclado

| Tecla | Ação |
|---|---|
| → ↓ Espaço PageDown | Avança: revela o próximo item ou passa ao slide seguinte |
| ← ↑ PageUp | Volta: recolhe o último item revelado ou retorna ao slide anterior |
| Home / End | Primeiro / último slide |
| **G**, número, Enter | Vai direto ao slide indicado |
| **O** | Visão geral: todos os slides em miniatura; escolha com as setas e Enter |
| **B** ou **.** | Escurece a tela (pausa); repita para voltar |
| **F** | Tela cheia |
| **P** | Modo apresentador em outra janela |
| Esc | Fecha a visão geral ou a tela escura; no editor, encerra a apresentação |

Também é possível avançar com um clique no slide (exceto sobre gráficos, links e botões) e, em telas de toque, deslizando o dedo. Ao mover o mouse, surge no canto inferior direito uma pequena barra com os mesmos comandos.

### 7.2 Modo apresentador

A tecla **P** abre uma segunda janela, para o seu monitor, enquanto a plateia vê a apresentação no projetor. Ela mostra:

- o slide em exibição (itens ainda não revelados aparecem esmaecidos) e o próximo;
- as **notas do orador** escritas em `::: notas`;
- o número do slide, o tempo decorrido e o horário;
- botões para avançar, voltar, escurecer a tela da plateia e zerar o cronômetro.

As setas e o espaço funcionam também nessa janela. Se o navegador bloquear a abertura, permita janelas *pop-up* para o arquivo ou endereço da apresentação e tecle **P** de novo.

**Dica para dois monitores:** arraste a janela da apresentação para o projetor e tecle **F**; mantenha a janela do apresentador no seu monitor.

### 7.3 Endereço de um slide

No arquivo exportado, o endereço termina em `#/7` quando você está no slide 7. Abrir o arquivo com esse final leva direto ao slide — útil para retomar uma aula de onde parou.

## 8. Exportando

Tudo fica na aba **Apresentar e exportar**. Os arquivos vão para a pasta de downloads do navegador, com o título e a data no nome (por exemplo, `introducao-ao-orcamento_2026-10-05.html`).

| Botão | Gera | Para quê |
|---|---|---|
| **Exportar em HTML** | `.html` | A apresentação pronta, num único arquivo. Abre com duplo clique em qualquer navegador, sem internet. Todos os atalhos de teclado, a visão geral e o modo apresentador funcionam nele. |
| **Exportar projeto** | `.oratoria.json` | Tudo o que compõe o trabalho (texto, imagens, planilhas, ajustes). Serve para continuar em outro computador ou guardar uma cópia de segurança. |
| **Abrir projeto…** | — | Reabre um `.oratoria.json`. Também é possível arrastá-lo para a janela. |
| **Texto (.md)** | `.md` | Só o texto, para editar em outro programa. |
| **Texto e acervo (.zip)** | `.zip` | O texto e todos os arquivos do acervo numa pasta. Depois de extraída, a pasta pode ser reaberta com **Abrir pasta**. |

Ao terminar, um aviso mostra o tamanho real do arquivo e a estimativa do indicador **Arquivo**.

**No arquivo HTML exportado:**

- Nada é buscado na internet. Imagens citadas por endereço da web (`https://…`) não aparecem: acrescente-as ao Acervo antes de exportar. O aviso da exportação e a aba Conferência indicam os casos.
- O endereço termina em `#/7` quando você está no slide 7; abrir o arquivo com esse final leva direto ao slide.

**Abrir um projeto** substitui o trabalho atual. Se houver trabalho em andamento, uma faixa acima do editor pede confirmação. O trabalho substituído fica guardado neste navegador e é oferecido em **Retomar** na próxima abertura. Por segurança, imagens em formato não aceito e itens estranhos ao projeto são descartados, com aviso.

PDF (direto e pela impressão): *(em preparação)*.

## 9. Biblioteca *(em preparação)*

Apresentações guardadas no navegador, numa pasta do computador ou pendrive, ou publicadas no GitHub.

## 10. Guarda automática e transporte do trabalho

O trabalho é guardado automaticamente **no navegador** deste computador, dois segundos depois da última alteração.

**Retomar.** Ao abrir o Apresenta, se houver um trabalho guardado, uma faixa acima do editor mostra o título, a data e o tamanho e oferece **Retomar**. Se você começar outro trabalho sem retomar, o anterior continua guardado à parte e a faixa volta a oferecê-lo na próxima abertura, até que outro rascunho o substitua.

Atenção:

- A guarda fica ligada ao **local** de onde o Apresenta foi aberto. Se a pasta for movida ou aberta de outro pendrive, os rascunhos **não** a acompanham.
- Para levar o trabalho a outro computador, use **Exportar projeto** (`.oratoria.json`) e, no destino, **Abrir projeto…** ou arraste o arquivo para a janela.
- Se a Conferência indicar "Guarda apenas nesta sessão", o navegador recusou a guarda: exporte o trabalho antes de fechar a página.

## 11. Conferência

O cartão **Condições do ambiente** informa se tudo está em ordem neste computador:

| Item | Significado |
|---|---|
| Modo de abertura | Arquivo local ou publicado |
| Bibliotecas locais | Os componentes da pasta `vendor/` foram lidos |
| Fontes IBM Plex | As fontes da pasta `assets/fontes/` foram lidas |
| Guarda automática | Se o navegador aceita guardar o trabalho |
| Recursos de exportação | Se a pasta `embutiveis/` pode ser lida |
| Conexão com a internet | Necessária só para recursos opcionais |

**Advertências** — revistas automaticamente um segundo depois de cada alteração. A aba mostra, ao lado do nome, quantas advertências e impedimentos há.

| Gravidade | Exemplos | O que fazer |
|---|---|---|
| **Impedimento** | Cabeçalho ilegível; bloco de tabela ou gráfico com erro | Corrija no texto: o slide não sai como esperado |
| **Advertência** | Imagem sem descrição ou não encontrada no acervo; slide sem título; contraste insuficiente do tema; imagem pesada; instrução desconhecida | Recomenda-se corrigir antes de apresentar |
| **Observação** | Tabela dividida em vários slides ou com a letra reduzida; arquivo do acervo não citado | Apenas informa |

Cada item indica o slide e a linha. **Ir ao texto** leva o cursor até lá; **Ver no acervo** e **Abrir Tema** levam à aba onde o ajuste é feito.

**Contraste do tema** — tabela com a legibilidade de cada par de cores do tema escolhido (texto sobre fundo, links, cabeçalho de tabela, eixos de gráfico), já com a sua cor de acento. O mínimo recomendado (nível AA) é 4,5:1 para texto comum e 3:1 para títulos.

## 12. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Página em branco ou sem estilos | Aberto de dentro do zip | Extraia o zip e abra o `index.html` extraído |
| "Bibliotecas locais: ausentes" | Pasta `vendor/` incompleta | Copie novamente a pasta inteira |
| Fontes diferentes do esperado | Pasta `assets/fontes/` ausente | Copie novamente a pasta inteira |
| Rascunho sumiu | Pasta movida ou outro navegador | Use o projeto `.oratoria.json` para transportar |
| "Imagem não encontrada no acervo" | Nome do arquivo diferente do citado | Confira maiúsculas, extensão e se a imagem foi carregada |

## 13. Glossário

| Termo | Significado |
|---|---|
| **Markdown** | Forma simples de escrever texto formatado com símbolos (`#`, `-`, `**`) |
| **Front-matter** | Cabeçalho entre `---` com dados da apresentação |
| **Diretiva** | Instrução para um slide, escrita entre `<!--` e `-->` |
| **Layout** | Diagramação de um slide |
| **Tema** | Conjunto de cores e fontes da apresentação |
| **Acervo** | Imagens e planilhas carregadas para uso nos slides |
| **Fragmento** | Parte do slide revelada aos poucos |
| **Texto alternativo** | Descrição de uma imagem para leitores de tela |
| **Contraste AA** | Nível mínimo de legibilidade recomendado internacionalmente (WCAG) |
