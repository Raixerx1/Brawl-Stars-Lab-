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
  PlayerPoolEntry,
  PoolPolicy,
} from "@/lib/types";
import { analyzeDraft } from "@/lib/draft-engine";
import { loadPool } from "@/lib/pool";
import { BrawlerPortrait } from "./GameArtwork";
import BrawlerDraftPicker from "./BrawlerDraftPicker";

type DraftTeam = "ally" | "enemy";
type OrderedPick = string | null;

const normalize = (value: string) => value.trim().toLowerCase();

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

function RecommendationCard({
  result,
  label,
  tone,
  poolEntry,
}: {
  result?: DraftRecommendation;
  label: string;
  tone: "best" | "safe" | "counter";
  poolEntry?: PlayerPoolEntry;
}) {
  if (!result) return null;
  return <article className={`simple-rec-card simple-rec-${tone}`}>
    <span className="simple-rec-label">{label}</span>
    <div className="simple-rec-head">
      <BrawlerPortrait name={result.brawler.name} className="simple-rec-avatar" priority={tone === "best"} />
      <div><h3>{result.brawler.name}</h3><p>{result.brawler.role} · {result.suggestedLine}</p></div>
      <strong>{result.score}</strong>
    </div>
    <p className="simple-rec-brief">{result.brief}</p>
    {poolEntry && <div className="rec-pool-status">
      {poolEntry.favorite && <span>★ Prioritario</span>}
      {poolEntry.power11 && <span>F11</span>}
      {poolEntry.hypercharge && <span>HC</span>}
      <span>Dominio {poolEntry.mastery}/5</span>
      {!poolEntry.available && <span className="bad">No disponible</span>}
    </div>}
    <div className="simple-rec-tags">
      {result.countersHit.slice(0, 3).map((name) => <span className="good" key={name}>Frena {name}</span>)}
      {result.softCounters.slice(0, 2).map((name) => <span className="soft" key={name}>Favorable vs {name}</span>)}
      {result.exposedTo.slice(0, 2).map((name) => <span className="bad" key={name}>Lo frena {name}</span>)}
    </div>
  </article>;
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
  const [quickMode, setQuickMode] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPersonalPool(loadPool(brawlers));
    const params = new URLSearchParams(window.location.search);
    const sharedMap = params.get("map");
    const sharedFirst = params.get("first") as DraftFirstPickOwner | null;
    const sharedPicks = params.get("picks")?.split("|").map((pick) => pick || null) || [];
    const sharedBans = params.get("bans")?.split("|").filter(Boolean) || [];
    const sharedPoolPolicy = params.get("pool") as PoolPolicy | null;
    const sharedQuick = params.get("quick");

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
    if (sharedQuick === "1") setQuickMode(true);
  }, [brawlers, maps]);

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
    }, brawlers);
  }, [map, position, allies, enemies, bans, priority, personalPool, poolPolicy, brawlers]);

  const selectedNames = useMemo(
    () => new Set([
      ...orderedPicks.filter(Boolean).map((name) => normalize(name as string)),
      ...bans.map(normalize),
    ]),
    [orderedPicks, bans],
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
    setQuery("");
    setFocused(false);
  };

  const clearFrom = (index: number) => {
    setOrderedPicks((current) => current.map((pick, pickIndex) => pickIndex >= index ? null : pick));
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
  };

  const resetDraft = () => {
    setOrderedPicks(Array(6).fill(null));
    setBans([]);
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
      quick: quickMode ? "1" : "0",
    });
    const url = `${window.location.origin}/draft?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado");
    } catch {
      setMessage("No se pudo copiar el enlace");
    }
  };

  if (!map || !analysis) return null;

  const best = analysis.recommendations[0];
  const safe = selectDistinct(
    analysis.recommendations,
    (a, b) => (b.metrics.safety * .62 + b.metrics.mapFit * .25 + b.score * .25)
      - (a.metrics.safety * .62 + a.metrics.mapFit * .25 + a.score * .25),
    best ? [best.brawler.name] : [],
  );
  const counter = selectDistinct(
    analysis.recommendations,
    (a, b) => (
      b.countersHit.length * 32 + b.softCounters.length * 12 + b.metrics.counter * .6 + b.score * .2
    ) - (
      a.countersHit.length * 32 + a.softCounters.length * 12 + a.metrics.counter * .6 + a.score * .2
    ),
    [best?.brawler.name, safe?.brawler.name].filter(Boolean) as string[],
  );

  const poolEntryFor = (result?: DraftRecommendation) =>
    result ? personalPool[result.brawler.slug] : undefined;

  const bestPoolEntry = poolEntryFor(best);

  const bestLabel = position === "First pick"
    ? "Mejor brawler del mapa"
    : position === "Last pick"
      ? "Mejor last pick"
      : "Mejor counter";
  const safeLabel = position === "First pick" ? "Alternativa segura" : "Counter seguro";
  const counterLabel = position === "First pick" ? "Opción flexible" : "Counter alternativo";

  return <div className="ordered-draft-assistant">
    <section className="panel ordered-draft-panel">
      <div className="section-title">
        <div><span className="eyebrow">Draft Coach v0.5.1</span><h2>Introduce los picks en orden</h2></div>
        <div className="draft-action-row">
          <button type="button" className="secondary-button compact-button" onClick={shareDraft}>Compartir</button>
          <button type="button" className="secondary-button compact-button" onClick={resetDraft}>Reiniciar</button>
        </div>
      </div>
      {message && <div className="draft-toast">{message}</div>}

      <div className="ordered-draft-context ordered-draft-context-v5">
        <label>Modo<select value={mode} onChange={(event) => changeMode(event.target.value)}>{modes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mapa<select value={mapSlug} onChange={(event) => { setMapSlug(event.target.value); setOrderedPicks(Array(6).fill(null)); setBans([]); }}>{availableMaps.map((item) => <option value={item.slug} key={item.slug}>{item.name}{item.rotationStatus === "Histórico" ? " · histórico" : ""}</option>)}</select></label>
        <label>First pick<select value={firstPickOwner} onChange={(event) => { setFirstPickOwner(event.target.value as DraftFirstPickOwner); setOrderedPicks(Array(6).fill(null)); }}><option value="Aliado">Mi equipo</option><option value="Rival">Equipo rival</option></select></label>
        <label>Política de pool<select value={poolPolicy} onChange={(event) => setPoolPolicy(event.target.value as PoolPolicy)}><option value="Off">No usar pool</option><option value="Preferir">Priorizar mi pool</option><option value="Solo pool">Solo brawlers disponibles</option></select></label>
        <label className="auto-position-toggle"><input type="checkbox" checked={quickMode} onChange={(event) => setQuickMode(event.target.checked)} /><span><b>Modo ultrarrápido</b><small>Pick, línea y build</small></span></label>
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
          onChange={setBans}
        />
      </div>

      <div className="ordered-phase-labels">
        <span>First pick</span><span>2 picks</span><span>2 picks</span><span>Last pick</span>
      </div>

      <div className="ordered-pick-bar">
        {orderedPicks.map((pick, index) => {
          const team = sequence[index];
          const isNext = index === nextIndex;
          return <button
            type="button"
            key={index}
            className={`ordered-pick-slot ${team === "ally" ? "ally" : "enemy"} ${pick ? "filled" : ""} ${isNext ? "next" : ""}`}
            onClick={() => pick && clearFrom(index)}
            title={pick ? `Corregir desde ${pick}` : `${phaseLabel(index)} · ${team === "ally" ? "Aliado" : "Rival"}`}
          >
            <small>{index + 1}</small>
            {pick ? <><BrawlerPortrait name={pick} className="ordered-pick-avatar" /><b>{pick}</b></> : <><span>+</span><b>{team === "ally" ? "Aliado" : "Rival"}</b></>}
          </button>;
        })}
      </div>

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

    <section className={`panel ordered-recommendations ${quickMode ? "quick-v5" : ""}`}>
      <div className="section-title">
        <div>
          <span className="eyebrow">{nextTeam === "enemy" ? "Recomendación provisional para tu próximo turno" : analysis.draftStage}</span>
          <h2>{position === "First pick" ? "Prioridad de mapa" : position === "Last pick" ? "Castigo final" : "Counters a los picks rivales"}</h2>
        </div>
        <span className="status-pill">{position}</span>
      </div>
      <div className={`simple-rec-grid ${quickMode ? "quick-rec-grid" : ""}`}>
        <RecommendationCard result={best} label={bestLabel} tone="best" poolEntry={poolEntryFor(best)} />
        <RecommendationCard result={safe} label={safeLabel} tone="safe" poolEntry={poolEntryFor(safe)} />
        <RecommendationCard result={counter} label={counterLabel} tone="counter" poolEntry={poolEntryFor(counter)} />
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

    {!quickMode && (analysis.winEstimate ? <section className="panel ordered-win-panel">
      <div className="ordered-win-head">
        <div><span className="eyebrow">Probabilidad estimada</span><h2>{analysis.winEstimate.title}</h2><p>{analysis.winEstimate.completeness < 100 ? "Se actualiza con cada pick introducido." : "Draft 3v3 completo."}</p></div>
        <div><strong>{analysis.winEstimate.percentage}%</strong><span>{analysis.winEstimate.lower}–{analysis.winEstimate.upper}% · confianza {analysis.winEstimate.confidence}</span></div>
      </div>
      <div className="win-meter"><span style={{ width: `${analysis.winEstimate.percentage}%` }} /></div>
      <div className="ordered-win-scores">
        <span>Aliados <b>{analysis.winEstimate.alliedScore}/100</b></span>
        <span>Rivales <b>{analysis.winEstimate.enemyScore}/100</b></span>
        <span>Draft <b>{analysis.winEstimate.completeness}%</b></span>
      </div>
      <small>{analysis.winEstimate.disclaimer}</small>
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
          {analysis.needs.length ? analysis.needs.slice(0, 5).map((item) => <span key={item}>Cubrir: {item}</span>) : <span>La composición está equilibrada.</span>}
          {analysis.threats.slice(0, 3).map((item) => <span className="danger" key={item}>{item}</span>)}
          {analysis.strengths.slice(0, 3).map((item) => <span className="good" key={item}>{item}</span>)}
        </div>
      </article>

      <article className="panel">
        <span className="eyebrow">Matchups y líneas</span>
        <h3>Emparejamientos que debes buscar</h3>
        <div className="line-matchup-list">
          {analysis.teamAssignments.length
            ? analysis.teamAssignments.map((assignment, index) => <div key={`${assignment.ally}-${index}`}>
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
          {analysis.enemyWeaknesses.length ? analysis.enemyWeaknesses.slice(0, 5).map((item) => <span className="good" key={item}>{item}</span>) : <span>Faltan picks rivales para detectar una debilidad clara.</span>}
          {best?.exposedTo.slice(0, 3).map((name) => <span className="danger" key={name}>{name} puede frenar al pick recomendado.</span>)}
        </div>
      </article>
    </section>}
  </div>;
}
