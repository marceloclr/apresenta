// js/exportacao/projeto.js — projeto .oratoria.json: exportação e importação de tudo o que
// compõe o trabalho (texto, acervo com imagens em base64, ajustes do tema e opções), para
// transporte entre computadores e navegadores (§5.5).
//
//   const { texto, nome, bytes } = O.exportacao.projeto.serializar(projeto)
//   O.exportacao.projeto.baixar(projeto)
//   const { projeto, avisos } = await O.exportacao.projeto.ler(arquivoOuTexto)
//
// Formato (identificador estável, D31):
//   { formato: 'oratoria.projeto', versaoFormato: 1, aplicacao: 'Apresenta 0.1.0', exportadoEm,
//     projeto: { titulo, markdown, acervo, ajustesTema, opcoes } }
//
// A importação trata o arquivo como NÃO confiável: confere estrutura e tamanhos, aceita apenas
// data URLs de imagem dos tipos do acervo, sanitiza de novo todo SVG e descarta o resto
// (com aviso). O texto segue o caminho normal do interpretador, que sanitiza o HTML (D11).

(function (O) {
  'use strict';

  const PJ = (O.exportacao.projeto = {});
  const U = O.util;
  const C = O.config;

  PJ.FORMATO = 'oratoria.projeto';
  PJ.VERSAO_FORMATO = 1;
  PJ.EXTENSAO = '.oratoria.json';

  const DATA_URL_IMAGEM = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/;

  PJ.serializar = function (projeto) {
    const conteudo = {
      formato: PJ.FORMATO,
      versaoFormato: PJ.VERSAO_FORMATO,
      aplicacao: `${C.APP_NOME} ${C.VERSAO}`,
      exportadoEm: new Date().toISOString(),
      projeto: {
        titulo: projeto.titulo || '',
        markdown: projeto.markdown || '',
        acervo: projeto.acervo || {},
        ajustesTema: projeto.ajustesTema || {},
        opcoes: projeto.opcoes || {},
      },
    };
    const texto = JSON.stringify(conteudo, null, 1);
    const meta = O.conteudo.extrairFrontMatter(conteudo.projeto.markdown).meta || {};
    const nome = O.exportacao.html.nomeArquivo(projeto, meta, PJ.EXTENSAO);
    return { texto, nome, bytes: new TextEncoder().encode(texto).length };
  };

  PJ.baixar = function (projeto) {
    const r = PJ.serializar(projeto);
    U.baixar(new Blob([r.texto], { type: 'application/json;charset=utf-8' }), r.nome);
    return r;
  };

  /** Nome de arquivo seguro para o acervo: sem pastas, sem caracteres de controle. */
  function nomeSeguro(nome) {
    const base = U.nomeBase(String(nome || '')).replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim().slice(0, 120);
    return base || null;
  }

  function limparItem(nomeOriginal, bruto, avisos) {
    const nome = nomeSeguro(bruto && bruto.nome ? bruto.nome : nomeOriginal);
    if (!nome || !bruto || typeof bruto !== 'object') { avisos.push(`Item do acervo "${nomeOriginal}" ilegível: descartado.`); return null; }
    const comum = {
      nome,
      alt: typeof bruto.alt === 'string' ? bruto.alt.replace(/[\[\]\r\n]/g, '').slice(0, C.TEXTO_ALTERNATIVO_MAXIMO) : '',
      adicionadoEm: Number.isFinite(bruto.adicionadoEm) ? bruto.adicionadoEm : Date.now(),
      decisao: typeof bruto.decisao === 'string' ? bruto.decisao.slice(0, 200) : '',
    };
    if (bruto.tipo === 'csv') {
      if (typeof bruto.texto !== 'string') { avisos.push(`Planilha "${nome}" sem conteúdo: descartada.`); return null; }
      const bytes = new TextEncoder().encode(bruto.texto).length;
      return Object.assign(comum, { tipo: 'csv', texto: bruto.texto, bytes, bytesOriginais: Number(bruto.bytesOriginais) || bytes });
    }
    if (bruto.tipo === 'imagem') {
      const m = typeof bruto.dataUrl === 'string' ? bruto.dataUrl.match(DATA_URL_IMAGEM) : null;
      if (!m) { avisos.push(`Imagem "${nome}" em formato não aceito: descartada.`); return null; }
      let mime = m[1];
      let dataUrl = bruto.dataUrl.replace(/\s+/g, '');
      if (mime === 'image/svg+xml') {
        try {
          const bin = atob(m[2].replace(/\s+/g, ''));
          const svg = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
          const limpo = O.conteudo.imagens.sanitizarSvg(svg);
          const bytes = new TextEncoder().encode(limpo);
          let s = '';
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          dataUrl = `data:image/svg+xml;base64,${btoa(s)}`;
        } catch (e) { avisos.push(`SVG "${nome}" recusado na limpeza de segurança: ${e.message}.`); return null; }
      }
      const bytes = U.bytesDeDataUrl(dataUrl);
      return Object.assign(comum, {
        tipo: 'imagem', mime, dataUrl, bytes, bytesOriginais: Number(bruto.bytesOriginais) || bytes,
        largura: Number(bruto.largura) || 0, altura: Number(bruto.altura) || 0,
      });
    }
    avisos.push(`Item "${nome}" de tipo desconhecido (${String(bruto.tipo)}): descartado.`);
    return null;
  }

  function numeroEntre(v, min, max) { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined; }

  /** Lê um .oratoria.json (File, Blob ou texto) e devolve { projeto, avisos, origem }. Lança Error legível. */
  PJ.ler = async function (fonte) {
    const tamanho = typeof fonte === 'string' ? fonte.length : fonte.size;
    if (tamanho > C.PROJETO_LIMITE_BYTES) throw new Error(`o arquivo tem ${U.formatarBytes(tamanho)}, acima do limite de ${U.formatarBytes(C.PROJETO_LIMITE_BYTES)}`);
    const texto = typeof fonte === 'string' ? fonte : await U.lerTexto(fonte);
    let dados;
    try { dados = JSON.parse(texto.replace(/^﻿/, '')); } catch (e) { throw new Error('o arquivo não é um projeto válido (JSON ilegível)'); }
    if (!dados || dados.formato !== PJ.FORMATO || !dados.projeto || typeof dados.projeto !== 'object') {
      throw new Error('o arquivo não é um projeto do Apresenta (formato não reconhecido)');
    }
    if (Number(dados.versaoFormato) > PJ.VERSAO_FORMATO) {
      throw new Error(`o projeto foi gravado por uma versão mais nova (formato ${dados.versaoFormato}); atualize a aplicação`);
    }
    const p = dados.projeto;
    if (typeof p.markdown !== 'string') throw new Error('o projeto não contém o texto da apresentação');
    const avisos = [];
    const acervo = {};
    for (const [chave, item] of Object.entries(p.acervo && typeof p.acervo === 'object' ? p.acervo : {})) {
      const limpo = limparItem(chave, item, avisos);
      if (limpo) acervo[limpo.nome] = limpo;
    }
    const aj = p.ajustesTema && typeof p.ajustesTema === 'object' ? p.ajustesTema : {};
    const ajustesTema = {};
    if (typeof aj.acento === 'string' && U.lerCor(aj.acento)) ajustesTema.acento = aj.acento;
    if (aj.grade && typeof aj.grade === 'object') {
      ajustesTema.grade = {};
      if (typeof aj.grade.ativa === 'boolean') ajustesTema.grade.ativa = aj.grade.ativa;
      const i = numeroEntre(aj.grade.intensidade, 0, 1.5);
      if (i !== undefined) ajustesTema.grade.intensidade = i;
    }
    const escala = numeroEntre(aj.escala, 0.9, 1.15);
    if (escala !== undefined) ajustesTema.escala = escala;
    const op = p.opcoes && typeof p.opcoes === 'object' ? p.opcoes : {};
    const opcoes = {
      minutosPorSlide: numeroEntre(op.minutosPorSlide, ...C.MINUTOS_POR_SLIDE_LIMITES) ?? C.MINUTOS_POR_SLIDE,
      qualidadeImagem: numeroEntre(op.qualidadeImagem, ...C.IMAGEM_QUALIDADE_LIMITES) ?? C.IMAGEM_QUALIDADE,
    };
    return {
      projeto: {
        titulo: typeof p.titulo === 'string' ? p.titulo.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '').slice(0, 120) : '',
        markdown: p.markdown.replace(/\r\n?/g, '\n'),
        acervo, ajustesTema, opcoes,
      },
      avisos,
      origem: { aplicacao: String(dados.aplicacao || '').slice(0, 60), exportadoEm: dados.exportadoEm || null },
    };
  };
})(window.Oratoria);
