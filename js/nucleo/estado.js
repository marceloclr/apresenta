// js/nucleo/estado.js — estado central da aplicação e barramento de eventos.
//
// Acesso por caminho em notação de pontos:
//   O.estado.obter('projeto.markdown')
//   O.estado.definir('interface.tema', 'claro')
//   const cancelar = O.estado.observar('projeto', (valor, caminho) => { … });
// Observadores de 'projeto' são avisados de mudanças em 'projeto.*' e vice-versa.
//
// Eventos avulsos (sem estado): O.estado.emitir('exportacao:progresso', dados) / O.estado.ouvir(…)

(function (O) {
  'use strict';

  const E = O.estado;
  const C = O.config;

  function estadoInicial() {
    return {
      projeto: {
        id: null,
        markdown: '',
        acervo: {},        // nome do arquivo → { tipo, dataUrl, bytesOriginais, bytes, alt, … }
        temaId: C.TEMA_PADRAO,
        ajustesTema: {},   // sobreposições de variáveis --s-* e opções (grade, escala, rodapé…)
        opcoes: { minutosPorSlide: C.MINUTOS_POR_SLIDE, qualidadeImagem: C.IMAGEM_QUALIDADE },
        atualizadoEm: null,
      },
      interface: {
        tema: 'escuro',    // tema da interface do editor (independente do tema dos slides)
        abaAtiva: 'composicao',
        slideAtual: 0,
      },
      ambiente: {
        protocolo: location.protocol.replace(':', ''),
        persistencia: 'pendente', // 'indexeddb' | 'memoria'
        rede: navigator.onLine,
      },
    };
  }

  let dados = estadoInicial();
  const observadores = new Set(); // { caminho, fn }
  const ouvintes = new Map();     // evento → Set<fn>

  const partes = (caminho) => (caminho ? String(caminho).split('.') : []);

  function ler(caminho) {
    let no = dados;
    for (const p of partes(caminho)) {
      if (no === null || typeof no !== 'object') return undefined;
      no = no[p];
    }
    return no;
  }

  const relacionados = (a, b) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.') || a === '' || b === '';

  function notificar(caminho) {
    for (const obs of Array.from(observadores)) {
      if (!relacionados(obs.caminho, caminho)) continue;
      try { obs.fn(ler(obs.caminho), caminho); } catch (e) { console.error(`[${C.APP_NOME}] observador de "${obs.caminho}" falhou:`, e); }
    }
  }

  /** Valor atual no caminho (objetos são devolvidos por referência: não os mute diretamente). */
  E.obter = (caminho) => ler(caminho);

  /** Define o valor no caminho, criando objetos intermediários, e notifica observadores. */
  E.definir = function (caminho, valor, { silencioso = false } = {}) {
    const ps = partes(caminho);
    if (!ps.length) throw new Error('estado.definir: caminho vazio');
    let no = dados;
    for (const p of ps.slice(0, -1)) {
      if (no[p] === null || typeof no[p] !== 'object') no[p] = {};
      no = no[p];
    }
    const chave = ps[ps.length - 1];
    if (Object.is(no[chave], valor) && (valor === null || typeof valor !== 'object')) return valor;
    no[chave] = valor;
    if (caminho.startsWith('projeto.') && caminho !== 'projeto.atualizadoEm') dados.projeto.atualizadoEm = Date.now();
    if (!silencioso) notificar(caminho);
    return valor;
  };

  /** Atualiza a partir do valor anterior: O.estado.atualizar('projeto.acervo', (a) => ({ ...a, [nome]: item })) */
  E.atualizar = (caminho, fn, opcoes) => E.definir(caminho, fn(ler(caminho)), opcoes);

  /** Observa um caminho; devolve a função de cancelamento. */
  E.observar = function (caminho, fn) {
    const obs = { caminho: caminho || '', fn };
    observadores.add(obs);
    return () => observadores.delete(obs);
  };

  /** Substitui o projeto inteiro (abrir, importar, retomar). */
  E.carregarProjeto = function (projeto) {
    dados.projeto = Object.assign(estadoInicial().projeto, projeto || {});
    notificar('projeto');
  };

  /** Cópia profunda e desacoplada (para persistência e exportação). */
  E.instantaneo = (caminho = '') => structuredClone(ler(caminho));

  /** Restaura o estado inicial (usado em testes e em "Novo projeto"). */
  E.reiniciar = function () {
    const ambiente = dados.ambiente;
    const interfaceAtual = dados.interface;
    dados = estadoInicial();
    dados.ambiente = ambiente;
    dados.interface = interfaceAtual;
    notificar('projeto');
  };

  // ── Barramento de eventos ─────────────────────────────────────────────
  E.ouvir = function (evento, fn) {
    if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
    ouvintes.get(evento).add(fn);
    return () => ouvintes.get(evento)?.delete(fn);
  };

  E.emitir = function (evento, dadosEvento) {
    for (const fn of Array.from(ouvintes.get(evento) || [])) {
      try { fn(dadosEvento); } catch (e) { console.error(`[${C.APP_NOME}] ouvinte de "${evento}" falhou:`, e); }
    }
  };

  // Rede: mantém ambiente.rede atualizado
  window.addEventListener('online', () => E.definir('ambiente.rede', true));
  window.addEventListener('offline', () => E.definir('ambiente.rede', false));
})(window.Oratoria);
