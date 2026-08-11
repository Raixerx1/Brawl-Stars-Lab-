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
  QueueMode,
  MatchResult,
  PersonalMatch,
  PersonalPerformance,
} from "@/lib/types";
import { analyzeDraft } from "@/lib/draft-engine";
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
      <div><h3>{result.brawler.name}</h3><p>{result.brawler.role} Â· {result.suggestedLine}</p></div>
      <strong>{result.score}</strong>
    </div>
    <p className="simple-rec-brief">{result.brief}</p>
    {result.firstPickEvaluation && <div className="first-pick-evaluation-v12">
      <span><b>{result.firstPickEvaluation.initialFit}</b>Mapa inicial</span>
      <span><b>{result.firstPickEvaluation.afterBreakFit}</b>Tras wallbreak</span>
      <span><b>{result.firstPickEvaluation.blindQuality}</b>Seguridad ciega</span>
      <span><b>{result.firstPickEvaluation.modeUtility}</b>Utilidad del modo</span>
    </div>}
    {poolEntry && <div className="rec-pool-status">
      {poolEntry.favorite && <span>â˜… Prioritario</span>}
      {poolEntry.power11 && <span>F11</span>}
      {poolEntry.hypercharge && <span>HC</span>}
      <span>Dominio {poolEntry.mastery}/5</span>
      {!poolEntry.available && <span className="bad">No disponible</span>}
    </div>}
    {result.personalHistory && result.personalHistory.games >= 2 && <div className="personal-history-badge-v7">
      <span>{result.personalHistory.winRate}% personal</span>
      <small>{result.personalHistory.games} partidas{result.personalMapHistory && result.personalMapHistory.games >= 2 ? ` Â· ${result.personalMapHistory.winRate}% en este mapa` : ""}</small>
      {typeof result.personalAdjustment === "number" && Math.abs(result.personalAdjustment) >= 1 && <b className={result.personalAdjustment >= 0 ? "positive" : "negative"}>{result.personalAdjustment > 0 ? "+" : ""}{result.personalAdjustment}</b>}
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
    if (resolvedQueueMode && ["SoloQ", "DÃºo", "TrÃ­o"].includes(resolvedQueueMode)) setQueueMode(resolvedQueueMode);
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
      // Mantener la selecciÃ³n durante la sesiÃ³n aunque el navegador bloquee storage.
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
    setOrderedPicks((current) => current.map((pick, pickIndex) => pickIndex >= index ? null : pick));çÝ¶¶‰žËkºwµçp½ˆøñÍµ…±°ùí¥Ñ•´¹‰É…Ý±•È¹É½±•ôƒ
Üí¥Ñ•´¹ÍÕ•ÍÑ•‘1¥¹•ôð½Íµ…±°øð½‘¥Øø(€€€€€€€€€€ð½…ÉÑ¥±”ø¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘½Õ‰±”µÁ¥¬µµ•ÑÉ¥ÌµØÄÌˆø(€€€€€€€€€€ñÍÁ…¸øñˆùíÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹Íå¹•Éåôð½ˆùM¥¹•É¥„ð½ÍÁ…¸ø(€€€€€€€€€€ñÍÁ…¸øñˆùíÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹½Ù•É…•ôð½ˆù½‰•ÉÑÕÉ„ð½ÍÁ…¸ø(€€€€€€€€€€ñÍÁ…¸øñˆùíÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹½½É‘¥¹…Ñ¥½¹ôð½ˆù½½É‘¥¹…§Í¸ð½ÍÁ…¸ø(€€€€€€€€€€ñÍÁ…¸øñˆùíÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹±…¹•A±…¹ôð½ˆùA±…¸‘”³µ¹•…Ìð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€íÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹É¥Í­Ì¹±•¹Ñ €ø€À€˜˜€ñÍµ…±°±…ÍÍ9…µ”ô‰‘½Õ‰±”µÁ¥¬µÉ¥Í¬µØÄÌˆùI¥•Í¼èíÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹É¥Í­Ì¹©½¥¸ ˆƒ
Ü€ˆ¥ôð½Íµ…±°ùô(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘½Õ‰±”µÁ¥¬µ…Ñ¥½¹ÌµØÄÌˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø…‘‘9•áÑA¥¬¡Á…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹™¥ÉÍÐ¹‰É…Ý±•È¹¹…µ”¥ôùUÍ…ÈÁÉ¥µ•É¼ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø…ÁÁ±åA…¥È¡Á…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹™¥ÉÍÐ¹‰É…Ý±•È¹¹…µ”°Á…¥ÉI•½µµ•¹‘…Ñ¥½¹ÍlÁt¹Í•½¹¹‰É…Ý±•È¹¹…µ”¥ôø(€€€€€€€€€€€íÅÕ•Õ•5½‘”€ôôô€‰M½±½Dˆ€ü€‰M¥µÕ±…ÈÁ…É•©„ˆ€è€‰Á±¥…ÈÁ…É•©„‰ô(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€íÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹Ì¹±•¹Ñ €ø€Ä€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘½Õ‰±”µÁ¥¬µ…±Ñ•É¹…Ñ¥Ù•ÌµØÄÌˆø(€€€€€€€€€íÁ…¥ÉI•½µµ•¹‘…Ñ¥½¹Ì¹Í±¥” Ä°€Ð¤¹µ…À ¡Á…¥È¤€ôø€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€­•äõí€‘íÁ…¥È¹™¥ÉÍÐ¹‰É…Ý±•È¹Í±Õô´‘íÁ…¥È¹Í•½¹¹‰É…Ý±•È¹Í±Õõô(€€€€€€€€€€€½¹±¥¬õì ¤€ôø…ÁÁ±åA…¥È¡Á…¥È¹™¥ÉÍÐ¹‰É…Ý±•È¹¹…µ”°Á…¥È¹Í•½¹¹‰É…Ý±•È¹¹…µ”¥ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñˆùíÁ…¥È¹™¥ÉÍÐ¹‰É…Ý±•È¹¹…µ•ô€¬íÁ…¥È¹Í•½¹¹‰É…Ý±•È¹¹…µ•ôð½ˆø(€€€€€€€€€€€€ñÍµ…±°ùíÁ…¥È¹Í½É•ô¼ÄÀÀƒ
ÜíÁ…¥È¹É•…Í½¹ÍlÁtñð€‰A…É•©„•ÅÕ¥±¥‰É…‘„‰ôð½Íµ…±°ø(€€€€€€€€€€ð½‰ÕÑÑ½¸ø¥ô(€€€€€€€€ð½‘¥Øùô(€€€€€€ð½‘¥Øùô((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí½µµ½¸µÁ¥¬µ•¹ÑÉä€‘í¹•áÑQ•…´€ôôô€‰…±±äˆ€ü€‰…±±äˆ€è€‰•¹•µä‰õôø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆùí¹•áÑ%¹‘•à€ð€À€ü€‰É…™Ð½µÁ±•Ñ¼ˆ€èA¥¬€‘í¹•áÑ%¹‘•à€¬€Åôƒ
Ü€‘í¹•áÑQ•…´€ôôô€‰…±±äˆ€ü€‰±¥…‘¼ˆ€è€‰I¥Ù…°‰õôð½ÍÁ…¸ø(€€€€€€€€€€ñ Ìùí¹•áÑ%¹‘•à€ð€À€ü€‰1½ÌÍ•¥ÌÁ¥­Ì•ÍÓ…¸½µÁ±•Ñ½Ìˆ€èÅ…‘¥ÈÍ¥Õ¥•¹Ñ”Á¥¬€‘í¹•áÑQ•…´€ôôô€‰…±±äˆ€ü€‰…±¥…‘¼ˆ€è€‰É¥Ù…°‰õôð½ Ìø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½µµ½¸µÁ¥¬µÍ•…É ˆø(€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€Ù…±Õ”õíÅÕ•Éåô(€€€€€€€€€€€‘¥Í…‰±•õí¹•áÑ%¹‘•à€ð€Áô(€€€€€€€€€€€½¹½ÕÌõì ¤€ôøÍ•Ñ½ÕÍ•¡ÑÉÕ”¥ô(€€€€€€€€€€€½¹	±ÕÈõì ¤€ôøÝ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ  ¤€ôøÍ•Ñ½ÕÍ•¡™…±Í”¤°€ÄÈÀ¥ô(€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑEÕ•Éä¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€½¹-•å½Ý¸õí¡…¹‘±•-•å½Ý¹ô(€€€€€€€€€€€Á±…•¡½±‘•Èõí¹•áÑ%¹‘•à€ð€À€ü€‰É…™Ð½µÁ±•Ñ¼ˆ€è€‰	ÕÍ…È‰É…Ý±•ËŠ˜‰ô(€€€€€€€€€€¼ø(€€€€€€€€€í™½ÕÍ•€˜˜¹•áÑ%¹‘•à€øô€À€˜˜ÍÕ•ÍÑ¥½¹Ì¹±•¹Ñ €ø€À€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰½µµ½¸µÁ¥¬µÍÕ•ÍÑ¥½¹Ìˆø(€€€€€€€€€€€íÍÕ•ÍÑ¥½¹Ì¹µ…À ¡‰É…Ý±•È¤€ôø€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ­•äõí‰É…Ý±•È¹Í±Õô½¹5½ÕÍ•½Ý¸õì ¤€ôø…‘‘9•áÑA¥¬¡‰É…Ý±•È¹¹…µ”¥ôø(€€€€€€€€€€€€€€ñ	É…Ý±•ÉA½ÉÑÉ…¥Ð¹…µ”õí‰É…Ý±•È¹¹…µ•ô±…ÍÍ9…µ”ô‰ÍÕ•ÍÑ¥½¸µ…Ù…Ñ…Èˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸øñˆùí‰É…Ý±•È¹¹…µ•ôð½ˆøñÍµ…±°ùí‰É…Ý±•È¹É½±•ôƒ
Üí‰É…Ý±•È¹Ñ¥•Éôð½Íµ…±°øð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€ð½‘¥Øùô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÍÑÉ½¹œ±…ÍÍ9…µ”õíÑÕÉ¸µÍÑ…ÑÕÌ€‘í¹•áÑQ•…´€ôôô€‰…±±äˆ€ü€‰…±±äˆ€è€‰•¹•µä‰õôø(€€€€€€€€€í¹•áÑ%¹‘•à€ð€À(€€€€€€€€€€€€ü€‰¥¹…±¥é…‘¼ˆ(€€€€€€€€€€€€è¹•áÑQ•…´€ôôô€‰…±±äˆ(€€€€€€€€€€€€€€üÁ½Í¥Ñ¥½¸€ôôô€‰¥ÉÍÐÁ¥¬ˆ€ü€‰±¥”Õ¸Á¥¬ÏÍ±¥‘¼ˆ€èÁ½Í¥Ñ¥½¸€ôôô€‰1…ÍÐÁ¥¬ˆ€ü€‰	ÕÍ„•°·…á¥µ¼½Õ¹Ñ•Èˆ€è€‰½Õ¹Ñ•É•„ä½µÁ±•Ñ„ˆ(€€€€€€€€€€€€€€è€‰%¹ÑÉ½‘Õ”•°Á¥¬É¥Ù…°‰ô(€€€€€€€€ð½ÍÑÉ½¹œø(€€€€€€ð½‘¥Øø(€€€€€€ñÍµ…±°±…ÍÍ9…µ”ô‰½É‘•É•µ•‘¥Ðµ¡¥¹ÐˆùAÕ±Í„Õ¸Á¥¬å„¥¹ÑÉ½‘Õ¥‘¼Á…É„½ÉÉ•¥É±¼ìÍ”‰½ÉÉ…Ë…¸Ñ…µ‰§¥¸±½ÌÁ¥­ÌÁ½ÍÑ•É¥½É•Ì¸ð½Íµ…±°ø(€€€€ð½Í•Ñ¥½¸ø((€€€í¹•áÑ%¹‘•à€ð€À€˜˜…±±¥•Ì¹±•¹Ñ €ôôô€Ì€˜˜•¹•µ¥•Ì¹±•¹Ñ €ôôô€Ì€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°‘É…™ÐµÉ•ÍÕ±ÐµÁ…¹•°µØÜˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùÁÉ•¹‘¥é…©”Á•ÉÍ½¹…°ð½ÍÁ…¸øñ ÈùÕ…É‘…ÈÉ•ÍÕ±Ñ…‘¼‘•°‘É…™Ðð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÌµÁ¥±°ˆøÌÙÌ€Ì½µÁ±•Ñ¼ð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘É…™ÐµÉ•ÍÕ±Ðµ™½É´µØÜˆø(€€€€€€€€ñ±…‰•°û
ýE×¤‰É…Ý±•È©Õ…ÍÑ”üñÍ•±•ÐÙ…±Õ”õíÁ±…å•‘	É…Ý±•Éô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑA±…å•‘	É…Ý±•È¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ôøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆùM•±•¥½¹…È…±¥…‘¿Š˜ð½½ÁÑ¥½¸ùí…±±¥•Ì¹µ…À ¡…±±ä¤€ôø€ñ½ÁÑ¥½¸­•äõí…±±åôùí…±±åôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½±…‰•°ø(€€€€€€€€ñ±…‰•°ùI•ÍÕ±Ñ…‘¼ñÍ•±•ÐÙ…±Õ”õíµ…Ñ¡I•ÍÕ±Ñô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…Ñ¡I•ÍÕ±Ð¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”…Ì5…Ñ¡I•ÍÕ±Ð¥ôøñ½ÁÑ¥½¸ùY¥Ñ½É¥„ð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù•ÉÉ½Ñ„ð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°ø(€€€€€€€€ñ±…‰•°ù9½Ñ„Ë…Á¥‘„ñ¥¹ÁÕÐÙ…±Õ”õíµ…Ñ¡9½Ñ•ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…Ñ¡9½Ñ”¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‰5…Ñ¡ÕÀ°•ÉÉ½È¼…¥•ÉÑ¼±…Ù”ˆ€¼øð½±…‰•°ø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ‘¥Í…‰±•õì…Á±…å•‘	É…Ý±•Éô½¹±¥¬õíÍ…Ù•É…™ÑI•ÍÕ±ÑôùÕ…É‘…Èä…ÁÉ•¹‘•Èð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñÍµ…±°ù1„É•½µ•¹‘…§Í¸Á•ÉÍ½¹…°Í”…©ÕÍÑ„‘”™½Éµ„É…‘Õ…°ìÕ¹„Í½±„Á…ÉÑ¥‘„¹¼…µ‰¥„Í¥¹¥™¥…Ñ¥Ù…µ•¹Ñ”•°É…¹­¥¹œ¸ð½Íµ…±°ø(€€€€ð½Í•Ñ¥½¸ùô((€€€í¹•áÑ¹•µå%¹‘•à€øô€À€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÁ…¹•°‘É…™ÐµÍ¥µÕ±…Ñ½ÈµØØ€‘íÍ•¹…É¥½¹•µä€ü€‰Í•¹…É¥¼µ…Ñ¥Ù”ˆ€è€ˆ‰õôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùM¥µÕ±…‘½È‘•°É¥Ù…°ð½ÍÁ…¸ø(€€€€€€€€€€ñ Èû
ýE×¤Á…Í„Í¤•°É¥Ù…°•±¥—Š˜üð½ Èø(€€€€€€€€ð½‘¥Øø(€€€€€€€íÍ•¹…É¥½¹•µä€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸½µÁ…Ðµ‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑM•¹…É¥½¹•µä ˆˆ¥ôù•ÉÉ…ÈÍ¥µÕ±…§Í¸ð½‰ÕÑÑ½¸ùô(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ•‘¥Ñ¥½¸µÍÑÉ¥Àˆø(€€€€€€€íÁÉ•‘¥Ñ•‘¹•µåA¥­Ì¹µ…À ¡ÁÉ•‘¥Ñ¥½¸°¥¹‘•à¤€ôø€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”õí¹½Éµ…±¥é”¡Í•¹…É¥½¹•µä¤€ôôô¹½Éµ…±¥é”¡ÁÉ•‘¥Ñ¥½¸¹‰É…Ý±•È¹¹…µ”¤€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€­•äõíÁÉ•‘¥Ñ¥½¸¹‰É…Ý±•È¹Í±Õô(€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑM•¹…É¥½¹•µä¡ÁÉ•‘¥Ñ¥½¸¹‰É…Ý±•È¹¹…µ”¥ô(€€€€€€€€ø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰ÁÉ•‘¥Ñ¥½¸µÉ…¹¬ˆùí¥¹‘•à€¬€Åôð½ÍÁ…¸ø(€€€€€€€€€€ñ	É…Ý±•ÉA½ÉÑÉ…¥Ð¹…µ”õíÁÉ•‘¥Ñ¥½¸¹‰É…Ý±•È¹¹…µ•ô±…ÍÍ9…µ”ô‰ÁÉ•‘¥Ñ¥½¸µ…Ù…Ñ…Èˆ€¼ø(€€€€€€€€€€ñ‘¥ØøñˆùíÁÉ•‘¥Ñ¥½¸¹‰É…Ý±•È¹¹…µ•ôð½ˆøñÍµ…±°ùíÁÉ•‘¥Ñ¥½¸¹É•…Í½¹ôð½Íµ…±°øð½‘¥Øø(€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ•‘¥Ñ¥½¸¹Í½É•ôð½ÍÑÉ½¹œø(€€€€€€€€ð½‰ÕÑÑ½¸ø¥ô(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µÍ•±•Ñ½ÈµÉ½Üˆø(€€€€€€€€ñ±…‰•°ùM¥µÕ±…È½ÑÉ¼‰É…Ý±•ÈñÍ•±•ÐÙ…±Õ”õíÍ•¹…É¥½¹•µåô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑM•¹…É¥½¹•µä¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ôø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆùM•±•¥½¹…ËŠ˜ð½½ÁÑ¥½¸ø(€€€€€€€€€íÍ•¹…É¥½…¹‘¥‘…Ñ•Ì¹µ…À ¡‰É…Ý±•È¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”õí‰É…Ý±•È¹¹…µ•ô­•äõí‰É…Ý±•È¹Í±Õôùí‰É…Ý±•È¹¹…µ•ôƒ
Üí‰É…Ý±•È¹É½±•ôð½½ÁÑ¥½¸ø¥ô(€€€€€€€€ð½Í•±•Ðøð½±…‰•°ø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸ùAËÍá¥µ¼¡Õ•¼É¥Ù…°ð½ÍÁ…¸ø(€€€€€€€€€€ñˆùí¹•áÑ¹•µå%¹‘•à€¬€Åôƒ
ÜíÁ¡…Í•1…‰•°¡¹•áÑ¹•µå%¹‘•à¥ôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø((€€€€€íÍ•¹…É¥½¹•µä€˜˜Í•¹…É¥½¹…±åÍ¥Ì€˜˜Í•¹…É¥½I•ÍÁ½¹Í”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µÉ•ÍÕ±ÐµÉ¥ˆø(€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Í•¹…É¥¼µÑ¡É•…Ðµ…Éˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆùµ•¹…é„Í¥µÕ±…‘„ð½ÍÁ…¸ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µ‰É…Ý±•Èµ¡•…ˆø(€€€€€€€€€€€€ñ	É…Ý±•ÉA½ÉÑÉ…¥Ð¹…µ”õíÍ•¹…É¥½¹•µåô±…ÍÍ9…µ”ô‰Í•¹…É¥¼µµ…¥¸µ…Ù…Ñ…Èˆ€¼ø(€€€€€€€€€€€€ñ‘¥Øøñ ÌùíÍ•¹…É¥½¹•µåôð½ ÌøñÀùíÍ•¹…É¥½AÉ•‘¥Ñ¥½¸ü¹É•…Í½¸ñð€‰Í•¹…É¥¼µ…¹Õ…°Í•±•¥½¹…‘¼‰ôð½Àøð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€íÍ•¹…É¥½AÉ•‘¥Ñ¥½¸ü¹Ñ…É•Ð€˜˜€ñÍÑÉ½¹œùAÕ•‘”…ÍÑ¥…È„íÍ•¹…É¥½AÉ•‘¥Ñ¥½¸¹Ñ…É•Ñôð½ÍÑÉ½¹œùô(€€€€€€€€€€ñÍµ…±°ùíÍ•¹…É¥½AÉ•‘¥Ñ¥½¸ü¹É•ÍÁ½¹Í”ñð€‰°…Í¥ÍÑ•¹Ñ”É•…±Õ±„±„É•ÍÁÕ•ÍÑ„ƒÍÁÑ¥µ„½¸•°‘É…™Ð…ÑÕ…°¸‰ôð½Íµ…±°ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µ…Ñ¥½¹Ìˆø(€€€€€€€€€€€í¹•áÑ¹•µå%¹‘•à€ôôô¹•áÑ%¹‘•à€˜˜¹•áÑQ•…´€ôôô€‰•¹•µäˆ€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹™¥ÉµM•¹…É¥½ôù½¹™¥Éµ…ÈÁ¥¬É¥Ù…°ð½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí‰…¹Ì¹±•¹Ñ €øô€Ùô½¹±¥¬õì ¤€ôø…‘‘MÕ•ÍÑ•‘	…¸¡Í•¹…É¥½¹•µä¥ôùÅ…‘¥È„‰…¹Ìð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½…ÉÑ¥±”ø((€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Í•¹…É¥¼µÉ•ÍÁ½¹Í”µ…Éˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùI•ÍÁÕ•ÍÑ„É•½µ•¹‘…‘„ð½ÍÁ…¸ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µ‰É…Ý±•Èµ¡•…ˆø(€€€€€€€€€€€€ñ	É…Ý±•ÉA½ÉÑÉ…¥Ð¹…µ”õíÍ•¹…É¥½I•ÍÁ½¹Í”¹‰É…Ý±•È¹¹…µ•ô±…ÍÍ9…µ”ô‰Í•¹…É¥¼µµ…¥¸µ…Ù…Ñ…Èˆ€¼ø(€€€€€€€€€€€€ñ‘¥Øøñ ÌùíÍ•¹…É¥½I•ÍÁ½¹Í”¹‰É…Ý±•È¹¹…µ•ôð½ ÌøñÀùíÍ•¹…É¥½I•ÍÁ½¹Í”¹‰É¥•™ôð½Àøð½‘¥Øø(€€€€€€€€€€€€ñÍÑÉ½¹œùíÍ•¹…É¥½I•ÍÁ½¹Í”¹Í½É•ôð½ÍÑÉ½¹œø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µÉ•ÍÁ½¹Í”µ‘•Ñ…¥±Ìˆø(€€€€€€€€€€€€ñÍÁ…¸øñˆù3µ¹•„ð½ˆùíÍ•¹…É¥½I•ÍÁ½¹Í”¹±…¹•A±…¸¹±…¹•ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸øñˆù=‰©•Ñ¥Ù¼ð½ˆùíÍ•¹…É¥½I•ÍÁ½¹Í”¹±…¹•A±…¸¹Ñ…É•Ðñð€‰½µÁ±•Ñ…È½µÁ½Í¥§Í¸‰ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸øñˆù	Õ¥±ð½ˆùíÍ•¹…É¥½I•ÍÁ½¹Í”¹‰Õ¥±¹•…ÉÌ¹©½¥¸ ˆ€¬€ˆ¥ôð½ÍÁ…¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€íÍ•¹…É¥½±Ñ•É¹…Ñ¥Ù•Ì¹±•¹Ñ €ø€À€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•¹…É¥¼µ…±Ñ•É¹…Ñ¥Ù•Ìˆø(€€€€€€€€€€€€ñˆù±Ñ•É¹…Ñ¥Ù…Ìð½ˆø(€€€€€€€€€€€íÍ•¹…É¥½±Ñ•É¹…Ñ¥Ù•Ì¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸­•äõí¥Ñ•´¹‰É…Ý±•È¹Í±Õôùí¥Ñ•´¹‰É…Ý±•È¹¹…µ•ôƒ
Üí¥Ñ•´¹½Õ¹Ñ•É1…‰•±ôð½ÍÁ…¸ø¥ô(€€€€€€€€€€ð½‘¥Øùô(€€€€€€€€ð½…ÉÑ¥±”ø((€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Í•¹…É¥¼µ¥µÁ…Ðµ…Éˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù%µÁ…Ñ¼•ÍÑ¥µ…‘¼ð½ÍÁ…¸ø(€€€€€€€€€íÑåÁ•½˜Í•¹…É¥½]¥¸€ôôô€‰¹Õµ‰•Èˆ€ü€ðø(€€€€€€€€€€€€ñÍÑÉ½¹œùíÍ•¹…É¥½]¥¹ô”ð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÀùAÉ½‰…‰¥±¥‘……±¥…‘„½¸íÍ•¹…É¥½¹•µåôð½Àø(€€€€€€€€€€€íÑåÁ•½˜Í•¹…É¥½•±Ñ„€ôôô€‰¹Õµ‰•Èˆ€˜˜€ñÍÁ…¸±…ÍÍ9…µ”õíÍ•¹…É¥½•±Ñ„€ð€À€ü€‰¹•…Ñ¥Ù”ˆ€èÍ•¹…É¥½•±Ñ„€ø€À€ü€‰Á½Í¥Ñ¥Ù”ˆ€è€ˆ‰ôø(€€€€€€€€€€€€€íÍ•¹…É¥½•±Ñ„€ø€À€ü€ˆ¬ˆ€è€ˆ‰õíÍ•¹…É¥½•±Ñ…ôÁÕ¹Ñ½Ì™É•¹Ñ”…°•Í•¹…É¥¼…ÑÕ…°(€€€€€€€€€€€€ð½ÍÁ…¸ùô(€€€€€€€€€€ð¼ø€è€ðø(€€€€€€€€€€€€ñÍÑÉ½¹œûŠPð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÀùÅ…‘”…°µ•¹½ÌÕ¸Á¥¬…±¥…‘¼Á…É„•ÍÑ¥µ…È•°¥µÁ…Ñ¼¸ð½Àø(€€€€€€€€€€ð¼ùô(€€€€€€€€€€ñÍµ…±°ùÌÕ¹„•ÍÑ¥µ…§Í¸¡•ÕËµÍÑ¥„°¹¼Õ¸Ý¥¸É…Ñ”½‰Í•ÉÙ…‘¼¸ð½Íµ…±°ø(€€€€€€€€ð½…ÉÑ¥±”ø(€€€€€€ð½‘¥Øùô(€€€€ð½Í•Ñ¥½¸ùô((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÁ…¹•°½É‘•É•µÉ•½µµ•¹‘…Ñ¥½¹Ì€‘íÅÕ¥­5½‘”€ü€‰ÅÕ¥¬µØÔˆ€è€ˆ‰õôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùíÍ•¹…É¥½¹•µä€üM¥µÕ±…§Í¸…Ñ¥Ù„ƒ
Ü€‘íÍ•¹…É¥½¹•µåõ€€è¹•áÑQ•…´€ôôô€‰•¹•µäˆ€ü€‰I•½µ•¹‘…§Í¸ÁÉ½Ù¥Í¥½¹…°Á…É„ÑÔÁËÍá¥µ¼ÑÕÉ¹¼ˆ€è‘¥ÍÁ±…å¹…±åÍ¥Ì¹‘É…™ÑMÑ…•ôð½ÍÁ…¸ø(€€€€€€€€€€ñ ÈùíÍ•¹…É¥½¹•µä€üI•ÍÁÕ•ÍÑ„Í¤É¥Ù…°•±¥”€‘íÍ•¹…É¥½¹•µåõ€€è‘¥ÍÁ±…åA½Í¥Ñ¥½¸€ôôô€‰¥ÉÍÐÁ¥¬ˆ€ü€‰AÉ¥½É¥‘…‘”µ…Á„ˆ€è‘¥ÍÁ±…åA½Í¥Ñ¥½¸€ôôô€‰1…ÍÐÁ¥¬ˆ€ü€‰…ÍÑ¥¼™¥¹…°ˆ€è€‰½Õ¹Ñ•ÉÌ„±½ÌÁ¥­ÌÉ¥Ù…±•Ì‰ôð½ Èø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÌµÁ¥±°ˆùí‘¥ÍÁ±…åA½Í¥Ñ¥½¹ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍ¥µÁ±”µÉ•ŒµÉ¥€‘íÅÕ¥­5½‘”€ü€‰ÅÕ¥¬µÉ•ŒµÉ¥ˆ€è€ˆ‰õôø(€€€€€€€€ñI•½µµ•¹‘…Ñ¥½¹…ÉÉ•ÍÕ±Ðõí‰•ÍÑô±…‰•°õí‰•ÍÑ1…‰•±ôÑ½¹”ô‰‰•ÍÐˆÁ½½±¹ÑÉäõíÁ½½±¹ÑÉå½È¡‰•ÍÐ¥ô€¼ø(€€€€€€€€ñI•½µµ•¹‘…Ñ¥½¹…ÉÉ•ÍÕ±ÐõíÍ…™•ô±…‰•°õíÍ…™•1…‰•±ôÑ½¹”ô‰Í…™”ˆÁ½½±¹ÑÉäõíÁ½½±¹ÑÉå½È¡Í…™”¥ô€¼ø(€€€€€€€€ñI•½µµ•¹‘…Ñ¥½¹…ÉÉ•ÍÕ±Ðõí½Õ¹Ñ•Éô±…‰•°õí½Õ¹Ñ•É1…‰•±ôÑ½¹”ô‰½Õ¹Ñ•ÈˆÁ½½±¹ÑÉäõíÁ½½±¹ÑÉå½È¡½Õ¹Ñ•È¥ô€¼ø(€€€€€€ð½‘¥Øø(€€€€€í‰•ÍÐ€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰½¹Ñ•áÑÕ…°µ‰Õ¥±µÁ…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½¹Ñ•áÑÕ…°µ‰Õ¥±µÑ¥Ñ±”ˆø(€€€€€€€€€€ñ	É…Ý±•ÉA½ÉÑÉ…¥Ð¹…µ”õí‰•ÍÐ¹‰É…Ý±•È¹¹…µ•ô±…ÍÍ9…µ”ô‰½¹Ñ•áÑÕ…°µ‰Õ¥±µ…Ù…Ñ…Èˆ€¼ø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù	Õ¥±½¹Ñ•áÑÕ…°ƒ
Üí‰•ÍÐ¹‰É…Ý±•È¹¹…µ•ôð½ÍÁ…¸øñ Ìùí‰•ÍÐ¹±…¹•A±…¸¹±…¹•õí‰•ÍÐ¹±…¹•A±…¸¹Ñ…É•Ð€ü€ƒŠH‰ÕÍ„„€‘í‰•ÍÐ¹±…¹•A±…¸¹Ñ…É•Ñõ€€è€ˆ‰ôð½ ÌøñÀùí‰•ÍÐ¹±…¹•A±…¸¹¥¹ÍÑÉÕÑ¥½¹ôð½Àøð½‘¥Øø(€€€€€€€€€í‰•ÍÑA½½±¹ÑÉä€˜˜Á½½±A½±¥ä€„ôô€‰=™˜ˆ€˜˜€ñÍÑÉ½¹œùí‰•ÍÑA½½±¹ÑÉä¹™…Ù½É¥Ñ”€ü€‹Šb€ˆ€è€ˆ‰õí‰•ÍÑA½½±¹ÑÉä¹µ…ÍÑ•Éåô¼Ôð½ÍÑÉ½¹œùô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½¹Ñ•áÑÕ…°µ‰Õ¥±µÉ¥ˆø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸ù…‘•Ðð½ÍÁ…¸øñˆùí‰•ÍÐ¹‰Õ¥±¹…‘•Ñôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸ù!…‰¥±¥‘…•ÍÑ•±…Èð½ÍÁ…¸øñˆùí‰•ÍÐ¹‰Õ¥±¹ÍÑ…ÉA½Ý•Éôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸ù¹É…¹…©•Ìð½ÍÁ…¸øñˆùí‰•ÍÐ¹‰Õ¥±¹•…ÉÌ¹©½¥¸ ˆ€¬€ˆ¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸ù!¥Á•É…É„ð½ÍÁ…¸øñˆùí‰•ÍÐ¹‰Õ¥±¹¡åÁ•É¡…É•ôð½ˆøð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÍµ…±°ùí‰•ÍÐ¹‰Õ¥±¹É•…Í½¹ôð½Íµ…±°ø(€€€€€€ð½‘¥Øùô(€€€€ð½Í•Ñ¥½¸ø((€€€ì…ÅÕ¥­5½‘”€˜˜€¡‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”€ü€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°½É‘•É•µÝ¥¸µÁ…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½É‘•É•µÝ¥¸µ¡•…ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùíÍ•¹…É¥½¹•µä€üAÉ½‰…‰¥±¥‘…½¸€‘íÍ•¹…É¥½¹•µåõ€€è€‰AÉ½‰…‰¥±¥‘…•ÍÑ¥µ…‘„‰ôð½ÍÁ…¸øñ Èùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹Ñ¥Ñ±•ôð½ ÈøñÀùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹½µÁ±•Ñ•¹•ÍÌ€ð€ÄÀÀ€ü€‰M”…ÑÕ…±¥é„½¸…‘„Á¥¬¥¹ÑÉ½‘Õ¥‘¼¸ˆ€è€‰É…™Ð€ÍØÌ½µÁ±•Ñ¼¸‰ôð½Àøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÑÉ½¹œùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹Á•É•¹Ñ…•ô”ð½ÍÑÉ½¹œøñÍÁ…¸ùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹±½Ý•É÷ŠMí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹ÕÁÁ•Éô”ƒ
Ü½¹™¥…¹é„í‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹½¹™¥‘•¹•ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ý¥¸µµ•Ñ•ÈˆøñÍÁ…¸ÍÑå±”õíìÝ¥‘Ñ è€‘í‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹Á•É•¹Ñ…•ô•€õô€¼øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½É‘•É•µÝ¥¸µÍ½É•Ìˆø(€€€€€€€€ñÍÁ…¸ù±¥…‘½Ì€ñˆùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹…±±¥•‘M½É•ô¼ÄÀÀð½ˆøð½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸ùI¥Ù…±•Ì€ñˆùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹•¹•µåM½É•ô¼ÄÀÀð½ˆøð½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸ùÉ…™Ð€ñˆùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹½µÁ±•Ñ•¹•ÍÍô”ð½ˆøð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñÍµ…±°ùí‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ý¥¹ÍÑ¥µ…Ñ”¹‘¥Í±…¥µ•Éôð½Íµ…±°ø(€€€€ð½Í•Ñ¥½¸ø€è€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°½É‘•É•µÝ¥¸µ•µÁÑäˆø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùAÉ½‰…‰¥±¥‘…•ÍÑ¥µ…‘„ð½ÍÁ…¸ø(€€€€€€ñ ÈùÅ…‘”…°µ•¹½ÌÕ¸Á¥¬‘”…‘„•ÅÕ¥Á¼ð½ Èø(€€€€€€ñÀù°…±Õ±¼…Á…É••Ë„Õ…¹‘¼•á¥ÍÑ„¥¹™½Éµ…§Í¸‘”…µ‰½Ì±…‘½Ìä…¹…Ë„ÁÉ•¥Í§Í¸…°½µÁ±•Ñ…È•°‘É…™Ð¸ð½Àø(€€€€ð½Í•Ñ¥½¸ø¥ô((€€€ì…ÅÕ¥­5½‘”€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰½É‘•É•µ½…¡¥¹œµÉ¥ˆø(€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°ˆø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù½¹Í•©½ÌË…Á¥‘½Ìð½ÍÁ…¸ø(€€€€€€€€ñ ÌùE×¤¹••Í¥Ñ„ÑÔ½µÁ½Í¥§Í¸ð½ Ìø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÕ¥¬µ…‘Ù¥”µ±¥ÍÐˆø(€€€€€€€€€í‘¥ÍÁ±…å¹…±åÍ¥Ì¹¹••‘Ì¹±•¹Ñ €ü‘¥ÍÁ±…å¹…±åÍ¥Ì¹¹••‘Ì¹Í±¥” À°€Ô¤¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸­•äõí¥Ñ•µôùÕ‰É¥Èèí¥Ñ•µôð½ÍÁ…¸ø¤€è€ñÍÁ…¸ù1„½µÁ½Í¥§Í¸•ÍÓ„•ÅÕ¥±¥‰É…‘„¸ð½ÍÁ…¸ùô(€€€€€€€€€í‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ñ¡É•…ÑÌ¹Í±¥” À°€Ì¤¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸±…ÍÍ9…µ”ô‰‘…¹•Èˆ­•äõí¥Ñ•µôùí¥Ñ•µôð½ÍÁ…¸ø¥ô(€€€€€€€€€í‘¥ÍÁ±…å¹…±åÍ¥Ì¹ÍÑÉ•¹Ñ¡Ì¹Í±¥” À°€Ì¤¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸±…ÍÍ9…µ”ô‰½½ˆ­•äõí¥Ñ•µôùí¥Ñ•µôð½ÍÁ…¸ø¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€ð½…ÉÑ¥±”ø((€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°ˆø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù5…Ñ¡ÕÁÌä³µ¹•…Ìð½ÍÁ…¸ø(€€€€€€€€ñ ÌùµÁ…É•©…µ¥•¹Ñ½ÌÅÕ”‘•‰•Ì‰ÕÍ…Èð½ Ìø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥¹”µµ…Ñ¡ÕÀµ±¥ÍÐˆø(€€€€€€€€€í‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ñ•…µÍÍ¥¹µ•¹ÑÌ¹±•¹Ñ (€€€€€€€€€€€€ü‘¥ÍÁ±…å¹…±åÍ¥Ì¹Ñ•…µÍÍ¥¹µ•¹ÑÌ¹µ…À ¡…ÍÍ¥¹µ•¹Ð°¥¹‘•à¤€ôø€ñ‘¥Ø­•äõí€‘í…ÍÍ¥¹µ•¹Ð¹…±±åô´‘í¥¹‘•áõôø(€€€€€€€€€€€€€€ñˆùí…ÍÍ¥¹µ•¹Ð¹…±±åôð½ˆø(€€€€€€€€€€€€€€ñÍÁ…¸ùí…ÍÍ¥¹µ•¹Ð¹±…¹•ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÑÉ½¹œùí…ÍÍ¥¹µ•¹Ð¹•¹•µä€ü	ÕÍ„„€‘í…ÍÍ¥¹µ•¹Ð¹•¹•µåõ€€è€‰5…¹Ó¥¸ÑÔ³µ¹•„‰ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€ñÍµ…±°ùí…ÍÍ¥¹µ•¹Ð¹¥¹ÍÑÉÕÑ¥½¹ôð½Íµ…±°ø(€€€€€€€€€€€€ð½‘¥Øø¤(€€€€€€€€€€€€è€ñÀùÅ…‘”·…ÌÁ¥­ÌÁ…É„•¹•É…È•°Á±…¸‘”³µ¹•…Ì¸ð½Àùô(€€€€€€€€ð½‘¥Øø(€€€€€€ð½…ÉÑ¥±”ø((€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°ˆø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù1•ÑÕÉ„É¥Ù…°ð½ÍÁ…¸ø(€€€€€€€€ñ Ìù•‰¥±¥‘…‘•Ìä…µ•¹…é…Ìð½ Ìø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÕ¥¬µ…‘Ù¥”µ±¥ÍÐˆø(€€€€€€€€€í‘¥ÍÁ±…å¹…±åÍ¥Ì¹•¹•µå]•…­¹•ÍÍ•Ì¹±•¹Ñ €ü‘¥ÍÁ±…å¹…±åÍ¥Ì¹•¹•µå]•…­¹•ÍÍ•Ì¹Í±¥” À°€Ô¤¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸±…ÍÍ9…µ”ô‰½½ˆ­•äõí¥Ñ•µôùí¥Ñ•µôð½ÍÁ…¸ø¤€è€ñÍÁ…¸ù…±Ñ…¸Á¥­ÌÉ¥Ù…±•ÌÁ…É„‘•Ñ•Ñ…ÈÕ¹„‘•‰¥±¥‘…±…É„¸ð½ÍÁ…¸ùô(€€€€€€€€€í‰•ÍÐü¹•áÁ½Í•‘Q¼¹Í±¥” À°€Ì¤¹µ…À ¡¹…µ”¤€ôø€ñÍÁ…¸±…ÍÍ9…µ”ô‰‘…¹•Èˆ­•äõí¹…µ•ôùí¹…µ•ôÁÕ•‘”™É•¹…È…°Á¥¬É•½µ•¹‘…‘¼¸ð½ÍÁ…¸ø¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€ð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ùô(€€ð½‘¥Øøì)ô(