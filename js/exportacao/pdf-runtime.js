// js/exportacao/pdf-runtime.js — motorPdf: PDF direto, sem bibliotecas (decisão "PDF direto").
//
// FUNÇÃO AUTOSSUFICIENTE: reinjetada via toString() nas apresentações exportadas; não pode
// referenciar nada fora de si além dos globais permitidos em tools/verificar.mjs. Meta: < 20 KB.
//
//   O.exportacao.motorPdf({
//     slides: [section.o-slide, …],   // já montadas e dispostas no documento (medidas reais)
//     largura: 1920, altura: 1080,    // resolução de referência
//     css: '…',                        // @font-face em data URL + CSS dos slides e do tema
//     tema: 'aurora', escala: 1, qualidade: 0.85,
//     titulo, autor, produtor, texto: true, aoProgredir(i, n)
//   }) → Promise<Blob application/pdf>
//
// Cada slide é clonado num SVG <foreignObject> com todo o CSS embutido, desenhado num canvas e
// gravado como JPEG (DCTDecode). Gráficos (canvas) viram imagens antes (D36): canvas não aparece
// em foreignObject. Por cima da imagem vai uma camada de texto invisível (modo 3), palavra a
// palavra, nas posições medidas no documento, em Helvetica/WinAnsi — o PDF fica pesquisável.
// Página: largura × altura px a 0,75 pt/px (1920×1080 → 1440×810 pt).

(function (O) {
  'use strict';

  O.exportacao.motorPdf = function motorPdf(opcoes) {
    var L = opcoes.largura || 1920;
    var A = opcoes.altura || 1080;
    var escala = opcoes.escala || 1;
    var qualidade = opcoes.qualidade || 0.85;
    var slides = Array.prototype.slice.call(opcoes.slides || []);
    var doc = slides.length ? slides[0].ownerDocument : document;
    var progresso = opcoes.aoProgredir || function () {};
    var PT = 0.75;
    var W = L * PT;
    var H = A * PT;

    // ── Texto ────────────────────────────────────────────────────────────
    var ESPECIAIS = { 8364: 128, 8218: 130, 402: 131, 8222: 132, 8230: 133, 8224: 134, 8225: 135, 710: 136, 8240: 137, 352: 138, 8249: 139, 338: 140, 381: 142, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151, 732: 152, 8482: 153, 353: 154, 8250: 155, 339: 156, 382: 158, 376: 159 };
    /** Cadeia literal em WinAnsi (bytes 0–255), com ( ) \ protegidos; o que não couber vira "?". */
    function winAnsi(s) {
      var r = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        var b = c < 128 || (c >= 160 && c < 256) ? c : ESPECIAIS[c];
        if (b === undefined || b < 32) b = 63;
        if (b === 40 || b === 41 || b === 92) r += '\\';
        r += String.fromCharCode(b);
      }
      return r;
    }
    /** Cadeia de metadados em UTF-16BE hexadecimal. */
    function textoPdf(s) {
      var h = 'FEFF';
      s = String(s || '');
      for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16)).slice(-4);
      return '<' + h.toUpperCase() + '>';
    }
    function num(n) { return String(Math.round(n * 100) / 100); }
    function bytesLatin1(s) {
      var b = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
      return b;
    }

    // ── Rasterização ─────────────────────────────────────────────────────
    function clonar(secao) {
      var c = secao.cloneNode(true);
      c.classList.remove('o-atual', 'o-anim-suave', 'o-anim-frente', 'o-anim-tras');
      c.removeAttribute('aria-hidden');
      c.style.position = 'relative';
      c.style.left = '0';
      c.style.top = '0';
      c.style.visibility = 'visible';
      c.style.transform = 'none';
      var origem = secao.querySelectorAll('canvas');
      var copia = c.querySelectorAll('canvas');
      for (var k = 0; k < copia.length; k++) {
        var img = doc.createElement('img');
        try { img.src = origem[k].toDataURL('image/png'); } catch (e) { /* canvas indisponível */ }
        img.setAttribute('style', 'display:block;width:100%;height:100%;object-fit:contain');
        copia[k].parentNode.replaceChild(img, copia[k]);
      }
      var fora = c.querySelectorAll('.o-grafico-tipos, .o-notas');
      for (var j = 0; j < fora.length; j++) fora[j].parentNode.removeChild(fora[j]);
      return c;
    }

    function svgDe(secao) {
      var envelope = doc.createElement('div');
      envelope.setAttribute('data-tema', opcoes.tema || '');
      envelope.setAttribute('class', 'o-expandido');
      envelope.setAttribute('style', 'width:' + L + 'px;height:' + A + 'px;overflow:hidden;--s-largura:' + L + 'px;--s-altura:' + A + 'px');
      var estilo = doc.createElement('style');
      estilo.textContent = (opcoes.css || '') + '\n*{animation:none!important;transition:none!important}.o-fragmento{opacity:1!important;transform:none!important}';
      envelope.appendChild(estilo);
      envelope.appendChild(clonar(secao));
      var xhtml = new XMLSerializer().serializeToString(envelope);
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(L * escala) + '" height="' + Math.round(A * escala) +
        '" viewBox="0 0 ' + L + ' ' + A + '"><foreignObject x="0" y="0" width="' + L + '" height="' + A + '">' + xhtml + '</foreignObject></svg>';
    }

    function carregar(src) {
      return new Promise(function (ok, erro) {
        var img = new Image();
        img.onload = function () { ok(img); };
        img.onerror = function () { erro(new Error('o navegador não conseguiu desenhar o slide')); };
        img.src = src;
      });
    }

    function rasterizar(secao) {
      return carregar('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDe(secao))).then(function (img) {
        // As fontes em data URL do SVG podem concluir depois do evento load: breve espera
        return new Promise(function (ok) { setTimeout(function () { ok(img); }, 80); });
      }).then(function (img) {
        var c = doc.createElement('canvas');
        c.width = Math.round(L * escala);
        c.height = Math.round(A * escala);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', qualidade);
        var bin = atob(url.slice(url.indexOf(',') + 1));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { bytes: bytes, largura: c.width, altura: c.height };
      });
    }

    // ── Camada de texto invisível ────────────────────────────────────────
    function camadaTexto(secao) {
      var r0 = secao.getBoundingClientRect();
      if (!r0.width) return '';
      var f = L / r0.width;
      var ops = [];
      var filtro = {
        acceptNode: function (n) {
          var p = n.parentElement;
          if (!p || !/\S/.test(n.nodeValue)) return 2; // FILTER_REJECT
          return p.closest('.o-notas, .o-grafico-tipos, .o-grafico-dados, style, script') ? 2 : 1;
        },
      };
      var andarilho = doc.createTreeWalker(secao, 4, filtro); // SHOW_TEXT
      var faixa = doc.createRange();
      var n;
      while ((n = andarilho.nextNode())) {
        var re = /\S+/g;
        var m;
        while ((m = re.exec(n.nodeValue))) {
          faixa.setStart(n, m.index);
          faixa.setEnd(n, m.index + m[0].length);
          var r = faixa.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          var x = (r.left - r0.left) * f;
          var y = (r.top - r0.top) * f;
          var w = r.width * f;
          var h = r.height * f;
          var tamanho = h * 0.78 * PT;
          var estimada = tamanho * 0.52 * m[0].length;
          var tz = estimada > 0 ? Math.max(20, Math.min(400, (100 * w * PT) / estimada)) : 100;
          ops.push('BT 3 Tr /F1 ' + num(tamanho) + ' Tf ' + num(tz) + ' Tz 1 0 0 1 ' + num(x * PT) + ' ' + num(H - (y + h * 0.8) * PT) + ' Tm (' + winAnsi(m[0]) + ') Tj ET');
        }
      }
      return ops.join('\n');
    }

    // ── Documento PDF ────────────────────────────────────────────────────
    function montar(paginas) {
      var partes = [];
      var tamanho = 0;
      var posicoes = [];
      var total = 4;
      function escrever(s) { var b = typeof s === 'string' ? bytesLatin1(s) : s; partes.push(b); tamanho += b.length; }
      function objeto(id, corpo, fluxo) {
        posicoes[id] = tamanho;
        escrever(id + ' 0 obj\n' + corpo);
        if (fluxo) { escrever('\nstream\n'); escrever(fluxo); escrever('\nendstream'); }
        escrever('\nendobj\n');
      }
      var ids = paginas.map(function () { return { pagina: ++total, conteudo: ++total, imagem: ++total }; });
      var d = new Date();
      function dois(v) { return ('0' + v).slice(-2); }
      var data = 'D:' + d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + dois(d.getHours()) + dois(d.getMinutes()) + dois(d.getSeconds());

      escrever('%PDF-1.4\n%âãÏÓ\n');
      objeto(1, '<< /Type /Catalog /Pages 2 0 R /PageLayout /SinglePage >>');
      objeto(2, '<< /Type /Pages /Count ' + paginas.length + ' /Kids [' + ids.map(function (i) { return i.pagina + ' 0 R'; }).join(' ') + '] >>');
      objeto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      objeto(4, '<< /Title ' + textoPdf(opcoes.titulo || 'Apresentação') + (opcoes.autor ? ' /Author ' + textoPdf(opcoes.autor) : '') +
        ' /Producer ' + textoPdf(opcoes.produtor || 'motorPdf') + ' /CreationDate (' + data + ') >>');
      paginas.forEach(function (p, i) {
        var id = ids[i];
        var conteudo = bytesLatin1('q ' + num(W) + ' 0 0 ' + num(H) + ' 0 0 cm /Im' + i + ' Do Q\n' + p.texto + '\n');
        objeto(id.pagina, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(W) + ' ' + num(H) + '] /Resources << /XObject << /Im' + i + ' ' +
          id.imagem + ' 0 R >> /Font << /F1 3 0 R >> >> /Contents ' + id.conteudo + ' 0 R >>');
        objeto(id.conteudo, '<< /Length ' + conteudo.length + ' >>', conteudo);
        objeto(id.imagem, '<< /Type /XObject /Subtype /Image /Width ' + p.largura + ' /Height ' + p.altura +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>', p.bytes);
      });
      var inicioXref = tamanho;
      var xref = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
      for (var k = 1; k <= total; k++) xref += ('0000000000' + posicoes[k]).slice(-10) + ' 00000 n \n';
      escrever(xref + 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info 4 0 R >>\nstartxref\n' + inicioXref + '\n%%EOF\n');
      return new Blob(partes, { type: 'application/pdf' });
    }

    // ── Execução, um slide por vez ───────────────────────────────────────
    var paginas = [];
    function proxima(i) {
      if (i >= slides.length) { progresso(slides.length, slides.length); return Promise.resolve(montar(paginas)); }
      progresso(i, slides.length);
      var texto = opcoes.texto === false ? '' : camadaTexto(slides[i]);
      return rasterizar(slides[i]).then(function (p) {
        p.texto = texto;
        paginas.push(p);
        return new Promise(function (ok) { setTimeout(ok, 0); });
      }).then(function () { return proxima(i + 1); });
    }
    return proxima(0);
  };
})(window.Oratoria);
