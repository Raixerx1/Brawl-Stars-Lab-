import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./draft-overrides.css";
import "./live-v18.css";
import "./pwa.css";
import "./visual-density-v195.css";
import "./visual-refresh-v230.css";
import "./visual-home-v230.css";
import AppShell from "@/components/AppShell";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "Brawl Draft Lab",
    template: "%s · Brawl Draft Lab",
  },
  description: "Guía competitiva y asistente de draft para Brawl Stars Ranked.",
  applicationName: "Brawl Draft Lab",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Draft Lab",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#060914",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es">
    <body>
      <ServiceWorkerRegister />
      <PwaInstallPrompt />
      <AppShell>{children}</AppShell>
    </body>
  </html>;
}
