// js/nucleo/persistencia.js — guarda local em IndexedDB, com recuo para memória.
//
// Lojas (chave-valor, chaves explícitas), todas criadas na versão 1 para evitar migrações:
//   rascunho      'atual' → projeto em edição (autossalvamento)
//   preferencias  preferências da interface (tema, fatores…)
//   biblioteca    apresentações guardadas no navegador (aba Biblioteca)
//   pastas        identificadores de pastas autorizadas (File System Access)
//   segredos      tokens de serviços externos (ex.: publicação no GitHub)
//
// Limitação documentada: em file://, o IndexedDB fica vinculado à origem de abertura.
// Movida a pasta, os rascunhos não a acompanham — use o projeto .oratoria.json para transporte.

(function (O) {
  'use strict';

  const P = (O.persistencia = {});
  const C = O.config;
  const LOJAS = ['rascunho', 'preferencias', 'biblioteca', 'pastas', 'segredos'];

  let banco = null;          // IDBDatabase
  let modo = 'pendente';     // 'indexeddb' | 'memoria'
  let motivoMemoria = '';
  const memoria = new Map(LOJAS.map((l) => [l, new Map()]));
  let prontidao = null;

  function abrir() {
    return new Promise((resolver, rejeitar) => {
      if (!('indexedDB' in window) || !window.indexedDB) return rejeitar(new Error('IndexedDB indisponível neste navegador'));
      let pedido;
      try { pedido = indexedDB.open(C.BANCO_NOME, C.BANCO_VERSAO); } catch (e) { return rejeitar(e); }
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        for (const l of LOJAS) if (!db.objectStoreNames.contains(l)) db.createObjectStore(l);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rejeitar(pedido.error || new Error('Falha ao abrir o IndexedDB'));
      pedido.onblocked = () => rejeitar(new Error('IndexedDB bloqueado por outra aba'));
    });
  }

  /** Inicializa uma única vez; resolve com o modo em uso. Nunca rejeita. */
  P.iniciar = function () {
    if (prontidao) return prontidao;
    prontidao = O.util.comTempoLimite(abrir(), 4000, 'IndexedDB não respondeu')
      .then(async (db) => {
        banco = db;
        banco.onversionchange = () => banco.close();
        // Sonda de escrita: alguns navegadores abrem o banco mas recusam gravações em file://
        await operar('preferencias', 'readwrite', (loja) => loja.put(Date.now(), '__sonda__'));
        modo = 'indexeddb';
      })
      .catch((e) => {
        banco = null;
        modo = 'memoria';
        motivoMemoria = e && e.message ? e.message : String(e);
        console.warn(`[${C.APP_NOME}] Guarda automática indisponível (${motivoMemoria}). O trabalho será mantido apenas nesta sessão.`);
      })
      .then(() => {
        O.estado.definir('ambiente.persistencia', modo);
        return modo;
      });
    return prontidao;
  };

  P.modo = () => modo;
  P.motivoMemoria = () => motivoMemoria;

  function operar(nomeLoja, tipo, acao) {
    return new Promise((resolver, rejeitar) => {
      const tx = banco.transaction(nomeLoja, tipo);
      const pedido = acao(tx.objectStore(nomeLoja));
      let resultado;
      if (pedido) pedido.onsuccess = () => { resultado = pedido.result; };
      tx.oncomplete = () => resolver(resultado);
      tx.onerror = () => rejeitar(tx.error);
      tx.onabort = () => rejeitar(tx.error || new Error('Transação abortada'));
    });
  }

  const conferirLoja = (l) => { if (!LOJAS.includes(l)) throw new Error(`Loja desconhecida: ${l}`); };

  P.obter = async function (loja, chave) {
    conferirLoja(loja);
    await P.iniciar();
    if (modo === 'memoria') return structuredClone(memoria.get(loja).get(chave));
    return operar(loja, 'readonly', (s) => s.get(chave));
  };

  P.gravar = async function (loja, chave, valor) {
    conferirLoja(loja);
    await P.iniciar();
    if (modo === 'memoria') { memoria.get(loja).set(chave, structuredClone(valor)); return; }
    await operar(loja, 'readwrite', (s) => s.put(valor, chave));
  };

  P.remover = async function (loja, chave) {
    conferirLoja(loja);
    await P.iniciar();
    if (modo === 'memoria') { memoria.get(loja).delete(chave); return; }
    await operar(loja, 'readwrite', (s) => s.delete(chave));
  };

  /** Lista [{ chave, valor }] de uma loja. */
  P.listar = async function (loja) {
    conferirLoja(loja);
    await P.iniciar();
    if (modo === 'memoria') return Array.from(memoria.get(loja), ([chave, valor]) => ({ chave, valor: structuredClone(valor) }));
    const [chaves, valores] = await Promise.all([
      operar(loja, 'readonly', (s) => s.getAllKeys()),
      operar(loja, 'readonly', (s) => s.getAll()),
    ]);
    return chaves.map((chave, i) => ({ chave, valor: valores[i] }));
  };

  P.limpar = async function (loja) {
    conferirLoja(loja);
    await P.iniciar();
    if (modo === 'memoria') { memoria.get(loja).clear(); return; }
    await operar(loja, 'readwrite', (s) => s.clear());
  };

  /** Uso e cota de armazenamento do navegador, quando informados. */
  P.estimativa = async function () {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        return { uso: usage, cota: quota };
      }
    } catch (_) { /* navegador não informa */ }
    return { uso: NaN, cota: NaN };
  };

  // ── Preferências (atalhos) ───────────────────────────────────────────────
  P.preferencia = (chave, padrao) => P.obter('preferencias', chave).then((v) => (v === undefined ? padrao : v)).catch(() => padrao);
  P.definirPreferencia = (chave, valor) => P.gravar('preferencias', chave, valor).catch((e) => console.warn(e));

  // ── Rascunho e autossalvamento ──────────────────────────────────────────
  /**
   * Metadados de um rascunho, para o convite "Retomar último trabalho".
   * Chaves: 'atual' (autossalvamento) e 'anterior' (o rascunho encontrado na abertura, guardado
   * à parte para que o autossalvamento da nova sessão não o sobrescreva antes da decisão).
   */
  P.rascunhoDisponivel = async function (chave = 'atual') {
    const r = await P.obter('rascunho', chave).catch(() => undefined);
    if (!r || !r.markdown) return null;
    return { atualizadoEm: r.atualizadoEm, caracteres: r.markdown.length, imagens: Object.keys(r.acervo || {}).length, projeto: r };
  };

  let cancelarObservacao = null;
  /** Salva o projeto após C.ATRASO_AUTOSSALVAMENTO_MS de inatividade. Emite 'persistencia:salvo'. */
  P.ativarAutossalvamento = function () {
    if (cancelarObservacao) return;
    const salvar = O.util.debounce(async () => {
      try {
        const projeto = O.estado.instantaneo('projeto');
        projeto.atualizadoEm = Date.now(); // momento da guarda (projetos carregados chegam sem data)
        await P.gravar('rascunho', 'atual', projeto);
        O.estado.emitir('persistencia:salvo', { quando: Date.now(), modo });
      } catch (e) {
        O.estado.emitir('persistencia:falha', { erro: e });
        console.error(`[${C.APP_NOME}] autossalvamento falhou:`, e);
      }
    }, C.ATRASO_AUTOSSALVAMENTO_MS);
    cancelarObservacao = O.estado.observar('projeto', () => salvar());
    window.addEventListener('pagehide', () => salvar.agora());
  };
})(window.Oratoria);
