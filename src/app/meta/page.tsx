import type { Metadata } from "next";
import { meta, maps, brawlers } from "@/lib/data";
import { BrawlerPortrait } from "@/components/GameArtwork";

export const metadata: Metadata = { title: "Meta" };

type NerfEntry = { brawler: string; changes: string[]; impact: string };

export default function MetaPage() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  const generalNerfs = meta.generalNerfs as NerfEntry[];
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Actualización oficial</span>
      <h1>Parche del 4 de agosto</h1>
      <p>Última revisión interna: {meta.updated}. Los cambios generales sí afectan al meta estándar; los NanoPowers se presentan aparte porque son específicos del evento.</p>
    </div>

    <div className="stats-grid">
      <div className="stat-card"><b>{meta.rosterCount}</b><span>brawlers</span></div>
      <div className="stat-card"><b>{profiled.length}</b><span>perfiles tácticos</span></div>
      <div className="stat-card"><b>{maps.length}</b><span>mapas revisados</span></div>
      <div className="stat-card"><b>{generalNerfs.length}</b><span>nerfs generales registrados</span></div>
    </div>

    <div className="section-title spaced"><div><span className="eyebrow danger-text">Balance general</span><h2>Brawlers debilitados</h2></div></div>
    <div className="patch-grid">
      {generalNerfs.map((entry) => <article className="patch-card" key={entry.brawler}>
        <BrawlerPortrait name={entry.brawler} className="patch-portrait" />
        <div><span className="patch-badge patch-down">NERF 04/08</span><h3>{entry.brawler}</h3><ul>{entry.changes.map((change) => <li key={change}>{change}</li>)}</ul><p>{entry.impact}</p></div>
      </article>)}
    </div>

    <div className="two-column-matchups spaced">
      <section className="panel">
        <span className="eyebrow danger-text">Solo evento NanoNoodles</span>
        <h2>NanoPowers debilitados</h2>
        <div className="note-list">{meta.nanoNerfs.map((item: string) => <p key={item}>↓ {item}</p>)}</div>
      </section>
      <section className="panel">
        <span className="eyebrow">Solo evento NanoNoodles</span>
        <h2>NanoPowers mejorados</h2>
        <div className="note-list">{meta.nanoBuffs.map((item: string) => <p key={item}>↑ {item}</p>)}</div>
      </section>
    </div>

    <section className="panel spaced">
      <span className="eyebrow">Correcciones relevantes</span>
      <h2>Interacciones corregidas</h2>
      <div className="note-list">{meta.bugFixes.map((item: string) => <p key={item}>✓ {item}</p>)}</div>
    </section>

    <section className="panel spaced">
      <span className="eyebrow">Criterio editorial</span>
      <h2>Cómo interpretar la v0.2</h2>
      <div className="note-list">{meta.notes.map((note: string) => <p key={note}>✓ {note}</p>)}</div>
    </section>
  </div>;
}
