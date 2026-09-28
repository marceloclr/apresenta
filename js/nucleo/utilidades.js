// js/nucleo/utilidades.js — funções puras e auxiliares de uso geral.
// Nada aqui depende de estado; tudo fica em Oratoria.util.

(function (O) {
  'use strict';

  const U = O.util;

  // ═══════════════════════════════ Tempo ═══════════════════════════════════

  /** Adia a execução até `ms` sem novas chamadas. Retorna função com .cancelar() e .agora(). */
  U.debounce = function (fn, ms) {
    let id = null;
    let ultimosArgs = null;
    const envolvida = function (...args) {
      ultimosArgs = args;
      clearTimeout(id);
      id = setTimeout(() => { id = null; fn.apply(this, ultimosArgs); }, ms);
    };
    envolvida.cancelar = () => { clearTimeout(id); id = null; };
    envolvida.agora = () => { if (id !== null) { envolvida.cancelar(); fn.apply(null, ultimosArgs || []); } };
    return envolvida;
  };

  /** Executa no máximo uma vez a cada `ms`. */
  U.throttle = function (fn, ms) {
    let ultimo = 0;
    let pendente = null;
    return function (...args) {
      const agora = Date.now();
      const restante = ms - (agora - ultimo);
      if (restante <= 0) { ultimo = agora; fn.apply(this, args); }
      else if (!pendente) pendente = setTimeout(() => { pendente = null; ultimo = Date.now(); fn.apply(this, args); }, restante);
    };
  };

  U.esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Rejeita a promessa se ela não se resolver em `ms`. */
  U.comTempoLimite = function (promessa, ms, mensagem) {
    let id;
    const limite = new Promise((_, rej) => { id = setTimeout(() => rej(new Error(mensagem || `Tempo-limite de ${ms} ms excedido`)), ms); });
    return Promise.race([promessa, limite]).finally(() => clearTimeout(id));
  };

  // ═════════════════════════ Formatação pt-BR ══════════════════════════════

  const LOCAL = 'pt-BR';
  const cacheFmt = new Map();
  const fmt = (opcoes) => {
    const chave = JSON.stringify(opcoes);
    if (!cacheFmt.has(chave)) cacheFmt.set(chave, new Intl.NumberFormat(LOCAL, opcoes));
    return cacheFmt.get(chave);
  };

  U.formatarNumero = (n, casas = 0) => fmt({ minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n);
  U.formatarDecimal = (n, maxCasas = 2) => fmt({ maximumFractionDigits: maxCasas }).format(n);
  U.formatarMoeda = (n) => fmt({ style: 'currency', currency: 'BRL' }).format(n);
  U.formatarPercentual = (n, casas = 1) => fmt({ style: 'percent', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n);

  U.formatarBytes = function (n) {
    if (!Number.isFinite(n)) return '—';
    if (n < 1024) return `${U.formatarNumero(n)} B`;
    if (n < 1024 * 1024) return `${U.formatarDecimal(n / 1024, 1)} KB`;
    return `${U.formatarDecimal(n / 1024 / 1024, 1)} MB`;
  };

  /** Minutos → "12 min" ou "1 h 05 min". */
  U.formatarDuracao = function (minutos) {
    const total = Math.round(minutos);
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = String(total % 60).padStart(2, '0');
    return `${h} h ${m} min`;
  };

  U.formatarData = (data) => new Date(data).toLocaleDateString(LOCAL);
  U.formatarDataHora = (data) => new Date(data).toLocaleString(LOCAL, { dateStyle: 'short', timeStyle: 'short' });

  /** Data local no formato AAAA-MM-DD (nome de arquivo exportado). */
  U.dataIso = function (data = new Date()) {
    const d = new Date(data);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /**
   * Interpreta número em notação brasileira ou internacional:
   * "1.234,56" → 1234.56 · "1234.56" → 1234.56 · "12%" → 12. Retorna NaN se não for número.
   */
  U.lerNumero = function (texto) {
    if (typeof texto === 'number') return texto;
    let s = String(texto ?? '').trim().replace(/^R\$\s*/i, '').replace(/%$/, '').replace(/\s/g, '');
    if (!s || !/^[-+]?[\d.,]+$/.test(s)) return NaN;
    const ultimaVirgula = s.lastIndexOf(',');
    const ultimoPonto = s.lastIndexOf('.');
    if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, '').replace(',', '.');
    else if (ultimoPonto > ultimaVirgula && ultimaVirgula !== -1) s = s.replace(/,/g, '');
    else if (ultimaVirgula === -1 && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    return Number(s);
  };

  // ═════════════════════════════ Texto ═════════════════════════════════════

  U.removerAcentos = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /** "Introdução ao Orçamento!" → "introducao-ao-orcamento" */
  U.normalizarNome = function (s, padrao = 'apresentacao') {
    const r = U.removerAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return r || padrao;
  };

  const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.escaparHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

  let contadorId = 0;
  U.gerarId = (prefixo = 'o') => `${prefixo}-${Date.now().toString(36)}-${(++contadorId).toString(36)}`;

  // ═══════════════════════════════ DOM ═════════════════════════════════════

  /**
   * Cria elemento: U.el('button', { class: 'botao', 'data-dica': '…', onclick: fn }, 'Texto', filho)
   * Atributos iniciados por "on" viram ouvintes; valores null/false são omitidos.
   */
  U.el = function (tag, atributos, ...filhos) {
    const no = document.createElement(tag);
    for (const [k, v] of Object.entries(atributos || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') no.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(no.dataset, v);
      else if (k === 'texto') no.textContent = v;
      else no.setAttribute(k, v === true ? '' : String(v));
    }
    for (const f of filhos.flat()) {
      if (f === null || f === undefined || f === false) continue;
      no.append(f instanceof Node ? f : document.createTextNode(String(f)));
    }
    return no;
  };

  U.$ = (seletor, raiz = document) => raiz.querySelector(seletor);
  U.$$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

  const FOCALIZAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  U.focalizaveis = (raiz) => U.$$(FOCALIZAVEIS, raiz).filter((e) => e.offsetParent !== null || e === document.activeElement);

  /** Foca o primeiro campo de formulário (ou controle) visível do painel. */
  U.focarPrimeiroCampo = function (painel) {
    const campo = U.$$('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])', painel)
      .find((e) => e.offsetParent !== null) || U.focalizaveis(painel)[0];
    if (campo) campo.focus({ preventScroll: true });
    return campo || null;
  };

  // ════════════════════════════ Arquivos ═══════════════════════════════════

  /** Oferece um Blob ou texto para download (funciona em file:// e https). */
  U.baixar = function (conteudo, nomeArquivo, tipo = 'application/octet-stream') {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = U.el('a', { href: url, download: nomeArquivo, style: 'display:none' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const lerComo = (metodo) => (arquivo) => new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(leitor.result);
    leitor.onerror = () => rejeitar(leitor.error || new Error(`Falha ao ler ${arquivo.name}`));
    leitor[metodo](arquivo);
  });
  U.lerTexto = lerComo('readAsText');
  U.lerDataUrl = lerComo('readAsDataURL');
  U.lerBinario = lerComo('readAsArrayBuffer');

  /** Tamanho em bytes do conteúdo de um data URL base64. */
  U.bytesDeDataUrl = function (dataUrl) {
    const i = dataUrl.indexOf(',');
    const b64 = dataUrl.slice(i + 1);
    const preenchimento = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - preenchimento;
  };

  /**
   * Busca tolerante por nome de arquivo num objeto { caminho: item }: primeiro o caminho
   * exato (com ou sem "./"), depois o nome do arquivo sem distinguir maiúsculas (§4.4).
   */
  U.criarBuscaPorNome = function (mapa) {
    const exatos = new Map();
    const porNome = new Map();
    for (const [chave, item] of Object.entries(mapa || {})) {
      exatos.set(chave, item);
      const base = U.nomeBase(chave).toLowerCase();
      if (!porNome.has(base)) porNome.set(base, item);
    }
    return function (referencia) {
      let ref = String(referencia || '').trim();
      try { ref = decodeURIComponent(ref); } catch (_) { /* mantém como veio */ }
      return exatos.get(ref) || exatos.get(ref.replace(/^\.\//, '')) || porNome.get(U.nomeBase(ref).toLowerCase()) || null;
    };
  };

  /** Compara nomes de coluna sem acentos, maiúsculas nem espaços nas pontas. */
  U.chaveNormalizada = (s) => U.removerAcentos(String(s ?? '')).toLowerCase().replace(/\s+/g, ' ').trim();

  U.extensao = (nome) => (String(nome).match(/\.[^./\\]+$/) || [''])[0].toLowerCase();
  U.nomeBase = (caminho) => String(caminho).split(/[\\/]/).pop();

  // ═══════════════════════════ Cor e contraste ═════════════════════════════
  // WCAG 2.x: razão = (L1 + 0,05) / (L2 + 0,05), L = luminância relativa sRGB.
  // AA: 4,5:1 texto corrente; 3:1 texto grande (≥ 24 px, ou ≥ 18,66 px em negrito).

  /** Converte "#abc", "#aabbcc", "#aabbccdd", "rgb()" ou "rgba()" em { r, g, b, a }. */
  U.lerCor = function (cor) {
    const s = String(cor).trim().toLowerCase();
    let m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      return {
        r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: +m[1], g: +m[2], b: +m[3], a };
    }
    return null;
  };

  U.corHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

  /** Compõe uma cor translúcida sobre um fundo opaco. */
  U.comporCor = function (cor, fundo) {
    const c = typeof cor === 'string' ? U.lerCor(cor) : cor;
    const f = typeof fundo === 'string' ? U.lerCor(fundo) : fundo;
    if (!c || !f) return null;
    const a = c.a ?? 1;
    return { r: c.r * a + f.r * (1 - a), g: c.g * a + f.g * (1 - a), b: c.b * a + f.b * (1 - a), a: 1 };
  };

  U.luminancia = function (cor) {
    const c = typeof cor === 'string' ? U.lerCor(cor) : cor;
    const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
  };

  /** Razão de contraste entre texto e fundo (cores translúcidas são compostas sobre o fundo). */
  U.razaoContraste = function (texto, fundo) {
    const f = typeof fundo === 'string' ? U.lerCor(fundo) : fundo;
    const t = U.comporCor(texto, f);
    if (!t || !f) return NaN;
    const [l1, l2] = [U.luminancia(t), U.luminancia(f)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  U.MINIMO_AA = { corrente: 4.5, grande: 3 };
  U.atendeAA = (razao, grande = false) => razao >= (grande ? U.MINIMO_AA.grande : U.MINIMO_AA.corrente);

  function rgbParaHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return { h, s, l };
  }
  function hslParaRgb({ h, s, l }) {
    if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
  }

  /**
   * Ajusta a luminosidade de `cor` (preservando matiz e saturação) até atingir `alvo`
   * contra `fundo`: escurece sobre fundo claro, clareia sobre fundo escuro.
   * Retorna { cor, razaoOriginal, razao, ajustada }.
   */
  U.ajustarContraste = function (cor, fundo, alvo = U.MINIMO_AA.corrente) {
    const original = U.lerCor(cor);
    const f = U.lerCor(fundo);
    const razaoOriginal = U.razaoContraste(original, f);
    if (razaoOriginal >= alvo) return { cor: U.corHex(original), razaoOriginal, razao: razaoOriginal, ajustada: false };
    const hsl = rgbParaHsl(original);
    const escurecer = U.luminancia(f) > 0.18;
    let atual = original;
    for (let passo = 0; passo < 100; passo++) {
      hsl.l = Math.max(0, Math.min(1, hsl.l + (escurecer ? -0.01 : 0.01)));
      atual = hslParaRgb(hsl);
      if (U.razaoContraste(atual, f) >= alvo || hsl.l === 0 || hsl.l === 1) break;
    }
    return { cor: U.corHex(atual), razaoOriginal, razao: U.razaoContraste(atual, f), ajustada: true };
  };

  U.formatarRazao = (r) => `${U.formatarDecimal(r, 2)}:1`;
})(window.Oratoria);
