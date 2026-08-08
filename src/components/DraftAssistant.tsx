"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Brawler,
  DraftPosition,
  DraftRecommendation,
  MapProfile,
  PlayerPool,
} from "@/lib/types";
import { analyzeDraft, inferDraftPosition } from "@/lib/draft-engine";
import { loadPool } from "@/lib/pool";
import { BrawlerPortrait, MapArtwork } from "./GameArtwork";
import BrawlerDraftPicker from "./BrawlerDraftPicker";

const normalize = (value: string) => value.trim().toLowerCase();
const HISTORY_KEY = "brawl-draft-history-v1";

type DraftSnapshot = {
  id: string;
  createdAt: string;
  mode: string;
  mapSlug: string;
  allies: string[];
  enemies: string[];
  bans: string[];
};

function selectDistinct(results: DraftRecommendation[], sorter: (a: DraftRecommendation, b: DraftRecommendation) => number, excluded: string[]) {
  return [...results].filter((result) => !excluded.includes(result.brawler.name)).sort(sorter)[0];
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="draft-metric">
    <span><b>{label}</b><small>{value}</small></span>
    <div><i className={danger ? "danger" : ""} style={{ width: `${value}%` }} /></div>
  </div>;
}

function FeaturedPick({ result, label, tone }: { result?: DraftRecommendation; label: string; tone: "best" | "safe" | "counter" }) {
  if (!result) return null;
  return <article className={`featured-pick featured-${tone}`}>
    <span className="featured-label">{label}</span>
    <div className="featured-pick-main">
      <BrawlerPortrait name={result.brawler.name} className="featured-avatar" priority={tone === "best"} />
      <div><h3>{result.brawler.name}</h3><p>{result.brawler.role} · {result.suggestedLine}</p></div>
      <strong>{result.score}</strong>
    </div>
    <p className="featured-reason">{result.brief}</p>
    {result.warning && <small className="featured-warning">⚠ {result.warning}</small>}
  </article>;
}

function readHistory(): DraftSnapshot[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as DraftSnapshot[]; } catch { return []; }
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
  const [quickMode, setQuickMode] = useState(false);
  const [personalPool, setPersonalPool] = useState<PlayerPool>({});
  const [usePersonalPool, setUsePersonalPool] = useState(false);
  const [scenarioEnemy, setScenarioEnemy] = useState("");
  const [history, setHistory] = useState<DraftSnapshot[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPersonalPool(loadPool(brawlers));
    setHistory(readHistory());
    const params = new URLSearchParams(window.location.search);
    const sharedMap = params.get("map");
    const sharedAllies = params.get("allies")?.split("|").filter(Boolean) || [];
    const sharedEnemies = params.get("enemies")?.split("|").filter(Boolean) || [];
    const sharedBans = params.get("bans")?.split("|").filter(Boolean) || [];
    if (sharedMap) {
      const found = maps.find((item) => item.slug === sharedMap);
      if (found) { setMode(found.mode); setMapSlug(found.slug); }
    }
    if (sharedAllies.length) setAllies(sharedAllies.slice(0, 2));
    if (sharedEnemies.length) setEnemies(sharedEnemies.slice(0, 3));
    if (sharedBans.length) setBans(sharedBans.slice(0, 6));
  }, [brawlers, maps]);

  const map = maps.find((item) => item.slug === mapSlug) || availableMaps[0];
  const inferredPosition = inferDraftPosition(allies.length, enemies.length);
  const position = autoPosition ? inferredPosition : manualPosition;
  const activeEnemies = useMemo(() => scenarioEnemy && !enemies.includes(scenarioEnemy) && enemies.length < 3 ? [...enemies, scenarioEnemy] : enemies, [enemies, scenarioEnemy]);

  const analysis = useMemo(() => {
    if (!map) return null;
    return analyzeDraft({ map, position, allies, enemies: activeEnemies, bans, personalPool, usePersonalPool }, brawlers);
  }, [map, position, allies, activeEnemies, bans, personalPool, usePersonalPool, brawlers]);

  const unavailable = useMemo(() => new Set([...allies, ...enemies, ...bans, scenarioEnemy].filter(Boolean).map(normalize)), [allies, enemies, bans, scenarioEnemy]);
  const best = analysis?.recommendations[0];
  const safe = analysis ? selectDistinct(analysis.recommendations, (a, b) => (b.metrics.safety * .55 + b.score * .45) - (a.metrics.safety * .55 + a.score * .45), best ? [best.brawler.name] : []) : undefined;
  const counter = analysis ? selectDistinct(analysis.recommendations, (a, b) => (b.metrics.counter * .65 + b.score * .35) - (a.metrics.counter * .65 + a.score * .35), [best?.brawler.name, safe?.brawler.name].filter(Boolean) as string[]) : undefined;

  const changeMode = (nextMode: string) => {
    setMode(nextMode);
    const first = maps.find((item) => item.mode === nextMode);
    if (first) setMapSlug(first.slug);
    setAllies([]); setEnemies([]); setBans([]); setScenarioEnemy("");
  };

  const resetDraft = () => {
    setAllies([]); setEnemies([]); setBans([]); setScenarioEnemy("");
    setAutoPosition(true); setManualPosition("First pick"); setMessage("");
  };

  const shareDraft = async () => {
    const params = new URLSearchParams({ map: map.slug });
    if (allies.length) params.set("allies", allies.join("|"));
    if (enemies.length) params.set("enemies", enemies.join("|"));
    if (bans.length) params.set("bans", bans.join("|"));
    const url = `${window.location.origin}/draft?${params.toString()}`;
    try {
      const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
      const usedShare = typeof nav.share === "function";
      if (usedShare) await nav.share!({ title: `Draft ${map.name}`, text: best ? `Mejor pick: ${best.brawler.name}` : "Draft Brawl Stars", url });
      else await navigator.clipboard.writeText(url);
      setMessage(usedShare ? "Draft compartido" : "Enlace copiado");
    } catch { setMessage("No se pudo compartir; copia la URL del navegador"); }
  };

  const saveDraft = () => {
    const snapshot: DraftSnapshot = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), mode, mapSlug: map.slug, allies, enemies, bans };
    const next = [snapshot, ...history].slice(0, 8);
    setHistory(next);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setMessage("Draft guardado en este dispositivo");
  };

  const loadSnapshot = (snapshot: DraftSnapshot) => {
    setMode(snapshot.mode); setMapSlug(snapshot.mapSlug); setAllies(snapshot.allies); setEnemies(snapshot.enemies); setBans(snapshot.bans); setScenarioEnemy("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScreenshot = (file?: File) => {
    if (!file) return;
    if (screenshot) URL.revokeObjectURL(screenshot);
    setScreenshot(URL.createObjectURL(file));
  };

  if (!map || !analysis) return null;

  return <div className={`live-draft ${quickMode ? "quick-mode" : "analysis-mode"}`}>
    <section className="panel draft-control-panel">
      <div className="section-title">
        <div><span className="eyebrow">Draft Coach v0.4</span><h2>Introduce los picks en orden</h2></div>
        <div className="draft-action-row">
          <button type="button" className={`secondary-button compact-button ${quickMode ? "is-active" : ""}`} onClick={() => setQuickMode(!quickMode)}>{quickMode ? "Modo análisis" : "Modo rápido"}</button>
          <button type="button" className="secondary-button compact-button" onClick={shareDraft}>Compartir</button>
          <button type="button" className="secondary-button compact-button" onClick={saveDraft}>Guardar</button>
          <button type="button" className="secondary-button compact-button" onClick={resetDraft}>Reiniciar</button>
        </div>
      </div>
      {message && <div className="draft-toast">{message}</div>}

      <div className="draft-context-grid draft-context-grid-v4">
        <label>Modo<select value={mode} onChange={(event) => changeMode(event.target.value)}>{modes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mapa<select value={mapSlug} onChange={(event) => { setMapSlug(event.target.value); setScenarioEnemy(""); }}>{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
        <label>Posición<select value={position} disabled={autoPosition} onChange={(event) => setManualPosition(event.target.value as DraftPosition)}><option>First pick</option><option>Pick intermedio</option><option>Last pick</option></select></label>
        <label className="auto-position-toggle"><input type="checkbox" checked={autoPosition} onChange={(event) => setAutoPosition(event.target.checked)} /><span><b>Detectar turno</b><small>Ahora: {position}</small></span></label>
        <label className="auto-position-toggle pool-draft-toggle"><input type="checkbox" checked={usePersonalPool} onChange={(event) => setUsePersonalPool(event.target.checked)} /><span><b>Usar mi pool</b><small>Fuerza, HC y dominio</small></span></label>
      </div>

      <div className="draft-board">
        <BrawlerDraftPicker title="Mis aliados" subtitle="Los otros dos picks de tu equipo" values={allies} max={2} roster={brawlers} unavailable={unavailable} tone="ally" onChange={setAllies} />
        <BrawlerDraftPicker title="Rivales" subtitle="Añádelos conforme aparecen" values={enemies} max={3} roster={brawlers} unavailable={unavailable} tone="enemy" onChange={(values) => { setEnemies(values); setScenarioEnemy(""); }} />
        <BrawlerDraftPicker title="Bans" subtitle="Bloqueados o descartados" values={bans} max={6} roster={brawlers} unavailable={unavailable} tone="ban" onChange={setBans} />
      </div>

      <div className="capture-helper">
        <label className="capture-upload">Adjuntar captura<input type="file" accept="image/*" onChange={(event) => handleScreenshot(event.target.files?.[0])} /></label>
        <span>Mantén la captura visible mientras completas el draft. El reconocimiento automático requerirá una integración de visión posterior.</span>
        {screenshot && <div className="capture-preview"><img src={screenshot} alt="Captura del draft" /><button type="button" onClick={() => setScreenshot(null)}>×</button></div>}
      </div>

      <div className="live-status"><span className="live-dot" /><div><b>Recalculando automáticamente</b><small>{analysis.draftStage}{scenarioEnemy ? ` · simulando ${scenarioEnemy}` : ""}</small></div><strong>{analysis.availableCount} disponibles</strong></div>
    </section>

    {quickMode && best && <section className="quick-coach panel">
      <BrawlerPortrait name={best.brawler.name} className="quick-coach-avatar" priority />
      <div><span className="eyebrow">Pick inmediato</span><h2>{best.brawler.name}</h2><p>{best.brief}</p><b>{best.lanePlan.lane}{best.lanePlan.target ? ` → busca a ${best.lanePlan.target}` : ""}</b><small>{best.warning || `Alternativas: ${safe?.brawler.name || "—"} / ${counter?.brawler.name || "—"}`}</small></div>
      <strong>{best.score}</strong>
    </section>}

    {!quickMode && <>
      <section className="draft-output-grid">
        <div className="panel live-recommendation-panel">
          <div className="section-title"><div><span className="eyebrow">Recomendación actual</span><h2>Mejor, seguro y castigo</h2></div><span className="status-pill">Composición {analysis.compositionScore}/100</span></div>
          <div className="featured-picks-grid"><FeaturedPick result={best} label="Mejor pick" tone="best" /><FeaturedPick result={safe} label="Pick seguro" tone="safe" /><FeaturedPick result={counter} label={enemies.length ? "Pick de castigo" : "Alternativa flexible"} tone="counter" /></div>

          {best && <article className="coach-callout">
            <BrawlerPortrait name={best.brawler.name} className="coach-avatar" />
            <div><span className="eyebrow">Llamada del coach</span><h3>{best.brawler.name} — {best.suggestedLine}</h3><p>{best.plan}</p><b className="lane-instruction">{best.lanePlan.instruction}</b>{best.warning && <small>⚠ {best.warning}</small>}</div>
          </article>}

          {best && <div className="metrics-grid metrics-grid-v4"><Metric label="Mapa" value={best.metrics.mapFit} /><Metric label="Counters" value={best.metrics.counter} /><Metric label="Sinergia" value={best.metrics.synergy} /><Metric label="Composición" value={best.metrics.composition} /><Metric label="Seguridad" value={best.metrics.safety} /><Metric label="Tu pool" value={best.metrics.personal} /><Metric label="Riesgo" value={best.metrics.risk} danger /></div>}
        </div>

        <aside className="panel draft-diagnosis-panel">
          <div className="section-title"><div><span className="eyebrow">Lectura del draft</span><h2>Diagnóstico</h2></div></div>
          <div className="map-mini-preview"><MapArtwork name={map.name} className="draft-map-art" /><div><b>{map.name}</b><span>{map.mode} · {map.layout}</span></div></div>
          <div className="diagnosis-block needs"><b>Necesidades</b>{analysis.needs.length ? analysis.needs.map((item) => <span key={item}>{item}</span>) : <small>Sin carencias críticas.</small>}</div>
          <div className="diagnosis-block threats"><b>Amenazas</b>{analysis.threats.length ? analysis.threats.map((item) => <span key={item}>{item}</span>) : <small>Sin amenaza directa identificada.</small>}</div>
          <div className="diagnosis-block strengths"><b>Fortalezas</b>{analysis.strengths.length ? analysis.strengths.map((item) => <span key={item}>{item}</span>) : <small>Añade aliados para analizar sinergias.</small>}</div>
          <div className="diagnosis-block punish"><b>Debilidades rivales</b>{analysis.enemyWeaknesses.length ? analysis.enemyWeaknesses.map((item) => <span key={item}>{item}</span>) : <small>Aún no hay suficiente información rival.</small>}</div>
        </aside>
      </section>

      {best && <section className="draft-intelligence-grid">
        <article className="panel build-panel"><span className="eyebrow">Build contextual</span><h2>{best.brawler.name}</h2><div className="build-grid"><div><b>Gadget</b><p>{best.build.gadget}</p></div><div><b>Habilidad estelar</b><p>{best.build.starPower}</p></div><div><b>Engranajes</b><p>{best.build.gears.join(" + ")}</p></div><div><b>Hipercarga</b><p>{best.build.hypercharge}</p></div></div><small>{best.build.reason}</small></article>
        <article className="panel line-panel"><span className="eyebrow">Plan de líneas</span><h2>Emparejamientos previstos</h2><div className="line-assignments">{analysis.teamAssignments.map((assignment) => <div key={`${assignment.ally}-${assignment.lane}`}><b>{assignment.lane}</b><span>{assignment.ally}{assignment.enemy ? ` vs ${assignment.enemy}` : ""}</span><small>{assignment.instruction}</small></div>)}</div></article>
      </section>}

      <section className="draft-intelligence-grid">
        <article className="panel prediction-panel">
          <div className="section-title"><div><span className="eyebrow">Siguiente movimiento</span><h2>Qué puede elegir el rival</h2></div>{scenarioEnemy && <button className="secondary-button compact-button" onClick={() => setScenarioEnemy("")}>Quitar simulación</button>}</div>
          <div className="prediction-list">{analysis.predictedEnemyPicks.slice(0, 4).map((prediction) => <button key={prediction.brawler.slug} type="button" onClick={() => setScenarioEnemy(prediction.brawler.name)} className={scenarioEnemy === prediction.brawler.name ? "active" : ""}><BrawlerPortrait name={prediction.brawler.name} className="prediction-avatar" /><span><b>{prediction.brawler.name}</b><small>{prediction.reason}</small><em>Respuesta: {prediction.response}</em></span><strong>{prediction.score}</strong></button>)}</div>
        </article>
        <article className="panel ban-panel"><span className="eyebrow">Asistente de bans</span><h2>Prioridades actuales</h2><div className="ban-list">{analysis.banRecommendations.slice(0, 4).map((ban) => <div key={ban.brawler.slug}><BrawlerPortrait name={ban.brawler.name} className="ban-avatar" /><span><b>{ban.brawler.name}</b><small>{ban.reasons.join(" · ")}</small></span><strong>{ban.score}</strong></div>)}</div></article>
      </section>

      <section className="panel full-ranking-panel">
        <div className="section-title"><div><span className="eyebrow">Ranking adaptativo</span><h2>Opciones restantes</h2></div><span className="helper">Puntuación de encaje, no probabilidad de victoria.</span></div>
        <div className="recommendations live-ranking">{analysis.recommendations.slice(0, 10).map((result, index) => <article key={result.brawler.slug} className={`recommendation rank-${index + 1}`}>
          <div className="rank">#{index + 1}</div><BrawlerPortrait name={result.brawler.name} className="recommendation-avatar" />
          <div className="rec-copy"><div><h3>{result.brawler.name}</h3><span>{result.brawler.role} · {result.suggestedLine}</span></div><p className="ranking-brief">{result.brief}</p><ul>{result.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>{result.exposedTo.length > 0 && <small>Evita: {result.exposedTo.join(", ")}</small>}{result.countersHit.length > 0 && <small className="positive-warning">Castiga: {result.countersHit.join(", ")}</small>}</div>
          <div className="score"><b>{result.score}</b><span>/100</span></div>
        </article>)}</div>
      </section>

      {history.length > 0 && <section className="panel draft-history-panel"><div className="section-title"><div><span className="eyebrow">Historial local</span><h2>Drafts guardados</h2></div></div><div className="draft-history-list">{history.map((snapshot) => <button key={snapshot.id} onClick={() => loadSnapshot(snapshot)}><b>{maps.find((item) => item.slug === snapshot.mapSlug)?.name || snapshot.mapSlug}</b><span>{snapshot.allies.join(", ") || "Sin aliados"} vs {snapshot.enemies.join(", ") || "Sin rivales"}</span><small>{new Date(snapshot.createdAt).toLocaleString("es-ES")}</small></button>)}</div></section>}
    </>}
  </div>;
}
