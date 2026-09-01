import type { VideoReviewEvent } from "./video-review";
import type { TeamStateWindow, VideoHudSnapshot, VideoStateMoment } from "./video-review-v26";
import {
  buildTeamStateWindowsV28,
  buildVideoStateReadoutV28,
  finalizeVideoHudSamplesV28,
  sampleVideoHudFrameV28,
  type VideoStateReadoutV28,
} from "./video-review-v28";

export type VideoStateReadoutV29 = VideoStateReadoutV28 & {
  trustedTeamEvents: number;
  teamEventTrustShare: number;
  wipeConversionsFor: number;
  wipeConversionRate: number;
  wipeObjectiveCostsAgainst: number;
  wipeCostRate: number;
  staggerDeaths: number;
};

const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

const TEAM_KEYS = new Set(["death", "ally-death", "enemy-death", "respawn", "scene"]);
const FRIENDLY_DEATH_KEYS = new Set(["death", "ally-death"]);

function trustedTeamEvents(events: VideoReviewEvent[]) {
  return events.filter((event) => {
    if (!TEAM_KEYS.has(event.key)) return true;
    if (event.key === "respawn" || event.key === "scene") return event.confidence >= 58;
    // Las correcciones manuales reciben >=96 en applyVideoEventOverrides, por lo
    // que pasan siempre. Las bajas automáticas débiles dejan de crear wipes falsos.
    return event.confidence >= 64;
  });
}

function objectiveWithin(events: VideoReviewEvent[], start: number, end: number) {
  return events.find((event) =>
    event.key === "objective" &&
    event.confidence >= 60 &&
    event.second >= start &&
    event.second <= end
  );
}

function friendlyDeathWithin(events: VideoReviewEvent[], start: number, end: number) {
  return events.find((event) =>
    FRIENDLY_DEATH_KEYS.has(event.key) &&
    event.confidence >= 64 &&
    event.second > start &&
    event.second <= end
  );
}

function wipeWindows(windows: TeamStateWindow[], side: "for" | "against") {
  return windows.filter((window) => side === "for"
    ? window.enemyAlive === 0 && window.friendlyAlive > 0
    : window.friendlyAlive === 0 && window.enemyAlive > 0
  );
}

function recoveryTransitions(windows: TeamStateWindow[]) {
  const transitions: Array<{ second: number; from: TeamStateWindow; to: TeamStateWindow }> = [];
  for (let index = 1; index < windows.length; index += 1) {
    const previous = windows[index - 1];
    const current = windows[index];
    const friendlyRecovered = current.friendlyAlive > previous.friendlyAlive;
    const wasWipedOrDeeplyDown = previous.friendlyAlive === 0 || previous.friendlyAlive < previous.enemyAlive;
    if (friendlyRecovered && wasWipedOrDeeplyDown) {
      transitions.push({ second: current.startSecond, from: previous, to: current });
    }
  }
  return transitions;
}

function modeConversionWindow(mode: string) {
  if (mode === "Balón Brawl") return 9;
  if (mode === "Zona Restringida") return 8;
  if (mode === "Atrapagemas") return 9;
  if (mode === "Atraco") return 8;
  if (mode === "Caza Estelar") return 7;
  return 8;
}

function uniqueMoments(moments: VideoStateMoment[]) {
  const seen = new Set<string>();
  return moments.filter((moment) => {
    const key = `${Math.round(moment.second * 2)}:${moment.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * v0.29 añade dos preguntas de coaching que faltaban en la reconstrucción v0.28:
 * 1) ¿el wipe se convirtió rápidamente en objetivo/score?
 * 2) ¿el equipo volvió de un wipe/desventaja y regaló una baja escalonada enseguida?
 * Además, las ventanas 3v0/0v3 solo se construyen con bajas de confianza suficiente.
 */
export function buildVideoStateReadoutV29(
  snapshots: VideoHudSnapshot[],
  inputEvents: VideoReviewEvent[],
  mode: string,
  duration: number,
): VideoStateReadoutV29 {
  const ordered = [...inputEvents].sort((a, b) => a.second - b.second);
  const trusted = trustedTeamEvents(ordered);
  const base = buildVideoStateReadoutV28(snapshots, trusted, mode, duration);
  const windows = buildTeamStateWindowsV28(trusted, mode, duration);
  const wipesFor = wipeWindows(windows, "for");
  const wipesAgainst = wipeWindows(windows, "against");
  const conversionWindow = modeConversionWindow(mode);

  let wipeConversionsFor = 0;
  let wipeObjectiveCostsAgainst = 0;
  const moments: VideoStateMoment[] = [...base.moments];

  if (mode === "Noqueo") {
    // En Noqueo el wipe ya es la condición de cierre de la ronda; no exigimos
    // una señal de objetivo posterior para considerarlo convertido.
    wipeConversionsFor = wipesFor.length;
    wipeObjectiveCostsAgainst = wipesAgainst.length;
  } else {
    for (const window of wipesFor) {
      const objective = objectiveWithin(
        ordered,
        Math.max(0, window.startSecond - .4),
        Math.min(duration, window.endSecond + conversionWindow),
      );
      if (objective) {
        wipeConversionsFor += 1;
        moments.push({
          second: Math.max(0, window.startSecond - 1.5),
          label: "Wipe convertido",
          detail: `${window.label} seguido por cambio de objetivo/marcador en ≈${Math.max(0, Math.round(objective.second - window.startSecond))} s. Revisa si fue la conversión óptima para ${mode}.`,
          priority: "Alta",
        });
      } else {
        moments.push({
          second: Math.max(0, window.startSecond - 1.5),
          label: "Wipe sin conversión visible",
          detail: `${window.label} sin señal de objetivo/marcador en la ventana posterior de ${conversionWindow} s. Puede ser un falso negativo del HUD: confirma el replay antes de corregir el hábito.`,
          priority: "Alta",
        });
      }
    }

    for (const window of wipesAgainst) {
      const objective = objectiveWithin(
        ordered,
        Math.max(0, window.startSecond - .4),
        Math.min(duration, window.endSecond + conversionWindow),
      );
      if (!objective) continue;
      wipeObjectiveCostsAgainst += 1;
      moments.push({
        second: Math.max(0, window.startSecond - 2),
        label: "Wipe con coste de objetivo",
        detail: `${window.label} y cambio de objetivo/marcador ≈${Math.max(0, Math.round(objective.second - window.startSecond))} s después. Esta secuencia tiene prioridad máxima de revisión.`,
        priority: "Alta",
      });
    }
  }

  let staggerDeaths = 0;
  for (const transition of recoveryTransitions(windows)) {
    const stagger = friendlyDeathWithin(ordered, transition.second, Math.min(duration, transition.second + 5.5));
    if (!stagger) continue;
    staggerDeaths += 1;
    moments.push({
      second: Math.max(0, transition.second - 1.5),
      label: "Reentrada escalonada probable",
      detail: `El equipo pasa de ${transition.from.label} a ${transition.to.label}, pero aparece otra baja propia/aliada ≈${Math.max(1, Math.round(stagger.second - transition.second))} s después. Revisa si se reentró antes de reagrupar.`,
      priority: "Alta",
    });
  }

  const teamDeaths = ordered.filter((event) => ["death", "ally-death", "enemy-death"].includes(event.key)).length;
  const trustedDeaths = trusted.filter((event) => ["death", "ally-death", "enemy-death"].includes(event.key)).length;
  const teamEventTrustShare = percent(trustedDeaths, teamDeaths);
  const wipeConversionRate = percent(wipeConversionsFor, wipesFor.length);
  const wipeCostRate = percent(wipeObjectiveCostsAgainst, wipesAgainst.length);

  const strengths = [...base.strengths];
  const risks = [...base.risks];
  const actions = [...base.actions];

  if (wipesFor.length && mode !== "Noqueo") {
    if (wipeConversionRate >= 70) strengths.unshift(`Conversión de wipe fuerte: ${wipeConversionsFor}/${wipesFor.length} wipes rivales enlazan con cambio de objetivo/marcador en la ventana táctica.`);
    else risks.unshift(`Conversión de wipe mejorable: solo ${wipeConversionsFor}/${wipesFor.length} wipes rivales muestran cambio de objetivo/marcador rápido.`);
  }
  if (wipesAgainst.length && wipeObjectiveCostsAgainst) {
    risks.unshift(`${wipeObjectiveCostsAgainst}/${wipesAgainst.length} wipes propios enlazan con cambio de objetivo/marcador rival: son pérdidas de tempo de máxima prioridad.`);
  }
  if (staggerDeaths) {
    risks.unshift(`${staggerDeaths} reentrada(s) probable(s) terminan en otra baja en ≤5,5 s: patrón compatible con stagger tras respawn/reagrupación incompleta.`);
    actions.unshift("En las reentradas escalonadas, pausa el replay al recuperar el primer compañero y comprueba si el siguiente engage empezó antes de volver a 3v3 o antes de recuperar recursos.");
  }
  if (teamDeaths >= 3 && teamEventTrustShare < 65) {
    risks.push(`Solo ${teamEventTrustShare}% de las bajas detectadas supera el umbral de confianza usado para reconstruir wipes; corrige YO/ALIADO/RIVAL antes de tomar conclusiones de 3v0/0v3.`);
  }
  if (wipesFor.length && mode !== "Noqueo") actions.unshift("Para cada wipe rival, compara la primera señal de objetivo con el final de la pelea: el objetivo es convertir espacio antes de que el respawn vuelva a cerrar el mapa.");

  return {
    ...base,
    teamWindows: windows
      .filter((window) => window.label !== "3v3" || window.endSecond - window.startSecond >= 5)
      .slice(0, 24),
    teamWipesFor: wipesFor.length,
    teamWipesAgainst: wipesAgainst.length,
    wipeForSeconds: Math.round(wipesFor.reduce((sum, window) => sum + Math.max(0, window.endSecond - window.startSecond), 0)),
    wipeAgainstSeconds: Math.round(wipesAgainst.reduce((sum, window) => sum + Math.max(0, window.endSecond - window.startSecond), 0)),
    trustedTeamEvents: trustedDeaths,
    teamEventTrustShare,
    wipeConversionsFor,
    wipeConversionRate,
    wipeObjectiveCostsAgainst,
    wipeCostRate,
    staggerDeaths,
    moments: uniqueMoments(moments).sort((a, b) => a.second - b.second).slice(0, 16),
    strengths: strengths.slice(0, 6),
    risks: risks.slice(0, 9),
    actions: actions.slice(0, 9),
  };
}

export {
  buildTeamStateWindowsV28 as buildTeamStateWindowsV29,
  finalizeVideoHudSamplesV28 as finalizeVideoHudSamplesV29,
  sampleVideoHudFrameV28 as sampleVideoHudFrameV29,
};
