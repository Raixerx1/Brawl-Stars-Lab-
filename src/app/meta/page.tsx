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
type Update69BalanceModel = {
  status: string;
  baseline: string;
  buffs: readonly string[];
  nerfs: readonly string[];
  mixed: readonly string[];
  buffieWatchlist: readonly string[];
  hyperchargeWatchlist: readonly string[];
};

export default function MetaPage() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  const generalNerfs = meta.generalNerfs as NerfEntry[];
  const rankedFeatured = meta.rankedFeatured as RankedFeatured;
  const update69Maps = meta.update69CompetitiveMaps as Update69MapChange[];
  const patchDay = meta.update69BalanceModel as Update69BalanceModel;

  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Update 69 LIVE · 01/09/2026 · cliente 69.230</span>
      <h1>Meta Center · Update 69</h1>
      <p>Update 69 ya está distribuida. El motor conserva la fotografía competitiva observada del 30/08 como baseline y activa desde hoy una capa provisional de día 1 para reflejar el balance final sin fingir que ya existen win rates post-parche maduros.</p>
    </div>

    <section className="panel meta-season-v20">
      <div className="section-title">
        <div><span className="eyebrow">Estado del juego</span><h2>{meta.season}</h2></div>
        <strong>{meta.newestBrawler}</strong>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><b>69.230</b><span>cliente Update 69 live</span></div>
        <div className="stat-card"><b>{rankedFeatured.mode}</b><span>último modo Ranked destacado registrado</span></div>
        <div className="stat-card"><b>{meta.rankedDataThrough}</b><span>evidencia + prior activo</span></div>
        <div className="stat-card"><b>{meta.officialPatchDate}</b><span>activación de Update 69</span></div>
      </div>
      <p className="muted">{meta.engineRosterNote}</p>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Update 69 · rotación live</span>
          <h2>Nueva rotación competitiva</h2>
          <p>Los mapas anunciados para Update 69 ya se tratan como rotación actual. Los completamente nuevos siguen con perfil estructural provisional hasta acumular muestra Ranked suficiente.</p>
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
      <p className="muted">Seguimiento: {meta.nextBalanceWindow}</p>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Modelo competitivo · día 1</span>
          <h2>Qué cambia ya en Draft Engine</h2>
          <p>{patchDay.status}. Baseline: {patchDay.baseline}.</p>
        </div>
        <strong>U69</strong>
      </div>
      <div className="patch-grid">
        <article className="patch-card">
          <div>
            <span className="patch-badge patch-up">PRIOR ↑</span>
            <h3>Subidas modelizadas</h3>
            <div className="tag-row">{patchDay.buffs.map((name) => <span key={name}>{name}</span>)}</div>
            <p>Solo se promociona de forma conservadora cuando el ajuste de kit justifica una expectativa competitiva clara. No son win rates observados.</p>
          </div>
        </article>
        <article className="patch-card">
          <div>
            <span className="patch-badge patch-down">PRIOR ↓</span>
            <h3>Bajadas modelizadas</h3>
            <div className="tag-row danger">{patchDay.nerfs.map((name) => <span key={name}>{name}</span>)}</div>
            <p>El motor reduce su viabilidad global, pero mapa, orden de draft y matchup pueden seguir colocándolos como primera opción.</p>
          </div>
        </article>
        <article className="patch-card">
          <div>
            <span className="patch-badge">MIXTO / REWORK</span>
            <h3>No forzar tier todavía</h3>
            <div className="tag-row">{patchDay.mixed.map((name) => <span key={name}>{name}</span>)}</div>
            <p>Chuck cambia profundamente su patrón de súper/postes y Bo combina mejora y recorte. Se mantienen en observación para no convertir incertidumbre en una falsa certeza.</p>
          </div>
        </article>
      </div>

      <div className="two-column-matchups spaced">
        <article className="panel">
          <span className="eyebrow">Buffies U69 · watchlist</span>
          <h3>{patchDay.buffieWatchlist.join(" · ")}</h3>
          <p>No se les concede un salto automático de tier por el mero anuncio del Buffie: el motor espera disponibilidad real y rendimiento Ranked.</p>
        </article>
        <article className="panel">
          <span className="eyebrow">Hipercargas U69 · watchlist</span>
          <h3>{patchDay.hyperchargeWatchlist.join(" · ")}</h3>
          <p>Se incorporarán como factor fuerte cuando estén efectivamente disponibles en el ciclo y podamos medir su impacto real.</p>
        </article>
      </div>
    </section>

    <section className="panel spaced">
      <span className="eyebrow">Contenido del ciclo Update 69</span>
      <h2>Novedades confirmadas</h2>
      <div className="note-list">{meta.update69Highlights.map((item) => <p key={item}>✓ {item}</p>)}</div>
    </section>

    <MetaTierList data={tierListRaw} brawlers={brawlers} />

    <div className="stats-grid meta-stats-v11">
      <div className="stat-card"><b>{meta.rosterCount}</b><span>brawlers operativos en el motor</span></div>
      <div className="stat-card"><b>{profiled.length}</b><span>perfiles tácticos</span></div>
      <div className="stat-card"><b>{maps.length}</b><span>mapas en base + rotación U69</span></div>
      <div className="stat-card"><b>{generalNerfs.length}</b><span>nerfs del 04/08 conservados como histórico</span></div>
    </div>

    <div className="section-title spaced"><div><span className="eyebrow danger-text">Histórico previo</span><h2>Nerfs del parche del 4 de agosto</h2></div></div>
    <div className="patch-grid">
      {generalNerfs.map((entry) => <article className="patch-card" key={entry.brawler}>
        <BrawlerPortrait name={entry.brawler} className="patch-portrait" />
        <div><span className="patch-badge patch-down">NERF 04/08</span><h3>{entry.brawler}</h3><ul>{entry.changes.map((change) => <li key={change}>{change}</li>)}</ul><p>{entry.impact}</p></div>
      </article>)}
    </div>

    <div className="two-column-matchups spaced">
      <section className="panel">
        <span className="eyebrow danger-text">Poderes estacionales · histórico</span>
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
      <span className="eyebrow">Correcciones previas relevantes</span>
      <h2>Interacciones corregidas</h2>
      <div className="note-list">{meta.bugFixes.map((item: string) => <p key={item}>✓ {item}</p>)}</div>
    </section>

    <section className="panel spaced">
      <span className="eyebrow">Criterio competitivo</span>
      <h2>Cómo interpretar esta revisión</h2>
      <div className="note-list">
        <p>✓ Update 69 está live, pero una actualización de cliente no crea instantáneamente una muestra estadística fiable.</p>
        <p>✓ El prior de día 1 mueve la viabilidad global de los afectados; mapa, geometría, orden del draft y matchup uno a uno conservan prioridad.</p>
        <p>✓ La fotografía 30/08 permanece accesible como baseline para poder distinguir efecto del parche de simple ruido de muestra.</p>
        <p>✓ Cosmo y Vince no se inventan dentro del motor competitivo antes de su release/elegibilidad real.</p>
      </div>
    </section>
  </div>;
}
