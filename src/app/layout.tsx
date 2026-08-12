import type { Metadata,Viewport } from "next";import "./globals.css";import "./draft-overrides.css";import AppShell from "@/components/AppShell";import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
export const metadata:Metadata={title:{default:"Brawl Draft Lab",template:"%s · Brawl Draft Lab"},description:"Guía competitiva y asistente de draft para Brawl Stars Ranked.",manifest:"/manifest.webmanifest",icons:{icon:"/icon-192.png",apple:"/icon-192.png"}};
export const viewport:Viewport={themeColor:"#090c18",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><ServiceWorkerRegister/><AppShell>{children}</AppShell></body></html>}
