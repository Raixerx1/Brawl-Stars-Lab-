import type {
  AutoReviewSensitivity,
  LiveEventTone,
} from "./types";

export type FrameMetrics = {
  globalLuma: number;
  globalSaturation: number;
  globalDarkRatio: number;
  motion: number;
  centerLuma: number;
  centerSaturation: number;
  centerDarkRatio: number;
  centerMotion: number;
  topMotion: number;
  leftTopMotion: number;
  bottomRightEnergy: number;
  bottomRightMotion: number;
};

export type AutoDetection = {
  key: string;
  eventLabel?: string;
  category: string;
  tone: LiveEventTone;
  confidence: number;
  comment: string;
};

export type AutoDetectorState = {
  samples: number;
  baseline?: FrameMetrics;
  previous?: FrameMetrics;
  previousGray?: Uint8Array;
  deathCandidate: number;
  deathActive: boolean;
  objectiveCandidate: number;
  sceneCandidate: number;
  combatCandidate: number;
  cooldowns: Record<string, number>;
};

type Region = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type RegionStats = {
  luma: number;
  saturation: number;
  darkRatio: number;
  motion: number;
};

const REGIONS = {
  global: { x0: 0, y0: 0, x1: 1, y1: 1 },
  center: { x0: .22, y0: .18, x1: .78, y1: .82 },
  top: { x0: .12, y0: 0, x1: .88, y1: .26 },
  leftTop: { x0: 0, y0: 0, x1: .42, y1: .30 },
  bottomRight: { x0: .68, y0: .56, x1: 1, y1: 1 },
} satisfies Record<string, Region>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const roundConfidence = (value: number) => Math.round(clamp01(value) * 100) / 100;

function pixelSaturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function regionStats(
  image: ImageData,
  gray: Uint8Array,
  previousGray: Uint8Array | undefined,
  region: Region,
): RegionStats {
  const { width, height, data } = image;
  const startX = Math.floor(width * region.x0);
  const endX = Math.max(startX + 1, Math.floor(width * region.x1));
  const startY = Math.floor(height * region.y0);
  const endY = Math.max(startY + 1, Math.floor(height * region.y1));

  let lumaTotal = 0;
  let saturationTotal = 0;
  let dark = 0;
  let motionTotal = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const pixelIndex = y * width + x;
      const dataIndex = pixelIndex * 4;
      const r = data[dataIndex];
      const g = data[dataIndex + 1];
      const b = data[dataIndex + 2];
      const luma = gray[pixelIndex];

      lumaTotal += luma / 255;
      saturationTotal += pixelSaturation(r, g, b);
      if (luma < 52) dark += 1;
      if (previousGray) motionTotal += Math.abs(luma - previousGray[pixelIndex]) / 255;
      count += 1;
    }
  }

  if (!count) return { luma: 0, saturation: 0, darkRatio: 0, motion: 0 };

  return {
    luma: lumaTotal / count,
    saturation: saturationTotal / count,
    darkRatio: dark / count,
    motion: previousGray ? motionTotal / count : 0,
  };
}

export function createAutoDetectorState(): AutoDetectorState {
  return {
    samples: 0,
    deathCandidate: 0,
    deathActive: false,
    objectiveCandidate: 0,
    sceneCandidate: 0,
    combatCandidate: 0,
    cooldowns: {},
  };
}

export function analyzeFrame(
  image: ImageData,
  previousGray?: Uint8Array,
): { metrics: FrameMetrics; gray: Uint8Array } {
  const { width, height, data } = image;
  const gray = new Uint8Array(width * height);

  for (let index = 0; index < gray.length; index += 1) {
    const dataIndex = index * 4;
    gray[index] = Math.round(
      data[dataIndex] * .2126 +
      data[dataIndex + 1] * .7152 +
      data[dataIndex + 2] * .0722
    );
  }

  const global = regionStats(image, gray, previousGray, REGIONS.global);
  const center = regionStats(image, gray, previousGray, REGIONS.center);
  const top = regionStats(image, gray, previousGray, REGIONS.top);
  const leftTop = regionStats(image, gray, previousGray, REGIONS.leftTop);
  const bottomRight = regionStats(image, gray, previousGray, REGIONS.bottomRight);

  const bottomRightEnergy = clamp01(
    bottomRight.saturation * .62 +
    bottomRight.luma * .28 +
    (1 - bottomRight.darkRatio) * .10
  );

  return {
    gray,
    metrics: {
      globalLuma: global.luma,
      globalSaturation: global.saturation,
      globalDarkRatio: global.darkRatio,
      motion: global.motion,
      centerLuma: center.luma,
      centerSaturation: center.saturation,
      centerDarkRatio: center.darkRatio,
      centerMotion: center.motion,
      topMotion: top.motion,
      leftTopMotion: leftTop.motion,
      bottomRightEnergy,
      bottomRightMotion: bottomRight.motion,
    },
  };
}

function thresholdFor(sensitivity: AutoReviewSensitivity) {
  if (sensitivity === "Alta") {
    return {
      deathFrames: 2,
      deathLumaRatio: .73,
      deathSaturationRatio: .78,
      deathDarkIncrease: .12,
      objectiveMotion: .075,
      sceneMotion: .20,
      combatMotion: .115,
      superDrop: .12,
      minConfidence: .58,
    };
  }
  if (sensitivity === "Baja") {
    return {
      deathFrames: 3,
      deathLumaRatio: .60,
      deathSaturationRatio: .66,
      deathDarkIncrease: .22,
      objectiveMotion: .13,
      sceneMotion: .30,
      combatMotion: .18,
      superDrop: .20,
      minConfidence: .72,
    };
  }
  return {
    deathFrames: 2,
    deathLumaRatio: .66,
    deathSaturationRatio: .72,
    deathDarkIncrease: .17,
    objectiveMotion: .10,
    sceneMotion: .25,
    combatMotion: .145,
    superDrop: .16,
    minConfidence: .64,
  };
}

function updateBaseline(current: FrameMetrics, previous: FrameMetrics | undefined) {
  if (!previous) return current;
  const alpha = .08;
  const blend = (a: number, b: number) => a * (1 - alpha) + b * alpha;
  return {
    globalLuma: blend(previous.globalLuma, current.globalLuma),
    globalSaturation: blend(previous.globalSaturation, current.globalSaturation),
    globalDarkRatio: blend(previous.globalDarkRatio, current.globalDarkRatio),
    motion: blend(previous.motion, current.motion),
    centerLuma: blend(previous.centerLuma, current.centerLuma),
    centerSaturation: blend(previous.centerSaturation, current.centerSaturation),
    centerDarkRatio: blend(previous.centerDarkRatio, current.centerDarkRatio),
    centerMotion: blend(previous.centerMotion, current.centerMotion),
    topMotion: blend(previous.topMotion, current.topMotion),
    leftTopMotion: blend(previous.leftTopMotion, current.leftTopMotion),
    bottomRightEnergy: blend(previous.bottomRightEnergy, current.bottomRightEnergy),
    bottomRightMotion: blend(previous.bottomRightMotion, current.bottomRightMotion),
  };
}

function canEmit(state: AutoDetectorState, key: string, second: number, cooldown: number) {
  return second - (state.cooldowns[key] ?? -999) >= cooldown;
}

function emit(
  state: AutoDetectorState,
  second: number,
  detection: AutoDetection,
  cooldown: number,
  output: AutoDetection[],
) {
  if (!canEmit(state, detection.key, second, cooldown)) return;
  state.cooldowns[detection.key] = second;
  output.push({
    ...detection,
    confidence: roundConfidence(detection.confidence),
  });
}

function objectiveComment(mode: string) {
  if (mode === "Zona Restringida") return "Cambio fuerte en el HUD de zona. Prioriza permanecer dentro antes de perseguir una eliminación.";
  if (mode === "Atrapagemas") return "Cambio en el marcador de gemas. Revisa quién porta las gemas y evita una entrada aislada.";
  if (mode === "Atraco") return "Cambio relevante en el objetivo. Decide rápido entre defender la caja o mantener la presión.";
  if (mode === "Balón Brawl") return "Cambio importante cerca del marcador. Recoloca las líneas y protege el siguiente avance.";
  if (mode === "Caza Estelar") return "Cambio en el marcador. Evita regalar una muerte cuando vuestro equipo ya tiene ventaja.";
  if (mode === "Noqueo") return "Posible cambio de ronda o ventaja. Conserva recursos para la siguiente interacción.";
  return "Cambio importante en el objetivo o marcador. Revisa la condición de victoria antes de perseguir.";
}

export function detectFrameEvents(
  state: AutoDetectorState,
  metrics: FrameMetrics,
  second: number,
  mode: string,
  sensitivity: AutoReviewSensitivity,
): {
  detections: AutoDetection[];
  status: "calibrating" | "active";
  calibration: number;
} {
  const thresholds = thresholdFor(sensitivity);
  const detections: AutoDetection[] = [];
  state.samples += 1;

  if (!state.baseline) state.baseline = metrics;
  const baseline = state.baseline;

  if (state.samples <= 8) {
    state.baseline = updateBaseline(metrics, state.baseline);
    state.previous = metrics;
    return {
      detections,
      status: "calibrating",
      calibration: Math.round((state.samples / 8) * 100),
    };
  }

  const centerDarkened =
    metrics.centerLuma < baseline.centerLuma * thresholds.deathLumaRatio &&
    metrics.centerSaturation < Math.max(.08, baseline.centerSaturation * thresholds.deathSaturationRatio) &&
    metrics.centerDarkRatio > baseline.centerDarkRatio + thresholds.deathDarkIncrease;

  state.deathCandidate = centerDarkened
    ? Math.min(5, state.deathCandidate + 1)
    : Math.max(0, state.deathCandidate - 1);

  if (!state.deathActive && state.deathCandidate >= thresholds.deathFrames) {
    state.deathActive = true;
    const confidence =
      .56 +
      Math.min(.18, (baseline.centerLuma - metrics.centerLuma) * .65) +
      Math.min(.14, (metrics.centerDarkRatio - baseline.centerDarkRatio) * .45);
    emit(state, second, {
      key: "death",
      eventLabel: "Muerte",
      category: "Auto · Combate",
      tone: "bad",
      confidence,
      comment: "Posible muerte detectada. Revisa si entraste sin munición, super o apoyo cercano.",
    }, 9, detections);
  }

  const recovered =
    state.deathActive &&
    metrics.centerLuma > baseline.centerLuma * .82 &&
    metrics.centerSaturation > baseline.centerSaturation * .74 &&
    metrics.centerMotion > .035;

  if (recovered) {
    state.deathActive = false;
    state.deathCandidate = 0;
    emit(state, second, {
      key: "respawn",
      eventLabel: "Reaparición",
      category: "Auto · Combate",
      tone: "neutral",
      confidence: .70,
      comment: "Reaparición probable. Reentra junto al equipo y evita encadenar una segunda muerte aislada.",
    }, 8, detections);
  }

  const previous = state.previous;
  if (previous) {
    const superDrop = previous.bottomRightEnergy - metrics.bottomRightEnergy;
    const likelySuperUse =
      superDrop > thresholds.superDrop &&
      metrics.bottomRightMotion > .10 &&
      metrics.motion < .28;

    if (likelySuperUse) {
      const confidence = .57 + Math.min(.22, superDrop * .9) + Math.min(.08, metrics.bottomRightMotion * .3);
      emit(state, second, {
        key: "super",
        eventLabel: "Super utilizada",
        category: "Auto · Recursos",
        tone: "neutral",
        confidence,
        comment: "Posible uso de super. Comprueba si produjo control del objetivo, una eliminación o una ventaja de recursos.",
      }, 7, detections);
    }
  }

  const objectiveActivity =
    metrics.topMotion > thresholds.objectiveMotion &&
    metrics.topMotion > metrics.motion * 1.16 &&
    metrics.motion < .24;

  state.objectiveCandidate = objectiveActivity
    ? Math.min(4, state.objectiveCandidate + 1)
    : Math.max(0, state.objectiveCandidate - 1);

  if (state.objectiveCandidate >= 2) {
    const confidence = .58 + Math.min(.20, metrics.topMotion * .8);
    emit(state, second, {
      key: "objective",
      eventLabel: "Cambio de objetivo",
      category: "Auto · Objetivo",
      tone: "objective",
      confidence,
      comment: objectiveComment(mode),
    }, 8, detections);
    state.objectiveCandidate = 0;
  }

  const sceneChange = metrics.motion > thresholds.sceneMotion;
  state.sceneCandidate = sceneChange ? state.sceneCandidate + 1 : Math.max(0, state.sceneCandidate - 1);

  if (state.sceneCandidate >= 2) {
    emit(state, second, {
      key: "scene",
      eventLabel: "Cambio de fase",
      category: "Auto · Partida",
      tone: "neutral",
      confidence: .64 + Math.min(.18, metrics.motion * .45),
      comment: "Cambio de fase o ronda probable. Revisa el marcador y reajusta el plan antes de la siguiente salida.",
    }, 14, detections);
    state.sceneCandidate = 0;
  }

  const combatActivity =
    metrics.motion > thresholds.combatMotion &&
    metrics.centerMotion > thresholds.combatMotion * .95 &&
    metrics.leftTopMotion > .06;

  state.combatCandidate = combatActivity
    ? Math.min(5, state.combatCandidate + 1)
    : Math.max(0, state.combatCandidate - 1);

  if (state.combatCandidate >= 3) {
    emit(state, second, {
      key: "combat",
      eventLabel: "Interacción intensa",
      category: "Auto · Combate",
      tone: "neutral",
      confidence: .60 + Math.min(.16, metrics.centerMotion * .45),
      comment: "Interacción intensa detectada. Comprueba si conservaste la línea, la munición y la posibilidad de retirada.",
    }, 11, detections);
    state.combatCandidate = 0;
  }

  const safeForBaseline =
    !state.deathActive &&
    metrics.motion < .16 &&
    metrics.centerDarkRatio < baseline.centerDarkRatio + .10;

  if (safeForBaseline) state.baseline = updateBaseline(metrics, state.baseline);
  state.previous = metrics;

  return {
    detections: detections.filter((detection) => detection.confidence >= thresholds.minConfidence),
    status: "active",
    calibration: 100,
  };
}
