"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Brawler,
  DraftPosition,
  DraftPriority,
  DraftFirstPickOwner,
  DraftRecommendation,
  MapProfile,
  PlayerPool,
} from "@/lib/types";
import { analyzeDraft } from "@/lib/draft-engine";
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
  myPick?: string;
  priority?: DraftPriority;
  firstPickOwner?: DraftFirstPickOwner;
  myPickSlot?: number;
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
    <span className="counter-grade">{result.counterLabel}</span>
    <p className="featured-reason">{result.brief}</p>
    {(result.countersHit.length > 0 || result.softCounters.length > 0 || result.exposedTo.length > 0) && <div className="featured-matchups">
      {result.countersHit.length > 0 && <small className="matchup-good">Counter: {result.countersHit.join(", ")}</small>}
      {result.softCounters.length > 0 && <small className="matchup-soft">Favorable: {result.softCounters.join(", ")}</small>}
      {result.exposedTo.length > 0 && <small className="matchup-bad">Lo frena: {result.exposedTo.join(", ")}</small>}
    </div>}
    {result.warning && <small className="featured-warning">⚠ {result.warning}</small>}
  </article>;
}


type DraftTeam = "ally" | "enemy";

type DraftFlowSlot = {
  index: number;
  team: DraftTeam;
  pick?: string;
  phase: number;
  slotLabel: string;
};

function buildCompetitiveDraftFlow(
  firstPickOwner: DraftFirstPickOwner,
  allyPicks: string[],
  enemyPicks: string[],
  myPick?: string,
  myPickSlot?: number | null,
) {
  const firstTeam: DraftTeam = firstPickOwner === "Aliado" ? "ally" : "enemy";
  const otherTeam: DraftTeam = firstTeam === "ally" ? "enemy" : "ally";
  const sequence: DraftTeam[] = [firstTeam, otherTeam, otherTeam, firstTeam, firstTeam, otherTeam];

  const slots: DraftFlowSlot[] = sequence.map((team, index) => ({
    index,
    team,
    phase: index === 0 ? 1 : index <= 2 ? 2 : index <= 4 ? 3 : 4,
    slotLabel: index === 0 ? "First pick" : index === 5 ? "Last pick" : `Pick ${index + 1}`,
  }));

  if (myPick) {
    const validOwnSlot = typeof myPickSlot === "number" && slots[myPickSlot]?.team === "ally"
      ? myPickSlot
      : slots.findIndex((slot) => slot.team === "ally");
    if (validOwnSlot >= 0) slots[validOwnSlot].pick = myPick;
  }

  let allyIndex = 0;
  let enemyIndex = 0;
  for (const slot of slots) {
    if (slot.pick) continue;
    if (slot.team === "ally" && allyPicks[allyIndex]) slot.pick = allyPicks[allyIndex++];
    if (slot.team === "enemy" && enemyPicks[enemyIndex]) slot.pick = enemyPicks[enemyIndex++];
  }

  const currentIndex = slots.findIndex((slot) => !slot.pick);
  const currentSlot = currentIndex >= 0 ? slots[currentIndex] : undefined;
  const nextOwnIndex = currentSlot?.team === "ally"
    ? currentIndex
    : slots.findIndex((slot, index) => index > currentIndex && slot.team === "ally" && !slot.pick);
  const recommendationIndex = nextOwnIndex >= 0
    ? nextOwnIndex
    : slots.findIndex((slot) => slot.team === "ally" && !slot.pick);

  const position: DraftPosition =
    recommendationIndex === 0 ? "First pick" :
    recommendationIndex === 5 ? "Last pick" :
    "Pick intermedio";
  const recommendedPriority: DraftPriority = position === "First pick" ? "Seguro" : "Counter";

  const phaseLabels = [
    { phase: 1, title: "First pick", subtitle: firstTeam === "ally" ? "Tu equipo" : "Rival" },
    { phase: 2, title: "Doble respuesta", subtitle: otherTeam === "ally" ? "Tu equipo · picks 2–3" : "Rival · picks 2–3" },
    { phase: 3, title: "Doble respuesta", subtitle: firstTeam === "ally" ? "Tu equipo · picks 4–5" : "Rival · picks 4–5" },
    { phase: 4, title: "Last pick", subtitle: otherTeam === "ally" ? "Tu equipo" : "Rival" },
  ];

  return {
    slots,
    phases: phaseLabels.map((phase) => ({
      ...phase,
      slots: slots.filter((slot) => slot.phase === phase.phase),
      status:
        slots.filter((slot) => slot.phase === phase.phase).every((slot) => Boolean(slot.pick))
          ? "done"
          : slots.some((slot) => slot.phase === phase.phase && slot.index === currentIndex)
            ? "current"
            : "pending",
    })),
    currentIndex,
    currentTeam: currentSlot?.team,
    isMyTurn: currentSlot?.team === "ally",
    isComplete: currentIndex === -1,
    position,
    recommendedPriority,
    statusText: currentIndex === -1
      ? "Draft completo"
      : currentSlot?.team === "ally"
        ? position === "First pick"
          ? "Tu turno: elige un first pick sólido del mapa"
          : position === "Last pick"
            ? "Tu turno: last pick de máximo castigo"
            : "Tu turno: counterea al rival y completa la composición"
        : "Turno rival: anticipando sus picks y preparando tu respuesta",
  };
}

function DraftOrderTimeline({
  flow,
}: {
  flow: ReturnType<typeof buildCompetitiveDraftFlow>;
}) {
  return <section className="competitive-draft-flow">
    <div className="competitive-flow-head">
      <div><span className="eyebrow">Orden competitivo 3v3</span><h3>1 pick → 2 picks → 2 picks → last pick</h3></div>
      <span className={`turn-chip ${flow.isComplete ? "complete" : flow.isMyTurn ? "my-turn" : "enemy-turn"}`}>{flow.statusText}</span>
    </div>
    <div className="competitive-flow-grid">
      {flow.phases.map((phase) => <article className={`competitive-phase phase-${phase.status}`} key={phase.phase}>
        <span className="phase-number">{phase.phase}</span>
        <div className="phase-copy"><b>{phase.title}</b><small>{phase.subtitle}</small></div>
        <div className="phase-slots">
          {phase.slots.map((slot) => <div className={`phase-slot team-${slot.team} ${slot.pick ? "filled" : ""}`} key={slot.index}>
            <span>{slot.pick || slot.slotLabel}</span>
            <small>{slot.team === "ally" ? "Aliado" : "Rival"}</small>
          </div>)}
        </div>
      </article>)}
    </div>
  </section>;
}

function readHistory(): DraftSnapshot[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as DraftSnapshot[]; } catch { return []; }
}

export default function DraftAssistant({ maps, brawlers }: { maps: MapProfile[]; brawlers: Brawler[] }) {
  const modes = [...new Set(maps.map((map) => map.mode))];
  const [mode, setMode] = useState(modes[0]);
  const availableMaps = useMemo(() => maps.filter((map) => map.mode === mode).sort((a, b) => Number(b.rotationStatus === "Actual") - Number(a.rotationStatus === "Actual") || a.name.localeCompare(b.name)), [maps, mode]);
  const [mapSlug, setMapSlug] = useState(availableMaps[0]?.slug || "");
  const [manualPosition, setManualPosition] = useState<DraftPosition>("First pick");
  const [firstPickOwner, setFirstPickOwner] = useState<DraftFirstPickOwner>("Aliado");
  const [priority, setPriority] = useState<DraftPriority>("Counter");
  const [autoPosition, setAutoPosition] = useState(true);
  const [allies, setAllies] = useState<string[]>([]);
  const [enemies, setEnemies] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [myPick, setMyPick] = useState<string[]>([]);
  const [myPickSlot, setMyPickSlot] = useState<number | null>(null);
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
    const sharedPick = params.get("pick");
    const sharedPriority = params.get("priority") as DraftPriority | null;
    const sharedFirstPickOwner = params.get("first") as DraftFirstPickOwner | null;
    const sharedPickSlot = params.get("pickSlot");
    if (sharedMap) {
      const found = maps.find((item) => item.slug === sharedMap);
      if (found) { setMode(found.mode); setMapSlug(found.slug); }
    }
    if (sharedAllies.length) setAllies(sharedAllies.slice(0, 2));
    if (sharedEnemies.length) setEnemies(sharedEnemies.slice(0, 3));
    if (sharedBans.length) setBans(sharedBans.slice(0, 6));
    if (sharedPick) setMyPick([sharedPick]);
    if (sharedPriority && ["Counter", "Equilibrado", "Seguro"].includes(sharedPriority)) setPriority(sharedPriority);
    if (sharedFirstPickOwner && ["Aliado", "Rival"].includes(sharedFirstPickOwner)) setFirstPickOwner(sharedFirstPickOwner);
    if (sharedPickSlot !== null && !Number.isNaN(Number(sharedPickSlot))) setMyPickSlot(Number(sharedPickSlot));
  }, [brawlers, maps]);

  const map = maps.find((item) => item.slug === mapSlug) || availableMaps[0];
  const activeEnemies = useMemo(() => scenarioEnemy && !enemies.includes(scenarioEnemy) && enemies.length < 3 ? [...enemies, scenarioEnemy] : enemies, [enemies, scenarioEnemy]);
  const draftFlow = useMemo(
    () => buildCompetitiveDraftFlow(firstPickOwner, allies, enemies, myPick[0], myPickSlot),
    [firstPickOwner, allies, enemies, myPick, myPickSlot],
  );
  const position = autoPosition ? draftFlow.position : manualPosition;
  const effectivePriority = autoPosition ? draftFlow.recommendedPriority : priority;

  const analysis = useMemo(() => {
    if (!map) return null;
    return analyzeDraft({ map, position, allies, enemies: activeEnemies, bans, myPick: myPick[0], priority: effectivePriority, personalPool, usePersonalPool }, brawlers);
  }, [map, position, allies, activeEnemies, bans, myPick, effectivePriority, personalPool, usePersonalPool, brawlers]);

  const unavailable = useMemo(() => new Set([...allies, ...enemies, ...bans, ...myPick, scenarioEnemy].filter(Boolean).map(normalize)), [allies, enemies, bans, myPick, scenarioEnemy]);
  const recommendedBest = analysis?.recommendations[0];
  const selectedPick = analysis?.selectedPick;
  const primaryPick = selectedPick || recommendedBest;
  const safe = analysis ? selectDistinct(
    analysis.recommendations,
    (a, b) => (b.metrics.safety * .55 + b.score * .45) - (a.metrics.safety * .55 + a.score * .45),
    recommendedBest ? [recommendedBest.brawler.name] : [],
  ) : undefined;
  const secondPick = selectedPick ? recommendedBest : safe;
  const counter = analysis ? selectDistinct(
    analysis.recommendations,
    (a, b) => ((b.countersHit.length * 30 + b.softCounters.length * 12 + b.metrics.counter * .5 + b.score * .25) - (a.countersHit.length * 30 + a.softCounters.length * 12 + a.metrics.counter * .5 + a.score * .25)),
    [primaryPick?.brawler.name, secondPick?.brawler.name].filter(Boolean) as string[],
  ) : undefined;

  const handleMyPickChange = (values: string[]) => {
    if (!values.length) {
      setMyPick([]);
      setMyPickSlot(null);
      return;
    }
    if (!myPick.length) {
      const suggestedSlot = draftFlow.currentTeam === "ally"
        ? draftFlow.currentIndex
        : draftFlow.slots.find((slot, index) => index > draftFlow.currentIndex && slot.team === "ally" && !slot.pick)?.index;
      setMyPickSlot(typeof suggestedSlot === "number" && suggestedSlot >= 0 ? suggestedSlot : null);
    }
    setMyPick(values);
  };

  const changeMode = (nextMode: string) => {
    setMode(nextMode);
    const first = maps.find((item) => item.mode === nextMode && item.rotationStatus === "Actual") || maps.find((item) => item.mode === nextMode);
    if (first) setMapSlug(first.slug);
    setAllies([]); setEnemies([]); setBans([]); setMyPick([]); setMyPickSlot(null); setScenarioEnemy("");
  };

  const resetDraft = () => {
    setAllies([]); setEnemies([]); setBans([]); setMyPick([]); setMyPickSlot(null); setScenarioEnemy("");
    setAutoPosition(true); setManualPosition("First pick"); setPriority("Counter"); setFirstPickOwner("Aliado"); setMessage("");
  };

  const shareDraft = async () => {
    const params = new URLSearchParams({ map: map.slug });
    if (allies.length) params.set("allies", allies.join("|"));
    if (enemies.length) params.set("enemies", enemies.join("|"));
    if (bans.length) params.set("bans", bans.join("|"));
    if (myPick[0]) params.set("pick", myPick[0]);
    params.set("priority", effectivePriority);
    params.set("first", firstPickOwner);
    if (typeof myPickSlot === "number") params.set("pickSlot", String(myPickSlot));
    const url = `${window.location.origin}/draft?${params.toString()}`;
    try {
      const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
      const usedShare = typeof nav.share === "function";
      if (usedShare) await nav.share!({ title: `Draft ${map.name}`, text: primaryPick ? `${selectedPick ? "Mi pick" : "Mejor pick"}: ${primaryPick.brawler.name}` : "Draft Brawl Stars", url });
      else await navigator.clipboard.writeText(url);
      setMessage(usedShare ? "Draft compartido" : "Enlace copiado");
    } catch { setMessage("No se pudo compartir; copia la URL del navegador"); }
  };

  const saveDraft = () => {
    const snapshot: DraftSnapshot = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), mode, mapSlug: map.slug, allies, enemies, bans, myPick: myPick[0], priority: effectivePriority, firstPickOwner, myPickSlot: myPickSlot ?? undefined };
    const next = [snapshot, ...history].slice(0, 8);
    setHistory(next);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setMessage("Draft guardado en este dispositivo");
  };

  const loadSnapshot = (snapshot: DraftSnapshot) => {
    setMode(snapshot.mode); setMapSlug(snapshot.mapSlug); setAllies(snapshot.allies); setEnemies(snapshot.enemies); setBans(snapshot.bans); setMyPick(snapshot.myPick ? [snapshot.myPick] : []); setPriority(snapshot.priority || "Counter"); setFirstPickOwner(snapshot.firstPickOwner || "Aliado"); setMyPickSlot(typeof snapshot.myPickSlot === "number" ? snapshot.myPickSlot : null); setScenarioEnemy("");
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
        <div><span className="eyebrow">Draft Coach v0.4.4</span><h2>Introduce los picks en orden</h2></div>
        <div className="draft-action-row">
          <button type="button" className={`secondary-button compact-button ${quickMode ? "is-active" : ""}`} onClick={() => setQuickMode(!quickMode)}>{quickMode ? "Modo análisis" : "Modo rápido"}</button>
          <button type="button" className="secondary-button compact-button" onClick={shareDraft}>Compartir</button>
          <button type="button" className="secondary-button compact-button" onClick={saveDraft}>Guardar</button>
          <button type="button" className="secondary-button compact-button" onClick={resetDraft}>Reiniciar</button>
        </div>
      </div>
      {message && <div className="draft-toast">{message}</div>}

      <div className="draft-context-grid draft-context-grid-v44">
        <label>Modo<select value={mode} onChange={(event) => changeMode(event.target.value)}>{modes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mapa<select value={mapSlug} onChange={(event) => { setMapSlug(event.target.value); setScenarioEnemy(""); }}>{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}{item.rotationStatus === "Histórico" ? " · histórico" : ""}</option>)}</select></label>
        <label>Quién tiene first pick<select value={firstPickOwner} onChange={(event) => { setFirstPickOwner(event.target.value as DraftFirstPickOwner); setMyPickSlot(null); setScenarioEnemy(""); }}><option value="Aliado">Mi equipo</option><option value="Rival">Equipo rival</option></select></label>
        <label>Posición calculada<select value={position} disabled={autoPosition} onChange={(event) => setManualPosition(event.target.value as DraftPosition)}><option>First pick</option><option>Pick intermedio</option><option>Last pick</option></select></label>
        <label>Criterio calculado<select value={effectivePriority} disabled={autoPosition} onChange={(event) => setPriority(event.target.value as DraftPriority)}><option value="Counter">Counter primero</option><option value="Equilibrado">Equilibrado</option><option value="Seguro">Pick seguro</option></select></label>
        <label className="auto-position-toggle"><input type="checkbox" checked={autoPosition} onChange={(event) => setAutoPosition(event.target.checked)} /><span><b>Orden competitivo automático</b><small>{position} · {effectivePriority}</small></span></label>
        <label className="auto-position-toggle pool-draft-toggle"><input type="checkbox" checked={usePersonalPool} onChange={(event) => setUsePersonalPool(event.target.checked)} /><span><b>Usar mi pool</b><small>Fuerza, HC y dominio</small></span></label>
      </div>

      <DraftOrderTimeline flow={draftFlow} />

      <div className="draft-board draft-board-four">
        <BrawlerDraftPicker title="Mis aliados" subtitle="Los otros dos picks de tu equipo" values={allies} max={2} roster={brawlers} unavailable={unavailable} tone="ally" onChange={setAllies} />
        <BrawlerDraftPicker title="Rivales" subtitle="Añádelos conforme aparecen" values={enemies} max={3} roster={brawlers} unavailable={unavailable} tone="enemy" onChange={(values) => { setEnemies(values); setScenarioEnemy(""); }} />
        <BrawlerDraftPicker title="Mi pick" subtitle="El brawler que vas a jugar" values={myPick} max={1} roster={brawlers} unavailable={unavailable} tone="self" onChange={handleMyPickChange} />
        <BrawlerDraftPicker title="Bans" subtitle="Bloqueados o descartados" values={bans} max={6} roster={brawlers} unavailable={unavailable} tone="ban" onChange={setBans} />
      </div>

      <div className="capture-helper">
        <label className="capture-upload">Adjuntar captura<input type="file" accept="image/*" onChange={(event) => handleScreenshot(event.target.files?.[0])} /></label>
        <span>Mantén la captura visible mientras completas el draft. El reconocimiento automático requerirá una integración de visión posterior.</span>
        {screenshot && <div className="capture-preview"><img src={screenshot} alt="Captura del draft" /><button type="button" onClick={() => setScreenshot(null)}>×</button></div>}
      </div>

      <div className="live-status"><span className="live-dot" /><div><b>Recalculando automáticamente</b><small>{draftFlow.statusText} · {analysis.draftStage}{scenarioEnemy ? ` · simulando ${scenarioEnemy}` : ""}</small></div><strong>{analysis.availableCount} disponibles</strong></div>
    </section>

    {quickMode && primaryPick && <section className="quick-coach panel">
      <BrawlerPortrait name={primaryPick.brawler.name} className="quick-coach-avatar" priority />
      <div><span className="eyebrow">{selectedPick ? "Evaluación de mi pick" : position === "First pick" ? "First pick sólido" : position === "Last pick" ? "Last pick de castigo" : enemies.length && effectivePriority === "Counter" ? "Counter inmediato" : "Pick inmediato"}</span><h2>{primaryPick.brawler.name}</h2><p>{primaryPick.brief}</p><b>{primaryPick.lanePlan.lane}{primaryPick.lanePlan.target ? ` → busca a ${primaryPick.lanePlan.target}` : ""}</b><small>{primaryPick.warning || `Alternativas: ${secondPick?.brawler.name || "—"} / ${counter?.brawler.name || "—"}`}</small></div>
      <strong>{analysis.winEstimate ? `${analysis.winEstimate.percentage}%` : primaryPick.score}</strong>
    </section>}

    {!quickMode && <>
      {analysis.winEstimate ? <section className="panel win-estimate-panel">
        <div className="win-estimate-summary">
          <div><span className="eyebrow">Probabilidad estimada del draft</span><h2>{analysis.winEstimate.title}</h2><p>{analysis.winEstimate.completeness < 100 ? "Estimación provisional que se recalcula con cada pick." : "Composición 3 contra 3 completa."}</p></div>
          <div className="win-percentage"><strong>{analysis.winEstimate.percentage}%</strong><span>rango {analysis.winEstimate.lower}–{analysis.winEstimate.upper}%</span><small>Confianza {analysis.winEstimate.confidence}</small></div>
        </div>
        <div className="win-meter"><span style={{ width: `${analysis.winEstimate.percentage}%` }} /></div>
        <div className="win-team-scores"><div><b>Tu equipo</b><strong>{analysis.winEstimate.alliedScore}/100</strong></div><div><b>Equipo rival</b><strong>{analysis.winEstimate.enemyScore}/100</strong></div><div><b>Draft completado</b><strong>{analysis.winEstimate.completeness}%</strong></div></div>
        <div className="win-factors"><div><b>Factores favorables</b>{analysis.winEstimate.advantages.length ? analysis.winEstimate.advantages.map((item) => <span key={item}>+ {item}</span>) : <small>Sin ventaja clara todavía.</small>}</div><div><b>Riesgos</b>{analysis.winEstimate.risks.length ? analysis.winEstimate.risks.map((item) => <span key={item}>− {item}</span>) : <small>Sin riesgo crítico detectado.</small>}</div></div>
        <small className="win-disclaimer">{analysis.winEstimate.disclaimer}</small>
      </section> : <section className="panel win-estimate-placeholder"><div><span className="eyebrow">Estimación de victoria</span><h2>Añade tu pick para activarla</h2><p>El porcentaje se actualizará automáticamente según el mapa, los seis brawlers, los counters y el equilibrio de ambas composiciones.</p></div><span>Mi pick →</span></section>}

      <section className="draft-output-grid">
        <div className="panel live-recommendation-panel">
          <div className="section-title"><div><span className="eyebrow">{selectedPick ? "Evaluación del pick" : position === "First pick" ? "First pick del mapa" : position === "Last pick" ? "Cierre del draft" : enemies.length && effectivePriority === "Counter" ? "Respuesta al rival" : "Recomendación actual"}</span><h2>{selectedPick ? "Tu pick y mejores alternativas" : position === "First pick" ? "Sólido, seguro y flexible" : position === "Last pick" ? "Máximo counter, alternativa y seguro" : enemies.length && effectivePriority === "Counter" ? "Counter principal, seguro y alternativo" : "Mejor, seguro y castigo"}</h2></div><span className="status-pill">Composición {analysis.compositionScore}/100</span></div>
          <div className="featured-picks-grid"><FeaturedPick result={primaryPick} label={selectedPick ? "Tu pick" : position === "First pick" ? "First pick sólido" : position === "Last pick" ? "Mejor last pick" : enemies.length && effectivePriority === "Counter" ? "Mejor counter" : "Mejor pick"} tone="best" /><FeaturedPick result={secondPick} label={selectedPick ? "Mejor alternativa" : "Pick seguro"} tone="safe" /><FeaturedPick result={counter} label={enemies.length ? "Counter alternativo" : "Alternativa flexible"} tone="counter" /></div>

          {primaryPick && <article className="coach-callout">
            <BrawlerPortrait name={primaryPick.brawler.name} className="coach-avatar" />
            <div><span className="eyebrow">Llamada del coach</span><h3>{primaryPick.brawler.name} — {primaryPick.suggestedLine}</h3><p>{primaryPick.plan}</p><b className="lane-instruction">{primaryPick.lanePlan.instruction}</b>{primaryPick.warning && <small>⚠ {primaryPick.warning}</small>}</div>
          </article>}

          {primaryPick && enemies.length > 0 && <div className="counter-response-grid">
            {enemies.map((enemy) => {
              const direct = primaryPick.countersHit.includes(enemy);
              const soft = primaryPick.softCounters.includes(enemy);
              const exposed = primaryPick.exposedTo.includes(enemy);
              return <div key={enemy} className={direct ? "counter-win" : soft ? "counter-soft" : exposed ? "counter-loss" : "counter-neutral"}>
                <BrawlerPortrait name={enemy} className="counter-target-avatar" />
                <span><b>{enemy}</b><small>{direct ? "Counter directo" : soft ? "Respuesta favorable" : exposed ? "Te counterea" : "Matchup neutral"}</small></span>
              </div>;
            })}
          </div>}

          {primaryPick && <div className="metrics-grid metrics-grid-v4"><Metric label="Mapa" value={primaryPick.metrics.mapFit} /><Metric label="Counters" value={primaryPick.metrics.counter} /><Metric label="Sinergia" value={primaryPick.metrics.synergy} /><Metric label="Composición" value={primaryPick.metrics.composition} /><Metric label="Seguridad" value={primaryPick.metrics.safety} /><Metric label="Tu pool" value={primaryPick.metrics.personal} /><Metric label="Riesgo" value={primaryPick.metrics.risk} danger /></div>}
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

      {primaryPick && <section className="draft-intelligence-grid">
        <article className="panel build-panel"><span className="eyebrow">Build contextual</span><h2>{primaryPick.brawler.name}</h2><div className="build-grid"><div><b>Gadget</b><p>{primaryPick.build.gadget}</p></div><div><b>Habilidad estelar</b><p>{primaryPick.build.starPower}</p></div><div><b>Engranajes</b><p>{primaryPick.build.gears.join(" + ")}</p></div><div><b>Hipercarga</b><p>{primaryPick.build.hypercharge}</p></div></div><small>{primaryPick.build.reason}</small></article>
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
          <div className="rec-copy"><div><h3>{result.brawler.name}</h3><span>{result.brawler.role} · {result.suggestedLine}</span><em className="ranking-counter-label">{result.counterLabel}</em></div><p className="ranking-brief">{result.brief}</p><ul>{result.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>{result.exposedTo.length > 0 && <small>Evita: {result.exposedTo.join(", ")}</small>}{result.countersHit.length > 0 && <small className="positive-warning">Castiga: {result.countersHit.join(", ")}</small>}</div>
          <div className="score"><b>{result.score}</b><span>/100</span></div>
        </article>)}</div>
      </section>

      {history.length > 0 && <section className="panel draft-history-panel"><div className="section-title"><div><span className="eyebrow">Historial local</span><h2>Drafts guardados</h2></div></div><div className="draft-history-list">{history.map((snapshot) => <button key={snapshot.id} onClick={() => loadSnapshot(snapshot)}><b>{maps.find((item) => item.slug === snapshot.mapSlug)?.name || snapshot.mapSlug}</b><span>{[...snapshot.allies, snapshot.myPick].filter(Boolean).join(", ") || "Sin equipo"} vs {snapshot.enemies.join(", ") || "Sin rivales"}</span><small>{new Date(snapshot.createdAt).toLocaleString("es-ES")}</small></button>)}</div></section>}
    </>}
  </div>;
}
