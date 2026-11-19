import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chinese Master HSK 1-3",
  description:
    "PWA offline-first per imparare il cinese mandarino (HSK 1–3) con ripasso spaziato e scrittura dei tratti in locale.",
  applicationName: "HanziMaster",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HanziMaster",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className="h-full">
      <head>
        <link rel="manifest" href="./manifest.json" />
        <link rel="icon" href="./icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="./icon-192.png" />
      </head>
      <body className="min-h-full antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
