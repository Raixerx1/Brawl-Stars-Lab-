import type { Metadata } from "next";
import { meta, maps, brawlers } from "@/lib/data";
import { BrawlerPortrait } from "@/components/GameArtwork";
import MetaTierList from "@/components/MetaTierList";
import tierListRaw from "@/data/meta-tierlist.json";

export const metadata: Metadata = { title: "Meta" };

type NerfEntry = { brawler: string; changes: string[]; impact: string };
type BalanceEntry = { readonly brawler: string; readonly changes: readonly string[]; readonly impact: string };
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
  observedLeaders: readonly string[];
  volatilePicks: readonly string[];
};

type September16Balance = {
  readonly nerfs: readonly BalanceEntry[];
  readonly buffs: readonly BalanceEntry[];
  readonly bugFixes: readonly string[];
};

export default function MetaPage() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  const generalNerfs = meta.generalNerfs as NerfEntry[];
  const rankedFeatured = meta.rankedFeatured as RankedFeatured;
  const update69Maps = meta.update69CompetitiveMaps as Update69MapChange[];
  const patchDay = meta.update69BalanceModel as Update69BalanceModel;
  const september16 = meta.september16Balance as September16Balance;

  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Meta v0.34.0 · revisado 25/09/2026 · Update 69</span>
      <h1>Meta Center · Revisión 25/09</h1>
      <p>El balance oficial del 16 de septiembre sigue plenamente integrado. La revisión v0.34.0 consolida la lectura posterior al parche y separa el tier global del valor contextual para evitar que un buen mapa o una señal agregada conviertan un pick situacional en prioridad universal.</p>
    </div>

    <MetaTierList data={tierListRaw} brawlers={brawlers} />

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow danger-text">Mantenimiento 16/09 · oficial</span>
          <h2>Nerfs del balance</h2>
          <p>Estos cambios son cifras publicadas por Supercell; el texto de impacto es la lectura competitiva de Kanna Draft.</p>
        </div>
        <strong>{september16.nerfs.length} afectados</strong>
      </div>
      <div className="patch-grid">
        {september16.nerfs.map((entry) => <article className="patch-card" key={entry.brawler}>
          <BrawlerPortrait name={entry.brawler} className="patch-portrait" />
          <div>
            <span className="patch-badge patch-down">NERF 16/09</span>
            <h3>{entry.brawler}</h3>
            <ul>{entry.changes.map((change) => <li key={change}>{change}</li>)}</ul>
            <p>{entry.impact}</p>
          </div>
        </article>)}
      </div>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Mantenimiento 16/09 · oficial</span>
          <h2>Buffs del balance</h2>
          <p>Poco, Chuck, Ollie, Trunk, Willow, Juju, Pam, Belle y R-T reciben mejoras directas. v0.34.0 conserva esos cambios mecánicos, pero limita su traducción a tier global cuando el rendimiento depende del mapa o de una composición concreta.</p>
        </div>
        <strong>{september16.buffs.length} afectados</strong>
      </div>
      <div className="patch-grid">
        {september16.buffs.map((entry) => <article className="patch-card" key={entry.brawler}>
          <BrawlerPortrait name={entry.brawler} className="patch-portrait" />
          <div>
            <span className="patch-badge patch-up">BUFF 16/09</span>
            <h3>{entry.brawler}</h3>
            <ul>{entry.changes.map((change) => <li key={change}>{change}</li>)}</ul>
            <p>{entry.impact}</p>
          </div>
        </article>)}
      </div>
    </section>

    <section className="panel spaced">
      <span className="eyebrow">Correcciones · 16/09</span>
      <h2>Bug fixes relevantes</h2>
      <div className="note-list">{september16.bugFixes.map((item) => <p key={item}>✓ {item}</p>)}</div>
    </section>

    <section className="panel meta-season-v20 spaced">
      <div className="section-title">
        <div><span className="eyebrow">Estado del juego</span><h2>{meta.season}</h2></div>
        <strong>{meta.newestBrawler}</strong>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><b>25/09</b><span>última recalibración competitiva</span></div>
        <div className="stat-card"><b>{rankedFeatured.mode}</b><span>último modo Ranked destacado registrado</span></div>
        <div className="stat-card"><b>{meta.rankedDataThrough}</b><span>evidencia observada activa</span></div>
        <div className="stat-card"><b>{meta.officialPatchDate}</b><span>balance oficial vigente</span></div>
      </div>
      <p className="muted">{meta.engineRosterNote}</p>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Modelo competitivo · revisión 25/09</span>
          <h2>Qué cambia en Draft Engine</h2>
          <p>{patchDay.status}. v0.34.0 mantiene los deltas mecánicos del 16/09, pero recalibra la viabilidad general y el riesgo de first pick con una lectura más estable.</p>
        </div>
        <strong>v0.34.0</strong>
      </div>
      <div className="patch-grid">
        <article className="patch-card">
          <div>
            <span className="patch-badge patch-up">BUFFS VIGENTES</span>
            <h3>Mejoras mecánicas conservadas</h3>
            <div className="tag-row">{patchDay.buffs.map((name) => <span key={name}>{name}</span>)}</div>
            <p>El buff oficial sigue entrando al motor. Su efecto sobre tier y prioridad de draft se limita cuando el valor depende de mapa, modo o protección del equipo.</p>
          </div>
        </article>
        <article className="patch-card">
          <div>
            <span className="patch-badge patch-down">NERFS VIGENTES</span>
            <h3>Recortes mecánicos conservados</h3>
            <div className="tag-row danger">{patchDay.nerfs.map((name) => <span key={name}>{name}</span>)}</div>
            <p>Los recortes siguen reduciendo seguridad, tempo o burst. Un mapa favorable puede compensar parte del nerf, pero no revierte automáticamente el tier general.</p>
          </div>
        </article>
        <article className="patch-card">
          <div>
            <span className="patch-badge">RECALIBRADO</span>
            <h3>Wendy deja de ser prioridad S global</h3>
            <div className="tag-row"><span>Wendy · A</span></div>
            <p>La vida base y la movilidad sobre agua siguen aportando, pero los escudos y la torreta más débiles elevan el riesgo de abrirla a ciegas. v0.34.0 la deja en A general.</p>
          </div>
        </article>
      </div>

      <div className="meta-signal-grid-v32">
        <article>
          <span className="eyebrow">Decisiones consolidadas 25/09</span>
          <h3>Wendy A · Brock A · Rico A · Nori B · Belle B · Trunk B · Pam C</h3>
          <p>Son tiers generales. Rico puede alcanzar valor S contextual; Nori y Belle A contextual; Pam B/A contextual en Zona Restringida y mapas estáticos que protegen su torreta.</p>
        </article>
        <article>
          <span className="eyebrow danger-text">Contexto antes que etiqueta</span>
          <h3>Rico · Nori · Belle · Pam</h3>
          <p>Estos picks son especialmente sensibles a geometría, modo y composición. Draft Assist aplica sus perfiles y afinidades concretas en lugar de elevar permanentemente el tier global.</p>
        </article>
      </div>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Update 69 · rotación live</span>
          <h2>Rotación competitiva</h2>
          <p>Los mapas de Update 69 siguen activos en el modelo. Los completamente nuevos mantienen perfil estructural provisional hasta acumular muestra Ranked suficiente.</p>
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
      <p className="muted">Balance vigente: {meta.update69BalanceStatus}</p>
      <p className="muted">Seguimiento: {meta.nextBalanceWindow}</p>
    </section>

    <section className="panel spaced">
      <span className="eyebrow">Notas del ciclo</span>
      <h2>Lectura competitiva actualizada</h2>
      <div className="note-list">{meta.update69Highlights.map((item) => <p key={item}>✓ {item}</p>)}</div>
    </section>

    <div className="stats-grid meta-stats-v11">
      <div className="stat-card"><b>{meta.rosterCount}</b><span>brawlers operativos en el motor local</span></div>
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
        <span className="eyebrow">Poderes estacionales · histórico</span>
        <h2>NanoPowers mejorados</h2>
        <div className="note-list">{meta.nanoBuffs.map((item: string) => <p key={item}>↑ {item}</p>)}</div>
      </section>
    </div>

    <section className="panel spaced">
      <span className="eyebrow">Criterio competitivo</span>
      <h2>Cómo interpretar la revisión del 25/09</h2>
      <div className="note-list">
        <p>✓ Las cifras del balance del 16/09 siguen siendo las oficiales de Supercell; los tiers son una capa competitiva del motor.</p>
        <p>✓ BrawlBetter y NOFF pesan más en esta revisión; Brawl Time Ninja se usa como contraste agregado y no como señal post-hotfix aislada.</p>
        <p>✓ Un buen rendimiento en un modo o geometría concreta se expresa como valor contextual, no como promoción automática del tier global.</p>
        <p>✓ Mapa, geometría, orden del draft, composición y matchup uno a uno conservan prioridad sobre el tier general.</p>
        <p>✓ Los snapshots previos permanecen como histórico para distinguir el efecto del parche de la recalibración posterior.</p>
      </div>
    </section>
  </div>;
}
