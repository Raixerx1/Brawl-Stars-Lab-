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
      <span className="eyebrow">Meta post-balance · revisado 16/09/2026 · Update 69</span>
      <h1>Meta Center · Balance 16/09</h1>
      <p>El mantenimiento del 16 de septiembre ya está incorporado. La tier list se recalibra con los cambios oficiales y la señal disponible el mismo día, pero se marca como provisional porque las primeras horas todavía mezclan partidas anteriores y posteriores al balance.</p>
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
          <p>Poco, Chuck, Ollie, Trunk, Willow, Juju, Pam, Belle y R-T reciben mejoras directas. La promoción en tier se mantiene prudente hasta acumular más Ranked postparche.</p>
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
        <div className="stat-card"><b>16/09</b><span>último balance oficial aplicado</span></div>
        <div className="stat-card"><b>{rankedFeatured.mode}</b><span>último modo Ranked destacado registrado</span></div>
        <div className="stat-card"><b>{meta.rankedDataThrough}</b><span>evidencia observada activa</span></div>
        <div className="stat-card"><b>{meta.officialPatchDate}</b><span>revisión de balance vigente</span></div>
      </div>
      <p className="muted">{meta.engineRosterNote}</p>
    </section>

    <section className="panel spaced">
      <div className="section-title">
        <div>
          <span className="eyebrow">Modelo competitivo · revisión 16/09</span>
          <h2>Qué cambia en Draft Engine</h2>
          <p>{patchDay.status}. Baseline: {patchDay.baseline}.</p>
        </div>
        <strong>16/09</strong>
      </div>
      <div className="patch-grid">
        <article className="patch-card">
          <div>
            <span className="patch-badge patch-up">SUBEN</span>
            <h3>Buffs modelizados</h3>
            <div className="tag-row">{patchDay.buffs.map((name) => <span key={name}>{name}</span>)}</div>
            <p>El cambio oficial entra inmediatamente en el modelo, pero la subida de tier adicional exige señal competitiva suficiente.</p>
          </div>
        </article>
        <article className="patch-card">
          <div>
            <span className="patch-badge patch-down">BAJAN</span>
            <h3>Nerfs modelizados</h3>
            <div className="tag-row danger">{patchDay.nerfs.map((name) => <span key={name}>{name}</span>)}</div>
            <p>Se reduce seguridad, tempo o burst según el cambio. El mapa y el matchup concreto todavía pueden convertirlos en la mejor respuesta.</p>
          </div>
        </article>
        <article className="patch-card">
          <div>
            <span className="patch-badge">MIXTO</span>
            <h3>No forzar conclusión todavía</h3>
            <div className="tag-row">{patchDay.mixed.map((name) => <span key={name}>{name}</span>)}</div>
            <p>Wendy gana vida base y movilidad sobre agua con gadget, pero pierde una parte muy importante de sus escudos y de la resistencia de la torreta.</p>
          </div>
        </article>
      </div>

      <div className="meta-signal-grid-v32">
        <article>
          <span className="eyebrow">Señal que vigilamos arriba</span>
          <h3>{patchDay.observedLeaders.join(" · ")}</h3>
          <p>Son los nombres con mejor combinación de fuerza previa, señal reciente o buff directo. No implica que todos sean first pick universales.</p>
        </article>
        <article>
          <span className="eyebrow danger-text">Lectura con cautela</span>
          <h3>{patchDay.volatilePicks.join(" · ")}</h3>
          <p>El cambio de kit es suficientemente grande o la muestra suficientemente joven como para evitar conclusiones fuertes el mismo día del mantenimiento.</p>
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
      <h2>Cómo interpretar la revisión del 16/09</h2>
      <div className="note-list">
        <p>✓ Las cifras de balance son oficiales de Supercell; los tiers son una interpretación competitiva y provisional.</p>
        <p>✓ El dato del mismo día del parche tiene contaminación pre-mantenimiento, por lo que no se hacen saltos extremos sin apoyo mecánico y estadístico.</p>
        <p>✓ BrawlBetter patch-aware y Brawl Time Ninja se usan como señales recientes; el modelo de Ranked alto del 03/09 actúa como baseline de estabilidad.</p>
        <p>✓ Mapa, geometría, orden del draft y matchup uno a uno conservan prioridad sobre el tier global.</p>
        <p>✓ Los snapshots anteriores permanecen accesibles en la tabla para auditar cuánto del cambio procede del balance del 16/09.</p>
      </div>
    </section>
  </div>;
}
