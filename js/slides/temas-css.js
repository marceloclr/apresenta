// js/slides/temas-css.js — registro de temas e conversão em CSS [data-tema="id"].
// Carregado ANTES de temas/*.js, que chamam O.temas.registrar({...}).
// O mesmo CSS gerado serve à pré-visualização e à exportação (somente o tema escolhido).
//
// Formato do tema (ver docs/manual-tecnico.md, "Temas"):
//   { id, nome, ambiente: 'claro'|'escuro', descricao, recomendacao,
//     fontes: { titulo, corpo, mono, pesoTitulo, fatorTitulo?, espacamentoCorpo? },
//     variaveis: { '--s-fundo': '#…', … },
//     grade: { ativa, menor, maior, cruz, intensidadeCor },   // parâmetros da grade de fundo
//     extras?: 'CSS adicional; & é substituído pelo seletor do tema' }
//
// Ajustes finos (sobreposições salvas no projeto, sem criar tema novo):
//   { acento?: '#hex', grade?: { ativa?: bool, intensidade?: 0…1.5 }, escala?: 0.9…1.15 }

(function (O) {
  'use strict';

  const T = O.temas;
  const U = O.util;
  const C = O.config;
  const registro = new Map();

  T.VARIAVEIS_OBRIGATORIAS = [
    '--s-fundo', '--s-tela', '--s-superficie', '--s-superficie-2',
    '--s-texto', '--s-texto-2', '--s-borda',
    '--s-acento', '--s-acento-texto', '--s-acento-2',
    '--s-sucesso', '--s-aviso', '--s-erro',
    '--s-fonte-titulo', '--s-fonte-corpo', '--s-fonte-mono',
    '--s-tabela-cabecalho-fundo', '--s-tabela-cabecalho-texto', '--s-tabela-zebra', '--s-tabela-destaque',
    '--s-grafico-1', '--s-grafico-2', '--s-grafico-3', '--s-grafico-4', '--s-grafico-5', '--s-grafico-6',
    '--s-grafico-eixo', '--s-grafico-grade',
    '--s-grade-menor', '--s-grade-maior', '--s-grade-cruz', '--s-vinheta',
  ];

  const PILHAS = {
    'IBM Plex Sans': "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
    'IBM Plex Serif': "'IBM Plex Serif', Georgia, 'Times New Roman', serif",
    'IBM Plex Mono': "'IBM Plex Mono', Consolas, 'Courier New', monospace",
  };
  const pilha = (familia) => PILHAS[familia] || `'${familia}', system-ui, sans-serif`;

  // ── Derivações ─────────────────────────────────────────────────────────

  /** Mistura uma cor com preto (claro) ou branco (escuro) na proporção `intensidade` (0–1). */
  function misturar(hex, destino, intensidade) {
    const c = U.lerCor(hex);
    const d = destino === 'preto' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    return { r: c.r + (d.r - c.r) * intensidade, g: c.g + (d.g - c.g) * intensidade, b: c.b + (d.b - c.b) * intensidade };
  }
  const rgba = (c, a) => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.max(0, Math.min(1, a)).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')})`;
  const porcentagem = (v) => (typeof v === 'string' ? parseFloat(v) / 100 : Number(v));

  /**
   * Cores das linhas da grade a partir dos parâmetros calibrados: a base é a cor da tela
   * escurecida (tema claro) ou clareada (tema escuro) em `intensidadeCor`; menor/maior/cruz
   * são as opacidades de cada traço. `fator` escala as opacidades (ajuste de 0 a 150%).
   */
  function coresDaGrade(tema, variaveis, fator = 1) {
    const g = tema.grade || {};
    const base = misturar(variaveis['--s-tela'] || variaveis['--s-fundo'], tema.ambiente === 'escuro' ? 'branco' : 'preto', porcentagem(g.intensidadeCor ?? '16%'));
    return {
      '--s-grade-menor': rgba(base, (g.menor ?? 0.015) * fator),
      '--s-grade-maior': rgba(base, (g.maior ?? 0.15) * fator),
      '--s-grade-cruz': rgba(base, (g.cruz ?? 0.01) * fator),
    };
  }

  function variaveisDeFontes(tema) {
    const f = tema.fontes || {};
    return {
      '--s-fonte-titulo': pilha(f.titulo || 'IBM Plex Sans'),
      '--s-fonte-corpo': pilha(f.corpo || 'IBM Plex Sans'),
      '--s-fonte-mono': pilha(f.mono || 'IBM Plex Mono'),
      '--s-peso-titulo': String(f.pesoTitulo || 600),
      '--s-fator-titulo': String(f.fatorTitulo || 1),
      '--s-espacamento-corpo': f.espacamentoCorpo || 'normal',
    };
  }

  /** Variáveis complementares com valor padrão (o tema pode sobrescrevê-las). */
  function variaveisComplementares(tema) {
    return {
      '--s-escala': '1',
      '--s-tabela-fonte-minima': `${C.TABELA_FONTE_MINIMA}px`,
      '--s-sobreposicao': 'color-mix(in srgb, var(--s-fundo) 74%, transparent)',
      '--s-textura': 'none',
      '--s-grade-exibir': (tema.grade && tema.grade.ativa) ? '1' : '0',
    };
  }

  /** Composição completa das variáveis de um tema, sem ajustes. */
  function composicaoBase(tema) {
    const v = Object.assign({}, variaveisComplementares(tema), variaveisDeFontes(tema), tema.variaveis || {});
    const grade = coresDaGrade(tema, v);
    for (const [k, valor] of Object.entries(grade)) if (!(tema.variaveis && tema.variaveis[k])) v[k] = valor;
    return v;
  }

  // ── Registro ───────────────────────────────────────────────────────────

  T.registrar = function (tema) {
    if (!tema || !tema.id || !/^[a-z0-9-]+$/.test(tema.id)) {
      console.error(`[${C.APP_NOME}] Tema recusado: identificador ausente ou inválido.`, tema);
      return false;
    }
    const v = composicaoBase(tema);
    const ausentes = T.VARIAVEIS_OBRIGATORIAS.filter((k) => !v[k]);
    if (ausentes.length) console.error(`[${C.APP_NOME}] Tema "${tema.id}": variáveis obrigatórias ausentes: ${ausentes.join(', ')}`);
    if (registro.has(tema.id)) console.warn(`[${C.APP_NOME}] Tema "${tema.id}" registrado novamente; prevalece o último.`);
    registro.set(tema.id, Object.freeze(Object.assign({ ambiente: 'claro', nome: tema.id, descricao: '', recomendacao: '' }, tema)));
    O.estado?.emitir?.('temas:registrado', { id: tema.id });
    return ausentes.length === 0;
  };

  T.obter = (id) => registro.get(id) || registro.get(C.TEMA_PADRAO) || registro.values().next().value || null;
  T.existe = (id) => registro.has(id);
  /** Temas na ordem de registro (ordem das linhas <script> no index.html). */
  T.lista = () => Array.from(registro.values());

  // ── Ajustes finos ──────────────────────────────────────────────────────

  /**
   * Aplica os ajustes do projeto ao tema e devolve { variaveis, gradeAtiva, correcoes }.
   * Se o acento escolhido não atingir AA como texto, calcula-se uma variante de
   * --s-acento-texto que atinja, preservando o matiz (registrada em `correcoes`).
   */
  T.aplicarAjustes = function (idOuTema, ajustes = {}) {
    const tema = typeof idOuTema === 'string' ? T.obter(idOuTema) : idOuTema;
    const v = composicaoBase(tema);
    const correcoes = [];

    if (ajustes.acento && U.lerCor(ajustes.acento)) {
      v['--s-acento'] = ajustes.acento;
      const fundos = [v['--s-fundo'], v['--s-superficie']];
      let cor = ajustes.acento;
      let pior = Infinity;
      for (const f of fundos) {
        const r = U.ajustarContraste(cor, f, U.MINIMO_AA.corrente);
        cor = r.cor;
        pior = Math.min(pior, r.razaoOriginal);
      }
      const razaoFinal = Math.min(...fundos.map((f) => U.razaoContraste(cor, f)));
      v['--s-acento-texto'] = cor;
      if (U.corHex(U.lerCor(cor)) !== U.corHex(U.lerCor(ajustes.acento))) {
        correcoes.push({ variavel: '--s-acento-texto', original: ajustes.acento, ajustada: cor, razaoOriginal: pior, razao: razaoFinal });
      }
    }

    const gradeAtiva = ajustes.grade && typeof ajustes.grade.ativa === 'boolean' ? ajustes.grade.ativa : !!(tema.grade && tema.grade.ativa);
    const intensidade = ajustes.grade && Number.isFinite(ajustes.grade.intensidade) ? Math.max(0, Math.min(1.5, ajustes.grade.intensidade)) : 1;
    if (intensidade !== 1) Object.assign(v, coresDaGrade(tema, v, intensidade));
    v['--s-grade-exibir'] = gradeAtiva ? '1' : '0';

    if (Number.isFinite(ajustes.escala)) v['--s-escala'] = String(Math.max(0.9, Math.min(1.15, ajustes.escala)));

    return { tema, variaveis: v, gradeAtiva, correcoes };
  };

  // ── Geração do CSS ─────────────────────────────────────────────────────

  /**
   * CSS do tema: bloco de variáveis em [data-tema="id"] mais os extras do tema.
   * Retorna string pronta para <style>. Com `ajustes`, aplica as sobreposições.
   */
  T.gerarCss = function (id, ajustes = {}) {
    const { tema, variaveis } = T.aplicarAjustes(id, ajustes);
    const seletor = `[data-tema="${tema.id}"]`;
    const linhas = Object.entries(variaveis).map(([k, val]) => `  ${k}: ${val};`).join('\n');
    const extras = tema.extras ? tema.extras.replace(/&/g, seletor) : '';
    return `/* Tema: ${tema.nome} (${tema.ambiente}) */\n${seletor} {\n${linhas}\n}\n${extras}\n`;
  };

  /** Famílias tipográficas efetivamente usadas pelo tema (para embutir só o necessário). */
  T.familiasUsadas = function (id) {
    const f = T.obter(id).fontes || {};
    return Array.from(new Set([f.titulo || 'IBM Plex Sans', f.corpo || 'IBM Plex Sans', f.mono || 'IBM Plex Mono']));
  };

  // ── Contraste ──────────────────────────────────────────────────────────

  /** Pares verificados: [rótulo, variável do texto, variável do fundo, texto grande?] */
  T.PARES_CONTRASTE = [
    ['Texto corrente sobre fundo', '--s-texto', '--s-fundo', false],
    ['Texto corrente sobre superfície', '--s-texto', '--s-superficie', false],
    ['Texto secundário sobre fundo', '--s-texto-2', '--s-fundo', false],
    ['Texto secundário sobre superfície', '--s-texto-2', '--s-superficie', false],
    ['Acento (texto) sobre fundo', '--s-acento-texto', '--s-fundo', false],
    ['Acento (texto) sobre superfície', '--s-acento-texto', '--s-superficie', false],
    ['Texto corrente sobre tela (grade)', '--s-texto', '--s-tela', false],
    ['Texto secundário sobre tela (grade)', '--s-texto-2', '--s-tela', false],
    ['Acento (texto) sobre tela (grade)', '--s-acento-texto', '--s-tela', false],
    ['Cabeçalho de tabela', '--s-tabela-cabecalho-texto', '--s-tabela-cabecalho-fundo', false],
    ['Texto sobre zebra da tabela', '--s-texto', '--s-tabela-zebra', false],
    ['Sucesso (texto) sobre fundo', '--s-sucesso', '--s-fundo', false],
    ['Aviso (texto) sobre fundo', '--s-aviso', '--s-fundo', false],
    ['Erro (texto) sobre fundo', '--s-erro', '--s-fundo', false],
    ['Eixos de gráfico sobre fundo', '--s-grafico-eixo', '--s-fundo', true],
    ['Título sobre fundo', '--s-texto', '--s-fundo', true],
  ];

  /**
   * Relatório de contraste WCAG do tema (com ajustes). Cores translúcidas (zebra) são
   * compostas sobre o fundo. Retorna [{ rotulo, texto, fundo, razao, minimo, aprovado }].
   */
  T.relatorioContraste = function (id, ajustes = {}) {
    const { variaveis: v } = T.aplicarAjustes(id, ajustes);
    return T.PARES_CONTRASTE.map(([rotulo, kt, kf, grande]) => {
      let fundo = v[kf];
      const fundoCor = U.lerCor(fundo);
      if (fundoCor && fundoCor.a < 1) fundo = U.corHex(U.comporCor(fundoCor, v['--s-fundo']));
      const razao = U.razaoContraste(v[kt], fundo);
      const minimo = grande ? U.MINIMO_AA.grande : U.MINIMO_AA.corrente;
      return { rotulo, texto: `${kt} ${v[kt]}`, fundo: `${kf} ${v[kf]}`, razao: Number(razao.toFixed(2)), minimo, aprovado: razao >= minimo };
    });
  };

  /** Relatório no console de desenvolvimento para todos os temas registrados. */
  T.relatarContrastes = function () {
    const reprovados = [];
    for (const tema of T.lista()) {
      const rel = T.relatorioContraste(tema.id);
      const falhas = rel.filter((r) => !r.aprovado);
      console.groupCollapsed(`[${C.APP_NOME}] Contraste · ${tema.nome}: ${falhas.length ? `${falhas.length} par(es) abaixo de AA` : 'todos os pares em AA'}`);
      console.table(rel.map((r) => ({ Par: r.rotulo, Texto: r.texto, Fundo: r.fundo, Razão: `${U.formatarDecimal(r.razao, 2)}:1`, Mínimo: `${r.minimo}:1`, AA: r.aprovado ? 'sim' : 'NÃO' })));
      console.groupEnd();
      falhas.forEach((f) => reprovados.push(`${tema.id}: ${f.rotulo}`));
    }
    return reprovados;
  };
})(window.Oratoria);
