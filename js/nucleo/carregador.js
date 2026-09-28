// js/nucleo/carregador.js — injeção dinâmica de <script src>, que funciona em file:// e https.
// Mantém uma promessa por recurso: pedidos repetidos não recarregam nada.
//
//   await O.carregador.embutivel('chart')   → string com o código do Chart.js
//   await O.carregador.modulo('katex')      → window.katex (exige rede)
//   O.carregador.estado('mermaid')          → 'ausente' | 'carregando' | 'pronto' | 'falhou'

(function (O) {
  'use strict';

  const L = (O.carregador = {});
  const C = O.config;
  const promessas = new Map(); // url → Promise
  const situacao = new Map();  // nome lógico → estado

  /**
   * Injeta um script e resolve quando `pronto()` for verdadeiro após o carregamento.
   * Remove a promessa em caso de falha, permitindo nova tentativa.
   */
  L.script = function (url, { pronto = () => true, tempoLimite = 20000, externo = false } = {}) {
    if (promessas.has(url)) return promessas.get(url);
    const promessa = new Promise((resolver, rejeitar) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      if (externo) { s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer'; }
      const limite = setTimeout(() => { s.remove(); rejeitar(new Error(`Tempo esgotado ao carregar ${url}`)); }, tempoLimite);
      s.onload = () => {
        clearTimeout(limite);
        let ok = false;
        try { ok = !!pronto(); } catch (_) { ok = false; }
        ok ? resolver() : rejeitar(new Error(`${url} carregou, mas não registrou o recurso esperado`));
      };
      s.onerror = () => { clearTimeout(limite); s.remove(); rejeitar(new Error(`Não foi possível carregar ${url}`)); };
      document.head.append(s);
    }).catch((e) => { promessas.delete(url); throw e; });
    promessas.set(url, promessa);
    return promessa;
  };

  /**
   * Embutível por nome lógico ('fontes' | 'chart'). Se já estiver presente (edição portátil,
   * onde tudo vem inline), resolve de imediato. Emite 'carregador:progresso'.
   */
  L.embutivel = async function (nome) {
    if (O.embutiveis[nome] !== undefined) return O.embutiveis[nome];
    const url = C.EMBUTIVEIS[nome];
    if (!url) throw new Error(`Embutível desconhecido: ${nome}`);
    situacao.set(nome, 'carregando');
    O.estado.emitir('carregador:progresso', { nome, estado: 'carregando' });
    try {
      await L.script(url, { pronto: () => O.embutiveis[nome] !== undefined, tempoLimite: 30000 });
      situacao.set(nome, 'pronto');
      O.estado.emitir('carregador:progresso', { nome, estado: 'pronto' });
      return O.embutiveis[nome];
    } catch (e) {
      situacao.set(nome, 'falhou');
      O.estado.emitir('carregador:progresso', { nome, estado: 'falhou', erro: e });
      throw new Error(`O recurso "${nome}" não pôde ser lido de ${url}. Verifique se a pasta embutiveis/ acompanha a aplicação. (${e.message})`);
    }
  };

  /** Módulo sob demanda da rede (C.MODULOS_REDE): 'katex' | 'mermaid' | 'sheetjs'. */
  L.modulo = async function (nome) {
    const m = C.MODULOS_REDE[nome];
    if (!m) throw new Error(`Módulo desconhecido: ${nome}`);
    if (window[m.global]) { situacao.set(nome, 'pronto'); return window[m.global]; }
    if (!navigator.onLine) { situacao.set(nome, 'falhou'); throw new Error('Sem conexão com a internet.'); }
    situacao.set(nome, 'carregando');
    try {
      await L.script(m.url, { pronto: () => !!window[m.global], tempoLimite: C.TEMPO_LIMITE_REDE_MS * 2, externo: true });
      situacao.set(nome, 'pronto');
      return window[m.global];
    } catch (e) {
      situacao.set(nome, 'falhou');
      throw e;
    }
  };

  L.estado = (nome) => situacao.get(nome) || (C.MODULOS_REDE[nome] && window[C.MODULOS_REDE[nome].global] ? 'pronto' : 'ausente');

  /**
   * Sonda leve de conectividade real (navigator.onLine só indica a interface de rede):
   * carrega um SVG minúsculo e estável do jsDelivr (@mdi/svg, versão fixada), sem cache.
   * Não usa fetch nem executa código de terceiros.
   */
  L.sondarRede = function (tempoLimite = 4000) {
    if (!navigator.onLine) return Promise.resolve(false);
    return new Promise((resolver) => {
      const img = new Image();
      const fim = (ok) => { clearTimeout(t); img.onload = img.onerror = null; resolver(ok); };
      const t = setTimeout(() => fim(false), tempoLimite);
      img.onload = () => fim(true);
      img.onerror = () => fim(false);
      img.referrerPolicy = 'no-referrer';
      img.src = `${C.SONDA_REDE_URL}?_=${Date.now()}`;
    });
  };
})(window.Oratoria);
