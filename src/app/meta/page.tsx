import type { Metadata } from "next";
import { meta, maps, brawlers } from "@/lib/data";
import { BrawlerPortrait } from "@/components/GameArtwork";
import MetaTierList from "@/components/MetaTierList";
import tierListRaw from "@/data/meta-tierlist.json";

export const metadata: Metadata = { title: "Meta" };

type NerfEntry = { brawler: string; changes: string[]; impact: string };
type RankedFeatured = { mode: string; maps: string[]; freeRotation: string[] };
type Update69MapChange = {
  mode: string;
  removed: string;
  added: string;
  new: boolean;
  creator?: string;
};

export default function MetaPage() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  const generalNerfs = meta.generalNerfs as NerfEntry[];
  const rankedFeatured = meta.rankedFeatured as RankedFeatured;
  const update69Maps = meta.update69CompetitiveMaps as Update69MapChange[];

  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Meta y actualización · revisión 31/08/2026</span>
      <h1>Tier list, parche vivo y Update 69</h1>
      <p>Hoy 31/08 no consta un nuevo balance live: el último oficial sigue siendo el 04/08. La tier list ya usa la fotografía Meta 24 h actualizada el 30/08 y el balance de septiembre permanece bloqueado hasta las release notes definitivas de Supercell.</p>
    </div>

    <section className="panel meta-season-v20">
      <div className="section-title">
        <div><span className="eyebrow">Temporada activa</span><h2>{meta.season}</h2></div>
        <strong>{meta.newestBrawler}</strong>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><b>{rankedFeatured.mode}</b><span>modo destacado Ranked actual</span></div>
        <div className="stat-card"><b>{rankedFeatured.maps.join(" · ")}</b><span>mapas destacados oficiales actuales</span></div>
        <div className="stat-card"><b>{meta.rankedDataThrough}</b><span>fotografía competitiva revisada</span></div>
        <div className="stat-card"><b>{meta.officialPatchDate}</b><span>último balance oficial vivo</span></div>
      </div>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Update 69 · anunciado 29/08</span>
          <h2>Nueva rotación competitiva</h2>
          <p>Los mapas nuevos ya están disponibles en Draft Assist con perfil provisional; los que regresan conservan su perfil histórico y se recalibrarán con datos post-lanzamiento.</p>
        </div>
        <strong>{update69Maps.filter((item) => item.new).length} nuevos</strong>
      </div>
      <div className="patch-grid">
        {update69Maps.map((change) => <article className="patch-card" key={`${change.mode}-${change.added}`}>
          <div>
            <span className={`patch-badge ${change.new ? "patch-up" : ""}`}>{change.new ? "NUEVO" : "REGRESA"}</span>
            <h3>{change.added}</h3>
            <p><b>{change.mode}</b></p>
            <p>Entra por <s>{change.removed}</s>{change.creator ? ` · creador: ${change.creator}` : ""}.</p>
          </div>
        </article>)}
      </div>
      <p className="muted">Balance de Update 69: {meta.update69BalanceStatus}</p>
      <p className="muted">Ventana prevista: {meta.nextBalanceWindow}</p>
    </section>

    <MetaTierList data={tierListRaw} brawlers={brawlers} />

    <div className="stats-grid meta-stats-v11">
      <div className="stat-card"><b>{meta.rosterCount}</b><span>brawlers operativos</span></div>
      <div className="stat-card"><b>{profiled.length}</b><span>perfiles tácticos</span></div>
      <div className="stat-card"><b>{maps.length}</b><span>mapas en base + rotación U69</span></div>
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
