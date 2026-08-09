"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Brawler,
  DraftPosition,
  MapProfile,
  MatchResult,
  PersonalMatch,
} from "@/lib/types";
import {
  buildPersonalPerformance,
  normalizeMatchHistory,
  readMatchHistory,
  saveMatchHistory,
} from "@/lib/performance";
import { BrawlerPortrait } from "./GameArtwork";

export default function MatchTracker({ maps, brawlers }: { maps: MapProfile[]; brawlers: Brawler[] }) {
  const [matches, setMatches] = useState<PersonalMatch[]>([]);
  const [mapSlug, setMapSlug] = useState(maps[0]?.slug || "");
  const [brawlerName, setBrawlerName] = useState(brawlers[0]?.name || "");
  const [result, setResult] = useState<MatchResult>("Victoria");
  const [draftPosition, setDraftPosition] = useState<DraftPosition>("Pick intermedio");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMatches(readMatchHistory(maps, brawlers)), [maps, brawlers]);

  const performance = useMemo(() => buildPersonalPerformance(matches), [matches]);
  const selectedMap = maps.find((map) => map.slug === mapSlug) || maps[0];
  const selectedBrawler = brawlers.find((brawler) => brawler.name === brawlerName) || brawlers[0];

  const commit = (next: PersonalMatch[], text?: string) => {
    setMatches(next);
    saveMatchHistory(next);
    if (text) setMessage(text);
  };

  const save = () => {
    if (!selectedMap || !selectedBrawler) return;
    const match: PersonalMatch = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mapSlug: selectedMap.slug,
      mapName: selectedMap.name,
      mode: selectedMap.mode,
      brawler: selectedBrawler.name,
      brawlerSlug: selectedBrawler.slug,
      role: selectedBrawler.role,
      result,
      draftPosition,
      allies: [],
      enemies: [],
      note,
      source: "Manual",
    };
    commit([match, ...matches].slice(0, 300), "Partida guardada; el Draft Coach ya puede aprender de ella");
    setNote("");
  };

  const remove = (id: string) => commit(matches.filter((match) => match.id !== id), "Partida eliminada");

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(matches, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brawl-draft-lab-historial.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Historial exportado");
  };

  const importHistory = async (file?: File) => {
    if (!file) return;
    try {
      const imported = normalizeMatchHistory(JSON.parse(await file.text()), maps, brawlers);
      const known = new Set(matches.map((match) => match.id));
      const merged = [...imported.filter((match) => !known.has(match.id)), ...matches]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 300);
      commit(merged, `${imported.length} partidas importadas`);
    } catch {
      setMessage("No se pudo importar el historial");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const topBrawlers = useMemo(() => Object.entries(performance.brawlers)
    .map(([slug, stat]) => ({ brawler: brawlers.find((entry) => entry.slug === slug), stat }))
    .filter((item) => item.brawler && item.stat.games >= 2)
    .sort((a, b) => b.stat.winRate - a.stat.winRate || b.stat.games - a.stat.games)
    .slice(0, 5), [performance, brawlers]);

  const weakMaps = useMemo(() => Object.entries(performance.maps)
    .map(([slug, stat]) => ({ map: maps.find((entry) => entry.slug === slug), stat }))
    .filter((item) => item.map && item.stat.games >= 2)
    .sort((a, b) => a.stat.winRate - b.stat.winRate || b.stat.games - a.stat.games)
    .slice(0, 4), [performance, maps]);

  const roleStats = useMemo(() => Object.entries(performance.roles)
    .filter(([, stat]) => stat.games >= 1)
    .sort(([, a], [, b]) => b.games - a.games), [performance]);

  return <div className="tracker-v7">
    {message && <div className="draft-toast">{message}</div>}

    <div className="stats-grid tracker-stats-v7">
      <div className="stat-card"><b>{performance.overall.games}</b><span>partidas registradas</span></div>
      <div className="stat-card"><b>{performance.overall.wins}</b><span>victorias</span></div>
      <div className="stat-card"><b>{performance.overall.winRate}%</b><span>win rate personal</span></div>
      <div className="stat-card"><b>{Object.keys(performance.brawlers).length}</b><span>brawlers evaluados</span></div>
    </div>

    <div className="tracker-grid tracker-grid-v7">
      <section className="panel">
        <div className="section-title"><div><span className="eyebrow">Aprendizaje personal</span><h2>Registrar partida</h2></div></div>
        <div className="form-grid tracker-form-v7">
          <label>Mapa<select value={mapSlug} onChange={(event) => setMapSlug(event.target.value)}>{maps.map((map) => <option value={map.slug} key={map.slug}>{map.mode} · {map.name}</option>)}</select></label>
          <label>Brawler<select value={brawlerName} onChange={(event) => setBrawlerName(event.target.value)}>{brawlers.map((brawler) => <option key={brawler.name}>{brawler.name}</option>)}</select></label>
          <label>Resultado<select value={result} onChange={(event) => setResult(event.target.value as MatchResult)}><option>Victoria</option><option>Derrota</option></select></label>
          <label>Posición<select value={draftPosition} onChange={(event) => setDraftPosition(event.target.value as DraftPosition)}><option>First pick</option><option>Pick intermedio</option><option>Last pick</option></select></label>
          <label className="tracker-note-field">Nota<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Qué matchup o decisión funcionó o falló" /></label>
        </div>
        <div className="tracker-actions-v7">
          <button className="primary-button" onClick={save}>Guardar partida</button>
          <button className="secondary-button" onClick={exportHistory}>Exportar historial</button>
          <button className="secondary-button" onClick={() => importRef.current?.click()}>Importar</button>
          <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => importHistory(event.target.files?.[0])} />
        </div>
        <small className="tracker-learning-note">El motor solo aplica ajustes moderados y exige varias partidas para evitar sobrevalorar muestras pequeñas.</small>
      </section>

      <section className="panel">
        <div className="section-title"><div><span className="eyebrow">Resumen</span><h2>Lo que está aprendiendo</h2></div></div>
        <div className="personal-insight-list">
          {topBrawlers.length ? topBrawlers.map(({ brawler, stat }) => brawler && <article key={brawler.slug}>
            <BrawlerPortrait name={brawler.name} className="tracker-avatar" />
            <div><b>{brawler.name}</b><small>{stat.games} partidas · {stat.wins} victorias</small></div>
            <strong>{stat.winRate}%</strong>
          </article>) : <div className="empty-state">Registra al menos dos partidas con un brawler para generar tendencias.</div>}
        </div>
      </section>
    </div>

    <div className="tracker-insight-grid-v7">
      <section className="panel">
        <span className="eyebrow">Rendimiento por rol</span><h2>Roles más fiables</h2>
        <div className="role-performance-list">{roleStats.length ? roleStats.map(([role, stat]) => <div key={role}><b>{role}</b><span>{stat.games} partidas</span><strong>{stat.winRate}%</strong></div>) : <p>Sin datos suficientes.</p>}</div>
      </section>
      <section className="panel">
        <span className="eyebrow">Puntos débiles</span><h2>Mapas a revisar</h2>
        <div className="role-performance-list">{weakMaps.length ? weakMaps.map(({ map, stat }) => map && <div key={map.slug}><b>{map.name}</b><span>{stat.games} partidas · {map.mode}</span><strong className={stat.winRate < 50 ? "negative" : ""}>{stat.winRate}%</strong></div>) : <p>Se necesitan al menos dos partidas por mapa.</p>}</div>
      </section>
    </div>

    <section className="panel tracker-history-v7">
      <div className="section-title"><div><span className="eyebrow">Historial local</span><h2>Últimas partidas</h2></div><span>{matches.length}/300</span></div>
      <div className="match-list match-list-v7">{matches.slice(0, 30).map((match) => <article key={match.id}>
        <span className={match.result === "Victoria" ? "win" : "loss"}>{match.result === "Victoria" ? "V" : "D"}</span>
        <BrawlerPortrait name={match.brawler} className="history-match-avatar" />
        <div><b>{match.brawler} · {match.mapName}</b><small>{match.mode} · {match.draftPosition || "Posición no registrada"}{match.note ? ` · ${match.note}` : ""}</small></div>
        <em>{match.source}</em>
        <button type="button" onClick={() => remove(match.id)} aria-label={`Eliminar partida de ${match.brawler}`}>×</button>
      </article>)}{!matches.length && <div className="empty-state">Tus partidas se guardarán únicamente en este dispositivo.</div>}</div>
    </section>
  </div>;
}
