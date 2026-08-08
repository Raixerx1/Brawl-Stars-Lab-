"use client";

import { useMemo, useState } from "react";
import type { Brawler, MapProfile } from "@/lib/types";
import { recommendDraft } from "@/lib/draft-engine";
import { BrawlerPortrait } from "./GameArtwork";

const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function DraftAssistant({ maps, brawlers }: { maps: MapProfile[]; brawlers: Brawler[] }) {
  const modes = [...new Set(maps.map((map) => map.mode))];
  const [mode, setMode] = useState(modes[0]);
  const available = useMemo(() => maps.filter((map) => map.mode === mode), [maps, mode]);
  const [mapSlug, setMapSlug] = useState(available[0]?.slug || "");
  const [position, setPosition] = useState<"First pick" | "Pick intermedio" | "Last pick">("First pick");
  const [allies, setAllies] = useState("");
  const [enemies, setEnemies] = useState("");
  const [bans, setBans] = useState("");
  const [run, setRun] = useState(false);
  const map = maps.find((item) => item.slug === mapSlug) || available[0];
  const results = run && map
    ? recommendDraft({ map, position, allies: split(allies), enemies: split(enemies), bans: split(bans) }, brawlers)
    : [];

  const changeMode = (nextMode: string) => {
    setMode(nextMode);
    const first = maps.find((item) => item.mode === nextMode);
    if (first) setMapSlug(first.slug);
    setRun(false);
  };

  return <div className="draft-layout">
    <section className="panel">
      <div className="section-title"><div><span className="eyebrow">Entrada</span><h2>Configura el draft</h2></div></div>
      <div className="form-grid">
        <label>Modo<select value={mode} onChange={(event) => changeMode(event.target.value)}>{modes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mapa<select value={mapSlug} onChange={(event) => { setMapSlug(event.target.value); setRun(false); }}>{available.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
        <label>Posición<select value={position} onChange={(event) => setPosition(event.target.value as typeof position)}><option>First pick</option><option>Pick intermedio</option><option>Last pick</option></select></label>
        <label>Bans<input value={bans} onChange={(event) => setBans(event.target.value)} placeholder="Piper, Gene…" /></label>
        <label>Aliados<input value={allies} onChange={(event) => setAllies(event.target.value)} placeholder="Belle, Byron…" /></label>
        <label>Enemigos<input value={enemies} onChange={(event) => setEnemies(event.target.value)} placeholder="Mortis, Grom…" /></label>
      </div>
      <button className="primary-button" onClick={() => setRun(true)}>Analizar draft</button>
      <p className="helper">La v0.2 cruza counters nominales, arquetipos, mapa, posición y equilibrio de composición.</p>
    </section>

    <section className="panel results-panel">
      <div className="section-title"><div><span className="eyebrow">Salida</span><h2>Recomendaciones</h2></div>{map && <span className="status-pill">{map.name}</span>}</div>
      {!run
        ? <div className="empty-state"><b>Listo para analizar</b><span>Completa el draft y pulsa “Analizar”.</span></div>
        : <div className="recommendations">{results.slice(0, 5).map((result, index) => <article key={result.brawler.slug} className={`recommendation rank-${index + 1}`}>
          <div className="rank">#{index + 1}</div>
          <BrawlerPortrait name={result.brawler.name} className="recommendation-avatar" />
          <div className="rec-copy">
            <div><h3>{result.brawler.name}</h3><span>{result.brawler.role} · {result.brawler.tier}</span></div>
            <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            {result.warning && <small>{result.warning}</small>}
          </div>
          <div className="score"><b>{result.score}</b><span>/100</span></div>
        </article>)}</div>}
    </section>
  </div>;
}
