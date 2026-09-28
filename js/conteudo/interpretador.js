// js/conteudo/interpretador.js — do Markdown estendido (§4) aos slides sanitizados.
//
//   const r = O.conteudo.interpretar(markdown, { resolverImagem, resolverArquivo });
//   r.meta     → front-matter normalizado (titulo, autor, data, dataFormatada, tema, proporcao, …)
//   r.slides   → [{ indice, layout, diretivas, classes, fundo, transicao, html, notas,
//                   titulo, linhaInicio, linhaFim, avisos }]
//   r.avisos   → [{ gravidade: 'erro'|'aviso'|'info', codigo, mensagem, slide, linha }]
//
// Etapas: front-matter (YAML) → separação por '---' fora de blocos de código → diretivas em
// comentários no início de cada slide → pré-processamento (atributos de tabela, aninhamento
// de contêineres) → markdown-it com plugins → DOMPurify (D11) → pós-processamento
// (notas, fragmentos, tabelas numéricas).
//
// Blocos cercados especiais (```tabela, ```grafico, …) são renderizados por funções
// registradas em O.conteudo.blocos (tabelas.js, graficos.js); sem registro, viram um aviso visível.

(function (O) {
  'use strict';

  const I = O.conteudo;
  const U = O.util;
  const C = O.config;
  const R = O.rotulos;

  const DIRETIVAS = ['layout', 'fundo', 'classe', 'transicao', 'colunas', 'lado'];
  const CONTEINERES = ['colunas', 'coluna', 'fragmento', 'notas', 'destaque'];
  const TRANSICOES = ['nenhuma', 'suave', 'deslizar'];
  const CHAVES_META = ['titulo', 'subtitulo', 'autor', 'data', 'tema', 'proporcao', 'rodape', 'numeracao', 'logotipo', 'transicao', 'idioma'];

  // ═══════════════════════ Registro de blocos cercados ═══════════════════════

  const blocos = new Map();
  I.blocos = {
    /** fn(spec, contexto) → HTML (será sanitizado). contexto: { resolverArquivo, avisar, slide } */
    registrar(tipo, fn, { rotulo } = {}) { blocos.set(tipo, { fn, rotulo: rotulo || tipo }); },
    existe: (tipo) => blocos.has(tipo),
    tipos: () => Array.from(blocos.keys()),
  };
  const TIPOS_RESERVADOS = ['tabela', 'grafico', 'diagrama', 'formula'];

  /** Lê o corpo "chave: valor" de um bloco especial; aceita YAML completo. */
  I.lerEspecificacao = function (texto) {
    try {
      const v = window.jsyaml.load(texto);
      if (v && typeof v === 'object' && !Array.isArray(v)) return { spec: v, erro: null };
      return { spec: {}, erro: 'O bloco deve conter linhas no formato "chave: valor".' };
    } catch (e) {
      return { spec: {}, erro: `Especificação ilegível: ${e.reason || e.message}` };
    }
  };

  // ═══════════════════════════════ Front-matter ═══════════════════════════════

  const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  /** Separa o front-matter YAML (--- no início … ---). Retorna { meta, corpo, linhasOcupadas, erro }. */
  I.extrairFrontMatter = function (texto) {
    const m = texto.match(/^(?:\uFEFF)?---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (!m) return { meta: {}, corpo: texto, linhasOcupadas: 0, erro: null };
    const linhasOcupadas = m[0].split('\n').length - (m[0].endsWith('\n') ? 1 : 0);
    try {
      const meta = window.jsyaml.load(m[1]) || {};
      if (typeof meta !== 'object' || Array.isArray(meta)) throw new Error('o cabeçalho deve ser uma lista de "chave: valor"');
      return { meta, corpo: texto.slice(m[0].length), linhasOcupadas, erro: null };
    } catch (e) {
      return { meta: {}, corpo: texto.slice(m[0].length), linhasOcupadas, erro: e.reason || e.message };
    }
  };

  function normalizarMeta(bruto, avisar) {
    const meta = {};
    for (const [k, v] of Object.entries(bruto || {})) {
      if (!CHAVES_META.includes(k)) avisar('info', 'meta-desconhecida', `Chave "${k}" do cabeçalho não é reconhecida e será ignorada.`);
      else meta[k] = v;
    }
    meta.titulo = meta.titulo != null ? String(meta.titulo) : '';
    if (meta.subtitulo != null) meta.subtitulo = String(meta.subtitulo);
    if (meta.autor != null) meta.autor = String(meta.autor);
    if (meta.data != null) {
      const d = meta.data instanceof Date ? meta.data : new Date(String(meta.data));
      meta.dataFormatada = Number.isNaN(d.getTime()) ? String(meta.data) : FORMATO_DATA.format(d);
      meta.data = Number.isNaN(d.getTime()) ? String(meta.data) : d.toISOString().slice(0, 10);
    }
    meta.tema = meta.tema ? String(meta.tema) : C.TEMA_PADRAO;
    if (O.temas.lista().length && !O.temas.existe(meta.tema)) {
      avisar('aviso', 'tema-desconhecido', `Tema "${meta.tema}" não está registrado; será usado "${O.temas.obter(C.TEMA_PADRAO)?.nome || C.TEMA_PADRAO}".`);
      meta.tema = O.temas.obter(C.TEMA_PADRAO)?.id || C.TEMA_PADRAO;
    }
    meta.proporcao = String(meta.proporcao || C.PROPORCAO_PADRAO);
    if (!C.PROPORCOES[meta.proporcao]) {
      avisar('aviso', 'proporcao-invalida', `Proporção "${meta.proporcao}" inválida; use 16:9 ou 4:3.`);
      meta.proporcao = C.PROPORCAO_PADRAO;
    }
    meta.transicao = TRANSICOES.includes(meta.transicao) ? meta.transicao : C.TRANSICAO_PADRAO;
    meta.numeracao = meta.numeracao === true || meta.numeracao === 'true' || meta.numeracao === 'sim';
    if (meta.rodape != null) meta.rodape = String(meta.rodape);
    return meta;
  }

  // ═══════════════════════════ Separação dos slides ═══════════════════════════

  const ABRE_CERCA = /^ {0,3}(`{3,}|~{3,})/;

  /**
   * Divide o corpo em slides por linhas '---' isoladas fora de blocos cercados (D7).
   * `deslocamento` = linhas ocupadas pelo front-matter. Linhas numeradas a partir de 1.
   */
  I.separarSlides = function (corpo, deslocamento = 0) {
    const linhas = corpo.split('\n');
    const slides = [];
    let atual = [];
    let inicio = deslocamento + 1;
    let cerca = null;
    linhas.forEach((linha, i) => {
      const numero = deslocamento + i + 1;
      if (cerca) {
        const fecha = linha.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (fecha && fecha[1][0] === cerca[0] && fecha[1].length >= cerca.length) cerca = null;
        atual.push(linha);
        return;
      }
      const abre = linha.match(ABRE_CERCA);
      if (abre) { cerca = abre[1]; atual.push(linha); return; }
      if (/^---[ \t]*$/.test(linha)) {
        slides.push({ texto: atual.join('\n'), linhaInicio: inicio, linhaFim: numero - 1 });
        atual = [];
        inicio = numero + 1;
        return;
      }
      atual.push(linha);
    });
    slides.push({ texto: atual.join('\n'), linhaInicio: inicio, linhaFim: deslocamento + linhas.length });
    // Slides vazios ao final (ex.: '---' de encerramento) são descartados. O primeiro slide
    // vazio é preservado: é o slide de título montado a partir do front-matter.
    while (slides.length > 1 && !slides[slides.length - 1].texto.trim()) slides.pop();
    return slides;
  };

  /** Contagem rápida (sem renderizar), para os indicadores. */
  I.contarSlides = function (markdown) {
    const fm = I.extrairFrontMatter(String(markdown || '').replace(/\r\n?/g, '\n'));
    if (!fm.corpo.trim()) return 0;
    return I.separarSlides(fm.corpo, fm.linhasOcupadas).length;
  };

  // ═══════════════════════════════ Diretivas ═══════════════════════════════

  /** Lê comentários <!-- chave: valor --> no início do slide (vários, ou separados por ';'). */
  I.lerDiretivas = function (texto) {
    const linhas = texto.split('\n');
    const diretivas = {};
    const invalidas = [];
    let i = 0;
    let consumidas = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      if (!l.trim()) { i++; continue; }
      const m = l.match(/^\s*<!--\s*([\s\S]*?)\s*-->\s*$/);
      if (!m || !/^[\w-]+\s*:/.test(m[1])) break;
      for (const parte of m[1].split(';')) {
        const p = parte.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
        if (!p) continue;
        const chave = U.removerAcentos(p[1].toLowerCase());
        if (DIRETIVAS.includes(chave)) diretivas[chave] = p[2];
        else invalidas.push(p[1]);
      }
      i++;
      consumidas = i;
    }
    return { diretivas, invalidas, restante: linhas.slice(consumidas).join('\n'), linhasConsumidas: consumidas };
  };

  // ═════════════════════════════ Pré-processamento ═════════════════════════════

  /**
   * (a) Atributos de tabela na linha imediatamente seguinte: insere a linha em branco que o
   *     markdown-it-attrs exige.
   * (b) Contêineres aninhados com marcadores iguais (::: colunas / ::: coluna / ::: / :::):
   *     o markdown-it-container fecharia o externo no primeiro ':::'; reescrevemos os
   *     marcadores externos com mais dois-pontos, conforme a profundidade.
   */
  I.preprocessar = function (texto) {
    const linhas = texto.split('\n');
    const saida = [];
    let cerca = null;
    const pilha = [];     // { indiceSaida, filhos: altura máxima dos filhos }
    const pares = [];     // { abre, fecha, altura }
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (cerca) {
        const fecha = l.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (fecha && fecha[1][0] === cerca[0] && fecha[1].length >= cerca.length) cerca = null;
        saida.push(l); continue;
      }
      const abreCerca = l.match(ABRE_CERCA);
      if (abreCerca) { cerca = abreCerca[1]; saida.push(l); continue; }

      // (a) atributos de tabela
      if (/^\s*\{[^{}]*\}\s*$/.test(l) && saida.length && /^\s*\|/.test(saida[saida.length - 1])) saida.push('');

      // (b) contêineres
      const abre = l.match(/^(\s*):{3,}\s*([\w-]+)(.*)$/);
      const fecha = /^\s*:{3,}\s*$/.test(l);
      if (abre && CONTEINERES.includes(abre[2])) {
        pilha.push({ indice: saida.length, altura: 0 });
      } else if (fecha && pilha.length) {
        const topo = pilha.pop();
        const altura = topo.altura + 1;
        pares.push({ abre: topo.indice, fecha: saida.length, altura });
        if (pilha.length) pilha[pilha.length - 1].altura = Math.max(pilha[pilha.length - 1].altura, altura);
      }
      saida.push(l);
    }
    for (const p of pares) {
      if (p.altura < 2) continue;
      const dois = ':'.repeat(2 + p.altura);
      saida[p.abre] = saida[p.abre].replace(/:{3,}/, dois);
      saida[p.fecha] = saida[p.fecha].replace(/:{3,}/, dois);
    }
    return saida.join('\n');
  };

  // ═══════════════════════════════ markdown-it ═══════════════════════════════

  let md = null;

  function criarMarkdownIt() {
    if (!window.markdownit) throw new Error('markdown-it não foi carregado (vendor/markdown-it.min.js).');
    const m = window.markdownit({
      html: true, linkify: true, typographer: true, breaks: false,
      quotes: '“”‘’',
      highlight(codigo, linguagem) {
        const hl = window.hljs;
        if (hl && linguagem && hl.getLanguage(linguagem)) {
          try { return hl.highlight(codigo, { language: linguagem, ignoreIllegals: true }).value; } catch (_) { /* segue sem realce */ }
        }
        return '';
      },
    });
    m.use(window.markdownItAttrs, { allowedAttributes: ['id', 'class', 'width', 'height', 'title', 'lang', /^data-/] });
    for (const nome of CONTEINERES) {
      const tag = nome === 'notas' ? 'aside' : 'div';
      const classe = nome === 'notas' ? 'o-notas' : nome;
      m.use(window.markdownitContainer, nome, {
        render(tokens, idx) { return tokens[idx].nesting === 1 ? `<${tag} class="${classe}">\n` : `</${tag}>\n`; },
      });
    }

    // Imagens: resolução no acervo e avisos de acessibilidade
    const imagemPadrao = m.renderer.rules.image;
    m.renderer.rules.image = function (tokens, idx, opcoes, env, self) {
      const t = tokens[idx];
      const src = t.attrGet('src') || '';
      const alt = self.renderInlineAsText(t.children || [], opcoes, env).trim();
      t.attrSet('alt', alt);
      const nome = U.nomeBase(src);
      if (!alt) env.avisar('aviso', 'alt-ausente', `Imagem "${nome}" sem texto alternativo: descreva-a entre os colchetes ![assim](${nome}).`);
      if (/^data:/i.test(src)) return imagemPadrao(tokens, idx, opcoes, env, self);
      if (/^https?:\/\//i.test(src)) {
        env.avisar('aviso', 'imagem-externa', `Imagem externa (${src.slice(0, 60)}…) não será exibida na apresentação exportada, que bloqueia a rede. Acrescente o arquivo ao acervo.`);
        return imagemPadrao(tokens, idx, opcoes, env, self);
      }
      const r = env.resolverImagem ? env.resolverImagem(src) : null;
      if (!r) {
        env.avisar('aviso', 'imagem-ausente', `Imagem "${nome}" não encontrada no acervo.`);
        return `<span class="o-imagem-ausente" data-imagem="${U.escaparHtml(nome)}">Imagem não encontrada no acervo: ${U.escaparHtml(nome)}</span>`;
      }
      t.attrSet('src', r.src);
      t.attrSet('data-arquivo', r.nome || nome);
      return imagemPadrao(tokens, idx, opcoes, env, self);
    };

    // Links externos em nova janela, sem vazar a origem
    const linkPadrao = m.renderer.rules.link_open || ((tokens, idx, opcoes, env, self) => self.renderToken(tokens, idx, opcoes));
    m.renderer.rules.link_open = function (tokens, idx, opcoes, env, self) {
      const href = tokens[idx].attrGet('href') || '';
      if (/^https?:\/\//i.test(href)) { tokens[idx].attrSet('target', '_blank'); tokens[idx].attrSet('rel', 'noopener noreferrer'); }
      return linkPadrao(tokens, idx, opcoes, env, self);
    };

    // Blocos cercados especiais
    const cercaPadrao = m.renderer.rules.fence;
    m.renderer.rules.fence = function (tokens, idx, opcoes, env, self) {
      const t = tokens[idx];
      const tipo = (t.info || '').trim().split(/\s+/)[0];
      if (!blocos.has(tipo) && !TIPOS_RESERVADOS.includes(tipo)) return cercaPadrao(tokens, idx, opcoes, env, self);
      const { spec, erro } = I.lerEspecificacao(t.content);
      if (erro) {
        env.avisar('erro', 'bloco-invalido', `Bloco "${tipo}": ${erro}`);
        return `<div class="o-imagem-ausente">Bloco "${U.escaparHtml(tipo)}" com erro: ${U.escaparHtml(erro)}</div>`;
      }
      const registrado = blocos.get(tipo);
      if (!registrado) {
        env.avisar('info', 'bloco-indisponivel', `Blocos "${tipo}" ainda não são renderizados nesta versão.`);
        return `<div class="o-bloco o-bloco-pendente" data-bloco="${U.escaparHtml(tipo)}">Bloco "${U.escaparHtml(tipo)}" reconhecido; a renderização chega numa próxima versão.</div>`;
      }
      try {
        return registrado.fn(spec, { resolverArquivo: env.resolverArquivo, avisar: env.avisar, slide: env.slide, meta: env.meta });
      } catch (e) {
        env.avisar('erro', 'bloco-falhou', `Bloco "${tipo}": ${e.message}`);
        return `<div class="o-imagem-ausente">Bloco "${U.escaparHtml(tipo)}" não pôde ser montado: ${U.escaparHtml(e.message)}</div>`;
      }
    };
    return m;
  }

  I.markdownIt = () => (md || (md = criarMarkdownIt()));

  // ═══════════════════════════════ Sanitização ═══════════════════════════════

  const CONFIG_PURIFY = {
    ADD_TAGS: ['canvas', 'figure', 'figcaption'],
    ADD_ATTR: ['target', 'data-arquivo', 'data-bloco', 'data-spec', 'aria-hidden', 'role'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base'],
    FORBID_ATTR: ['srcset'],
    ALLOW_DATA_ATTR: true,
    // URIs: regra padrão do DOMPurify (data: somente em imagens e mídia).
  };
  I.sanitizar = (html) => window.DOMPurify.sanitize(html, CONFIG_PURIFY);

  // ═════════════════════════════ Pós-processamento ═════════════════════════════

  function posProcessar(html, env) {
    const modelo = document.createElement('template');
    modelo.innerHTML = html;
    const raiz = modelo.content;

    // Notas do orador: nunca aparecem no slide
    const notas = [];
    raiz.querySelectorAll('.o-notas').forEach((n) => { notas.push(n.innerHTML.trim()); n.remove(); });

    // Fragmentos: bloco com uma única lista → cada item; caso contrário, o bloco inteiro
    raiz.querySelectorAll('.fragmento').forEach((f) => {
      const filhos = Array.from(f.children);
      if (filhos.length === 1 && /^(UL|OL)$/.test(filhos[0].tagName)) {
        filhos[0].querySelectorAll(':scope > li').forEach((li) => li.classList.add('o-fragmento'));
        f.replaceWith(filhos[0]);
      } else {
        f.classList.remove('fragmento');
        f.classList.add('o-fragmento');
      }
    });

    // Tabelas numéricas (.numerica): colunas inteiramente numéricas formatadas em pt-BR
    raiz.querySelectorAll('table.numerica').forEach(formatarTabelaNumerica);

    // Título do slide (para listagens e conferência)
    const cab = raiz.querySelector('h1, h2');
    const titulo = cab ? cab.textContent.trim() : '';

    return { html: modelo.innerHTML, notas: notas.join('\n'), titulo };
  }

  /** Formata as colunas numéricas de uma tabela e as alinha à direita. */
  function formatarTabelaNumerica(tabela) {
    const linhas = Array.from(tabela.querySelectorAll('tbody tr'));
    if (!linhas.length) return;
    const colunas = Math.max(...linhas.map((l) => l.children.length));
    for (let j = 0; j < colunas; j++) {
      const celulas = linhas.map((l) => l.children[j]).filter(Boolean);
      const textos = celulas.map((c) => c.textContent.trim());
      const preenchidas = textos.filter(Boolean);
      if (!preenchidas.length || !preenchidas.every((t) => Number.isFinite(U.lerNumero(t)))) continue;
      const moeda = preenchidas.every((t) => /^R\$/i.test(t));
      const pct = preenchidas.every((t) => /%$/.test(t));
      const casas = Math.min(2, Math.max(0, ...preenchidas.map((t) => {
        const s = t.replace(/^R\$\s*/i, '').replace(/%$/, '');
        const n = U.lerNumero(s);
        return Number.isInteger(n) ? 0 : (String(n).split('.')[1] || '').length;
      })));
      celulas.forEach((c, i) => {
        c.classList.add('o-num');
        if (!textos[i]) return;
        const n = U.lerNumero(textos[i]);
        c.textContent = moeda ? U.formatarMoeda(n) : `${U.formatarNumero(n, moeda ? 2 : casas)}${pct ? '%' : ''}`;
      });
      tabela.querySelectorAll(`thead tr > :nth-child(${j + 1})`).forEach((th) => th.classList.add('o-num'));
    }
  }

  // ═════════════════════════════ Interpretação ═════════════════════════════

  const cache = new Map(); // chave → resultado de slide (sem índice)
  const LIMITE_CACHE = 600;
  let assinaturaContexto = '';

  /**
   * Interpreta o Markdown completo. `opcoes.assinatura` deve mudar quando o acervo mudar
   * (invalida o cache de slides já renderizados).
   */
  I.interpretar = function (markdown, opcoes = {}) {
    const texto = String(markdown || '').replace(/\r\n?/g, '\n');
    const avisos = [];
    const avisarGeral = (gravidade, codigo, mensagem, extra = {}) => avisos.push(Object.assign({ gravidade, codigo, mensagem, slide: null, linha: null }, extra));

    const fm = I.extrairFrontMatter(texto);
    if (fm.erro) avisarGeral('erro', 'frontmatter-invalido', `Cabeçalho (front-matter) ilegível: ${fm.erro}`, { linha: 1 });
    const meta = normalizarMeta(fm.meta, avisarGeral);

    const assinatura = `${opcoes.assinatura || ''}|${JSON.stringify(meta)}`;
    if (assinatura !== assinaturaContexto) { cache.clear(); assinaturaContexto = assinatura; }

    const brutos = fm.corpo.trim() ? I.separarSlides(fm.corpo, fm.linhasOcupadas) : [];
    const slides = brutos.map((bruto, indice) => {
      const chave = `${indice === 0 ? '1:' : 'n:'}${bruto.texto}`;
      let base = cache.get(chave);
      if (!base) {
        base = interpretarSlide(bruto.texto, indice, meta, opcoes);
        if (cache.size >= LIMITE_CACHE) cache.delete(cache.keys().next().value);
        cache.set(chave, base);
      }
      const avisosSlide = base.avisos.map((a) => Object.assign({}, a, { slide: indice, linha: bruto.linhaInicio }));
      avisos.push(...avisosSlide);
      return Object.assign({}, base, { indice, linhaInicio: bruto.linhaInicio, linhaFim: bruto.linhaFim, avisos: avisosSlide });
    });

    return { meta, slides, avisos };
  };

  function interpretarSlide(textoSlide, indice, meta, opcoes) {
    const avisos = [];
    const avisar = (gravidade, codigo, mensagem) => avisos.push({ gravidade, codigo, mensagem });
    const { diretivas, invalidas, restante } = I.lerDiretivas(textoSlide);
    invalidas.forEach((k) => avisar('aviso', 'diretiva-desconhecida', `Diretiva "${k}" desconhecida. Válidas: ${DIRETIVAS.join(', ')}.`));

    let layout = diretivas.layout ? diretivas.layout.trim() : (indice === 0 ? C.LAYOUT_PRIMEIRO_SLIDE : C.LAYOUT_PADRAO);
    if (!O.layouts.existe(layout)) {
      avisar('aviso', 'layout-desconhecido', `Layout "${layout}" desconhecido. Disponíveis: ${O.layouts.lista().map(R.rotuloLayout).join(', ')}.`);
      layout = C.LAYOUT_PADRAO;
    }
    let transicao = meta.transicao;
    if (diretivas.transicao) {
      if (TRANSICOES.includes(diretivas.transicao)) transicao = diretivas.transicao;
      else avisar('aviso', 'transicao-invalida', `Transição "${diretivas.transicao}" inválida; use ${TRANSICOES.join(', ')}.`);
    }
    const classes = (diretivas.classe || '').split(/[\s,]+/).filter((c) => /^[a-z][\w-]*$/i.test(c));

    const env = { avisar, resolverImagem: opcoes.resolverImagem, resolverArquivo: opcoes.resolverArquivo, slide: indice, meta };
    let html;
    try {
      html = I.markdownIt().render(I.preprocessar(restante), env);
    } catch (e) {
      avisar('erro', 'interpretacao-falhou', `Não foi possível interpretar o slide: ${e.message}`);
      html = `<p class="o-imagem-ausente">${U.escaparHtml(e.message)}</p>`;
    }
    const limpo = I.sanitizar(html);
    const pos = posProcessar(limpo, env);

    const dispensaTitulo = ['titulo', 'imagem-fundo', 'citacao', 'encerramento'].includes(layout);
    if (!pos.titulo && !dispensaTitulo) avisar('aviso', 'titulo-ausente', 'Slide sem título (# ou ##): prejudica a navegação por leitores de tela e o sumário.');

    return {
      layout, diretivas, classes, transicao,
      fundo: diretivas.fundo ? diretivas.fundo.trim() : null,
      html: pos.html, notas: pos.notas,
      titulo: pos.titulo || (layout === 'titulo' ? meta.titulo : ''),
      avisos,
    };
  }

  // ═══════════════════════════ Edição estrutural do texto ═══════════════════════════
  // Funções puras usadas pela interface: devolvem o novo texto, sem tocar no estado.

  const PALAVRAS_YAML = /^(true|false|yes|no|on|off|null|sim|nao|não|~)$/i;

  /** Valor escalar em YAML: aspas duplas (sintaxe JSON, válida em YAML) quando necessárias. */
  function valorYaml(v) {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    const s = String(v).replace(/\s*\n\s*/g, ' ');
    const arriscado = s === '' || s !== s.trim() || PALAVRAS_YAML.test(s) || /^[-+]?[\d.]/.test(s)
      || /[:#"'`{}\[\]|>&*!%@\\]/.test(s) || /^[-?,]/.test(s);
    return arriscado ? JSON.stringify(s) : s;
  }

  /**
   * Define (ou remove, com valor null) uma chave do front-matter, preservando as demais linhas.
   * Sem front-matter, cria um no início do texto. Linhas de continuação indentadas da chave
   * anterior (valores em bloco) são substituídas junto.
   */
  I.definirMeta = function (markdown, chave, valor) {
    const texto = String(markdown || '').replace(/\r\n?/g, '\n');
    const linha = valor === null || valor === undefined ? null : `${chave}: ${valorYaml(valor)}`;
    const m = texto.match(/^(﻿?)---[ \t]*\n([\s\S]*?)\n---[ \t]*(\n|$)/);
    if (!m) return linha === null ? texto : `---\n${linha}\n---\n\n${texto}`;
    const corpo = m[2].split('\n');
    const i = corpo.findIndex((l) => new RegExp(`^${chave}\\s*:`).test(l));
    if (i >= 0) {
      let fim = i + 1;
      while (fim < corpo.length && /^[ \t]+\S/.test(corpo[fim])) fim++;
      corpo.splice(i, fim - i, ...(linha === null ? [] : [linha]));
    } else if (linha !== null) corpo.push(linha);
    return `${m[1]}---\n${corpo.join('\n')}\n---${m[3]}${texto.slice(m[0].length)}`;
  };

  /**
   * Move o slide `de` para a posição `para` (índices do interpretador) e devolve
   * { texto, linha } — linha (1-based) em que o slide movido passa a começar — ou null se o
   * movimento for inválido. O slide 0 (título, D14) e o front-matter ficam fixos (D27).
   * Os separadores são normalizados como '---'; o conteúdo de cada slide é preservado.
   */
  I.reordenarSlides = function (markdown, de, para) {
    const texto = String(markdown || '').replace(/\r\n?/g, '\n');
    const fm = I.extrairFrontMatter(texto);
    const brutos = fm.corpo.trim() ? I.separarSlides(fm.corpo, fm.linhasOcupadas) : [];
    const n = brutos.length;
    if (!(de >= 1 && para >= 1 && de < n && para < n && de !== para)) return null;
    const linhas = texto.split('\n');
    const blocos = brutos.map((b) => linhas.slice(b.linhaInicio - 1, b.linhaFim));
    const prefixo = linhas.slice(0, brutos[0].linhaInicio - 1);
    const sufixo = linhas.slice(brutos[n - 1].linhaFim);
    const ordem = blocos.map((_, i) => i);
    ordem.splice(para, 0, ordem.splice(de, 1)[0]);
    const saida = prefixo.slice();
    let linhaMovido = 1;
    ordem.forEach((indice, pos) => {
      if (pos > 0) saida.push('---');
      if (indice === de) linhaMovido = saida.length + 1;
      saida.push(...blocos[indice]);
    });
    return { texto: saida.concat(sufixo).join('\n'), linha: linhaMovido };
  };

  /** Índice do slide que contém a linha (1-based) do editor. */
  I.slideDaLinha = function (resultado, linha) {
    const s = resultado.slides;
    for (let i = s.length - 1; i >= 0; i--) if (linha >= s[i].linhaInicio - 1) return i;
    return 0;
  };

  I.limparCache = () => cache.clear();
})(window.Oratoria);
