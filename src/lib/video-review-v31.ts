import type { VideoReviewEvent } from "./video-review";
import type { TeamStateWindow, VideoHudSnapshot, VideoStateMoment } from "./video-review-v26";
import {
  buildTeamStateWindowsV30,
  buildVideoStateReadoutV30,
  filterStateEventsV30,
  finalizeVideoHudSamplesV30,
  sampleVideoHudFrameV30,
  type VideoStateReadoutV30,
} from "./video-review-v30";

export type VideoMomentumMoment = VideoStateMoment & {
  kind: "opener" | "reversal" | "recovery" | "overchase";
  lateGame: boolean;
};

export type VideoStateReadoutV31 = VideoStateReadoutV30 & {
  fightOpenersFor: number;
  fightOpenersAgainst: number;
  retainedOpenersFor: number;
  openerRetentionRate: number;
  tradeResponses: number;
  tradeResponseRate: number;
  advantageReversals: number;
  overchaseDeaths: number;
  disadvantageEpisodes: number;
  disadvantageRecoveries: number;
  cleanRegroups: number;
  cleanRegroupRate: number;
  activeRecoveries: number;
  medianRecoverySeconds?: number;
  lateGameSwings: number;
  momentumMoments: VideoMomentumMoment[];
};

type StateRun = {
  startSecond: number;
  endSecond: number;
  windows: TeamStateWindow[];
};

const FRIENDLY_DEATH_KEYS = new Set(["death", "ally-death"]);
const ENEMY_DEATH_KEYS = new Set(["enemy-death"]);
const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

function eventWithin(
  events: VideoReviewEvent[],
  keys: Set<string>,
  startSecond: number,
  endSecond: number,
) {
  return events.find((event) =>
    keys.has(event.key) &&
    event.second > startSecond + .04 &&
    event.second <= endSecond
  );
}

function objectiveBefore(events: VideoReviewEvent[], startSecond: number, endSecond: number) {
  return events.some((event) =>
    event.key === "objective" &&
    event.confidence >= 60 &&
    event.second >= startSecond - .25 &&
    event.second <= endSecond
  );
}

function sceneBetween(events: VideoReviewEvent[], startSecond: number, endSecond: number) {
  return events.some((event) => event.key === "scene" && event.second > startSecond && event.second <= endSecond);
}

function stateAt(windows: TeamStateWindow[], second: number) {
  return windows.find((window) => second >= window.startSecond && second < window.endSecond)
    || windows[windows.length - 1];
}

function stateRuns(
  windows: TeamStateWindow[],
  predicate: (window: TeamStateWindow) => boolean,
) {
  const runs: StateRun[] = [];
  for (const window of windows) {
    if (!predicate(window)) continue;
    const previous = runs[runs.length - 1];
    if (previous && Math.abs(previous.endSecond - window.startSecond) < .06) {
      previous.endSecond = window.endSecond;
      previous.windows.push(window);
    } else {
      runs.push({
        startSecond: window.startSecond,
        endSecond: window.endSecond,
        windows: [window],
      });
    }
  }
  return runs;
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
  return Math.round(value * 10) / 10;
}

function lateGameThreshold(duration: number) {
  return Math.max(duration * .7, duration - 45);
}

function dedupeMomentum(moments: VideoMomentumMoment[]) {
  const seen = new Set<string>();
  return moments
    .filter((moment) => {
      const key = `${Math.round(moment.second * 2)}:${moment.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(b.lateGame) - Number(a.lateGame) || a.second - b.second)
    .slice(0, 10);
}

/**
 * v0.31 convierte la reconstrucción numérica en lectura de momentum:
 * - primera baja de una pelea iniciada desde 3v3;
 * - ventaja inicial conservada o devuelta antes de convertir;
 * - trade defensivo tras perder la primera baja;
 * - recuperación y reagrupación después de caer en inferioridad;
 * - muerte por sobreperseguir después de un wipe sin objetivo visible.
 */
export function buildVideoStateReadoutV31(
  snapshots: VideoHudSnapshot[],
  inputEvents: VideoReviewEvent[],
  mode: string,
  duration: number,
): VideoStateReadoutV31 {
  const validated = filterStateEventsV30(inputEvents, mode);
  const events = [...validated.events].sort((a, b) => a.second - b.second);
  const windows = buildTeamStateWindowsV30(inputEvents, mode, duration);
  // El motor base debe recibir también las escenas rechazadas para conservar
  // el contador de resets ignorados que expone v0.30 en la interfaz.
  const base = buildVideoStateReadoutV30(snapshots, inputEvents, mode, duration);
  const lateThreshold = lateGameThreshold(duration);
  const moments: VideoMomentumMoment[] = [];

  let fightOpenersFor = 0;
  let fightOpenersAgainst = 0;
  let retainedOpenersFor = 0;
  let tradeResponses = 0;
  let advantageReversals = 0;

  for (const event of events) {
    if (!["death", "ally-death", "enemy-death"].includes(event.key)) continue;
    const before = stateAt(windows, Math.max(0, event.second - .06));
    if (!before || before.friendlyAlive !== 3 || before.enemyAlive !== 3) continue;

    const responseEnd = Math.min(duration, event.second + 5.5);
    const lateGame = event.second >= lateThreshold;
    if (event.key === "enemy-death") {
      fightOpenersFor += 1;
      const friendlyDeath = eventWithin(events, FRIENDLY_DEATH_KEYS, event.second, responseEnd);
      const convertedFirst = friendlyDeath
        ? objectiveBefore(events, event.second, friendlyDeath.second)
        : objectiveBefore(events, event.second, responseEnd);
      if (!friendlyDeath || convertedFirst || sceneBetween(events, event.second, friendlyDeath.second)) {
        retainedOpenersFor += 1;
        continue;
      }

      advantageReversals += 1;
      moments.push({
        second: Math.max(0, event.second - 2),
        kind: "reversal",
        label: lateGame ? "Ventaja inicial devuelta en tramo final" : "Ventaja inicial devuelta",
        detail: `El equipo consigue la primera baja, pero aparece una baja propia/aliada ≈${Math.max(1, Math.round(friendlyDeath.second - event.second))} s después y antes de una conversión visible. Revisa si se persiguió de más o se adelantó la siguiente entrada.`,
        priority: "Alta",
        lateGame,
      });
    } else {
      fightOpenersAgainst += 1;
      const enemyDeath = eventWithin(events, ENEMY_DEATH_KEYS, event.second, responseEnd);
      if (enemyDeath && !sceneBetween(events, event.second, enemyDeath.second)) {
        tradeResponses += 1;
        moments.push({
          second: Math.max(0, event.second - 2),
          kind: "recovery",
          label: lateGame ? "Trade defensivo en tramo final" : "Primera baja respondida con trade",
          detail: `Tras perder la primera baja aparece una eliminación rival ≈${Math.max(1, Math.round(enemyDeath.second - event.second))} s después. Revisa qué posición o recurso permitió recuperar la igualdad.`,
          priority: lateGame ? "Alta" : "Media",
          lateGame,
        });
      } else {
        moments.push({
          second: Math.max(0, event.second - 2),
          kind: "opener",
          label: lateGame ? "Primera baja sin trade en tramo final" : "Primera baja sin trade",
          detail: "La pelea parte de 3v3, vuestro equipo pierde la primera baja y no aparece una respuesta rival en ≤5,5 s. Revisa si el superviviente debía cubrir el trade o cortar la pelea.",
          priority: "Alta",
          lateGame,
        });
      }
    }
  }

  let overchaseDeaths = 0;
  const wipeRuns = stateRuns(windows, (window) => window.enemyAlive === 0 && window.friendlyAlive > 0);
  for (const run of wipeRuns) {
    const chaseEnd = Math.min(duration, run.startSecond + 6.5, run.endSecond + 2);
    const friendlyDeath = eventWithin(events, FRIENDLY_DEATH_KEYS, run.startSecond, chaseEnd);
    if (!friendlyDeath || objectiveBefore(events, run.startSecond, friendlyDeath.second)) continue;
    overchaseDeaths += 1;
    const lateGame = friendlyDeath.second >= lateThreshold;
    moments.push({
      second: Math.max(0, run.startSecond - 1.5),
      kind: "overchase",
      label: lateGame ? "Sobrepersecución tras wipe en tramo final" : "Sobrepersecución tras wipe",
      detail: `Tras ${run.windows[0].label} aparece una baja propia/aliada antes de una señal de objetivo. Revisa si se abandonó la conversión segura para buscar una eliminación adicional.`,
      priority: "Alta",
      lateGame,
    });
  }

  const disadvantageRuns = stateRuns(windows, (window) => window.friendlyAlive < window.enemyAlive);
  let disadvantageRecoveries = 0;
  let cleanRegroups = 0;
  let activeRecoveries = 0;
  const recoverySeconds: number[] = [];

  for (const run of disadvantageRuns) {
    const after = stateAt(windows, Math.min(duration - .001, run.endSecond + .03));
    const recovered = run.endSecond < duration - .08 && after && after.friendlyAlive >= after.enemyAlive;
    if (!recovered) continue;
    disadvantageRecoveries += 1;
    recoverySeconds.push(run.endSecond - run.startSecond);

    const recoveryKill = eventWithin(events, ENEMY_DEATH_KEYS, run.startSecond, run.endSecond + .08);
    if (recoveryKill) activeRecoveries += 1;
    const nextFriendlyDeath = eventWithin(
      events,
      FRIENDLY_DEATH_KEYS,
      run.endSecond,
      Math.min(duration, run.endSecond + 4.5),
    );
    if (!nextFriendlyDeath) cleanRegroups += 1;
  }

  const openerRetentionRate = percent(retainedOpenersFor, fightOpenersFor);
  const tradeResponseRate = percent(tradeResponses, fightOpenersAgainst);
  const cleanRegroupRate = percent(cleanRegroups, disadvantageRecoveries);
  const medianRecoverySeconds = median(recoverySeconds);
  const momentumMoments = dedupeMomentum(moments);
  const lateGameSwings = momentumMoments.filter((moment) => moment.lateGame).length;
  const strengths = [...base.strengths];
  const risks = [...base.risks];
  const actions = [...base.actions];

  if (fightOpenersFor >= 2 && openerRetentionRate >= 70) {
    strengths.unshift(`Buena disciplina tras la primera baja: se conserva o convierte ${retainedOpenersFor}/${fightOpenersFor} ventajas iniciales (${openerRetentionRate}%).`);
  }
  if (fightOpenersAgainst >= 2 && tradeResponseRate >= 60) {
    strengths.unshift(`Respuesta de trade sólida: ${tradeResponses}/${fightOpenersAgainst} primeras bajas propias reciben respuesta en ≤5,5 s (${tradeResponseRate}%).`);
  }
  if (advantageReversals) {
    risks.unshift(`${advantageReversals} ventaja(s) inicial(es) se devuelven con una baja propia antes de convertir: revisa sobreextensión y sincronía tras el primer pick.`);
  }
  if (fightOpenersAgainst >= 2 && tradeResponseRate < 50) {
    risks.unshift(`Solo ${tradeResponses}/${fightOpenersAgainst} primeras bajas propias reciben trade rápido (${tradeResponseRate}%): el equipo queda demasiado tiempo en 2v3.`);
  }
  if (overchaseDeaths) {
    risks.unshift(`${overchaseDeaths} muerte(s) tras wipe aparecen antes de objetivo visible: patrón compatible con sobrepersecución.`);
  }
  if (disadvantageRecoveries >= 2 && cleanRegroupRate < 60) {
    risks.push(`Solo ${cleanRegroups}/${disadvantageRecoveries} recuperaciones vuelven limpias durante los 4,5 s siguientes (${cleanRegroupRate}%): el re-engage puede estar llegando demasiado pronto.`);
  }
  if (advantageReversals) actions.unshift("Abre cada «Ventaja inicial devuelta» dos segundos antes y decide quién debía frenar: portador de la ventaja, lane sin munición o jugador sin ruta de salida.");
  if (fightOpenersAgainst > tradeResponses) actions.unshift("En las primeras bajas sin trade, comprueba si faltó línea de tiro/cobertura o si lo correcto era ceder mapa y esperar el respawn.");
  if (medianRecoverySeconds !== undefined) actions.push(`Usa ≈${medianRecoverySeconds} s como referencia observada de vuelta a igualdad; no reabras la pelea antes si todavía faltan recursos o posición.`);

  return {
    ...base,
    fightOpenersFor,
    fightOpenersAgainst,
    retainedOpenersFor,
    openerRetentionRate,
    tradeResponses,
    tradeResponseRate,
    advantageReversals,
    overchaseDeaths,
    disadvantageEpisodes: disadvantageRuns.length,
    disadvantageRecoveries,
    cleanRegroups,
    cleanRegroupRate,
    activeRecoveries,
    medianRecoverySeconds,
    lateGameSwings,
    momentumMoments,
    strengths: strengths.slice(0, 9),
    risks: risks.slice(0, 12),
    actions: actions.slice(0, 12),
  };
}

export {
  buildTeamStateWindowsV30 as buildTeamStateWindowsV31,
  finalizeVideoHudSamplesV30 as finalizeVideoHudSamplesV31,
  sampleVideoHudFrameV30 as sampleVideoHudFrameV31,
};
