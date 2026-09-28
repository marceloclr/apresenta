// js/conteudo/imagens.js — preparo de arquivos para o acervo (§5.4): recompressão de imagens
// por canvas, sanitização de SVG e leitura de CSV.
//
//   const item = await O.conteudo.imagens.processar(arquivo, { qualidade: 0.85 });
//     → { tipo: 'imagem', nome, mime, dataUrl, bytes, bytesOriginais, largura, altura, decisao }
//   const csv = await O.conteudo.imagens.lerPlanilhaCsv(arquivo)
//     → { tipo: 'csv', nome, texto, bytes, bytesOriginais }
//
// Regras de recompressão:
//   • lado maior reduzido a C.IMAGEM_LADO_MAXIMO (1920 px);
//   • conversão para WebP com a qualidade escolhida; sem suporte a WebP, JPEG — ou PNG, se a
//     imagem tiver transparência;
//   • se a conversão não reduzir o peso e a imagem não precisar ser redimensionada, o original
//     é preservado (caso comum de PNGs pequenos com transparência);
//   • GIF é preservado (o canvas perderia a animação);
//   • SVG é sanitizado pelo DOMPurify (perfil SVG, sem scripts nem foreignObject) e não é
//     recomprimido.

(function (O) {
  'use strict';

  const IM = (O.conteudo.imagens = {});
  const U = O.util;
  const C = O.config;

  const MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  };
  const EXTENSAO_DO_MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
  const ROTULO_FORMATO = { 'image/webp': 'WebP', 'image/jpeg': 'JPEG', 'image/png': 'PNG' };

  IM.ehImagem = (nome) => Object.prototype.hasOwnProperty.call(MIME, U.extensao(nome));
  IM.ehCsv = (nome) => U.extensao(nome) === '.csv';
  IM.extensaoDoMime = (mime) => EXTENSAO_DO_MIME[mime] || '.png';

  let suporteWebp = null;
  IM.suportaWebp = function () {
    if (suporteWebp === null) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      suporteWebp = c.toDataURL('image/webp').startsWith('data:image/webp');
    }
    return suporteWebp;
  };

  const paraBlob = (canvas, tipo, qualidade) => new Promise((resolver) => canvas.toBlob(resolver, tipo, qualidade));

  function carregarImagem(blob) {
    return new Promise((resolver, rejeitar) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('imagem ilegível ou corrompida')); };
      img.src = url;
    });
  }

  function temTransparencia(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
  }

  function base64DeBytes(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /** Remove scripts, manipuladores e objetos estranhos de um SVG (DOMPurify, perfil SVG). */
  IM.sanitizarSvg = function (texto) {
    const limpo = window.DOMPurify.sanitize(String(texto), {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject', 'style'],
    });
    if (!/<svg[\s>]/i.test(limpo)) throw new Error('o SVG ficou vazio após a limpeza de segurança');
    return limpo;
  };

  async function processarSvg(arquivo, nome) {
    const svg = IM.sanitizarSvg(await U.lerTexto(arquivo));
    const bytes = new TextEncoder().encode(svg);
    const dataUrl = `data:image/svg+xml;base64,${base64DeBytes(bytes)}`;
    let largura = 0, altura = 0;
    try {
      const img = await carregarImagem(new Blob([bytes], { type: 'image/svg+xml' }));
      largura = img.naturalWidth; altura = img.naturalHeight;
    } catch (_) { /* dimensões desconhecidas não impedem o uso */ }
    return {
      tipo: 'imagem', nome, mime: 'image/svg+xml', dataUrl, bytes: bytes.length, bytesOriginais: arquivo.size,
      largura, altura, decisao: 'SVG sanitizado; imagem vetorial, sem recompressão',
    };
  }

  /**
   * Prepara uma imagem para o acervo. `nome` substitui o nome do arquivo (imagens coladas).
   * Lança Error com mensagem legível se o arquivo não puder ser lido.
   */
  IM.processar = async function (arquivo, { qualidade = C.IMAGEM_QUALIDADE, ladoMaximo = C.IMAGEM_LADO_MAXIMO, nome } = {}) {
    const n = nome || arquivo.name;
    const ext = U.extensao(n);
    if (ext === '.svg' || arquivo.type === 'image/svg+xml') return processarSvg(arquivo, n);

    const img = await carregarImagem(arquivo);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const mimeOriginal = arquivo.type || MIME[ext] || 'image/png';
    const base = { tipo: 'imagem', nome: n, bytesOriginais: arquivo.size, largura: w0, altura: h0 };

    if (ext === '.gif' || mimeOriginal === 'image/gif') {
      return Object.assign(base, {
        mime: 'image/gif', dataUrl: await U.lerDataUrl(arquivo), bytes: arquivo.size,
        decisao: 'GIF preservado: a recompressão perderia a animação',
      });
    }

    const escala = Math.min(1, ladoMaximo / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * escala));
    const h = Math.max(1, Math.round(h0 * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const alfa = mimeOriginal !== 'image/jpeg' && temTransparencia(ctx, w, h);
    const destino = IM.suportaWebp() ? 'image/webp' : (alfa ? 'image/png' : 'image/jpeg');
    const blob = await paraBlob(canvas, destino, qualidade);
    const reduzida = escala < 1;

    if (!blob || (blob.size >= arquivo.size && !reduzida)) {
      return Object.assign(base, {
        mime: mimeOriginal, dataUrl: await U.lerDataUrl(arquivo), bytes: arquivo.size,
        decisao: alfa ? 'original preservado: imagem com transparência que a conversão não tornaria mais leve'
          : 'original preservado: a conversão não reduziria o peso',
      });
    }
    const formato = ROTULO_FORMATO[blob.type] || blob.type;
    const partes = [];
    if (reduzida) partes.push(`reduzida de ${w0}×${h0} para ${w}×${h} px`);
    partes.push(`convertida em ${formato}${blob.type === 'image/png' ? '' : ` (qualidade ${Math.round(qualidade * 100)}%)`}`);
    return Object.assign(base, {
      mime: blob.type, dataUrl: await U.lerDataUrl(blob), bytes: blob.size, largura: w, altura: h,
      decisao: partes.join('; '),
    });
  };

  /** Lê um CSV como fonte de dados do acervo (o texto é interpretado pelo PapaParse no uso). */
  IM.lerPlanilhaCsv = async function (arquivo, { nome } = {}) {
    const texto = (await U.lerTexto(arquivo)).replace(/^﻿/, '');
    return { tipo: 'csv', nome: nome || arquivo.name, texto, bytes: new TextEncoder().encode(texto).length, bytesOriginais: arquivo.size };
  };
})(window.Oratoria);
