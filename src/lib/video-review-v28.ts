import type { VideoReviewEvent } from "./video-review";
import type { TeamStateWindow, VideoHudSnapshot } from "./video-review-v26";
import {
  buildVideoStateReadoutV27,
  finalizeVideoHudSamplesV27,
  sampleVideoHudFrameV27,
  type VideoStateReadoutV27,
} from "./video-review-v27";

export type VideoStateReadoutV28 = VideoStateReadoutV27 & {
  teamWipesFor: number;
  teamWipesAgainst: number;
  wipeForSeconds: number;
  wipeAgainstSeconds: number;
};

function lastSceneBefore(events: VideoReviewEvent[], second: number) {
  let scene = -1;
  for (const event of events) {
    if (event.second > second) break;
    if (event.key === "scene") scene = Math.max(scene, event.second);
  }
  return scene;
}

function activeTeamDeaths(
  events: VideoReviewEvent[],
  key: "ally-death" | "enemy-death",
  second: number,
  mode: string,
  cap: number,
) {
  const scene = lastSceneBefore(events, second);
  let count = 0;
  for (const event of events) {
    if (event.second > second) break;
    if (event.key !== key || event.second <= scene) continue;
    if (mode === "Noqueo" || second - event.second <= 8.5) count += 1;
  }
  return Math.min(cap, count);
}

function ownDown(events: VideoReviewEvent[], second: number, mode: string) {
  const scene = lastSceneBefore(events, second);
  let death: VideoReviewEvent | undefined;
  for (const event of events) {
    if (event.second > second) break;
    if (event.key === "death" && event.second > scene) death = event;
  }
  if (!death) return false;

  for (const event of events) {
    if (event.second <= death.second) continue;
    if (event.second > second) break;
    if (event.key === "respawn") return false;
  }
  return mode === "Noqueo" ? true : second - death.second <= 9.5;
}

function stateAt(events: VideoReviewEvent[], second: number, mode: string) {
  // Dos aliados pueden caer además del jugador local. El equipo rival sí puede
  // tener sus tres miembros fuera simultáneamente, especialmente en Noqueo.
  const friendlyDown = Math.min(3, activeTeamDeaths(events, "ally-death", second, mode, 2) + (ownDown(events, second, mode) ? 1 : 0));
  const enemyDown = activeTeamDeaths(events, "enemy-death", second, mode, 3);
  return {
    friendlyAlive: Math.max(0, 3 - friendlyDown),
    enemyAlive: Math.max(0, 3 - enemyDown),
  };
}

/**
 * Reconstrucción numérica v0.28. Corrige el límite histórico que forzaba al
 * menos un jugador vivo y, por tanto, impedía representar 3v0 / 0v3.
 */
export function buildTeamStateWindowsV28(
  inputEvents: VideoReviewEvent[],
  mode: string,
  duration: number,
): TeamStateWindow[] {
  const events = [...inputEvents].sort((a, b) => a.second - b.second);
  const safeDuration = Math.max(1, duration);
  const points = new Set<number>([0, safeDuration]);

  for (const event of events) {
    if (!["death", "ally-death", "enemy-death", "respawn", "scene"].includes(event.key)) continue;
    const second = Math.max(0, Math.min(safeDuration, event.second));
    points.add(second);
    if (mode !== "Noqueo" && ["death", "ally-death", "enemy-death"].includes(event.key)) {
      const timeout = event.key === "death" ? 9.5 : 8.5;
      points.add(Math.max(0, Math.min(safeDuration, event.second + timeout)));
    }
  }

  const ordered = [...points].sort((a, b) => a - b);
  const windows: TeamStateWindow[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const startSecond = ordered[index];
    const endSecond = ordered[index + 1];
    if (endSecond - startSecond < .05) continue;
    const sampleSecond = startSecond + (endSecond - startSecond) * .5;
    const state = stateAt(events, sampleSecond, mode);
    const label = `${state.friendlyAlive}v${state.enemyAlive}`;
    const totalDown = 6 - state.friendlyAlive - state.enemyAlive;
    const confidence = state.friendlyAlive === 0 || state.enemyAlive === 0
      ? 86
      : totalDown >= 2
        ? 82
        : label === "3v3"
          ? 64
          : 78;
    const previous = windows[windows.length - 1];
    if (previous && previous.label === label && Math.abs(previous.endSecond - startSecond) < .06) {
      previous.endSecond = endSecond;
      previous.confidence = Math.max(previous.confidence, confidence);
    } else {
      windows.push({ startSecond, endSecond, ...state, label, confidence });
    }
  }
  return windows;
}

function secondsBy(windows: TeamStateWindow[], predicate: (window: TeamStateWindow) => boolean) {
  return Math.round(windows.reduce((sum, window) => predicate(window)
    ? sum + Math.max(0, window.endSecond - window.startSecond)
    : sum, 0));
}

function withoutNumericalLegacy(text: string) {
  return !text.includes("superioridad numérica")
    && !text.includes("inferioridad numérica")
    && !text.includes("tramos 2v3/1v3");
}

export function buildVideoStateReadoutV28(
  snapshots: VideoHudSnapshot[],
  events: VideoReviewEvent[],
  mode: string,
  duration: number,
): VideoStateReadoutV28 {
  const base = buildVideoStateReadoutV27(snapshots, events, mode, duration);
  const fullWindows = buildTeamStateWindowsV28(events, mode, duration);
  const advantageSeconds = secondsBy(fullWindows, (window) => window.friendlyAlive > window.enemyAlive);
  const disadvantageSeconds = secondsBy(fullWindows, (window) => window.friendlyAlive < window.enemyAlive);
  const wipeForWindows = fullWindows.filter((window) => window.enemyAlive === 0 && window.friendlyAlive > 0);
  const wipeAgainstWindows = fullWindows.filter((window) => window.friendlyAlive === 0 && window.enemyAlive > 0);
  const wipeForSeconds = secondsBy(wipeForWindows, () => true);
  const wipeAgainstSeconds = secondsBy(wipeAgainstWindows, () => true);

  const strengths = base.strengths.filter(withoutNumericalLegacy);
  const risks = base.risks.filter(withoutNumericalLegacy);
  const actions = base.actions.filter(withoutNumericalLegacy);

  if (advantageSeconds >= 10) strengths.unshift(`Se reconstruyen ≈${advantageSeconds} s de superioridad numérica real, incluyendo estados con rival a 0 si aparecen.`);
  if (wipeForWindows.length) strengths.unshift(`${wipeForWindows.length} wipe(s) rival(es) reconstruido(s), con ≈${wipeForSeconds} s totales antes del reset/reaparición.`);
  if (disadvantageSeconds >= 10) risks.unshift(`Se reconstruyen ≈${disadvantageSeconds} s de inferioridad numérica; prioriza si el equipo cedió espacio y evitó encadenar otra baja.`);
  if (wipeAgainstWindows.length) risks.unshift(`${wipeAgainstWindows.length} wipe(s) propio(s) reconstruido(s), con ≈${wipeAgainstSeconds} s sin ningún miembro vivo.`);
  if (wipeForWindows.length) actions.unshift("Abre cada 3v0/2v0/1v0 y comprueba si el wipe se convirtió inmediatamente en gol, gemas, zona o control de mapa.");
  if (wipeAgainstWindows.length) actions.unshift("Después de cada 0vX, revisa la primera decisión tras el reset: salida escalonada y segunda muerte temprana suelen ampliar el coste del wipe.");
  if (disadvantageSeconds > advantageSeconds) actions.push("Compara las ventanas de inferioridad con la siguiente vuelta a igualdad y mide si el equipo esperó la reagrupación antes de volver a pelear.");

  return {
    ...base,
    advantageSeconds,
    disadvantageSeconds,
    teamWipesFor: wipeForWindows.length,
    teamWipesAgainst: wipeAgainstWindows.length,
    wipeForSeconds,
    wipeAgainstSeconds,
    teamWindows: fullWindows
      .filter((window) => window.label !== "3v3" || window.endSecond - window.startSecond >= 5)
      .slice(0, 20),
    strengths: strengths.slice(0, 5),
    risks: risks.slice(0, 8),
    actions: actions.slice(0, 8),
  };
}

export {
  finalizeVideoHudSamplesV27 as finalizeVideoHudSamplesV28,
  sampleVideoHudFrameV27 as sampleVideoHudFrameV28,
};
