import type { VideoReviewEvent } from "./video-review";

export type VideoHudRawSample = {
  second: number;
  playerX?: number;
  playerY?: number;
  locatorSignal: number;
  hpSignal?: number;
  ammoEnergy: number;
  superEnergy: number;
  hyperEnergy: number;
  objectiveEnergy: number;
};

export type VideoHudSnapshot = {
  second: number;
  playerX?: number;
  playerY?: number;
  positionConfidence: number;
  hpPercent?: number;
  ammoEstimate?: 0 | 1 | 2 | 3;
  ammoPercent?: number;
  superCharge?: number;
  superReady: boolean;
  hyperCharge?: number;
  hyperReady: boolean;
  objectivePossession: "probable" | "no" | "unknown";
  hudConfidence: number;
};

export type TeamStateWindow = {
  startSecond: number;
  endSecond: number;
  friendlyAlive: number;
  enemyAlive: number;
  label: string;
  confidence: number;
};

export type VideoStateMoment = {
  second: number;
  label: string;
  detail: string;
  priority: "Alta" | "Media";
};

export type VideoStateReadout = {
  snapshots: number;
  playerLocatedShare: number;
  hpReadableShare: number;
  lowHpShare: number;
  lowAmmoShare: number;
  superReadyShare: number;
  hyperReadyShare: number;
  possessionShare: number;
  deathsLowHp: number;
  deathsDryAmmo: number;
  deathsWithSuperReady: number;
  deathsWithObjective: number;
  advantageSeconds: number;
  disadvantageSeconds: number;
  teamWindows: TeamStateWindow[];
  moments: VideoStateMoment[];
  strengths: string[];
  risks: string[];
  actions: string[];
};

type NormalizedRegion = { x0: number; y0: number; x1: number; y1: number };

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
  let weightedX = 0;
  let weightedY = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (predicate(r, g, b)) {
        matches += 1;
        weightedX += x;
        weightedY += y;
      }
      samples += 1;
    }
  }

  return {
    ratio: samples ? matches / samples : 0,
    matches,
    x: matches ? weightedX / matches / width : undefined,
    y: matches ? weightedY / matches / height : undefined,
  };
}

const isFriendlyMarker = (r: number, g: number, b: number) => {
  const sat = saturation(r, g, b);
  const cyan = b > r * 1.28 && g > r * 1.10 && b > 95;
  const green = g > 125 && g > r * 1.28 && g > b * 1.04;
  return sat > .30 && (cyan || green);
};

const isHealthGreen = (r: number, g: number, b: number) =>
  g > 120 && g > r * 1.34 && g > b * 1.10 && saturation(r, g, b) > .34;

const isAmmoGold = (r: number, g: number, b: number) =>
  r > 145 && g > 92 && b < 125 && r > b * 1.35 && saturation(r, g, b) > .34;

const isSuperEnergy = (r: number, g: number, b: number) => {
  const sat = saturation(r, g, b);
  const gold = r > 150 && g > 105 && b < 125;
  const cyan = b > 135 && g > 110 && r < 120;
  return sat > .28 && (gold || cyan);
};

const isHyperPurple = (r: number, g: number, b: number) =>
  r > 105 && b > 140 && b > g * 1.22 && r > g * .92 && saturation(r, g, b) > .30;

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
 * Extrae señales del HUD sin OCR ni modelos externos. El brawler se fija por el
 * contexto que selecciona el usuario; la visión intenta localizar su marcador
 * de equipo/cámara y estimar recursos de forma relativa al propio vídeo.
 */
export function sampleVideoHudFrame(
  image: ImageData,
  second: number,
  mode: string,
): VideoHudRawSample {
  const battlefield = scanRegion(image, { x0: .18, y0: .18, x1: .82, y1: .86 }, isFriendlyMarker);
  const locatorSignal = clamp01(battlefield.ratio * 16);
  const playerX = battlefield.matches >= 10 ? battlefield.x : undefined;
  const playerY = battlefield.matches >= 10 ? battlefield.y : undefined;
  const hpSignal = playerX !== undefined && playerY !== undefined
    ? healthBarSignal(image, playerX, playerY)
    : undefined;

  const ammo = scanRegion(image, { x0: .70, y0: .67, x1: .985, y1: .985 }, isAmmoGold);
  const superRegion = scanRegion(image, { x0: .72, y0: .50, x1: .985, y1: .93 }, isSuperEnergy);
  const hyperRegion = scanRegion(image, { x0: .61, y0: .58, x1: .94, y1: .985 }, isHyperPurple);

  let objectiveEnergy = 0;
  if (playerX !== undefined && playerY !== undefined && (mode === "Balón Brawl" || mode === "Atrapagemas")) {
    const radiusX = .13;
    const radiusY = .18;
    const predicate = mode === "Balón Brawl" ? isBallEnergy : isGemEnergy;
    objectiveEnergy = scanRegion(image, {
      x0: Math.max(0, playerX - radiusX),
      y0: Math.max(0, playerY - radiusY),
      x1: Math.min(1, playerX + radiusX),
      y1: Math.min(1, playerY + radiusY),
    }, predicate).ratio;
  }

  return {
    second,
    playerX,
    playerY,
    locatorSignal,
    hpSignal,
    ammoEnergy: ammo.ratio,
    superEnergy: superRegion.ratio,
    hyperEnergy: hyperRegion.ratio,
    objectiveEnergy,
  };
}

/**
 * Calibra recursos contra el propio vídeo: esto reduce el impacto de resolución,
 * brillo, skin, dispositivo y escalado del HUD. La salida sigue siendo un proxy,
 * nunca un contador oficial leído por OCR.
 */
export function finalizeVideoHudSamples(samples: VideoHudRawSample[]): VideoHudSnapshot[] {
  const unique = new Map<number, VideoHudRawSample>();
  for (const sample of samples) {
    const key = Math.round(sample.second * 10);
    const previous = unique.get(key);
    if (!previous || sample.locatorSignal > previous.locatorSignal) unique.set(key, sample);
  }
  const ordered = [...unique.values()].sort((a, b) => a.second - b.second);
  const ammoHigh = Math.max(.001, quantile(ordered.map((item) => item.ammoEnergy), .92));
  const superHigh = Math.max(.001, quantile(ordered.map((item) => item.superEnergy), .92));
  const hyperHigh = Math.max(.0008, quantile(ordered.map((item) => item.hyperEnergy), .94));
  const objectiveHigh = Math.max(.001, quantile(ordered.map((item) => item.objectiveEnergy), .94));

  return ordered.map((sample) => {
    const ammoPercent = clamp100(sample.ammoEnergy / ammoHigh * 100);
    const ammoEstimate = Math.max(0, Math.min(3, Math.round(ammoPercent / 33))) as 0 | 1 | 2 | 3;
    const superCharge = clamp100(sample.superEnergy / superHigh * 100);
    const hyperCharge = clamp100(sample.hyperEnergy / hyperHigh * 100);
    const positionConfidence = clamp100(sample.locatorSignal * 100);
    const resourceSignal = Math.max(sample.ammoEnergy / ammoHigh, sample.superEnergy / superHigh, sample.hyperEnergy / hyperHigh);
    const hudConfidence = clamp100(42 + positionConfidence * .28 + Math.min(1, resourceSignal) * 28 + (sample.hpSignal !== undefined ? 10 : 0));
    const objectivePossession = objectiveHigh <= .0012
      ? "unknown" as const
      : sample.objectiveEnergy >= objectiveHigh * .62
        ? "probable" as const
        : "no" as const;

    return {
      second: sample.second,
      playerX: sample.playerX,
      playerY: sample.playerY,
      positionConfidence,
      hpPercent: sample.hpSignal,
      ammoEstimate,
      ammoPercent,
      superCharge,
      superReady: superCharge >= 78,
      hyperCharge,
      hyperReady: hyperCharge >= 82,
      objectivePossession,
      hudConfidence,
    };
  });
}

function isSceneBetween(events: VideoReviewEvent[], start: number, end: number) {
  return events.some((event) => event.key === "scene" && event.second > start && event.second <= end);
}

function activeDeathCount(
  events: VideoReviewEvent[],
  key: "ally-death" | "enemy-death",
  second: number,
  mode: string,
) {
  const relevant = events.filter((event) => event.key === key && event.second <= second);
  let count = 0;
  for (const event of relevant) {
    if (isSceneBetween(events, event.second, second)) continue;
    if (mode === "Noqueo") {
      count += 1;
      continue;
    }
    if (second - event.second <= 8.5) count += 1;
  }
  return Math.min(2, count);
}

function ownDown(events: VideoReviewEvent[], second: number, mode: string) {
  const deaths = events.filter((event) => event.key === "death" && event.second <= second);
  if (!deaths.length) return false;
  const last = deaths[deaths.length - 1];
  if (isSceneBetween(events, last.second, second)) return false;
  const respawn = events.find((event) => event.key === "respawn" && event.second > last.second && event.second <= second);
  if (respawn) return false;
  return mode === "Noqueo" ? true : second - last.second <= 9.5;
}

function stateAt(events: VideoReviewEvent[], second: number, mode: string) {
  const friendlyDown = Math.min(2, activeDeathCount(events, "ally-death", second, mode) + (ownDown(events, second, mode) ? 1 : 0));
  const enemyDown = activeDeathCount(events, "enemy-death", second, mode);
  return {
    friendlyAlive: Math.max(1, 3 - friendlyDown),
    enemyAlive: Math.max(1, 3 - enemyDown),
  };
}

export function buildTeamStateWindows(
  events: VideoReviewEvent[],
  mode: string,
  duration: number,
): TeamStateWindow[] {
  const safeDuration = Math.max(1, duration);
  const points = new Set<number>([0, safeDuration]);
  for (const event of events) {
    if (!["death", "ally-death", "enemy-death", "respawn", "scene"].includes(event.key)) continue;
    points.add(Math.max(0, Math.min(safeDuration, event.second)));
    if (mode !== "Noqueo" && ["death", "ally-death", "enemy-death"].includes(event.key)) {
      points.add(Math.max(0, Math.min(safeDuration, event.second + (event.key === "death" ? 9.5 : 8.5))));
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
    const confidence = label === "3v3" ? 62 : 78;
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

function nearestBefore(snapshots: VideoHudSnapshot[], second: number, maxGap = 2.6) {
  let best: VideoHudSnapshot | undefined;
  for (const snapshot of snapshots) {
    if (snapshot.second > second) break;
    if (second - snapshot.second <= maxGap) best = snapshot;
  }
  return best;
}

function positionLabel(snapshot?: VideoHudSnapshot) {
  if (!snapshot || snapshot.playerX === undefined || snapshot.playerY === undefined) return "posición no localizada";
  const horizontal = snapshot.playerX < .42 ? "izquierda" : snapshot.playerX > .58 ? "derecha" : "centro";
  const vertical = snapshot.playerY < .42 ? "parte alta" : snapshot.playerY > .62 ? "parte baja" : "franja media";
  return `${horizontal} · ${vertical} del encuadre`;
}

export function buildVideoStateReadout(
  snapshots: VideoHudSnapshot[],
  events: VideoReviewEvent[],
  mode: string,
  duration: number,
): VideoStateReadout {
  const usable = snapshots.filter((snapshot) => snapshot.hudConfidence >= 48);
  const located = usable.filter((snapshot) => snapshot.positionConfidence >= 42 && snapshot.playerX !== undefined);
  const hpReadable = usable.filter((snapshot) => snapshot.hpPercent !== undefined);
  const lowHp = hpReadable.filter((snapshot) => (snapshot.hpPercent || 100) <= 35);
  const ammoReadable = usable.filter((snapshot) => snapshot.ammoEstimate !== undefined);
  const lowAmmo = ammoReadable.filter((snapshot) => (snapshot.ammoEstimate || 0) <= 1);
  const superReady = usable.filter((snapshot) => snapshot.superReady);
  const hyperReady = usable.filter((snapshot) => snapshot.hyperReady);
  const objectiveReadable = usable.filter((snapshot) => snapshot.objectivePossession !== "unknown");
  const possession = objectiveReadable.filter((snapshot) => snapshot.objectivePossession === "probable");
  const ownDeaths = events.filter((event) => event.key === "death");
  let deathsLowHp = 0;
  let deathsDryAmmo = 0;
  let deathsWithSuperReady = 0;
  let deathsWithObjective = 0;
  const moments: VideoStateMoment[] = [];

  for (const death of ownDeaths) {
    const snapshot = nearestBefore(usable, death.second);
    if (!snapshot) continue;
    const details: string[] = [];
    if (snapshot.hpPercent !== undefined) details.push(`HP≈${snapshot.hpPercent}%`);
    if (snapshot.ammoEstimate !== undefined) details.push(`munición≈${snapshot.ammoEstimate}/3`);
    if (snapshot.superReady) details.push("super lista");
    if (snapshot.hyperReady) details.push("hipercarga lista");
    if (snapshot.objectivePossession === "probable") details.push(mode === "Atrapagemas" ? "portando gemas probable" : mode === "Balón Brawl" ? "balón probable" : "objetivo probable");
    details.push(positionLabel(snapshot));

    if (snapshot.hpPercent !== undefined && snapshot.hpPercent <= 35) deathsLowHp += 1;
    if (snapshot.ammoEstimate !== undefined && snapshot.ammoEstimate <= 1) deathsDryAmmo += 1;
    if (snapshot.superReady) deathsWithSuperReady += 1;
    if (snapshot.objectivePossession === "probable") deathsWithObjective += 1;

    moments.push({
      second: Math.max(0, death.second - 2.5),
      label: "Estado antes de tu muerte",
      detail: details.join(" · "),
      priority: snapshot.superReady || snapshot.objectivePossession === "probable" || (snapshot.hpPercent !== undefined && snapshot.hpPercent <= 35) ? "Alta" : "Media",
    });
  }

  const teamWindows = buildTeamStateWindows(events, mode, duration);
  let advantageSeconds = 0;
  let disadvantageSeconds = 0;
  for (const window of teamWindows) {
    const span = Math.max(0, window.endSecond - window.startSecond);
    if (window.friendlyAlive > window.enemyAlive) advantageSeconds += span;
    if (window.friendlyAlive < window.enemyAlive) disadvantageSeconds += span;
  }

  const strengths: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  if (advantageSeconds >= 10) strengths.push(`El detector reconstruye ≈${Math.round(advantageSeconds)} s de superioridad numérica; úsalo para revisar cuánto de ese tiempo terminó en objetivo.`);
  if (superReady.length && deathsWithSuperReady === 0) strengths.push("No aparece una muerte propia clara con la super ya disponible en la muestra legible del HUD.");
  if (possession.length && deathsWithObjective === 0) strengths.push("Las ventanas con posesión/portador probable no coinciden con una muerte propia detectada.");

  if (deathsLowHp) risks.push(`${deathsLowHp} muerte(s) propia(s) llegan con HP visual estimado ≤35% poco antes del evento.`);
  if (deathsDryAmmo) risks.push(`${deathsDryAmmo} muerte(s) propia(s) llegan con ≤1 munición estimada: posible entrada sin recursos o recarga tardía.`);
  if (deathsWithSuperReady) risks.push(`${deathsWithSuperReady} muerte(s) propia(s) aparecen con la super visualmente lista; revisa si debía usarse para ganar, escapar o negar la entrada.`);
  if (deathsWithObjective) risks.push(`${deathsWithObjective} muerte(s) propia(s) coinciden con posesión/portador probable: son candidatas a error de riesgo de objetivo.`);
  if (disadvantageSeconds >= 10) risks.push(`Se reconstruyen ≈${Math.round(disadvantageSeconds)} s de inferioridad numérica; revisa si el equipo cedió espacio hasta reagrupar.`);
  if (percent(located.length, usable.length) < 45) risks.push("La localización del jugador es inestable en este vídeo; no uses la posición aproximada como coordenada absoluta del mapa.");

  if (deathsDryAmmo) actions.push("Abre cada muerte con poca munición 2–3 s antes y comprueba si el engage empezó antes de completar la recarga.");
  if (deathsWithSuperReady) actions.push("Para cada muerte con super lista, define antes del replay si la condición correcta era usarla ofensivamente, defensivamente o conservarla; así evitas juzgar solo por resultado.");
  if (deathsWithObjective) actions.push("Prioriza las muertes con balón/gemas probables: el umbral de riesgo debe ser más conservador cuando llevas la condición de victoria.");
  if (disadvantageSeconds > advantageSeconds) actions.push("Compara los tramos 2v3/1v3 con la siguiente reagrupación: mide si se regaló una segunda baja antes de volver a 3v3.");
  actions.push("La identidad del brawler queda anclada al brawler seleccionado en la grabación; la visión v0.26 estima HUD/estado, no hace reconocimiento facial o de skin.");

  return {
    snapshots: usable.length,
    playerLocatedShare: percent(located.length, usable.length),
    hpReadableShare: percent(hpReadable.length, usable.length),
    lowHpShare: percent(lowHp.length, hpReadable.length),
    lowAmmoShare: percent(lowAmmo.length, ammoReadable.length),
    superReadyShare: percent(superReady.length, usable.length),
    hyperReadyShare: percent(hyperReady.length, usable.length),
    possessionShare: percent(possession.length, objectiveReadable.length),
    deathsLowHp,
    deathsDryAmmo,
    deathsWithSuperReady,
    deathsWithObjective,
    advantageSeconds: Math.round(advantageSeconds),
    disadvantageSeconds: Math.round(disadvantageSeconds),
    teamWindows: teamWindows.filter((window) => window.label !== "3v3" || window.endSecond - window.startSecond >= 5).slice(0, 16),
    moments: moments.sort((a, b) => a.second - b.second).slice(0, 8),
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 6),
    actions: actions.slice(0, 6),
  };
}
