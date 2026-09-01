"use client";

import Link from "next/link";
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

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark">★</div><div><strong>Brawl Draft Lab</strong><small>Competitive Intelligence</small></div></div>
      <nav>{nav.map(([href, label, icon]) => <Link key={href} className={path === href || (href !== "/" && path.startsWith(href)) ? "active" : ""} href={href} onClick={() => setOpen(false)}><span>{icon}</span>{label}</Link>)}</nav>
      <div className="sidebar-note"><b>Base v0.28.0</b><span>Update 69 · 69.230 live</span><span>Analyzer v0.28 · wipes + HUD estable</span></div>
    </aside>
    <main>
      <header className="topbar">
        <button className="menu-button" onClick={() => setOpen(!open)}>☰</button>
        <div><b>Competitive Draft Center</b><span>Update 69 live · analyzer v0.28 con 3v0/0v3 y tracking estabilizado · counters recalculados</span></div>
        <Link className="status-pill" href="/meta">● U69 LIVE · 69.230</Link>
      </header>
      {children}
      <footer>Proyecto independiente no afiliado a Supercell. Imágenes servidas por BrawlAPI/Brawlify. Los tiers estadísticos no equivalen por sí solos a porcentajes de victoria en tu draft.</footer>
    </main>
    {open && <button className="overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}
  </div>;
}
