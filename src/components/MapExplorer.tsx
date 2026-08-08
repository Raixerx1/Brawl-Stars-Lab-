"use client";
import { useMemo, useState } from "react";
import type { MapProfile } from "@/lib/types";
import MapCard from "./MapCard";

export default function MapExplorer({ maps, modes }: { maps: MapProfile[]; modes: string[] }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("Todos");
  const [pool, setPool] = useState("Actual");

  const list = useMemo(() => maps.filter((map) => {
    const modeMatch = mode === "Todos" || map.mode === mode;
    const poolMatch = pool === "Todos" || map.rotationStatus === pool;
    const haystack = `${map.name} ${(map.aliases || []).join(" ")} ${map.mode} ${map.traits.join(" ")} ${map.tierS.join(" ")}`.toLowerCase();
    return modeMatch && poolMatch && haystack.includes(q.toLowerCase());
  }), [maps, mode, pool, q]);

  return <>
    <div className="filters">
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar mapa, alias español o brawler…" />
      <select value={mode} onChange={(event) => setMode(event.target.value)}>
        <option>Todos</option>
        {modes.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={pool} onChange={(event) => setPool(event.target.value)}>
        <option value="Actual">Ranked actual</option>
        <option value="Histórico">Históricos</option>
        <option value="Todos">Todos</option>
      </select>
      <span>{list.length} mapas</span>
    </div>
    <div className="card-grid">{list.map((map) => <MapCard map={map} key={map.slug} />)}</div>
  </>;
}
