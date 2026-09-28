// js/exportacao/zip.js — gerador de arquivos ZIP próprio, sem dependências (D33).
//
//   const blob = O.exportacao.zip.criar([{ nome: 'pasta/texto.md', dados: Uint8Array | string, data? }])
//
// Método "store" (sem compressão): imagens WebP/JPEG já estão comprimidas e o texto é pequeno,
// de modo que o ganho do deflate não justificaria o código. Nomes em UTF-8 (bit 11 ativo).
// Limites: arquivos e total abaixo de 4 GB (sem ZIP64).

(function (O) {
  'use strict';

  const Z = (O.exportacao.zip = {});

  let tabelaCrc = null;
  function crc32(bytes) {
    if (!tabelaCrc) {
      tabelaCrc = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        tabelaCrc[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = tabelaCrc[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  Z.crc32 = crc32;

  /** Data e hora no formato MS-DOS. */
  function dataDos(d) {
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
    const data = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { hora, data };
  }

  Z.criar = function (entradas) {
    const cod = new TextEncoder();
    const partes = [];
    const central = [];
    let deslocamento = 0;
    for (const e of entradas) {
      const nome = cod.encode(String(e.nome).replace(/\\/g, '/').replace(/^\/+/, ''));
      const dados = typeof e.dados === 'string' ? cod.encode(e.dados) : e.dados;
      const crc = crc32(dados);
      const { hora, data } = dataDos(e.data || new Date());

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);        // versão necessária
      local.setUint16(6, 0x0800, true);    // UTF-8
      local.setUint16(8, 0, true);         // store
      local.setUint16(10, hora, true);
      local.setUint16(12, data, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, dados.length, true);
      local.setUint32(22, dados.length, true);
      local.setUint16(26, nome.length, true);
      local.setUint16(28, 0, true);
      partes.push(new Uint8Array(local.buffer), nome, dados);

      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);            // criado por
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, hora, true);
      c.setUint16(14, data, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, dados.length, true);
      c.setUint32(24, dados.length, true);
      c.setUint16(28, nome.length, true);
      c.setUint32(42, deslocamento, true);
      central.push(new Uint8Array(c.buffer), nome);
      deslocamento += 30 + nome.length + dados.length;
    }
    const tamanhoCentral = central.reduce((t, p) => t + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, entradas.length, true);
    fim.setUint16(10, entradas.length, true);
    fim.setUint32(12, tamanhoCentral, true);
    fim.setUint32(16, deslocamento, true);
    return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: 'application/zip' });
  };
})(window.Oratoria);
