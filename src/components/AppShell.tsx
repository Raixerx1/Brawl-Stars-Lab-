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
      <div className="brand"><div className="brand-mark">★</div><div><strong>Brawl Draft Lab</strong><small>Ranked Intelligence</small></div></div>
      <nav>{nav.map(([href, label, icon]) => <Link key={href} className={path === href || (href !== "/" && path.startsWith(href)) ? "active" : ""} href={href} onClick={() => setOpen(false)}><span>{icon}</span>{label}</Link>)}</nav>
      <div className="sidebar-note"><b>Base v0.15</b><span>Meta: 11/08/2026</span><span>106 brawlers · 1.060 matchups</span></div>
    </aside>
    <main>
      <header className="topbar">
        <button className="menu-button" onClick={() => setOpen(!open)}>☰</button>
        <div><b>De Mítico a Legendario</b><span>SoloQ, Dúo, Trío y doble pick coordinado</span></div>
        <Link className="status-pill" href="/meta">● Parche 04/08</Link>
      </header>
      {children}
      <footer>Proyecto independiente no afiliado a Supercell. Imágenes servidas por BrawlAPI/Brawlify. Los tiers editoriales no equivalen a porcentajes de victoria.</footer>
    </main>
    {open && <button className="overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}
  </div>;
}
