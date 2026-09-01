import type { VideoReviewEvent } from "./video-review";
import {
  buildTeamStateWindows,
  buildVideoStateReadout,
  sampleVideoHudFrame,
  type TeamStateWindow,
  type VideoHudRawSample,
  type VideoHudSnapshot,
  type VideoStateMoment,
  type VideoStateReadout,
} from "./video-review-v26";

export type VideoStateReadoutV27 = VideoStateReadout & {
  hudQuality: "Alta" | "Media" | "Baja";
  hudQualityScore: number;
  stableTrackingShare: number;
  criticalDeaths: number;
  superHoldSeconds: number;
  hyperHoldSeconds: number;
};

type NormalizedRegion = { x0: number; y0: number; x1: number; y1: number };
type Calibration = { low: number; high: number; span: number; usable: boolean; reliability: number };

type MarkerBin = {
  matches: number;
  weightedX: number;
  weightedY: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max ? (max - min) / max : 0;
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(ordered.length - 1, Math.round((ordered.length - 1) * q)));
  return ordered[index];
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function scanRegion(
  image: ImageData,
  region: NormalizedRegion,
  predicate: (r: number, g: number, b: number) => boolean,
) {
  const { width, height, data } = image;
  const startX = Math.max(0, Math.floor(width * region.x0));
  const endX = Math.min(width, Math.ceil(width * region.x1));
  const startY = Math.max(0, Math.floor(height * region.y0));
  const endY = Math.min(height, Math.ceil(height * region.y1));
  let matches = 0;
  let samples = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const index = (y * width + x) * 4;
      if (predicate(data[index], data[index + 1], data[index + 2])) matches += 1;
      samples += 1;
    }
  }
  return samples ? matches / samples : 0;
}

const isFriendlyMarker = (r: number, g: number, b: number) => {
  const sat = saturation(r, g, b);
  const cyan = b > r * 1.28 && g > r * 1.10 && b > 95;
  const green = g > 125 && g > r * 1.28 && g > b * 1.04;
  return sat > .30 && (cyan || green);
};

const isHealthGreen = (r: number, g: number, b: number) =>
  g > 120 && g > r * 1.34 && g > b * 1.10 && saturation(r, g, b) > .34;

const isBallEnergy = (r: number, g: number, b: number) => {
  const bright = r > 190 && g > 170 && b > 135;
  const gold = r > 175 && g > 115 && b < 105;
  return bright || gold;
};

const isGemEnergy = (r: number, g: number, b: number) =>
  b > 135 && r > 95 && b > g * 1.20 && r > g * .88 && saturation(r, g, b) > .30;

function healthBarSignal(image: ImageData, playerX: number, playerY: number) {
  const { width, height, data } = image;
  const centerX = Math.round(playerX * width);
  const centerY = Math.round(playerY * height);
  const startX = Math.max(0, centerX - Math.round(width * .10));
  const endX = Math.min(width - 1, centerX + Math.round(width * .10));
  const startY = Math.max(0, centerY - Math.round(height * .16));
  const endY = Math.max(startY + 1, Math.min(height - 1, centerY - Math.round(height * .025)));
  let bestSpan = 0;
  let bestDensity = 0;

  for (let y = startY; y <= endY; y += 1) {
    let first = -1;
    let last = -1;
    let green = 0;
    for (let x = startX; x <= endX; x += 1) {
      const index = (y * width + x) * 4;
      if (!isHealthGreen(data[index], data[index + 1], data[index + 2])) continue;
      if (first < 0) first = x;
      last = x;
      green += 1;
    }
    if (first >= 0 && last >= first) {
      bestSpan = Math.max(bestSpan, last - first + 1);
      bestDensity = Math.max(bestDensity, green / Math.max(1, endX - startX + 1));
    }
  }

  if (bestSpan < width * .018 || bestDensity < .035) return undefined;
  return clamp100(bestSpan / Math.max(1, width * .135) * 100);
}

/**
 * La cámara de Brawl Stars sigue al jugador local. En vez de promediar todos los
 * marcadores aliados del campo, v0.27 agrupa candidatos y prioriza el marcador
 * coherente con el centro de cámara y con una barra de vida próxima.
 */
function locateCameraPlayer(image: ImageData) {
  const { width, height, data } = image;
  const region = { x0: .18, y0: .18, x1: .82, y1: .86 };
  const columns = 12;
  const rows = 10;
  const bins: MarkerBin[] = Array.from({ length: columns * rows }, () => ({ matches: 0, weightedX: 0, weightedY: 0 }));
  const startX = Math.floor(width * region.x0);
  const endX = Math.ceil(width * region.x1);
  const startY = Math.floor(height * region.y0);
  const endY = Math.ceil(height * region.y1);

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const index = (y * width + x) * 4;
      if (!isFriendlyMarker(data[index], data[index + 1], data[index + 2])) continue;
      const normalizedX = (x / width - region.x0) / (region.x1 - region.x0);
      const normalizedY = (y / height - region.y0) / (region.y1 - region.y0);
      const column = Math.max(0, Math.min(columns - 1, Math.floor(normalizedX * columns)));
      const row = Math.max(0, Math.min(rows - 1, Math.floor(normalizedY * rows)));
      const bin = bins[row * columns + column];
      bin.matches += 1;
      bin.weightedX += x;
      bin.weightedY += y;
    }
  }

  let best: { x: number; y: number; score: number; hp?: number } | undefined;
  for (const bin of bins) {
    if (bin.matches < 2) continue;
    const x = bin.weightedX / bin.matches / width;
    const y = bin.weightedY / bin.matches / height;
    const dx = (x - .5) / .33;
    const dy = (y - .54) / .38;
    const centerScore = clamp01(1 - Math.sqrt(dx * dx + dy * dy));
    const densityScore = clamp01(bin.matches / 14);
    const hp = healthBarSignal(image, x, y);
    const score = centerScore * .56 + densityScore * .30 + (hp !== undefined ? .14 : 0);
    if (!best || score > best.score) best = { x, y, score, hp };
  }

  if (!best || best.score < .22) return undefined;
  return {
    playerX: best.x,
    playerY: best.y,
    locatorSignal: clamp01(best.score),
    hpSignal: best.hp,
  };
}

export function sampleVideoHudFrameV27(image: ImageData, second: number, mode: string): VideoHudRawSample {
  const base = sampleVideoHudFrame(image, second, mode);
  const player = locateCameraPlayer(image);
  if (!player) return base;

  let objectiveEnergy = base.objectiveEnergy;
  if (mode === "Balón Brawl" || mode === "Atrapagemas") {
    const predicate = mode === "Balón Brawl" ? isBallEnergy : isGemEnergy;
    objectiveEnergy = scanRegion(image, {
      x0: Math.max(0, player.playerX - .13),
      y0: Math.max(0, player.playerY - .18),
      x1: Math.min(1, player.playerX + .13),
      y1: Math.min(1, player.playerY + .18),
    }, predicate);
  }

  return {
    ...base,
    ...player,
    objectiveEnergy,
  };
}

function calibration(values: number[], minHigh: number, minSpan: number): Calibration {
  const low = quantile(values, .20);
  const high = quantile(values, .92);
  const span = Math.max(0, high - low);
  const usable = high >= minHigh && span >= minSpan;
  const signalScore = clamp01(high / Math.max(minHigh * 3.5, .0001));
  const contrastScore = clamp01(span / Math.max(minSpan * 4, .0001));
  return {
    low,
    high,
    span,
    usable,
    reliability: usable ? clamp100((signalScore * .45 + contrastScore * .55) * 100) : 0,
  };
}

function normalized(value: number, model: Calibration) {
  if (!model.usable || model.span <= 0) return undefined;
  return clamp100((value - model.low) / model.span * 100);
}

function windowValues(
  snapshots: VideoHudSnapshot[],
  index: number,
  seconds: number,
  selector: (snapshot: VideoHudSnapshot) => number | undefined,
) {
  const center = snapshots[index].second;
  const values: number[] = [];
  for (let cursor = Math.max(0, index - 4); cursor <= Math.min(snapshots.length - 1, index + 4); cursor += 1) {
    if (Math.abs(snapshots[cursor].second - center) > seconds) continue;
    const value = selector(snapshots[cursor]);
    if (value !== undefined) values.push(value);
  }
  return values;
}

/**
 * Calibración robusta + mediana temporal + histéresis. Una señal de color
 * constante ya no se auto-normaliza artificialmente al 100%, y un único frame
 * espurio no convierte por sí solo super/hipercarga en "lista".
 */
export function finalizeVideoHudSamplesV27(samples: VideoHudRawSample[]): VideoHudSnapshot[] {
  const unique = new Map<number, VideoHudRawSample>();
  for (const sample of samples) {
    const key = Math.round(sample.second * 10);
    const previous = unique.get(key);
    if (!previous || sample.locatorSignal > previous.locatorSignal) unique.set(key, sample);
  }
  const ordered = [...unique.values()].sort((a, b) => a.second - b.second);
  if (!ordered.length) return [];

  const ammoModel = calibration(ordered.map((item) => item.ammoEnergy), .0020, .0007);
  const superModel = calibration(ordered.map((item) => item.superEnergy), .0018, .0007);
  const hyperModel = calibration(ordered.map((item) => item.hyperEnergy), .0012, .0005);
  const objectiveModel = calibration(ordered.map((item) => item.objectiveEnergy), .0010, .0004);

  const provisional: VideoHudSnapshot[] = ordered.map((sample) => {
    const ammoPercent = normalized(sample.ammoEnergy, ammoModel);
    const superCharge = normalized(sample.superEnergy, superModel);
    const hyperCharge = normalized(sample.hyperEnergy, hyperModel);
    const positionConfidence = clamp100(sample.locatorSignal * 100);
    const resourceReliability = Math.max(ammoModel.reliability, superModel.reliability, hyperModel.reliability);
    const hudConfidence = clamp100(24 + positionConfidence * .38 + (sample.hpSignal !== undefined ? 12 : 0) + resourceReliability * .26);
    const objectivePercent = normalized(sample.objectiveEnergy, objectiveModel);

    return {
      second: sample.second,
      playerX: sample.playerX,
      playerY: sample.playerY,
      positionConfidence,
      hpPercent: sample.hpSignal,
      ammoEstimate: ammoPercent === undefined ? undefined : Math.max(0, Math.min(3, Math.round(ammoPercent / 33))) as 0 | 1 | 2 | 3,
      ammoPercent,
      superCharge,
      superReady: false,
      hyperCharge,
      hyperReady: false,
      objectivePossession: objectivePercent === undefined ? "unknown" : objectivePercent >= 68 ? "probable" : "no",
      hudConfidence,
    };
  });

  const smoothed = provisional.map((snapshot, index) => {
    const x = median(windowValues(provisional, index, .85, (item) => item.positionConfidence >= 38 ? item.playerX : undefined));
    const y = median(windowValues(provisional, index, .85, (item) => item.positionConfidence >= 38 ? item.playerY : undefined));
    const hp = median(windowValues(provisional, index, .65, (item) => item.hpPercent));
    const ammo = median(windowValues(provisional, index, .62, (item) => item.ammoPercent));
    const superCharge = median(windowValues(provisional, index, .82, (item) => item.superCharge));
    const hyperCharge = median(windowValues(provisional, index, .82, (item) => item.hyperCharge));

    const neighborhood = provisional.filter((item) => Math.abs(item.second - snapshot.second) <= .75 && item.objectivePossession !== "unknown");
    const probableVotes = neighborhood.filter((item) => item.objectivePossession === "probable").length;
    const objectivePossession = !neighborhood.length
      ? "unknown" as const
      : probableVotes >= Math.max(2, Math.ceil(neighborhood.length * .55))
        ? "probable" as const
        : "no" as const;

    return {
      ...snapshot,
      playerX: x,
      playerY: y,
      hpPercent: hp === undefined ? undefined : clamp100(hp),
      ammoPercent: ammo === undefined ? undefined : clamp100(ammo),
      ammoEstimate: ammo === undefined ? undefined : Math.max(0, Math.min(3, Math.round(ammo / 33))) as 0 | 1 | 2 | 3,
      superCharge: superCharge === undefined ? undefined : clamp100(superCharge),
      hyperCharge: hyperCharge === undefined ? undefined : clamp100(hyperCharge),
      objectivePossession,
    };
  });

  let superReady = false;
  let hyperReady = false;
  return smoothed.map((snapshot) => {
    if (snapshot.superCharge !== undefined) {
      if (!superReady && snapshot.superCharge >= 84 && superModel.reliability >= 28) superReady = true;
      else if (superReady && snapshot.superCharge <= 38) superReady = false;
    } else {
      superReady = false;
    }
    if (snapshot.hyperCharge !== undefined) {
      if (!hyperReady && snapshot.hyperCharge >= 87 && hyperModel.reliability >= 30) hyperReady = true;
      else if (hyperReady && snapshot.hyperCharge <= 42) hyperReady = false;
    } else {
      hyperReady = false;
    }
    return { ...snapshot, superReady, hyperReady };
  });
}

function nearestBefore(snapshots: VideoHudSnapshot[], second: number, maxGap = 2.8) {
  let best: VideoHudSnapshot | undefined;
  for (const snapshot of snapshots) {
    if (snapshot.second > second) break;
    if (second - snapshot.second <= maxGap) best = snapshot;
  }
  return best;
}

function windowAt(windows: TeamStateWindow[], second: number) {
  return windows.find((window) => second >= window.startSecond && second < window.endSecond);
}

function hasBreak(events: VideoReviewEvent[], start: number, end: number) {
  return events.some((event) => event.second > start && event.second <= end && ["death", "respawn", "scene"].includes(event.key));
}

function buildReadyHoldMoments(
  snapshots: VideoHudSnapshot[],
  events: VideoReviewEvent[],
  key: "superReady" | "hyperReady",
  minimumSeconds: number,
) {
  const moments: VideoStateMoment[] = [];
  let start: VideoHudSnapshot | undefined;
  let previous: VideoHudSnapshot | undefined;
  let totalSeconds = 0;

  const flush = () => {
    if (!start || !previous) return;
    const span = Math.max(0, previous.second - start.second);
    if (span >= minimumSeconds) {
      totalSeconds += span;
      moments.push({
        second: start.second,
        label: key === "superReady" ? "Super lista sostenida" : "Hipercarga lista sostenida",
        detail: `Recurso visualmente listo durante ≈${Math.round(span)} s. Es una ventana para revisar timing; no implica error por sí sola.`,
        priority: span >= minimumSeconds * 1.6 ? "Alta" : "Media",
      });
    }
    start = undefined;
    previous = undefined;
  };

  for (const snapshot of snapshots) {
    const ready = snapshot[key];
    const gap = previous ? snapshot.second - previous.second : 0;
    if (!ready || (previous && (gap > 2.8 || hasBreak(events, previous.second, snapshot.second)))) {
      flush();
      if (!ready) continue;
    }
    if (!start) start = snapshot;
    previous = snapshot;
  }
  flush();
  return { moments, totalSeconds: Math.round(totalSeconds) };
}

export function buildVideoStateReadoutV27(
  snapshots: VideoHudSnapshot[],
  events: VideoReviewEvent[],
  mode: string,
  duration: number,
): VideoStateReadoutV27 {
  const base = buildVideoStateReadout(snapshots, events, mode, duration);
  const usable = snapshots.filter((snapshot) => snapshot.hudConfidence >= 48);
  const stable = usable.filter((snapshot) => snapshot.positionConfidence >= 60 && snapshot.playerX !== undefined && snapshot.playerY !== undefined);
  const averageConfidence = usable.length
    ? usable.reduce((sum, snapshot) => sum + snapshot.hudConfidence, 0) / usable.length
    : 0;
  const coverageFactor = usable.length ? .72 + .28 * (stable.length / usable.length) : 0;
  const hudQualityScore = clamp100(averageConfidence * coverageFactor);
  const hudQuality: VideoStateReadoutV27["hudQuality"] = hudQualityScore >= 70 ? "Alta" : hudQualityScore >= 52 ? "Media" : "Baja";
  const stableTrackingShare = percent(stable.length, usable.length);
  const teamWindows = buildTeamStateWindows(events, mode, duration);
  const ownDeaths = events.filter((event) => event.key === "death");
  let criticalDeaths = 0;
  const criticalBySecond = new Map<number, number>();

  for (const death of ownDeaths) {
    const snapshot = nearestBefore(usable, death.second);
    if (!snapshot) continue;
    const team = windowAt(teamWindows, Math.max(0, death.second - .15));
    let risk = 0;
    if (snapshot.hpPercent !== undefined && snapshot.hpPercent <= 35) risk += 2;
    if (snapshot.ammoEstimate !== undefined && snapshot.ammoEstimate <= 1) risk += 1;
    if (snapshot.superReady) risk += 1;
    if (snapshot.hyperReady) risk += 1;
    if (snapshot.objectivePossession === "probable") risk += 2;
    if (team && team.friendlyAlive < team.enemyAlive) risk += 1;
    if (risk >= 3) {
      criticalDeaths += 1;
      criticalBySecond.set(death.second, risk);
    }
  }

  const superHold = buildReadyHoldMoments(usable, events, "superReady", 8);
  const hyperHold = buildReadyHoldMoments(usable, events, "hyperReady", 6);
  const enrichedDeaths = base.moments.map((moment) => {
    const matching = [...criticalBySecond.entries()].find(([second]) => Math.abs((second - 2.5) - moment.second) <= 1.2);
    if (!matching) return moment;
    return {
      ...moment,
      label: `Muerte de alto riesgo · ${matching[1]}/8`,
      priority: "Alta" as const,
    };
  });

  const risks = [...base.risks];
  const actions = [...base.actions];
  if (criticalDeaths) risks.unshift(`${criticalDeaths} muerte(s) combinan al menos tres factores de riesgo de estado (HP, munición, recurso listo, objetivo o inferioridad).`);
  if (superHold.totalSeconds >= 12) risks.push(`La super aparece lista durante ≈${superHold.totalSeconds} s acumulados en tramos sostenidos; revisa si hubo una ventana de valor perdida antes de concluir que fue ahorro correcto.`);
  if (hudQuality === "Baja") risks.push("La calidad agregada del HUD es baja; prioriza eventos/bajas y usa los recursos estimados solo como pista de revisión.");
  if (criticalDeaths) actions.unshift("Revisa primero las muertes marcadas como alto riesgo: concentran varios errores potenciales en la misma decisión y suelen ofrecer el mayor retorno de coaching.");
  if (superHold.moments.length || hyperHold.moments.length) actions.push("En los tramos de recurso listo sostenido, busca una ventana concreta de uso; conservarlo puede ser correcto si la condición de valor aún no había aparecido.");

  return {
    ...base,
    hudQuality,
    hudQualityScore,
    stableTrackingShare,
    criticalDeaths,
    superHoldSeconds: superHold.totalSeconds,
    hyperHoldSeconds: hyperHold.totalSeconds,
    moments: [...enrichedDeaths, ...superHold.moments, ...hyperHold.moments]
      .sort((a, b) => a.second - b.second)
      .slice(0, 12),
    risks: risks.slice(0, 7),
    actions: actions.slice(0, 7),
  };
}
