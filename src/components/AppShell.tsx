"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const nav = [
  ["/", "Inicio", "⌂"],
  ["/maps", "Mapas", "◇"],
  ["/brawlers", "Brawlers", "✦"],
  ["/counters", "Counters", "⇄"],
  ["/draft", "Draft Assistant", "◎"],
  ["/live", "Auto Review", "▶"],
  ["/pool", "Mi pool", "◉"],
  ["/compare", "Comparador", "≍"],
  ["/favorites", "Favoritos", "★"],
  ["/tracker", "Aprendizaje", "▥"],
  ["/meta", "Meta", "↗"],
  ["/sources", "Fuentes", "i"],
];

const mobileNav = ["/draft", "/counters", "/live", "/meta"]
  .map((href) => nav.find(([candidate]) => candidate === href))
  .filter((item): item is string[] => Boolean(item));

const isActivePath = (path: string, href: string) => path === href || (href !== "/" && path.startsWith(`${href}/`));

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <aside id="primary-navigation" className={`sidebar ${open ? "open" : ""}`}>
      <Link className="brand" href="/" aria-label="Ir al inicio de Knna Draft" onClick={() => setOpen(false)}>
        <span className="brand-mark" aria-hidden="true">
          <Image className="brand-logo" src="/icon-192.png" alt="" width={44} height={44} priority />
        </span>
        <span><strong>Knna Draft</strong><small>Competitive Intelligence</small></span>
      </Link>
      <nav aria-label="Navegación principal">{nav.map(([href, label, icon]) => {
        const active = isActivePath(path, href);
        return <Link key={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={href} onClick={() => setOpen(false)}><span aria-hidden="true">{icon}</span>{label}</Link>;
      })}</nav>
      <div className="sidebar-note"><b>Base v0.33.1</b><span>Meta U69 · calibrado 02/09</span><span>Analyzer v0.33 · captura + lectura en vivo</span></div>
    </aside>
    <main>
      <header className="topbar">
        <button type="button" className="menu-button" onClick={() => setOpen(!open)} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? "Cerrar navegación" : "Abrir navegación"}>☰</button>
        <div><b>Competitive Draft Center</b><span>Meta U69 del 02/09 · counters recalibrados · analyzer v0.33 en vivo</span></div>
        <Link className="status-pill" href="/meta">● META 02/09</Link>
      </header>
      {children}
      <footer>Proyecto independiente no afiliado a Supercell. Imágenes servidas por BrawlAPI/Brawlify. Los tiers estadísticos no equivalen por sí solos a porcentajes de victoria en tu draft.</footer>
    </main>
    <nav className="mobile-dock" aria-label="Accesos principales">
      {mobileNav.map(([href, label, icon]) => {
        const active = isActivePath(path, href);
        return <Link key={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={href}><span aria-hidden="true">{icon}</span><small>{label === "Draft Assistant" ? "Draft" : label === "Auto Review" ? "Review" : label}</small></Link>;
      })}
    </nav>
    {open && <button className="overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}
  </div>;
}
