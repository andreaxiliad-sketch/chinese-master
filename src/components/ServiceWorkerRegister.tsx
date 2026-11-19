"use client";

import { useEffect } from "react";

/**
 * Registra il service worker solo nell'export di produzione.
 * L'URL è relativo alla cartella della pagina, così funziona anche
 * quando il sito vive in una sottocartella di GitHub Pages.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const pageUrl = new URL(window.location.href);
    if (!pageUrl.pathname.endsWith("/")) {
      pageUrl.pathname = pageUrl.pathname.replace(/[^/]*$/, "");
    }
    const scriptUrl = new URL("sw.js", pageUrl);

    navigator.serviceWorker.register(scriptUrl).catch(() => {
      /* file://, policy del browser o scope non disponibile */
    });
  }, []);

  return null;
}
