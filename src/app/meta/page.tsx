import type { Metadata } from "next";
import { meta, maps, brawlers } from "@/lib/data";
import { BrawlerPortrait } from "@/components/GameArtwork";
import MetaTierList from "@/components/MetaTierList";
import tierListRaw from "@/data/meta-tierlist.json";

export const metadata: Metadata = { title: "Meta" };

type NerfEntry = { brawler: string; changes: string[]; impact: string };
type RankedFeatured = { mode: string; maps: string[]; freeRotation: string[] };

export default function MetaPage() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  const generalNerfs = meta.generalNerfs as NerfEntry[];
  const rankedFeatured = meta.rankedFeatured as RankedFeatured;
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Meta y actualización oficial · {meta.season}</span>
      <h1>Tier list y parche actual</h1>
      <p>Revisión competitiva del 22/08/2026. El balance base más reciente es el mantenimiento oficial del 04/08; la tier list usa datos Ranked posteriores y separa los poderes estacionales del rendimiento estándar.</p>
    </div>

    <section className="panel meta-season-v20">
      <div className="section-title">
        <div><span className="eyebrow">Temporada activa</span><h2>{meta.season}</h2></div>
        <strong>{meta.newestBrawler}</strong>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><b>{rankedFeatured.mode}</b><span>modo destacado Ranked</span></div>
        <div className="stat-card"><b>{rankedFeatured.maps.join(" · ")}</b><span>mapas destacados oficiales</span></div>
        <div className="stat-card"><b>{rankedFeatured.freeRotation.join(" · ")}</b><span>rotación gratuita</span></div>
        <div className="stat-card"><b>{meta.officialPatchDate}</b><span>último balance oficial</span></div>
      </div>
    </section>

    <MetaTierList data={tierListRaw} brawlers={brawlers} />

    <div className="stats-grid meta-stats-v11">
      <div className="stat-card"><b>{meta.rosterCount}</b><span>brawlers operativos</span></div>
      <div className="stat-card"><b>{profiled.length}</b><span>perfiles tácticos</span></div>
      <div className="stat-card"><b>{maps.length}</b><span>mapas revisados</span></div>
      <div className="stat-card"><b>{generalNerfs.length}</b><span>nerfs generales del 04/08</span></div>
    </div>

    <div className="section-title spaced"><div><span className="eyebrow danger-text">Balance base oficial</span><h2>Nerfs del parche del 4 de agosto</h2></div></div>
    <div className="patch-grid">
      {generalNerfs.map((entry) => <article className="patch-card" key={entry.brawler}>
        <BrawlerPortrait name={entry.brawler} className="patch-portrait" />
        <div><span className="patch-badge patch-down">NERF 04/08</span><h3>{entry.brawler}</h3><ul>{entry.changes.map((change) => <li key={change}>{change}</li>)}</ul><p>{entry.impact}</p></div>
      </article>)}
    </div>

    <div className="two-column-matchups spaced">
      <section className="panel">
        <span className="eyebrow danger-text">Poderes estacionales · no confundir con kit base</span>
        <h2>NanoPowers debilitados</h2>
        <div className="note-list">{meta.nanoNerfs.map((item: string) => <p key={item}>↓ {item}</p>)}</div>
      </section>
      <section className="panel">
        <span className="eyebrow">Poderes estacionales · Windstock</span>
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
      <span className="eyebrow">Criterio competitivo</span>
      <h2>Cómo interpretar esta revisión</h2>
      <div className="note-list">{meta.notes.map((note: string) => <p key={note}>✓ {note}</p>)}</div>
    </section>
  </div>;
}
