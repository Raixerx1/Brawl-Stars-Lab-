"use client";

import { useState } from "react";
import type { Brawler } from "@/lib/types";
import BrawlerCard from "./BrawlerCard";

export default function BrawlerExplorer({ brawlers }: { brawlers: Brawler[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("Todos");
  const roles = [...new Set(brawlers.map((brawler) => brawler.role))].sort();
  const search = query.toLocaleLowerCase("es");
  const visible = brawlers.filter((brawler) =>
    (role === "Todos" || brawler.role === role) &&
    `${brawler.name} ${brawler.role} ${brawler.rarity}`.toLocaleLowerCase("es").includes(search)
  );

  return <>
    <div className="filters">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar brawler…" />
      <select value={role} onChange={(event) => setRole(event.target.value)}>
        <option>Todos</option>
        {roles.map((item) => <option key={item}>{item}</option>)}
      </select>
      <span>{visible.length} brawlers</span>
    </div>
    <div className="card-grid brawler-grid">
      {visible.map((brawler) => <BrawlerCard brawler={brawler} key={brawler.slug} />)}
    </div>
  </>;
}
