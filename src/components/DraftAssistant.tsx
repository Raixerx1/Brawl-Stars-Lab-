"use client";

import { useMemo, useState } from "react";
import type { Brawler, DraftPosition, DraftRecommendation, MapProfile } from "@/lib/types";
import { analyzeDraft, inferDraftPosition } from "@/lib/draft-engine";
import { BrawlerPortrait, MapArtwork } from "./GameArtwork";
import BrawlerDraftPicker from "./BrawlerDraftPicker";

const normalize = (value: string) => value.trim().toLowerCase();

function selectDistinct(
  results: DraftRecommendation[],
  sorter: (a: DraftRecommendation, b: DraftRecommendation) => number,
  excluded: string[],
) {
  return [...results]
    .filter((result) => !excluded.includes(result.brawler.name))
    .sort(sorter)[0];
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="draft-metric">
    <span><b>{label}</b><small>{value}</small></span>
    <div><i className={danger ? "danger" : ""} style={{ width: `${value}%` }} /></div>
  </div>;
}

function FeaturedPick({
  result,
  label,
  tone,
}: {
  result?: DraftRecommendation;
  label: string;
  tone: "best" | "safe" | "counter";
}) {
  if (!result) return null;
  return <article className={`featured-pick featured-${tone}`}>
    <span className="featured-label">{label}</span>
    <div className="featured-pick-main">
      <BrawlerPortrait name={result.brawler.name} className="featured-avatar" priority={tone === "best"} />
      <div>
        <h3>{result.brawler.name}</h3>
        <p>{result.brawler.role} · {result.suggestedLine}</p>
      </div>
      <strong>{result.score}</strong>
    </div>
    <p className="featured-reason">{result.reasons[0] || "Opción equilibrada para el estado actual del draft."}</p>
  </article>;
}

export default function DraftAssistant({ maps, brawlers }: { maps: MapProfile[]; brawlers: Brawler[] }) {
  const modes = [...new Set(maps.map((map) => map.mode))];
  const [mode, setMode] = useState(modes[0]);
  const availableMaps = useMemo(() => maps.filter((map) => map.mode === mode), [maps, mode]);
  const [mapSlug, setMapSlug] = useState(availableMaps[0]?.slug || "");
  const [manualPosition, setManualPosition] = useState<DraftPosition>("First pick");
  const [autoPosition, setAutoPosition] = useState(true);
  const [allies, setAllies] = useState<string[]>([]);
  const [enemies, setEnemies] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);

  const map = maps.find((item) => item.slug === mapSlug) || availableMaps[0];
  const inferredPosition = inferDraftPosition(allies.length, enemies.length);
  const position = autoPosition ? inferredPosition : manualPosition;

  const analysis = useMemo(() => {
    if (!map) return null;
    return analyzeDraft({ map, position, allies, enemies, bans }, brawlers);
  }, [map, position, allies, enemies, bans, brawlers]);

  const unavailable = useMemo(
    () => new Set([...allies, ...enemies, ...bans].map(normalize)),
    [allies, enemies, bans],
  );

  const best = analysis?.recommendations[0];
  const safe = analysis
    ? selectDistinct(
        analysis.recommendations,
        (a, b) => (b.metrics.safety * 0.55 + b.score * 0.45) - (a.metrics.safety * 0.55 + a.score * 0.45),
        best ? [best.brawler.name] : [],
      )
    : undefined;
  const counter = analysis
    ? selectDistinct(
        analysis.recommendations,
        (a, b) => (b.metrics.counter * 0.65 + b.score * 0.35) - (a.metrics.counter * 0.65 + a.score * 0.35),
        [best?.brawler.name, safe?.brawler.name].filter(Boolean) as string[],
      )
    : undefined;

  const changeMode = (nextMode: string) => {
    setMode(nextMode);
    const first = maps.find((item) => item.mode === nextMode);
    if (first) setMapSlug(first.slug);
    setAllies([]);
    setEnemies([]);
    setBans([]);
  };

  const resetDraft = () => {
    setAllies([]);
    setEnemies([]);
    setBans([]);
    setAutoPosition(true);
    setManualPosition("First pick");
  };

  if (!map || !analysis) return null;

  return <div className="live-draft">
    <section className="panel draft-control-panel">
      <div className="section-title">
        <div><span className="eyebrow">Draft vivo</span><h2>Introduce los picks en orden</h2></div>
        <button type="button" className="secondary-button compact-button" onClick={resetDraft}>Reiniciar</button>
      </div>

      <div className="draft-context-grid">
        <label>Modo<select value={mode} onChange={(event) => changeMode(event.target.value)}>{modes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mapa<select value={mapSlug} onChange={(event) => setMapSlug(event.target.value)}>{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
        <label>Posición
          <select
            value={position}
            disabled={autoPosition}
            onChange={(event) => setManualPosition(event.target.value as DraftPosition)}
          >
            <option>First pick</option><option>Pick intermedio</option><option>Last pick</option>
          </select>
        </label>
        <label className="auto-position-toggle">
          <input type="checkbox" checked={autoPosition} onChange={(event) => setAutoPosition(event.target.checked)} />
          <span><b>Detectar turno automáticamente</b><small>Ahora: {position}</small></span>
        </label>
      </div>

      <div className="draft-board">
        <BrawlerDraftPicker
          title="Mis aliados"
          subtitle="Los otros dos picks de tu equipo"
          values={allies}
          max={2}
          roster={brawlers}
          unavailable={unavailable}
          tone="ally"
          onChange={setAllies}
        />
        <BrawlerDraftPicker
          title="Rivales"
          subtitle="Añádelos conforme aparecen"
          values={enemies}
          max={3}
          roster={brawlers}
          unavailable={unavailable}
          tone="enemy"
          onChange={setEnemies}
        />
        <BrawlerDraftPicker
          title="Bans"
          subtitle="Solo los relevantes o ya bloqueados"
          values={bans}
          max={6}
          roster={brawlers}
          unavailable={unavailable}
          tone="ban"
          onChange={setBans}
        />
      </div>

      <div className="live-status">
        <span className="live-dot" />
        <div><b>Recalculando automáticamente</b><small>{analysis.draftStage}</small></div>
        <strong>{analysis.availableCount} disponibles</strong>
      </div>
    </section>

    <section className="draft-output-grid">
      <div className="panel live-recommendation-panel">
        <div className="section-title">
          <div><span className="eyebrow">Recomendación actual</span><h2>El pick cambia con cada selección</h2></div>
          <span className="status-pill">{map.name}</span>
        </div>

        <div className="featured-picks-grid">
          <FeaturedPick result={best} label="Mejor pick" tone="best" />
          <FeaturedPick result={safe} label="Pick seguro" tone="safe" />
          <FeaturedPick result={counter} label={enemies.length ? "Counter / cierre" : "Alternativa flexible"} tone="counter" />
        </div>

        {best && <article className="coach-callout">
          <BrawlerPortrait name={best.brawler.name} className="coach-avatar" />
          <div>
            <span className="eyebrow">Llamada del coach</span>
            <h3>{best.brawler.name} — {best.suggestedLine}</h3>
            <p>{best.plan}</p>
            {best.warning && <small>⚠ {best.warning}</small>}
          </div>
        </article>}

        {best && <div className="metrics-grid">
          <Metric label="Mapa" value={best.metrics.mapFit} />
          <Metric label="Counters" value={best.metrics.counter} />
          <Metric label="Sinergia" value={best.metrics.synergy} />
          <Metric label="Composición" value={best.metrics.composition} />
          <Metric label="Seguridad" value={best.metrics.safety} />
          <Metric label="Riesgo" value={best.metrics.risk} danger />
        </div>}
      </div>

      <aside className="panel draft-diagnosis-panel">
        <div className="section-title"><div><span className="eyebrow">Lectura del draft</span><h2>Qué falta y qué amenaza</h2></div></div>
        <div className="map-mini-preview"><MapArtwork name={map.name} className="draft-map-art" /><div><b>{map.name}</b><span>{map.mode} · {map.layout}</span></div></div>
        <div className="diagnosis-block needs"><b>Necesidades</b>{analysis.needs.length ? analysis.needs.map((item) => <span key={item}>{item}</span>) : <small>La composición no presenta una carencia crítica.</small>}</div>
        <div className="diagnosis-block threats"><b>Amenazas</b>{analysis.threats.length ? analysis.threats.map((item) => <span key={item}>{item}</span>) : <small>Aún no hay una amenaza directa identificada.</small>}</div>
        <div className="diagnosis-block strengths"><b>Fortalezas</b>{analysis.strengths.length ? analysis.strengths.map((item) => <span key={item}>{item}</span>) : <small>Añade aliados para analizar sinergias.</small>}</div>
      </aside>
    </section>

    <section className="panel full-ranking-panel">
      <div className="section-title"><div><span className="eyebrow">Ranking adaptativo</span><h2>Opciones restantes</h2></div><span className="helper">Puntuación estratégica, no probabilidad de victoria.</span></div>
      <div className="recommendations live-ranking">{analysis.recommendations.slice(0, 8).map((result, index) => <article key={result.brawler.slug} className={`recommendation rank-${index + 1}`}>
        <div className="rank">#{index + 1}</div>
        <BrawlerPortrait name={result.brawler.name} className="recommendation-avatar" />
        <div className="rec-copy">
          <div><h3>{result.brawler.name}</h3><span>{result.brawler.role} · {result.suggestedLine}</span></div>
          <ul>{result.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {result.exposedTo.length > 0 && <small>Evita: {result.exposedTo.join(", ")}</small>}
          {result.countersHit.length > 0 && <small className="positive-warning">Castiga: {result.countersHit.join(", ")}</small>}
        </div>
        <div className="score"><b>{result.score}</b><span>/100</span></div>
      </article>)}</div>
    </section>
  </div>;
}
