"use client";

import { useEffect, useMemo, useState } from "react";
import type { Brawler, PlayerPool as PlayerPoolType, PlayerPoolEntry } from "@/lib/types";
import { loadPool, savePool } from "@/lib/pool";
import { BrawlerPortrait } from "./GameArtwork";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function PlayerPool({ brawlers }: { brawlers: Brawler[] }) {
  const [pool, setPool] = useState<PlayerPoolType>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPool(loadPool(brawlers));
    setLoaded(true);
  }, [brawlers]);

  const update = (slug: string, patch: Partial<PlayerPoolEntry>) => {
    setPool((current) => {
      const next = { ...current, [slug]: { ...current[slug], ...patch } };
      savePool(next);
      return next;
    });
  };

  const visible = useMemo(() => brawlers.filter((brawler) => {
    const entry = pool[brawler.slug];
    const matches = normalize(`${brawler.name} ${brawler.role}`).includes(normalize(query));
    if (!matches) return false;
    if (filter === "Fuerza 11") return entry?.power11;
    if (filter === "Hipercarga") return entry?.hypercharge;
    if (filter === "Confort") return (entry?.mastery || 0) >= 4;
    if (filter === "Evitar") return entry?.avoid;
    if (filter === "No disponibles") return entry && !entry.available;
    return true;
  }), [brawlers, pool, query, filter]);

  const summary = useMemo(() => {
    const entries = Object.values(pool);
    return {
      available: entries.filter((entry) => entry.available && !entry.avoid).length,
      power11: entries.filter((entry) => entry.power11).length,
      hypercharge: entries.filter((entry) => entry.hypercharge).length,
      comfort: entries.filter((entry) => entry.mastery >= 4 && !entry.avoid).length,
    };
  }, [pool]);

  if (!loaded) return <div className="panel">Cargando tu pool…</div>;

  return <div className="pool-page">
    <div className="stats-grid pool-stats">
      <div className="stat-card"><b>{summary.available}</b><span>disponibles</span></div>
      <div className="stat-card"><b>{summary.power11}</b><span>fuerza 11</span></div>
      <div className="stat-card"><b>{summary.hypercharge}</b><span>con hipercarga</span></div>
      <div className="stat-card"><b>{summary.comfort}</b><span>dominio 4–5</span></div>
    </div>

    <section className="panel pool-toolbar">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar brawler…" />
      <select value={filter} onChange={(event) => setFilter(event.target.value)}>
        {['Todos', 'Fuerza 11', 'Hipercarga', 'Confort', 'Evitar', 'No disponibles'].map((item) => <option key={item}>{item}</option>)}
      </select>
      <p>El Draft Assistant puede limitarse a este pool y ponderar tu dominio, fuerza 11 e hipercarga.</p>
    </section>

    <div className="pool-grid">{visible.map((brawler) => {
      const entry = pool[brawler.slug];
      return <article className={`pool-card ${entry.avoid ? "pool-card-avoid" : ""}`} key={brawler.slug}>
        <div className="pool-card-head">
          <BrawlerPortrait name={brawler.name} className="pool-avatar" />
          <div><h3>{brawler.name}</h3><p>{brawler.role} · Tier {brawler.tier}</p></div>
        </div>
        <div className="pool-toggles">
          <label><input type="checkbox" checked={entry.available} onChange={(event) => update(brawler.slug, { available: event.target.checked })} /> Disponible</label>
          <label><input type="checkbox" checked={entry.power11} onChange={(event) => update(brawler.slug, { power11: event.target.checked })} /> Fuerza 11</label>
          <label><input type="checkbox" checked={entry.hypercharge} onChange={(event) => update(brawler.slug, { hypercharge: event.target.checked })} /> Hipercarga</label>
          <label><input type="checkbox" checked={entry.avoid} onChange={(event) => update(brawler.slug, { avoid: event.target.checked })} /> Evitar</label>
        </div>
        <label className="mastery-control"><span>Dominio personal <b>{entry.mastery}/5</b></span><input type="range" min="1" max="5" value={entry.mastery} onChange={(event) => update(brawler.slug, { mastery: Number(event.target.value) })} /></label>
      </article>;
    })}</div>
  </div>;
}
