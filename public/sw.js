/**
 * Service worker di ChineseMaster.
 * Shell e asset con hash: stale-while-revalidate, così l'avvio è immediato
 * e un aggiornamento arriva in background.
 * Tratti hanzi: cache-first, sono immutabili e devono esserci anche offline.
 * Gli URL sono relativi alla posizione di questo file, quindi il worker
 * resta valido in una sottocartella di GitHub Pages.
 */
const CACHE = "chinesemaster-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-maskable.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (relativeUrl) => {
          try {
            await cache.add(new URL(relativeUrl, self.location.href));
          } catch {
            /* un'icona mancante non deve bloccare l'installazione */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
  warmStrokeData();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (isStrokeFile(url) || url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

function isStrokeFile(url) {
  return url.pathname.includes("/hanzi-data/") && url.pathname.endsWith(".json") && !url.pathname.endsWith("/index.json");
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    void network;
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;
  if (request.mode === "navigate") {
    const shell =
      (await cache.match(new URL("./index.html", self.location.href))) ||
      (await cache.match(new URL("./", self.location.href)));
    if (shell) return shell;
  }
  return Response.error();
}

async function warmStrokeData() {
  try {
    const indexUrl = new URL("./hanzi-data/index.json", self.location.href);
    const response = await fetch(indexUrl);
    if (!response.ok) return;
    const data = await response.json();
    const characters = Array.isArray(data.characters) ? data.characters : [];
    const cache = await caches.open(CACHE);
    const batchSize = 8;
    for (let index = 0; index < characters.length; index += batchSize) {
      const slice = characters.slice(index, index + batchSize);
      await Promise.all(
        slice.map(async (char) => {
          const fileUrl = new URL(`./hanzi-data/${encodeURIComponent(char)}.json`, self.location.href);
          if (await cache.match(fileUrl)) return;
          try {
            const file = await fetch(fileUrl);
            if (file.ok) await cache.put(fileUrl, file);
          } catch {
            /* carattere assente o rete giù: il canvas ha il suo fallback */
          }
        }),
      );
    }
  } catch {
    /* indice non ancora generato: i tratti si cachano alla prima richiesta */
  }
}
