// sw.js — service worker da versão publicada (https). Registrado por js/interface/app.js
// somente em https: (em file:// não há service worker; §2.7 do CLAUDE.md).
//
// • Núcleo da aplicação (lista gerada em sw-recursos.js, D6): cache primeiro. A lista e o
//   nome do cache mudam juntos a cada alteração de qualquer arquivo; a instalação baixa a
//   nova lista inteira num cache novo.
// • Módulos sob demanda (C.MODULOS_REDE): rede primeiro, com cópia guardada para uso sem
//   internet. A sonda de conectividade e qualquer outro endereço externo passam direto.
// • Atualização: a nova versão assume assim que instalada, mas a página aberta segue com o
//   código já carregado; a interface avisa "Nova versão disponível" e a recarga seguinte
//   já usa a nova versão. Caches de versões anteriores são removidos na ativação.
// • Nada do trabalho do usuário passa por aqui (D40): textos, imagens e rascunhos ficam no
//   IndexedDB da página; o service worker guarda só os arquivos da aplicação.

importScripts('sw-recursos.js');

const CACHE = self.ORATORIA_CACHE;
const CACHE_REDE = 'oratoria-rede-1';
const RECURSOS = self.ORATORIA_RECURSOS;
const REDE = new Set(self.ORATORIA_REDE || []);

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' ignora o cache HTTP do navegador: a lista nova precisa dos arquivos novos.
    await cache.addAll(RECURSOS.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter((n) => n.startsWith('oratoria-') && n !== CACHE && n !== CACHE_REDE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'versao' && evento.source) evento.source.postMessage({ tipo: 'versao', cache: CACHE });
});

async function doNucleo(pedido, url) {
  const cache = await caches.open(CACHE);
  // A página principal (pasta ou index.html, com ou sem ?dev) usa sempre a mesma cópia.
  const principal = pedido.mode === 'navigate' && url.href.split(/[?#]/)[0].replace(/index\.html$/, '') === self.registration.scope;
  const guardado = await cache.match(principal ? './' : pedido, { ignoreSearch: principal });
  if (guardado) return guardado;
  try {
    return await fetch(pedido);
  } catch (e) {
    if (principal) {
      const indice = await cache.match('index.html');
      if (indice) return indice;
    }
    throw e;
  }
}

async function daRede(pedido) {
  const cache = await caches.open(CACHE_REDE);
  try {
    const resposta = await fetch(pedido);
    if (resposta.ok || resposta.type === 'opaque') await cache.put(pedido.url, resposta.clone());
    return resposta;
  } catch (e) {
    const guardado = await cache.match(pedido.url);
    if (guardado) return guardado;
    throw e;
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin === self.location.origin) {
    // Só o que está no escopo desta aplicação; o próprio sw.js nunca é interceptado.
    if (!url.href.startsWith(self.registration.scope) || /\/sw(-recursos)?\.js$/.test(url.pathname)) return;
    evento.respondWith(doNucleo(pedido, url));
    return;
  }
  if (REDE.has(url.origin + url.pathname)) evento.respondWith(daRede(pedido));
});
