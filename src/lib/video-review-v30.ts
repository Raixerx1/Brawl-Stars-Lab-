import type { VideoReviewEvent } from "./video-review";
import type { TeamStateWindow, VideoHudSnapshot, VideoStateMoment } from "./video-review-v26";
import { buildTeamStateWindowsV28 } from "./video-review-v28";
import {
  buildVideoStateReadoutV29,
  finalizeVideoHudSamplesV29,
  sampleVideoHudFrameV29,
  type VideoStateReadoutV29,
} from "./video-review-v29";

export type VideoStateReadoutV30 = VideoStateReadoutV29 & {
  acceptedSceneResets: number;
  ignoredSceneResets: number;
  fastWipeConversions: number;
  meanWipeConversionSeconds?: number;
  staggerOpportunities: number;
  staggerRate: number;
};

type SceneValidation = {
  events: VideoReviewEvent[];
  acceptedSceneResets: number;
  ignoredSceneResets: number;
};

const DEATH_KEYS = new Set(["death", "ally-death", "enemy-death"]);
const FRIENDLY_DEATH_KEYS = new Set(["death", "ally-death"]);

const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

function objectiveWindow(mode: string) {
  if (mode === "Balón Brawl") return 9;
  if (mode === "Atrapagemas") return 9;
  if (mode === "Zona Restringida") return 8;
  if (mode === "Atraco") return 8;
  if (mode === "Caza Estelar") return 7;
  return 8;
}

function fastConversionLimit(mode: string) {
  if (mode === "Balón Brawl") return 5;
  if (mode === "Atrapagemas") return 6;
  if (mode === "Zona Restringida") return 4;
  if (mode === "Atraco") return 4;
  if (mode === "Caza Estelar") return 5;
  return 5;
}

function sceneHasObjectiveContext(events: VideoReviewEvent[], second: number) {
  return events.some((event) =>
    event.key === "objective" &&
    event.confidence >= 60 &&
    Math.abs(event.second - second) <= 3.2
  );
}

function recentTrustedDeaths(events: VideoReviewEvent[], second: number, seconds = 8) {
  return events.filter((event) =>
    DEATH_KEYS.has(event.key) &&
    event.confidence >= 64 &&
    event.second <= second &&
    second - event.second <= seconds
  ).length;
}

/**
 * Un cambio visual fuerte no equivale siempre a un reset de ronda. v0.30 solo
 * permite que `scene` reinicie el modelo numérico cuando encaja con la lógica
 * del modo: wipe/fin de ronda en Noqueo o gol/objetivo en Balón Brawl.
 * En modos de respawn continuo se ignoran escenas para no inventar un 3v3.
 */
export function filterStateEventsV30(inputEvents: VideoReviewEvent[], mode: string): SceneValidation {
  const ordered = [...inputEvents].sort((a, b) => a.second - b.second);
  const events: VideoReviewEvent[] = [];
  let acceptedSceneResets = 0;
  let ignoredSceneResets = 0;

  for (const event of ordered) {
    if (DEATH_KEYS.has(event.key)) {
      if (event.confidence >= 64) events.push(event);
      continue;
    }
    if (event.key === "respawn") {
      if (event.confidence >= 58) events.push(event);
      continue;
    }
    if (event.key !== "scene") {
      events.push(event);
      continue;
    }

    const deaths = recentTrustedDeaths(ordered, event.second);
    const objectiveContext = sceneHasObjectiveContext(ordered, event.second);
    let accepted = false;

    if (event.confidence >= 58) {
      if (mode === "Noqueo") {
        accepted = deaths >= 2 || (deaths >= 1 && event.confidence >= 84);
      } else if (mode === "Balón Brawl") {
        accepted = objectiveContext || (deaths >= 2 && event.confidence >= 76);
      } else if (!["Atrapagemas", "Zona Restringida", "Atraco", "Caza Estelar"].includes(mode)) {
        accepted = deaths >= 2 && event.confidence >= 82;
      }
    }

    if (accepted) {
      acceptedSceneResets += 1;
      events.push(event);
    } else {
      ignoredSceneResets += 1;
    }
  }

  return { events, acceptedSceneResets, ignoredSceneResets };
}

export function buildTeamStateWindowsV30(
  inputEvents: VideoReviewEvent[],
  mode: string,
  duration: number,
): TeamStateWindow[] {
  return buildTeamStateWindowsV28(filterStateEventsV30(inputEvents, mode).events, mode, duration);
}

function wipeWindows(windows: TeamStateWindow[]) {
  return windows.filter((window) => window.enemyAlive === 0 && window.friendlyAlive > 0);
}

function firstObjectiveAfter(
  events: VideoReviewEvent[],
  startSecond: number,
  endSecond: number,
) {
  return events.find((event) =>
    event.key === "objective" &&
    event.confidence >= 60 &&
    event.second >= startSecond - .35 &&
    event.second <= endSecond
  );
}

function staggerOpportunities(windows: TeamStateWindow[]) {
  let opportunities = 0;
  for (let index = 1; index < windows.length; index += 1) {
    const previous = windows[index - 1];
    const current = windows[index];
    if (
      current.friendlyAlive > previous.friendlyAlive &&
      (previous.friendlyAlive === 0 || previous.friendlyAlive < previous.enemyAlive)
    ) opportunities += 1;
  }
  return opportunities;
}

function dedupeMoments(moments: VideoStateMoment[]) {
  const seen = new Set<string>();
  return moments.filter((moment) => {
    const key = `${Math.round(moment.second * 2)}:${moment.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildVideoStateReadoutV30(
  snapshots: VideoHudSnapshot[],
  inputEvents: VideoReviewEvent[],
  mode: string,
  duration: number,
): VideoStateReadoutV30 {
  const validated = filterStateEventsV30(inputEvents, mode);
  const ordered = [...validated.events].sort((a, b) => a.second - b.second);
  const base = buildVideoStateReadoutV29(snapshots, ordered, mode, duration);
  const windows = buildTeamStateWindowsV28(ordered, mode, duration);
  const wipes = wipeWindows(windows);
  const conversionSeconds: number[] = [];
  const moments: VideoStateMoment[] = [...base.moments];
  const maxWindow = objectiveWindow(mode);
  const fastLimit = fastConversionLimit(mode);

  if (mode !== "Noqueo") {
    for (const window of wipes) {
      const objective = firstObjectiveAfter(
        ordered,
        window.startSecond,
        Math.min(duration, window.endSecond + maxWindow),
      );
      if (!objective) continue;
      const delay = Math.max(0, objective.second - window.startSecond);
      conversionSeconds.push(delay);
      if (delay > fastLimit) {
        moments.push({
          second: Math.max(0, window.startSecond - 1.25),
          label: "Conversión tardía tras wipe",
          detail: `${window.label} sí convierte, pero la primera señal de objetivo/marcador llega ≈${Math.round(delay)} s después. Para ${mode}, revisa si había una línea segura de conversión antes.`,
          priority: "Media",
        });
      }
    }
  }

  const fastWipeConversions = mode === "Noqueo"
    ? base.teamWipesFor
    : conversionSeconds.filter((seconds) => seconds <= fastLimit).length;
  const meanWipeConversionSeconds = conversionSeconds.length
    ? Math.round(conversionSeconds.reduce((sum, seconds) => sum + seconds, 0) / conversionSeconds.length * 10) / 10
    : undefined;
  const opportunities = staggerOpportunities(windows);
  const staggerRate = percent(base.staggerDeaths, opportunities);

  const strengths = [...base.strengths];
  const risks = [...base.risks];
  const actions = [...base.actions];

  if (conversionSeconds.length >= 2 && meanWipeConversionSeconds !== undefined) {
    if (meanWipeConversionSeconds <= fastLimit) {
      strengths.unshift(`Cierre rápido tras wipe: la primera señal de objetivo llega en ≈${meanWipeConversionSeconds} s de media (${fastWipeConversions}/${conversionSeconds.length} conversiones dentro del umbral rápido).`);
    } else {
      risks.unshift(`Tempo tras wipe mejorable: la conversión visible tarda ≈${meanWipeConversionSeconds} s de media; el umbral rápido usado para ${mode} es ≤${fastLimit} s.`);
    }
  }

  if (opportunities >= 2 && base.staggerDeaths) {
    risks.unshift(`Stagger tras recuperación en ${base.staggerDeaths}/${opportunities} oportunidades (${staggerRate}%): patrón repetido, no solo una secuencia aislada.`);
  }

  if (validated.ignoredSceneResets > 0) {
    actions.push(`${validated.ignoredSceneResets} cambio(s) visual(es) fuerte(s) se ignoraron como reset porque no encajaban con la lógica de ${mode}; esto protege la reconstrucción 3v3 frente a transiciones falsas.`);
  }

  const trustedFriendlyDeaths = ordered.filter((event) => FRIENDLY_DEATH_KEYS.has(event.key)).length;
  if (trustedFriendlyDeaths >= 3 && opportunities === 0 && base.disadvantageSeconds > 12) {
    actions.push("Hay varias bajas propias/aliadas pero ninguna recuperación limpia reconstruida; corrige respawns o escenas si el replay muestra una reagrupación que el detector no captó.");
  }

  return {
    ...base,
    acceptedSceneResets: validated.acceptedSceneResets,
    ignoredSceneResets: validated.ignoredSceneResets,
    fastWipeConversions,
    meanWipeConversionSeconds,
    staggerOpportunities: opportunities,
    staggerRate,
    teamWindows: windows
      .filter((window) => window.label !== "3v3" || window.endSecond - window.startSecond >= 5)
      .slice(0, 24),
    moments: dedupeMoments(moments).sort((a, b) => a.second - b.second).slice(0, 18),
    strengths: strengths.slice(0, 7),
    risks: risks.slice(0, 10),
    actions: actions.slice(0, 10),
  };
}

export {
  finalizeVideoHudSamplesV29 as finalizeVideoHudSamplesV30,
  sampleVideoHudFrameV29 as sampleVideoHudFrameV30,
};
