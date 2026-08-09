"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Brawler, PlayerPool as PlayerPoolType, PlayerPoolEntry } from "@/lib/types";
import { createDefaultPool, loadPool, mergePool, savePool } from "@/lib/pool";
import { BrawlerPortrait } from "./GameArtwork";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const GROUP_BY_ROLE_KEY = "brawl-pool-group-by-role-v1";
const ROLE_ORDER = [
  "Tirador",
  "Control",
  "Daño",
  "Antitanque",
  "Antidive",
  "Asesino",
  "Tanque",
  "Artillero",
  "Apoyo",
  "Especialista",
];

export default function PlayerPool({ brawlers }: { brawlers: Brawler[] }) {
  const [pool, setPool] = useState<PlayerPoolType>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [groupByRole, setGroupByRole] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPool(loadPool(brawlers));
    try {
      const storedGrouping = window.localStorage.getItem(GROUP_BY_ROLE_KEY);
      if (storedGrouping !== null) setGroupByRole(storedGrouping === "true");
    } catch {
      // Mantener agrupación por defecto si el navegador bloquea localStorage.
    }
    setLoaded(true);
  }, [brawlers]);

  const commit = (next: PlayerPoolType, message?: string) => {
    setPool(next);
    savePool(next);
    if (message) setMessage(message);
  };

  const toggleGrouping = (enabled: boolean) => {
    setGroupByRole(enabled);
    try {
      window.localStorage.setItem(GROUP_BY_ROLE_KEY, String(enabled));
    } catch {
      // La vista sigue funcionando aunque no pueda guardarse la preferencia.
    }
  };

  const update = (slug: string, patch: Partial<PlayerPoolEntry>) => {
    const currentEntry = pool[slug];
    if (!currentEntry) return;
    commit({ ...pool, [slug]: { ...currentEntry, ...patch } });
  };

  const bulkUpdate = (patch: Partial<PlayerPoolEntry>, label: string) => {
    const next = Object.fromEntries(
      (Object.entries(pool) as [string, PlayerPoolEntry][]).map(([slug, entry]) => [slug, { ...entry, ...patch }]),
    );
    commit(next, label);
  };

  const markPower11Only = () => {
    const next = Object.fromEntries(
      (Object.entries(pool) as [string, PlayerPoolEntry][]).map(([slug, entry]) => [
        slug,
        { ...entry, available: entry.power11 && !entry.avoid },
      ]),
    );
    commit(next, "Disponibles limitados a Fuerza 11");
  };

  const exportPool = () => {
    const blob = new Blob([JSON.stringify(pool, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brawl-draft-lab-pool.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Pool exportado");
  };

  const importPool = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PlayerPoolType;
      commit(mergePool(brawlers, parsed), "Pool importado correctamente");
    } catch {
      setMessage("El archivo no contiene un pool válido");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const resetPool = () => {
    commit(createDefaultPool(brawlers), "Pool restaurado");
  };

  const visible = useMemo(() => brawlers.filter((brawler) => {
    const entry = pool[brawler.slug];
    const matches = normalize(`${brawler.name} ${brawler.role}`).includes(normalize(query));
    if (!matches) return false;
    if (filter === "Favoritos") return entry?.favorite;
    if (filter === "Fuerza 11") return entry?.power11;
    if (filter === "Hipercarga") return entry?.hypercharge;
    if (filter === "Confort") return (entry?.mastery || 0) >= 4;
    if (filter === "Evitar") return entry?.avoid;
    if (filter === "No disponibles") return entry && !entry.available;
    return true;
  }), [brawlers, pool, query, filter]);

  const groupedVisible = useMemo(() => {
    const groups = new Map<string, Brawler[]>();
    for (const brawler of visible) {
      const current = groups.get(brawler.role) || [];
      current.push(brawler);
      groups.set(brawler.role, current);
    }
    return [...groups.entries()].sort(([roleA], [roleB]) => {
      const indexA = ROLE_ORDER.indexOf(roleA);
      const indexB = ROLE_ORDER.indexOf(roleB);
      if (indexA === -1 && indexB === -1) return roleA.localeCompare(roleB, "es");
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [visible]);

  const summary = useMemo(() => {
    const entries = Object.values(pool) as PlayerPoolEntry[];
    return {
      available: entries.filter((entry) => entry.available && !entry.avoid).length,
      power11: entries.filter((entry) => entry.power11).length,
      hypercharge: entries.filter((entry) => entry.hypercharge).length,
      comfort: entries.filter((entry) => entry.mastery >= 4 && !entry.avoid).length,
      favorite: entries.filter((entry) => entry.favorite && !entry.avoid).length,
    };
  }, [pool]);

  const renderCard = (brawler: Brawler) => {
    const entry = pool[brawler.slug];
    if (!entry) return null;
    return <article className={`pool-card ${entry.avoid ? "pool-card-avoid" : ""} ${entry.favorite ? "pool-card-favorite" : ""}`} key={brawler.slug}>
      <button
        type="button"
        className={`pool-favorite-button ${entry.favorite ? "active" : ""}`}
        onClick={() => update(brawler.slug, { favorite: !entry.favorite })}
        title={entry.favorite ? "Quitar prioridad" : "Marcar como prioritario"}
      >★</button>
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
  };

  if (!loaded) return <div className="panel">Cargando tu pool…</div>;

  return <div className="pool-page pool-page-v5">
    {message && <div className="draft-toast">{message}</div>}

    <div className="stats-grid pool-stats pool-stats-v5">
      <div className="stat-card"><b>{summary.available}</b><span>disponibles</span></div>
      <div className="stat-card"><b>{summary.favorite}</b><span>prioritarios</span></div>
      <div className="stat-card"><b>{summary.power11}</b><span>fuerza 11</span></div>
      <div className="stat-card"><b>{summary.hypercharge}</b><span>con hipercarga</span></div>
      <div className="stat-card"><b>{summary.comfort}</b><span>dominio 4–5</span></div>
    </div>

    <section className="panel pool-toolbar pool-toolbar-v5">
      <div className="pool-search-row pool-search-row-v52">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar brawler…" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          {["Todos", "Favoritos", "Fuerza 11", "Hipercarga", "Confort", "Evitar", "No disponibles"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <label className="pool-group-toggle">
          <input type="checkbox" checked={groupByRole} onChange={(event) => toggleGrouping(event.target.checked)} />
          <span><b>Agrupar por rol</b><small>{groupByRole ? "Secciones por categoría" : "Vista única"}</small></span>
        </label>
      </div>
      <div className="pool-bulk-actions">
        <button type="button" onClick={() => bulkUpdate({ available: true }, "Todos marcados como disponibles")}>Todos disponibles</button>
        <button type="button" onClick={markPower11Only}>Solo Fuerza 11</button>
        <button type="button" onClick={() => bulkUpdate({ favorite: false }, "Prioridades eliminadas")}>Limpiar favoritos</button>
        <button type="button" onClick={exportPool}>Exportar</button>
        <button type="button" onClick={() => importRef.current?.click()}>Importar</button>
        <button type="button" onClick={resetPool}>Restaurar</button>
        <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => importPool(event.target.files?.[0])} />
      </div>
      <p>En el Draft Assistant podrás ignorar el pool, usarlo como preferencia o limitar las recomendaciones exclusivamente a tus brawlers disponibles.</p>
    </section>

    {visible.length === 0 ? <section className="panel pool-empty-state"><h3>No hay brawlers con estos filtros</h3><p>Cambia el filtro o el texto de búsqueda.</p></section> : groupByRole ? <div className="pool-role-groups">
      {groupedVisible.map(([role, roleBrawlers]) => {
        const roleAvailable = roleBrawlers.filter((brawler) => {
          const entry = pool[brawler.slug];
          return entry?.available && !entry.avoid;
        }).length;
        return <details className="pool-role-group" key={role} open>
          <summary>
            <div><span className="pool-role-icon">{role.slice(0, 1)}</span><div><h2>{role}</h2><p>{roleAvailable} disponibles de {roleBrawlers.length}</p></div></div>
            <strong>{roleBrawlers.length}</strong>
          </summary>
          <div className="pool-grid">{roleBrawlers.map(renderCard)}</div>
        </details>;
      })}
    </div> : <div className="pool-grid">{visible.map(renderCard)}</div>}
  </div>;
}
