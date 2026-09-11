import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./draft-overrides.css";
import "./live-v18.css";
import "./pwa.css";
import "./visual-density-v195.css";
import "./visual-refresh-v230.css";
import "./visual-home-v230.css";
import "./visual-polish-v320.css";
import "./visual-mobile-fit-v321.css";
import "./kanna-brand.css";
import AppShell from "@/components/AppShell";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "Kanna Draft",
    template: "%s · Kanna Draft",
  },
  description: "Guía competitiva y asistente de draft para Brawl Stars Ranked.",
  applicationName: "Kanna Draft",
  manifest: "/manifest.webmanifest?crow=4",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/favicon-32.png?crow=4", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png?crow=4", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png?crow=4", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?crow=4", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [
      { url: "/favicon-48.png?crow=4", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?crow=4", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Kanna Draft",
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
