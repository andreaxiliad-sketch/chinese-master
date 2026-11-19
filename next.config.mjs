/** @type {import('next').NextConfig} */

// GitHub Pages di progetto: `NEXT_PUBLIC_BASE_PATH=/nome-repo` al momento del build.
// Vuoto: il sito resta alla radice (locale, user site, hosting statico).
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig = {
  // Esporta l'intera app come sito statico puro (cartella `out/`),
  // installabile come PWA e funzionante completamente offline.
  output: "export",
  // Necessario con output: 'export' perché non c'è un server che ottimizza le immagini.
  images: {
    unoptimized: true,
  },
  // URL con slash finale: aiuta la navigazione corretta quando l'export
  // statico viene servito da file system / hosting statico.
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
