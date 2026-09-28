// js/exportacao/markdown.js — texto da apresentação em Markdown (§9.4), sozinho ou num pacote
// ZIP com os arquivos do acervo (D33), para edição em outro programa.
//
//   O.exportacao.markdown.baixarTexto(projeto)   → titulo_AAAA-MM-DD.md
//   O.exportacao.markdown.baixarPacote(projeto)  → titulo_AAAA-MM-DD.zip
//                                                   (pasta/texto .md + imagens e CSV pelo nome)
//
// As imagens são citadas pelo nome do arquivo, que é também o nome gravado no pacote:
// descompactado, o texto e as imagens podem ser reabertos juntos (Abrir pasta).

(function (O) {
  'use strict';

  const MD = (O.exportacao.markdown = {});
  const U = O.util;

  const meta = (projeto) => O.conteudo.extrairFrontMatter(projeto.markdown || '').meta || {};

  /** Texto final: o próprio Markdown, com fim de linha garantido. */
  MD.texto = (projeto) => {
    const t = (projeto.markdown || '').replace(/\r\n?/g, '\n');
    return t.endsWith('\n') ? t : `${t}\n`;
  };

  MD.baixarTexto = function (projeto) {
    if (!(projeto.markdown || '').trim()) throw new Error('não há texto para exportar');
    const nome = O.exportacao.html.nomeArquivo(projeto, meta(projeto), '.md');
    const texto = MD.texto(projeto);
    U.baixar(new Blob([texto], { type: 'text/markdown;charset=utf-8' }), nome);
    return { nome, bytes: new TextEncoder().encode(texto).length };
  };

  function bytesDoItem(item) {
    if (item.tipo === 'csv') return new TextEncoder().encode(item.texto || '');
    const b64 = String(item.dataUrl || '').split(',')[1] || '';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  MD.baixarPacote = function (projeto) {
    if (!(projeto.markdown || '').trim()) throw new Error('não há texto para exportar');
    const m = meta(projeto);
    const nomeZip = O.exportacao.html.nomeArquivo(projeto, m, '.zip');
    const pasta = nomeZip.replace(/\.zip$/, '');
    const entradas = [{ nome: `${pasta}/${U.normalizarNome(projeto.titulo || m.titulo || 'apresentacao')}.md`, dados: MD.texto(projeto) }];
    for (const item of Object.values(projeto.acervo || {})) {
      // O nome citado no texto prevalece, mesmo que a recompressão tenha mudado o formato
      // (ex.: foto.jpg guardada como WebP): navegadores e a própria aplicação reconhecem o conteúdo.
      entradas.push({ nome: `${pasta}/${item.nome}`, dados: bytesDoItem(item), data: item.adicionadoEm ? new Date(item.adicionadoEm) : new Date() });
    }
    const blob = O.exportacao.zip.criar(entradas);
    U.baixar(blob, nomeZip);
    return { nome: nomeZip, bytes: blob.size, arquivos: entradas.length };
  };
})(window.Oratoria);
