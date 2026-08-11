"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type {
  Brawler,
  DraftFirstPickOwner,
  DraftPosition,
  DraftRecommendation,
  MapProfile,
  PlayerPool,
  PoolPolicy,
  QueueMode,
  MatchResult,
  PersonalMatch,
  PersonalPerformance,
} from "@/lib/types";
import { analyzeDraft } from "@/lib/draft-engine";
import { evaluateFirstPick } from "@/lib/first-pick-model";
import { analyzeRecommendationResilience } from "@/lib/draft-resilience";
import { recommendDoublePick } from "@/lib/pair-engine";
import { loadPool } from "@/lib/pool";
import { buildPersonalPerformance, readMatchHistory, saveMatchHistory } from "@/lib/performance";
import { BrawlerPortrait } from "./GameArtwork";
import BrawlerDraftPicker from "./BrawlerDraftPicker";

type DraftTeam = "ally" | "enemy";
type OrderedPick = string | null;

const QUEUE_MODE_KEY = "brawl-lab:queue-mode-v1";

const normalize = (value: string) => value.trim().toLowerCase();

const alternativeTierBonus: Record<string, number> = {
  "S+": 9,
  S: 8,
  "A+": 6,
  A: 5,
  "B+": 3,
  B: 2,
  C: 0,
  D: -7,
  F: -11,
  "Sin evaluar": -4,
};

function sequenceFor(firstPickOwner: DraftFirstPickOwner): DraftTeam[] {
  return firstPickOwner === "Aliado"
    ? ["ally", "enemy", "enemy", "ally", "ally", "enemy"]
    : ["enemy", "ally", "ally", "enemy", "enemy", "ally"];
}

function phaseLabel(index: number) {
  if (index === 0) return "First pick";
  if (index <= 2) return "Doble pick";
  if (index <= 4) return "Doble pick";
  return "Last pick";
}

function recommendationPosition(sequence: DraftTeam[], picks: OrderedPick[]): DraftPosition {
  const currentIndex = picks.findIndex((pick) => !pick);
  if (currentIndex < 0) return "Last pick";
  const ownIndex = sequence[currentIndex] === "ally"
    ? currentIndex
    : sequence.findIndex((team, index) => index > currentIndex && team === "ally" && !picks[index]);
  if (ownIndex === 0) return "First pick";
  if (ownIndex === 5) return "Last pick";
  return "Pick intermedio";
}

function selectDistinct(
  results: DraftRecommendation[],
  sorter: (a: DraftRecommendation, b: DraftRecommendation) => number,
  excluded: string[],
) {
  return [...results]
    .filter((result) => !excluded.includes(result.brawler.name))
    .sort(sorter)[0];
}

export default function DraftAssistant({
  maps,
  brawlers,
}: {
  maps: MapProfile[];
  brawlers: Brawler[];
}) {
  const modes = [...new Set(maps.map((map) => map.mode))];
  const [mode, setMode] = useState(modes[0]);
  const availableMaps = useMemo(
    () => maps
      .filter((map) => map.mode === mode)
      .sort((a, b) =>
        Number(b.rotationStatus === "Actual") - Number(a.rotationStatus === "Actual") ||
        a.name.localeCompare(b.name)
      ),
    [maps, mode],
  );
  const [mapSlug, setMapSlug] = useState(availableMaps[0]?.slug || "");
  const [firstPickOwner, setFirstPickOwner] = useState<DraftFirstPickOwner>("Aliado");
  const [orderedPicks, setOrderedPicks] = useState<OrderedPick[]>(Array(6).fill(null));
  const [bans, setBans] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [personalPool, setPersonalPool] = useState<PlayerPool>({});
  const [poolPolicy, setPoolPolicy] = useState<PoolPolicy>("Off");
  const [queueMode, setQueueMode] = useState<QueueMode>("SoloQ");
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [learnFromHistory, setLearnFromHistory] = useState(true);
  const [personalPerformance, setPersonalPerformance] = useState<PersonalPerformance | undefined>();
  const [matchHistory, setMatchHistory] = useState<PersonalMatch[]>([]);
  const [playedBrawler, setPlayedBrawler] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResult>("Victoria");
  const [matchNote, setMatchNote] = useState("");
  const [scenarioEnemy, setScenarioEnemy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPersonalPool(loadPool(brawlers));
    const storedMatches = readMatchHistory(maps, brawlers);
    setMatchHistory(storedMatches);
    setPersonalPerformance(buildPersonalPerformance(storedMatches));
    const params = new URLSearchParams(window.location.search);
    const sharedMap = params.get("map");
    const sharedFirst = params.get("first") as DraftFirstPickOwner | null;
    const sharedPicks = params.get("picks")?.split("|").map((pick) => pick || null) || [];
    const sharedBans = params.get("bans")?.split("|").filter(Boolean) || [];
    const sharedPoolPolicy = params.get("pool") as PoolPolicy | null;
    const sharedQueueMode = params.get("queue") as QueueMode | null;
    const sharedQuick = params.get("quick");
    const sharedScenario = params.get("scenario");
    const sharedLearning = params.get("learn");

    if (sharedMap) {
      const found = maps.find((item) => item.slug === sharedMap);
      if (found) {
        setMode(found.mode);
        setMapSlug(found.slug);
      }
    }
    if (sharedFirst && ["Aliado", "Rival"].includes(sharedFirst)) setFirstPickOwner(sharedFirst);
    if (sharedPicks.length) {
      const normalized = Array.from({ length: 6 }, (_, index) => sharedPicks[index] || null);
      setOrderedPicks(normalized);
    }
    if (sharedBans.length) setBans(sharedBans.slice(0, 6));
    if (sharedPoolPolicy && ["Off", "Preferir", "Solo pool"].includes(sharedPoolPolicy)) setPoolPolicy(sharedPoolPolicy);
    const storedQueueMode = window.localStorage.getItem(QUEUE_MODE_KEY) as QueueMode | null;
    const resolvedQueueMode = sharedQueueMode || storedQueueMode;
    if (resolvedQueueMode && ["SoloQ", "Dúo", "Trío"].includes(resolvedQueueMode)) setQueueMode(resolvedQueueMode);
    if (sharedQuick === "1") setQuickMode(true);
    if (sharedScenario) setScenarioEnemy(sharedScenario);
    if (sharedLearning === "0") setLearnFromHistory(false);
    setQueueLoaded(true);
  }, [brawlers, maps]);

  useEffect(() => {
    if (!queueLoaded) return;
    try {
      window.localStorage.setItem(QUEUE_MODE_KEY, queueMode);
    } catch {
      // Mantener la selección durante la sesión aunque el navegador bloquee storage.
    }
  }, [queueMode, queueLoaded]);

  const map = maps.find((item) => item.slug === mapSlug) || availableMaps[0];
  const sequence = useMemo(() => sequenceFor(firstPickOwner), [firstPickOwner]);
  const nextIndex = orderedPicks.findIndex((pick) => !pick);
  const nextTeam = nextIndex >= 0 ? sequence[nextIndex] : null;
  const position = recommendationPosition(sequence, orderedPicks);
  const priority = position === "First pick" ? "Seguro" : "Counter";

  const allies = useMemo(
    () => orderedPicks.filter((pick, index): pick is string => Boolean(pick) && sequence[index] === "ally"),
    [orderedPicks, sequence],
  );
  const enemies = useMemo(
    () => orderedPicks.filter((pick, index): pick is string => Boolean(pick) && sequence[index] === "enemy"),
    [orderedPicks, sequence],
  );

  const analysis = useMemo(() => {
    if (!map) return null;
    return analyzeDraft({
      map,
      position,
      allies,
      enemies,
      bans,
      priority,
      personalPool,
      poolPolicy,
      personalPerformance,
      learnFromHistory,
      queueMode,
    }, brawlers);
  }, [map, position, allies, enemies, bans, priority, personalPool, poolPolicy, personalPerformance, learnFromHistory, queueMode, brawlers]);

  const nextEnemyIndex = useMemo(() => {
    const start = nextIndex < 0 ? 0 : nextIndex;
    return sequence.findIndex((team, index) => index >= start && team === "enemy" && !orderedPicks[index]);
  }, [sequence, orderedPicks, nextIndex]);

  const scenarioPicks = useMemo(() => {
    if (!scenarioEnemy || nextEnemyIndex < 0) return orderedPicks;
    return orderedPicks.map((pick, index) => index === nextEnemyIndex ? scenarioEnemy : pick);
  }, [orderedPicks, scenarioEnemy, nextEnemyIndex]);

  const scenarioAllies = useMemo(
    () => scenarioPicks.filter((pick, index): pick is string => Boolean(pick) && sequence[index] === "ally"),
    [scenarioPicks, sequence],
  );
  const scenarioEnemies = useMemo(
    () => scenarioPicks.filter((pick, index): pick is string => Boolean(pick) && sequence[index] === "enemy"),
    [scenarioPicks, sequence],
  );
  const scenarioPosition = recommendationPosition(sequence, scenarioPicks);

  const scenarioAnalysis = useMemo(() => {
    if (!map || !scenarioEnemy || nextEnemyIndex < 0) return null;
    return analyzeDraft({
      map,
      position: scenarioPosition,
      allies: scenarioAllies,
      enemies: scenarioEnemies,
      bans,
      priority: scenarioPosition === "First pick" ? "Seguro" : "Counter",
      personalPool,
      poolPolicy,
      personalPerformance,
      learnFromHistory,
      queueMode,
    }, brawlers);
  }, [map, scenarioEnemy, nextEnemyIndex, scenarioPosition, scenarioAllies, scenarioEnemies, bans, personalPool, poolPolicy, personalPerformance, learnFromHistory, queueMode, brawlers]);

  const displayAnalysis = scenarioAnalysis || analysis;
  const displayPosition = scenarioAnalysis ? scenarioPosition : position;

  const stressAnalysis = useMemo(() => {
    if (!map || displayPosition === "Last pick") return null;
    return analyzeRecommendationResilience({
      map,
      position: displayPosition,
      allies: scenarioAnalysis ? scenarioAllies : allies,
      enemies: scenarioAnalysis ? scenarioEnemies : enemies,
      bans,
      priority: displayPosition === "First pick" ? "Seguro" : "Counter",
      personalPool,
      poolPolicy,
      personalPerformance,
      learnFromHistory,
      queueMode,
    }, brawlers, 4, 5);
  }, [
    map,
    displayPosition,
    scenarioAnalysis,
    scenarioAllies,
    scenarioEnemies,
    allies,
    enemies,
    bans,
    personalPool,
    poolPolicy,
    personalPerformance,
    learnFromHistory,
    queueMode,
    brawlers,
  ]);

  const hasDoubleAllyTurn =
    nextIndex >= 0 &&
    nextTeam === "ally" &&
    sequence[nextIndex + 1] === "ally" &&
    !orderedPicks[nextIndex + 1];

  const pairRecommendations = useMemo(() => {
    if (!map || !hasDoubleAllyTurn) return [];
    return recommendDoublePick({
      map,
      position,
      allies,
      enemies,
      bans,
      priority,
      personalPool,
      poolPolicy,
      personalPerformance,
      learnFromHistory,
      queueMode,
    }, brawlers, 4);
  }, [
    map,
    hasDoubleAllyTurn,
    position,
    allies,
    enemies,
    bans,
    priority,
    personalPool,
    poolPolicy,
    personalPerformance,
    learnFromHistory,
    queueMode,
    brawlers,
  ]);

  const unavailableNames = useMemo(
    () => new Set([
      ...orderedPicks.filter(Boolean).map((name) => normalize(name as string)),
      ...bans.map(normalize),
    ]),
    [orderedPicks, bans],
  );

  const selectedNames = useMemo(
    () => new Set([
      ...unavailableNames,
      ...(scenarioEnemy ? [normalize(scenarioEnemy)] : []),
    ]),
    [unavailableNames, scenarioEnemy],
  );

  const suggestions = useMemo(() => {
    const search = normalize(query);
    return brawlers
      .filter((brawler) => !selectedNames.has(normalize(brawler.name)))
      .filter((brawler) => !search || normalize(brawler.name).includes(search))
      .sort((a, b) => {
        if (a.profileComplete !== b.profileComplete) return a.profileComplete ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      })
      .slice(0, 10);
  }, [query, brawlers, selectedNames]);

  const addNextPick = (name: string) => {
    if (nextIndex < 0) return;
    setOrderedPicks((current) => current.map((pick, index) => index === nextIndex ? name : pick));
    setScenarioEnemy("");
    setPlayedBrawler("");
    setMatchNote("");
    setQuery("");
    setFocused(false);
  };

  const applyPair = (first: string, second: string) => {
    if (
      nextIndex < 0 ||
      sequence[nextIndex] !== "ally" ||
      sequence[nextIndex + 1] !== "ally"
    ) return;

    setOrderedPicks((current) => current.map((pick, index) => {
      if (index === nextIndex) return first;
      if (index === nextIndex + 1) return second;
      return pick;
    }));
    setScenarioEnemy("");
    setPlayedBrawler("");
    setMatchNote("");
    setQuery("");
    setFocused(false);
    setMessage(`Pareja registrada: ${first} + ${second}`);
  };

  const clearFrom = (index: number) => {
    setOrderedPicks((current) => current.map((pick, pickIndex) => pickIndex >= index ? null : pick));
    setScenarioEnemy("");
    setQuery("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && suggestions[0] && nextIndex >= 0) {
      event.preventDefault();
      addNextPick(suggestions[0].name);
    }
    if (event.key === "Backspace" && !query) {
      const lastFilled = [...orderedPicks].map((pick, index) => pick ? index : -1).filter((index) => index >= 0).pop();
      if (typeof lastFilled === "number") clearFrom(lastFilled);
    }
  };

  const changeMode = (nextMode: string) => {
    setMode(nextMode);
    const first = maps.find((item) => item.mode === nextMode && item.rotationStatus === "Actual")
      || maps.find((item) => item.mode === nextMode);
    if (first) setMapSlug(first.slug);
    setOrderedPicks(Array(6).fill(null));
    setBans([]);
    setScenarioEnemy("");
    setPlayedBrawler("");
    setMatchNote("");
  };

  const resetDraft = () => {
    setOrderedPicks(Array(6).fill(null));
    setBans([]);
    setScenarioEnemy("");
    setQuery("");
    setMessage("");
  };

  const shareDraft = async () => {
    if (!map) return;
    const params = new URLSearchParams({
      map: map.slug,
      first: firstPickOwner,
      picks: orderedPicks.map((pick) => pick || "").join("|"),
      bans: bans.join("|"),
      pool: poolPolicy,
      queue: queueMode,
      quick: quickMode ? "1" : "0",
      scenario: scenarioEnemy,
      learn: learnFromHistory ? "1" : "0",
    });
    const url = `${window.location.origin}/draft?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado");
    } catch {
      setMessage("No se pudo copiar el enlace");
    }
  };

  if (!map || !analysis || !displayAnalysis) return null;

  const best = displayAnalysis.recommendations[0];
  const safe = selectDistinct(
    displayAnalysis.recommendations,
    (a, b) => {
      const aValue =
        a.score * .42 +
        a.metrics.safety * .32 +
        a.metrics.mapFit * .15 +
        a.metrics.composition * .08 -
        a.metrics.risk * .20 +
        (alternativeTierBonus[a.brawler.tier] || 0);
      const bValue =
        b.score * .42 +
        b.metrics.safety * .32 +
        b.metrics.mapFit * .15 +
        b.metrics.composition * .08 -
        b.metrics.risk * .20 +
        (alternativeTierBonus[b.brawler.tier] || 0);
      return bValue - aValue;
    },
    best ? [best.brawler.name] : [],
  );
  const counter = selectDistinct(
    displayAnalysis.recommendations,
    (a, b) => (
      b.countersHit.length * 32 + b.softCounters.length * 12 + b.metrics.counter * .6 + b.score * .2
    ) - (
      a.countersHit.length * 32 + a.softCounters.length * 12 + a.metrics.counter * .6 + a.score * .2
    ),
    [best?.brawler.name, safe?.brawler.name].filter(Boolean) as string[],
  );
  const compactAlternativeResults: DraftRecommendation[] = [];
  for (const candidate of [safe, counter, ...displayAnalysis.recommendations]) {
    if (!candidate || candidate.brawler.name === best?.brawler.name) continue;
    if (compactAlternativeResults.some((item) => item.brawler.name === candidate.brawler.name)) continue;
    compactAlternativeResults.push(candidate);
    if (compactAlternativeResults.length === 4) break;
  }
  const compactAlternatives = compactAlternativeResults.map((result, index) => ({
    result,
    label:
      result.brawler.name === safe?.brawler.name ? "Más seguro" :
      result.brawler.name === counter?.brawler.name ? "Counter puro" :
      `Opción #${index + 2}`,
  }));

  const predictedEnemyPicks = analysis.predictedEnemyPicks
    .filter((prediction) => !unavailableNames.has(normalize(prediction.brawler.name)))
    .slice(0, 4);
  const scenarioCandidates = brawlers
    .filter((brawler) => !unavailableNames.has(normalize(brawler.name)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const scenarioPrediction = analysis.predictedEnemyPicks.find(
    (prediction) => normalize(prediction.brawler.name) === normalize(scenarioEnemy),
  );
  const baselineWin = analysis.winEstimate?.percentage;
  const scenarioWin = scenarioAnalysis?.winEstimate?.percentage;
  const scenarioDelta = typeof baselineWin === "number" && typeof scenarioWin === "number"
    ? scenarioWin - baselineWin
    : undefined;

  const scenarioResponse = scenarioAnalysis?.recommendations[0];
  const scenarioAlternatives = scenarioAnalysis?.recommendations.slice(1, 3) || [];
  const suggestedBans = analysis.banRecommendations
    .filter((item) => !bans.some((ban) => normalize(ban) === normalize(item.brawler.name)))
    .filter((item) => normalize(item.brawler.name) !== normalize(scenarioEnemy))
    .slice(0, 3);

  const addSuggestedBan = (name: string) => {
    if (bans.length >= 6 || bans.some((ban) => normalize(ban) === normalize(name))) return;
    setBans((current) => [...current, name]);
    if (normalize(scenarioEnemy) === normalize(name)) setScenarioEnemy("");
  };

  const confirmScenario = () => {
    if (!scenarioEnemy || nextEnemyIndex < 0 || nextEnemyIndex !== nextIndex || nextTeam !== "enemy") return;
    setOrderedPicks((current) => current.map((pick, index) => index === nextEnemyIndex ? scenarioEnemy : pick));
    setScenarioEnemy("");
  };

  const saveDraftResult = () => {
    if (!map || !playedBrawler || allies.length !== 3 || enemies.length !== 3) return;
    const profile = brawlers.find((brawler) => brawler.name === playedBrawler);
    const slotIndex = orderedPicks.findIndex((pick) => pick === playedBrawler);
    const match: PersonalMatch = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mapSlug: map.slug,
      mapName: map.name,
      mode: map.mode,
      brawler: playedBrawler,
      brawlerSlug: profile?.slug,
      role: profile?.role,
      result: matchResult,
      draftPosition: slotIndex === 0 ? "First pick" : slotIndex === 5 ? "Last pick" : "Pick intermedio",
      allies,
      enemies,
      note: matchNote,
      source: "Draft Coach",
    };
    const nextHistory = [match, ...matchHistory].slice(0, 300);
    setMatchHistory(nextHistory);
    saveMatchHistory(nextHistory);
    setPersonalPerformance(buildPersonalPerformance(nextHistory));
    setMessage("Resultado guardado; las recomendaciones se han actualizado");
    setMatchNote("");
  };

  const poolEntryFor = (result?: DraftRecommendation) =>
    result ? personalPool[result.brawler.slug] : undefined;

  const bestPoolEntry = poolEntryFor(best);
  const robustPick = stressAnalysis?.robustPick;
  const robustAlternatives = stressAnalysis?.results
    .filter((item) => item.recommendation.brawler.name !== robustPick?.recommendation.brawler.name)
    .slice(0, 2) || [];

  return <div className="ordered-draft-assistant">
    <section className="panel ordered-draft-panel">
      <div className="section-title">
        <div><span className="eyebrow">Draft Coach v0.17</span><h2>Introduce los picks en orden</h2></div>
        <div className="draft-action-row">
          <button type="button" className="secondary-button compact-button" onClick={shareDraft}>Compartir</button>
          <button type="button" className="secondary-button compact-button" onClick={resetDraft}>Reiniciar</button>
        </div>
      </div>
      {message && <div className="draft-toast">{message}</div>}

      <div className="ordered-draft-context ordered-draft-context-v5">
        <label>Modo<select value={mode} onChange={(event) => changeMode(event.target.value)}>{modes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mapa<select value={mapSlug} onChange={(event) => { setMapSlug(event.target.value); setOrderedPicks(Array(6).fill(null)); setBans([]); setScenarioEnemy(""); }}>{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}{item.rotationStatus === "Histórico" ? " · histórico" : ""}</option>)}</select></label>
        <label>First pick<select value={firstPickOwner} onChange={(event) => { setFirstPickOwner(event.target.value as DraftFirstPickOwner); setOrderedPicks(Array(6).fill(null)); setScenarioEnemy(""); }}><option value="Aliado">Mi equipo</option><option value="Rival">Equipo rival</option></select></label>
        <label>Política de pool<select value={poolPolicy} onChange={(event) => setPoolPolicy(event.target.value as PoolPolicy)}><option value="Off">No usar pool</option><option value="Preferir">Priorizar mi pool</option><option value="Solo pool">Solo brawlers disponibles</option></select></label>
        <label>Cola Ranked<select value={queueMode} onChange={(event) => setQueueMode(event.target.value as QueueMode)}><option value="SoloQ">SoloQ</option><option value="Dúo">Dúo</option><option value="Trío">Trío premade</option></select></label>
        <label className="auto-position-toggle"><input type="checkbox" checked={quickMode} onChange={(event) => setQuickMode(event.target.checked)} /><span><b>Modo ultrarrápido</b><small>Pick, línea y build</small></span></label>
        <label className="auto-position-toggle learning-toggle-v7"><input type="checkbox" checked={learnFromHistory} onChange={(event) => setLearnFromHistory(event.target.checked)} /><span><b>Aprender de mi historial</b><small>{personalPerformance?.overall.games || 0} partidas registradas</small></span></label>
      </div>

      <div className="first-pick-audit-v11 first-pick-audit-v12">
        <div className="first-pick-audit-heading">
          <div>
            <span className="eyebrow">First picks estructurales</span>
            <small>{map.firstPickReviewedAt || "Revisión editorial"} · confianza {map.firstPickConfidence || "Media"} · motor v0.15</small>
          </div>
          {map.geometry && <div className="map-geometry-chips-v12">
            <span><b>{map.geometry.openness}</b>Apertura</span>
            <span><b>{map.geometry.bushDensity}</b>Arbustos</span>
            <span><b>{map.geometry.wallDensity}</b>Muros</span>
            <span><b>{map.geometry.destructibility}</b>Muros rompibles</span>
            <span><b>{map.geometry.chokeDensity}</b>Pasillos</span>
          </div>}
        </div>
        <div className="first-pick-audit-brawlers">
          {map.firstPicks.map((name, index) => {
            const candidate = map.firstPickCandidates?.find((item) => item.name === name);
            const profile = brawlers.find((item) => item.name === name);
            const currentEvaluation = profile ? evaluateFirstPick(profile, map) : undefined;
            return <span key={name}>
              <BrawlerPortrait name={name} className="first-pick-audit-avatar" />
              <span><b>{index + 1}. {name}</b><small>{currentEvaluation ? `${currentEvaluation.score}/100 · ${currentEvaluation.strengths[0] || candidate?.reasons[0] || "Pick ciego estable"}` : "Pick ciego auditado"}</small></span>
            </span>;
          })}
        </div>
        {map.geometry && <small className="opening-model-note-v15">La facilidad de romper muros no presupone que el campo vaya a abrirse: el motor exige una herramienta de wallbreak fiable para dar peso a ese escenario.</small>}
        {map.firstPickNotes && <p>{map.firstPickNotes}</p>}
      </div>

      <div className="draft-ban-panel-v51">
        <BrawlerDraftPicker
          title="Bans"
          subtitle="Añade los brawlers bloqueados antes o durante el draft"
          values={bans}
          max={6}
          roster={brawlers}
          unavailable={selectedNames}
          tone="ban"
          onChange={(values) => {
            setBans(values);
            if (scenarioEnemy && values.some((ban) => normalize(ban) === normalize(scenarioEnemy))) setScenarioEnemy("");
          }}
        />
        {suggestedBans.length > 0 && <div className="suggested-ban-row">
          <div><span className="eyebrow">Bans sugeridos</span><small>Según mapa, amenazas y tus picks</small></div>
          {suggestedBans.map((item) => <button
            type="button"
            key={item.brawler.slug}
            onClick={() => addSuggestedBan(item.brawler.name)}
            disabled={bans.length >= 6}
          >
            <BrawlerPortrait name={item.brawler.name} className="suggested-ban-avatar" />
            <span><b>{item.brawler.name}</b><small>{item.reasons[0] || "Amenaza prioritaria"}</small></span>
            <strong>Ban</strong>
          </button>)}
        </div>}
      </div>

      <div className="ordered-phase-labels">
        <span>First pick</span><span>2 picks</span><span>2 picks</span><span>Last pick</span>
      </div>

      <div className="ordered-pick-bar">
        {orderedPicks.map((pick, index) => {
          const team = sequence[index];
          const isNext = index === nextIndex;
          const simulatedPick = !pick && scenarioEnemy && index === nextEnemyIndex ? scenarioEnemy : "";
          const visiblePick = pick || simulatedPick;
          return <button
            type="button"
            key={index}
            className={`ordered-pick-slot ${team === "ally" ? "ally" : "enemy"} ${pick ? "filled" : ""} ${simulatedPick ? "simulated" : ""} ${isNext ? "next" : ""}`}
            onClick={() => pick && clearFrom(index)}
            title={pick ? `Corregir desde ${pick}` : simulatedPick ? `Simulación: ${simulatedPick}` : `${phaseLabel(index)} · ${team === "ally" ? "Aliado" : "Rival"}`}
          >
            <small>{index + 1}</small>
            {visiblePick ? <><BrawlerPortrait name={visiblePick} className="ordered-pick-avatar" /><b>{visiblePick}</b>{simulatedPick && <em>Simulado</em>}</> : <><span>+</span><b>{team === "ally" ? "Aliado" : "Rival"}</b></>}
          </button>;
        })}
      </div>

      {nextIndex >= 0 && best && <div className={`draft-pick-decision-v16 draft-pick-decision-v17 ${nextTeam === "ally" ? "ready" : "provisional"}`} data-testid="draft-pick-priorities">
        <section className="draft-primary-pick-v16">
          <div className="draft-primary-banner-v16">
            <span>{nextTeam === "ally" ? "PRIORIDAD #1 · PICKEA AHORA" : "PRIORIDAD #1 · PREPARA TU PRÓXIMO PICK"}</span>
            <b>Confianza {displayAnalysis.confidence.label} · {displayAnalysis.confidence.score}/100</b>
          </div>
          <div className="draft-primary-body-v16">
            <BrawlerPortrait name={best.brawler.name} className="draft-primary-avatar-v16" priority />
            <div className="draft-primary-copy-v16">
              <small>MI RECOMENDACIÓN PRINCIPAL · {queueMode} · {displayPosition}</small>
              <h2>{best.brawler.name}</h2>
              <p>{best.brief}</p>
              <div>
                <span>{best.counterLabel}</span>
                <span>{best.suggestedLine}</span>
                <span>Meta {best.metrics.meta}</span>
                <span>Mapa {best.metrics.mapFit}</span>
              </div>
            </div>
            <strong className="draft-primary-score-v16">{best.score}<small>score</small></strong>
          </div>
          <div className="draft-primary-action-v16">
            <p>{best.reasons.slice(0, 2).join(" · ") || "La opción con mejor equilibrio para este turno."}</p>
            {nextTeam === "ally" ? <button type="button" onClick={() => addNextPick(best.brawler.name)}>PICKEAR {best.brawler.name}</button> : <span>Se actualizará al registrar el pick rival</span>}
          </div>
        </section>
        <aside className="draft-compact-alternatives-v16">
          <div><span className="eyebrow">Otras 4 opciones</span><small>Ordenadas para comparar sin quitar foco al #1</small></div>
          {compactAlternatives.map(({ result, label }, index) => <button
            type="button"
            key={result.brawler.slug}
            disabled={nextTeam !== "ally"}
            onClick={() => addNextPick(result.brawler.name)}
            aria-label={`Pickear ${result.brawler.name}`}
          >
            <em>#{index + 2}</em>
            <BrawlerPortrait name={result.brawler.name} className="draft-compact-avatar-v16" />
            <span><b>{result.brawler.name}</b><small>{label} · {result.counterLabel}</small></span>
            <strong>{result.score}</strong>
          </button>)}
        </aside>
      </div>}

      {nextIndex >= 0 && robustPick && stressAnalysis && <div className="draft-stress-panel-v14">
        <div className="draft-stress-heading-v14">
          <div>
            <span className="eyebrow">Prueba de respuestas probables</span>
            <h3>{robustPick.recommendation.brawler.name} · {robustPick.verdict}</h3>
            <p>{stressAnalysis.summary}</p>
          </div>
          <div className="draft-resilience-score-v14">
            <strong>{robustPick.resilience}</strong>
            <span>Resiliencia</span>
          </div>
        </div>

        <div className="draft-stress-main-v14">
          <div className="draft-stress-pick-v14">
            <BrawlerPortrait name={robustPick.recommendation.brawler.name} className="draft-stress-avatar-v14" priority />
            <div>
              <b>Pick más robusto</b>
              <strong>{robustPick.recommendation.brawler.name}</strong>
              <small>{robustPick.recommendation.brief}</small>
            </div>
            {nextTeam === "ally" && <button type="button" onClick={() => addNextPick(robustPick.recommendation.brawler.name)}>Usar pick robusto</button>}
          </div>
          <div className="draft-stress-metrics-v14">
            <span><b>{robustPick.averageScore}</b>Media tras respuesta</span>
            <span><b>{robustPick.worstScore}</b>Peor escenario</span>
            <span><b>{robustPick.directThreats}</b>Counters directos</span>
            <span><b>{robustPick.scenarios.length}</b>Respuestas probadas</span>
          </div>
        </div>

        <div className="draft-stress-scenarios-v14">
          {robustPick.scenarios.map((stressScenario) => <article className={stressScenario.directThreat ? "danger" : "stable"} key={stressScenario.enemy.slug}>
            <BrawlerPortrait name={stressScenario.enemy.name} className="draft-stress-enemy-v14" />
            <div>
              <b>{stressScenario.enemy.name}</b>
              <small>{stressScenario.reason}</small>
            </div>
            <span>
              <strong>{stressScenario.candidateScore}</strong>
              <small>{stressScenario.scoreDrop ? `−${stressScenario.scoreDrop}` : "estable"}</small>
            </span>
          </article>)}
        </div>

        {robustAlternatives.length > 0 && <div className="draft-stress-alternatives-v14">
          <span>Otras opciones resistentes</span>
          {robustAlternatives.map((item) => <button type="button" key={item.recommendation.brawler.slug} onClick={() => nextTeam === "ally" && addNextPick(item.recommendation.brawler.name)} disabled={nextTeam !== "ally"}>
            <b>{item.recommendation.brawler.name}</b>
            <small>{item.resilience}/100 · {item.verdict} · peor caso {item.worstScore}</small>
          </button>)}
        </div>}
      </div>}

      {hasDoubleAllyTurn && pairRecommendations[0] && <div className="double-pick-panel-v13">
        <div className="double-pick-heading-v13">
          <div>
            <span className="eyebrow">Doble pick recomendado · {queueMode}</span>
            <h3>{pairRecommendations[0].first.brawler.name} + {pairRecommendations[0].second.brawler.name}</h3>
            <p>{pairRecommendations[0].reasons.slice(0, 3).join(" · ")}</p>
          </div>
          <strong>{pairRecommendations[0].score}</strong>
        </div>
        <div className="double-pick-brawlers-v13">
          {[pairRecommendations[0].first, pairRecommendations[0].second].map((item, index) => <article key={item.brawler.slug}>
            <span>{index + 1}</span>
            <BrawlerPortrait name={item.brawler.name} className="double-pick-avatar-v13" priority={index === 0} />
            <div><b>{item.brawler.name}</b><small>{item.brawler.role} · {item.suggestedLine}</small></div>
          </article>)}
        </div>
        <div className="double-pick-metrics-v13">
          <span><b>{pairRecommendations[0].synergy}</b>Sinergia</span>
          <span><b>{pairRecommendations[0].coverage}</b>Cobertura</span>
          <span><b>{pairRecommendations[0].coordination}</b>Coordinación</span>
          <span><b>{pairRecommendations[0].lanePlan}</b>Plan de líneas</span>
        </div>
        {pairRecommendations[0].risks.length > 0 && <small className="double-pick-risk-v13">Riesgo: {pairRecommendations[0].risks.join(" · ")}</small>}
        <div className="double-pick-actions-v13">
          <button type="button" onClick={() => addNextPick(pairRecommendations[0].first.brawler.name)}>Usar primero</button>
          <button type="button" onClick={() => applyPair(pairRecommendations[0].first.brawler.name, pairRecommendations[0].second.brawler.name)}>
            {queueMode === "SoloQ" ? "Simular pareja" : "Aplicar pareja"}
          </button>
        </div>
        {pairRecommendations.length > 1 && <div className="double-pick-alternatives-v13">
          {pairRecommendations.slice(1, 4).map((pair) => <button
            type="button"
            key={`${pair.first.brawler.slug}-${pair.second.brawler.slug}`}
            onClick={() => applyPair(pair.first.brawler.name, pair.second.brawler.name)}
          >
            <b>{pair.first.brawler.name} + {pair.second.brawler.name}</b>
            <small>{pair.score}/100 · {pair.reasons[0] || "Pareja equilibrada"}</small>
          </button>)}
        </div>}
      </div>}

      <div className={`common-pick-entry ${nextTeam === "ally" ? "ally" : "enemy"}`}>
        <div>
          <span className="eyebrow">{nextIndex < 0 ? "Draft completo" : `Pick ${nextIndex + 1} · ${nextTeam === "ally" ? "Aliado" : "Rival"}`}</span>
          <h3>{nextIndex < 0 ? "Los seis picks están completos" : `Añadir siguiente pick ${nextTeam === "ally" ? "aliado" : "rival"}`}</h3>
        </div>
        <div className="common-pick-search">
          <input
            value={query}
            disabled={nextIndex < 0}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={nextIndex < 0 ? "Draft completo" : "Buscar brawler…"}
          />
          {focused && nextIndex >= 0 && suggestions.length > 0 && <div className="common-pick-suggestions">
            {suggestions.map((brawler) => <button type="button" key={brawler.slug} onMouseDown={() => addNextPick(brawler.name)}>
              <BrawlerPortrait name={brawler.name} className="suggestion-avatar" />
              <span><b>{brawler.name}</b><small>{brawler.role} · {brawler.tier}</small></span>
            </button>)}
          </div>}
        </div>
        <strong className={`turn-status ${nextTeam === "ally" ? "ally" : "enemy"}`}>
          {nextIndex < 0
            ? "Finalizado"
            : nextTeam === "ally"
              ? position === "First pick" ? "Elige un pick sólido" : position === "Last pick" ? "Busca el máximo counter" : "Counterea y completa"
              : "Introduce el pick rival"}
        </strong>
      </div>
      <small className="ordered-edit-hint">Pulsa un pick ya introducido para corregirlo; se borrarán también los picks posteriores.</small>
    </section>

    {nextIndex < 0 && allies.length === 3 && enemies.length === 3 && <section className="panel draft-result-panel-v7">
      <div className="section-title"><div><span className="eyebrow">Aprendizaje personal</span><h2>Guardar resultado del draft</h2></div><span className="status-pill">3 vs 3 completo</span></div>
      <div className="draft-result-form-v7">
        <label>¿Qué brawler jugaste?<select value={playedBrawler} onChange={(event) => setPlayedBrawler(event.target.value)}><option value="">Seleccionar aliado…</option>{allies.map((ally) => <option key={ally}>{ally}</option>)}</select></label>
        <label>Resultado<select value={matchResult} onChange={(event) => setMatchResult(event.target.value as MatchResult)}><option>Victoria</option><option>Derrota</option></select></label>
        <label>Nota rápida<input value={matchNote} onChange={(event) => setMatchNote(event.target.value)} placeholder="Matchup, error o acierto clave" /></label>
        <button type="button" className="primary-button" disabled={!playedBrawler} onClick={saveDraftResult}>Guardar y aprender</button>
      </div>
      <small>La recomendación personal se ajusta de forma gradual; una sola partida no cambia significativamente el ranking.</small>
    </section>}

    {nextEnemyIndex >= 0 && <section className={`panel draft-simulator-v6 ${scenarioEnemy ? "scenario-active" : ""}`}>
      <div className="section-title">
        <div>
          <span className="eyebrow">Simulador del rival</span>
          <h2>¿Qué pasa si el rival elige…?</h2>
        </div>
        {scenarioEnemy && <button type="button" className="secondary-button compact-button" onClick={() => setScenarioEnemy("")}>Cerrar simulación</button>}
      </div>

      <div className="prediction-strip">
        {predictedEnemyPicks.map((prediction, index) => <button
          type="button"
          className={normalize(scenarioEnemy) === normalize(prediction.brawler.name) ? "active" : ""}
          key={prediction.brawler.slug}
          onClick={() => setScenarioEnemy(prediction.brawler.name)}
        >
          <span className="prediction-rank">{index + 1}</span>
          <BrawlerPortrait name={prediction.brawler.name} className="prediction-avatar" />
          <div><b>{prediction.brawler.name}</b><small>{prediction.reason}</small></div>
          <strong>{prediction.score}</strong>
        </button>)}
      </div>

      <div className="scenario-selector-row">
        <label>Simular otro brawler<select value={scenarioEnemy} onChange={(event) => setScenarioEnemy(event.target.value)}>
          <option value="">Seleccionar…</option>
          {scenarioCandidates.map((brawler) => <option value={brawler.name} key={brawler.slug}>{brawler.name} · {brawler.role}</option>)}
        </select></label>
        <div>
          <span>Próximo hueco rival</span>
          <b>{nextEnemyIndex + 1} · {phaseLabel(nextEnemyIndex)}</b>
        </div>
      </div>

      {scenarioEnemy && scenarioAnalysis && scenarioResponse && <div className="scenario-result-grid">
        <article className="scenario-threat-card">
          <span className="eyebrow">Amenaza simulada</span>
          <div className="scenario-brawler-head">
            <BrawlerPortrait name={scenarioEnemy} className="scenario-main-avatar" />
            <div><h3>{scenarioEnemy}</h3><p>{scenarioPrediction?.reason || "Escenario manual seleccionado"}</p></div>
          </div>
          {scenarioPrediction?.target && <strong>Puede castigar a {scenarioPrediction.target}</strong>}
          <small>{scenarioPrediction?.response || "El asistente recalcula la respuesta óptima con el draft actual."}</small>
          <div className="scenario-actions">
            {nextEnemyIndex === nextIndex && nextTeam === "enemy" && <button type="button" className="primary-button" onClick={confirmScenario}>Confirmar pick rival</button>}
            <button type="button" className="secondary-button" disabled={bans.length >= 6} onClick={() => addSuggestedBan(scenarioEnemy)}>Añadir a bans</button>
          </div>
        </article>

        <article className="scenario-response-card">
          <span className="eyebrow">Respuesta recomendada</span>
          <div className="scenario-brawler-head">
            <BrawlerPortrait name={scenarioResponse.brawler.name} className="scenario-main-avatar" />
            <div><h3>{scenarioResponse.brawler.name}</h3><p>{scenarioResponse.brief}</p></div>
            <strong>{scenarioResponse.score}</strong>
          </div>
          <div className="scenario-response-details">
            <span><b>Línea</b>{scenarioResponse.lanePlan.lane}</span>
            <span><b>Objetivo</b>{scenarioResponse.lanePlan.target || "Completar composición"}</span>
            <span><b>Build</b>{scenarioResponse.build.gears.join(" + ")}</span>
          </div>
          {scenarioAlternatives.length > 0 && <div className="scenario-alternatives">
            <b>Alternativas</b>
            {scenarioAlternatives.map((item) => <span key={item.brawler.slug}>{item.brawler.name} · {item.counterLabel}</span>)}
          </div>}
        </article>

        <article className="scenario-impact-card">
          <span className="eyebrow">Impacto estimado</span>
          {typeof scenarioWin === "number" ? <>
            <strong>{scenarioWin}%</strong>
            <p>Probabilidad aliada con {scenarioEnemy}</p>
            {typeof scenarioDelta === "number" && <span className={scenarioDelta < 0 ? "negative" : scenarioDelta > 0 ? "positive" : ""}>
              {scenarioDelta > 0 ? "+" : ""}{scenarioDelta} puntos frente al escenario actual
            </span>}
          </> : <>
            <strong>—</strong>
            <p>Añade al menos un pick aliado para estimar el impacto.</p>
          </>}
          <small>Es una estimación heurística, no un win rate observado.</small>
        </article>
      </div>}
    </section>}

    <section className={`panel ordered-recommendations ${quickMode ? "quick-v5" : ""}`}>
      <div className="section-title">
        <div>
          <span className="eyebrow">{scenarioEnemy ? `Simulación activa · ${scenarioEnemy}` : "Análisis de la prioridad #1"}</span>
          <h2>{best ? `Cómo jugar a ${best.brawler.name}` : "Plan para el pick principal"}</h2>
        </div>
        <span className="status-pill">Pick #1 · {displayPosition}</span>
      </div>
      <div className="draft-diagnosis-v15">
        <div className="draft-confidence-v15">
          <span className="eyebrow">Confianza de la recomendación</span>
          <strong>{displayAnalysis.confidence.score}<small>/100 · {displayAnalysis.confidence.label}</small></strong>
          <p>{displayAnalysis.confidence.reasons[0] || "La recomendación se recalcula con cada pick."}</p>
          {displayAnalysis.confidence.cautions.map((item) => <small className="caution" key={item}>{item}</small>)}
        </div>
        <div className="draft-checklist-v15">
          {displayAnalysis.checklist.map((item) => <article className={item.status === "Cubierto" ? "covered" : item.status === "Parcial" ? "partial" : "missing"} key={item.label}>
            <span>{item.status}</span><b>{item.label}</b><small>{item.detail}</small>
          </article>)}
        </div>
      </div>
      {best && <div className="contextual-build-panel">
        <div className="contextual-build-title">
          <BrawlerPortrait name={best.brawler.name} className="contextual-build-avatar" />
          <div><span className="eyebrow">Build contextual · {best.brawler.name}</span><h3>{best.lanePlan.lane}{best.lanePlan.target ? ` → busca a ${best.lanePlan.target}` : ""}</h3><p>{best.lanePlan.instruction}</p></div>
          {bestPoolEntry && poolPolicy !== "Off" && <strong>{bestPoolEntry.favorite ? "★ " : ""}{bestPoolEntry.mastery}/5</strong>}
        </div>
        <div className="contextual-build-grid">
          <div><span>Gadget</span><b>{best.build.gadget}</b></div>
          <div><span>Habilidad estelar</span><b>{best.build.starPower}</b></div>
          <div><span>Engranajes</span><b>{best.build.gears.join(" + ")}</b></div>
          <div><span>Hipercarga</span><b>{best.build.hypercharge}</b></div>
        </div>
        <small>{best.build.reason}</small>
      </div>}
    </section>

    {!quickMode && (displayAnalysis.winEstimate ? <section className="panel ordered-win-panel">
      <div className="ordered-win-head">
        <div><span className="eyebrow">{scenarioEnemy ? `Probabilidad con ${scenarioEnemy}` : "Probabilidad estimada"}</span><h2>{displayAnalysis.winEstimate.title}</h2><p>{displayAnalysis.winEstimate.completeness < 100 ? "Se actualiza con cada pick introducido." : "Draft 3v3 completo."}</p></div>
        <div><strong>{displayAnalysis.winEstimate.percentage}%</strong><span>{displayAnalysis.winEstimate.lower}–{displayAnalysis.winEstimate.upper}% · confianza {displayAnalysis.winEstimate.confidence}</span></div>
      </div>
      <div className="win-meter"><span style={{ width: `${displayAnalysis.winEstimate.percentage}%` }} /></div>
      <div className="ordered-win-scores">
        <span>Aliados <b>{displayAnalysis.winEstimate.alliedScore}/100</b></span>
        <span>Rivales <b>{displayAnalysis.winEstimate.enemyScore}/100</b></span>
        <span>Draft <b>{displayAnalysis.winEstimate.completeness}%</b></span>
      </div>
      <small>{displayAnalysis.winEstimate.disclaimer}</small>
    </section> : <section className="panel ordered-win-empty">
      <span className="eyebrow">Probabilidad estimada</span>
      <h2>Añade al menos un pick de cada equipo</h2>
      <p>El cálculo aparecerá cuando exista información de ambos lados y ganará precisión al completar el draft.</p>
    </section>)}

    {!quickMode && <section className="ordered-coaching-grid">
      <article className="panel">
        <span className="eyebrow">Consejos rápidos</span>
        <h3>Qué necesita tu composición</h3>
        <div className="quick-advice-list">
          {displayAnalysis.needs.length ? displayAnalysis.needs.slice(0, 5).map((item) => <span key={item}>Cubrir: {item}</span>) : <span>La composición está equilibrada.</span>}
          {displayAnalysis.threats.slice(0, 3).map((item) => <span className="danger" key={item}>{item}</span>)}
          {displayAnalysis.strengths.slice(0, 3).map((item) => <span className="good" key={item}>{item}</span>)}
        </div>
      </article>

      <article className="panel">
        <span className="eyebrow">Matchups y líneas</span>
        <h3>Emparejamientos que debes buscar</h3>
        <div className="line-matchup-list">
          {displayAnalysis.teamAssignments.length
            ? displayAnalysis.teamAssignments.map((assignment, index) => <div key={`${assignment.ally}-${index}`}>
              <b>{assignment.ally}</b>
              <span>{assignment.lane}</span>
              <strong>{assignment.enemy ? `Busca a ${assignment.enemy}` : "Mantén tu línea"}</strong>
              <small>{assignment.instruction}</small>
            </div>)
            : <p>Añade más picks para generar el plan de líneas.</p>}
        </div>
      </article>

      <article className="panel">
        <span className="eyebrow">Lectura rival</span>
        <h3>Debilidades y amenazas</h3>
        <div className="quick-advice-list">
          {displayAnalysis.enemyWeaknesses.length ? displayAnalysis.enemyWeaknesses.slice(0, 5).map((item) => <span className="good" key={item}>{item}</span>) : <span>Faltan picks rivales para detectar una debilidad clara.</span>}
          {best?.exposedTo.slice(0, 3).map((name) => <span className="danger" key={name}>{name} puede frenar al pick recomendado.</span>)}
        </div>
      </article>
    </section>}
  </div>;
}
