"use client";

import { useMemo, useState } from "react";
import type { Brawler } from "@/lib/types";
import { BrawlerPortrait } from "./GameArtwork";

function overlap(a: string[], b: string[]) {
  return a.filter((item) => b.includes(item));
}

export default function BrawlerCompare({ brawlers }: { brawlers: Brawler[] }) {
  const defaults = ["Gene", "Belle", "Gale"];
  const [selected, setSelected] = useState(defaults.map((name) => brawlers.find((brawler) => brawler.name === name)?.slug || brawlers[0].slug));
  const picks = useMemo(() => selected.map((slug) => brawlers.find((brawler) => brawler.slug === slug)).filter(Boolean) as Brawler[], [selected, brawlers]);

  const change = (index: number, slug: string) => setSelected((current) => current.map((item, itemIndex) => itemIndex === index ? slug : item));
  const commonCounters = picks.length >= 2 ? picks.slice(1).reduce((current, brawler) => overlap(current, brawler.counters), picks[0].counters) : [];
  const commonThreats = picks.length >= 2 ? picks.slice(1).reduce((current, brawler) => overlap(current, brawler.counteredBy), picks[0].counteredBy) : [];

  return <div className="compare-page">
    <section className="panel compare-selectors">
      {selected.map((slug, index) => <label key={index}>Brawler {index + 1}<select value={slug} onChange={(event) => change(index, event.target.value)}>{brawlers.map((brawler) => <option value={brawler.slug} key={brawler.slug}>{brawler.name}</option>)}</select></label>)}
    </section>

    <div className="compare-grid">{picks.map((brawler) => <article className="panel compare-card" key={brawler.slug}>
      <BrawlerPortrait name={brawler.name} className="compare-avatar" />
      <span className="eyebrow">{brawler.role}</span>
      <h2>{brawler.name}</h2>
      <p>{brawler.range} · dificultad {brawler.difficulty}/5</p>
      <div className="compare-facts">
        <span><b>Tier</b>{brawler.tier}</span>
        <span><b>First pick</b>{brawler.tags.includes("safe") || brawler.role === "Control" ? "Bueno" : brawler.role === "Asesino" ? "Arriesgado" : "Situacional"}</span>
        <span><b>Carry SoloQ</b>{brawler.tags.includes("carry") || ["Asesino", "Antitanque"].includes(brawler.role) ? "Alto" : "Medio"}</span>
        <span><b>Antidive</b>{["Antidive", "Antitanque"].includes(brawler.role) || ["Gale", "R-T", "Surge", "Shelly"].includes(brawler.name) ? "Sí" : "Limitado"}</span>
      </div>
      <div className="compare-list good"><b>Favorece</b>{brawler.counters.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
      <div className="compare-list bad"><b>Lo frena</b>{brawler.counteredBy.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
    </article>)}</div>

    <div className="two-column-matchups spaced">
      <section className="panel"><span className="eyebrow">Solapamiento</span><h2>Objetivos comunes</h2>{commonCounters.length ? <div className="tag-row">{commonCounters.map((item) => <span key={item}>{item}</span>)}</div> : <p className="muted">No comparten counters directos registrados.</p>}</section>
      <section className="panel"><span className="eyebrow danger-text">Riesgo conjunto</span><h2>Amenazas comunes</h2>{commonThreats.length ? <div className="tag-row danger-tags">{commonThreats.map((item) => <span key={item}>{item}</span>)}</div> : <p className="muted">No comparten una amenaza directa registrada.</p>}</section>
    </div>
  </div>;
}
