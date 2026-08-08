"use client";

import { useMemo, useState } from "react";
import type { Brawler } from "@/lib/types";
import { favorableReason, threatReason } from "@/lib/matchups";
import { BrawlerPortrait } from "./GameArtwork";

export default function CounterExplorer({ brawlers }: { brawlers: Brawler[] }) {
  const [selected, setSelected] = useState("Kenji");
  const source = useMemo(
    () => brawlers.find((brawler) => brawler.name === selected) || brawlers[0],
    [brawlers, selected],
  );
  const lookup = (name: string) => brawlers.find((brawler) => brawler.name === name);

  return (
    <div className="counter-explorer">
      <section className="panel counter-selector">
        <div>
          <span className="eyebrow">Consulta rápida</span>
          <h2>Selecciona un brawler</h2>
          <p>Los matchups son orientativos y deben adaptarse al mapa, líneas y orden del draft.</p>
        </div>
        <select value={source.name} onChange={(event) => setSelected(event.target.value)}>
          {brawlers.map((brawler) => <option key={brawler.slug}>{brawler.name}</option>)}
        </select>
      </section>

      <section className="counter-focus">
        <BrawlerPortrait name={source.name} className="counter-focus-art" priority />
        <div>
          <span className="card-kicker">{source.role} · Tier {source.tier}</span>
          <h1>{source.name}</h1>
          <p>{source.build}</p>
        </div>
      </section>

      <div className="two-column-matchups">
        <section className="panel">
          <span className="eyebrow">Lo suele castigar</span>
          <h2>Buenos enfrentamientos</h2>
          <div className="matchup-grid">
            {source.counters.map((name) => {
              const target = lookup(name);
              if (!target) return null;
              return <article className="matchup-card favorable" key={name}>
                <BrawlerPortrait name={target.name} className="matchup-avatar" />
                <div><h3>{target.name}</h3><p>{favorableReason(source, target)}</p></div>
              </article>;
            })}
          </div>
        </section>
        <section className="panel">
          <span className="eyebrow danger-text">Amenazas</span>
          <h2>Quién lo frena</h2>
          <div className="matchup-grid">
            {source.counteredBy.map((name) => {
              const threat = lookup(name);
              if (!threat) return null;
              return <article className="matchup-card threat" key={name}>
                <BrawlerPortrait name={threat.name} className="matchup-avatar" />
                <div><h3>{threat.name}</h3><p>{threatReason(source, threat)}</p></div>
              </article>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
