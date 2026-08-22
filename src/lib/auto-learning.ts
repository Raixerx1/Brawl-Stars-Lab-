import type {
  AutoFeedbackProfile,
  AutoFeedbackStat,
  AutoFeedbackVerdict,
  LiveMatchEvent,
  LiveEventTone,
} from "./types";

export const AUTO_FEEDBACK_KEY = "brawl-lab:auto-feedback-v1";

export type SequenceInsight = {
  key: string;
  second: number;
  label: string;
  category: string;
  tone: LiveEventTone;
  confidence: number;
  comment: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function readAutoFeedback(): AutoFeedbackProfile {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(AUTO_FEEDBACK_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    return Object.fromEntries(
      Object.entries(raw).flatMap(([key, value]) => {
        if (!value || typeof value !== "object") return [];
        const stat = value as Partial<AutoFeedbackStat>;
        return [[key, {
          accepted: Math.max(0, Number(stat.accepted) || 0),
          rejected: Math.max(0, Number(stat.rejected) || 0),
        }]];
      }),
    );
  } catch {
    return {};
  }
}

export function saveAutoFeedback(profile: AutoFeedbackProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_FEEDBACK_KEY, JSON.stringify(profile));
  } catch {
    // El análisis continúa aunque el navegador bloquee el almacenamiento local.
  }
}

export function registerAutoFeedback(
  profile: AutoFeedbackProfile,
  key: string,
  verdict: AutoFeedbackVerdict,
): AutoFeedbackProfile {
  const current = profile[key] || { accepted: 0, rejected: 0 };
  return {
    ...profile,
    [key]: {
      accepted: current.accepted + (verdict === "accepted" ? 1 : 0),
      rejected: current.rejected + (verdict === "rejected" ? 1 : 0),
    },
  };
}

export function feedbackSummary(profile: AutoFeedbackProfile) {
  const totals = Object.values(profile).reduce(
    (accumulator, stat) => ({
      accepted: accumulator.accepted + stat.accepted,
      rejected: accumulator.rejected + stat.rejected,
    }),
    { accepted: 0, rejected: 0 },
  );
  const reviewed = totals.accepted + totals.rejected;
  return {
    ...totals,
    reviewed,
    precision: reviewed ? Math.round((totals.accepted / reviewed) * 100) : undefined,
  };
}

export function adjustConfidence(
  confidence: number,
  key: string,
  profile: AutoFeedbackProfile,
) {
  const stat = profile[key];
  if (!stat) return confidence;
  const total = stat.accepted + stat.rejected;
  if (!total) return confidence;

  const acceptanceRate = (stat.accepted + 2) / (total + 4);
  const bias = (acceptanceRate - .5) * Math.min(.14, total * .018);
  return clamp(confidence + bias, .35, .96);
}

export function isDetectionSuppressed(
  confidence: number,
  key: string,
  profile: AutoFeedbackProfile,
) {
  const stat = profile[key];
  if (!stat) return false;
  const total = stat.accepted + stat.rejected;
  if (total < 5) return false;
  const acceptanceRate = stat.accepted / total;
  return acceptanceRate < .25 && confidence < .78;
}

const recentBefore = (
  events: LiveMatchEvent[],
  labels: string | string[],
  second: number,
  maxSeconds: number,
) => {
  const wanted = Array.isArray(labels) ? labels : [labels];
  return [...events]
    .reverse()
    .find((event) => wanted.includes(event.label) && second - event.second >= 0 && second - event.second <= maxSeconds);
};

const lastTwo = (events: LiveMatchEvent[], labels: string | string[]) => {
  const wanted = Array.isArray(labels) ? labels : [labels];
  return events.filter((event) => wanted.includes(event.label)).slice(-2);
};

export function deriveSequenceInsights(
  events: LiveMatchEvent[],
  emittedKeys: Set<string>,
): SequenceInsight[] {
  const ordered = [...events]
    .filter((event) => event.feedback !== "rejected")
    .sort((a, b) => a.second - b.second);

  const insights: SequenceInsight[] = [];

  const add = (insight: SequenceInsight) => {
    if (emittedKeys.has(insight.key)) return;
    emittedKeys.add(insight.key);
    insights.push(insight);
  };

  for (const event of ordered) {
    // "Muerte" se reserva para la muerte del jugador detectada por la transición central.
    if (event.label === "Muerte") {
      const combat = recentBefore(ordered, "Interacción intensa", event.second, 9);
      if (combat) {
        add({
          key: `combat-death:${combat.id}:${event.id}`,
          second: event.second,
          label: "Entrada castigada",
          category: "Auto · Secuencia",
          tone: "bad",
          confidence: Math.min(88, Math.max(67, Math.round(((event.confidence || 70) + (combat.confidence || 65)) / 2 + 5))),
          comment: "Tu muerte llegó pocos segundos después de una interacción intensa. Probable entrada demasiado profunda o retirada tardía.",
        });
      }

      const superUse = recentBefore(ordered, "Super utilizada", event.second, 7);
      if (superUse) {
        add({
          key: `super-death:${superUse.id}:${event.id}`,
          second: event.second,
          label: "Super sin conversión",
          category: "Auto · Secuencia",
          tone: "bad",
          confidence: Math.min(86, Math.max(65, Math.round(((event.confidence || 70) + (superUse.confidence || 65)) / 2))),
          comment: "Posible super seguida de tu muerte sin conversión clara. Revisa si la activaste sin salida segura o sin apoyo.",
        });
      }

      const previousRespawn = recentBefore(ordered, "Reaparición", event.second, 18);
      if (previousRespawn) {
        add({
          key: `respawn-death:${previousRespawn.id}:${event.id}`,
          second: event.second,
          label: "Muerte encadenada",
          category: "Auto · Secuencia",
          tone: "bad",
          confidence: 76,
          comment: "Segunda muerte poco después de reaparecer. Conviene reentrar con el equipo y recuperar primero la línea.",
        });
      }
    }

    if (event.label === "Eliminación rival") {
      const recentSuper = recentBefore(ordered, "Super utilizada", event.second, 7);
      if (recentSuper) {
        add({
          key: `super-enemy-death:${recentSuper.id}:${event.id}`,
          second: event.second,
          label: "Super convertida en baja",
          category: "Auto · Secuencia",
          tone: "good",
          confidence: Math.min(90, Math.max(69, Math.round(((event.confidence || 72) + (recentSuper.confidence || 66)) / 2 + 6))),
          comment: "La super fue seguida de una baja rival. Ventana favorable: convierte la ventaja numérica en posición u objetivo antes del respawn.",
        });
      }
    }

    if (event.label === "Muerte aliada") {
      const recentCombat = recentBefore(ordered, "Interacción intensa", event.second, 8);
      if (recentCombat) {
        add({
          key: `combat-ally-death:${recentCombat.id}:${event.id}`,
          second: event.second,
          label: "Aliado caído en el intercambio",
          category: "Auto · Secuencia",
          tone: "bad",
          confidence: Math.min(86, Math.max(66, Math.round(((event.confidence || 70) + (recentCombat.confidence || 65)) / 2 + 3))),
          comment: "Un aliado cayó durante una interacción intensa. No fuerces el 2v3: estabiliza líneas y espera la reagrupación salvo que haya una conversión inmediata.",
        });
      }
    }

    if (event.label === "Cambio de objetivo") {
      const recentDeath = recentBefore(ordered, "Muerte", event.second, 8);
      const recentAllyDeath = recentBefore(ordered, "Muerte aliada", event.second, 8);
      const recentEnemyDeath = recentBefore(ordered, "Eliminación rival", event.second, 8);

      if (recentDeath) {
        add({
          key: `death-objective:${recentDeath.id}:${event.id}`,
          second: event.second,
          label: "Muerte con coste de objetivo",
          category: "Auto · Secuencia",
          tone: "bad",
          confidence: Math.min(89, Math.max(68, Math.round(((event.confidence || 70) + (recentDeath.confidence || 70)) / 2 + 4))),
          comment: "El objetivo cambió poco después de tu muerte. Esa baja probablemente abrió una ventana directa para el rival.",
        });
      } else if (recentAllyDeath) {
        add({
          key: `ally-death-objective:${recentAllyDeath.id}:${event.id}`,
          second: event.second,
          label: "Desventaja numérica con coste",
          category: "Auto · Secuencia",
          tone: "bad",
          confidence: Math.min(87, Math.max(66, Math.round(((event.confidence || 70) + (recentAllyDeath.confidence || 69)) / 2 + 3))),
          comment: "El objetivo cambió tras una muerte aliada. La desventaja numérica parece haber dado al rival una ventana de conversión.",
        });
      } else if (recentEnemyDeath) {
        add({
          key: `enemy-death-objective:${recentEnemyDeath.id}:${event.id}`,
          second: event.second,
          label: "Eliminación convertida",
          category: "Auto · Secuencia",
          tone: "good",
          confidence: Math.min(90, Math.max(68, Math.round(((event.confidence || 70) + (recentEnemyDeath.confidence || 72)) / 2 + 5))),
          comment: "Una baja rival precedió al cambio de objetivo. Buena conversión de ventaja numérica; revisa si el equipo cerró la jugada sin sobreextenderse.",
        });
      }

      const recentSuper = recentBefore(ordered, "Super utilizada", event.second, 8);
      if (recentSuper && !recentDeath && !recentAllyDeath && !recentEnemyDeath) {
        add({
          key: `super-objective:${recentSuper.id}:${event.id}`,
          second: event.second,
          label: "Super con impacto",
          category: "Auto · Secuencia",
          tone: "good",
          confidence: Math.min(87, Math.max(66, Math.round(((event.confidence || 70) + (recentSuper.confidence || 65)) / 2 + 3))),
          comment: "La super precedió a un cambio de objetivo. Puede haber generado espacio o ventaja real; confirma si fue una buena ventana.",
        });
      }

      const recentCombat = recentBefore(ordered, "Interacción intensa", event.second, 7);
      if (recentCombat && !recentDeath && !recentAllyDeath && !recentEnemyDeath) {
        add({
          key: `combat-objective:${recentCombat.id}:${event.id}`,
          second: event.second,
          label: "Presión convertida",
          category: "Auto · Secuencia",
          tone: "good",
          confidence: Math.min(88, Math.max(66, Math.round(((event.confidence || 70) + (recentCombat.confidence || 65)) / 2 + 4))),
          comment: "La interacción intensa terminó en un cambio de objetivo sin una baja aliada cercana. Probable presión bien convertida.",
        });
      }
    }

    if (event.label === "Cambio de línea") {
      const badMatchup = recentBefore(ordered, "Matchup desfavorable", event.second, 14);
      if (badMatchup) {
        add({
          key: `matchup-lane:${badMatchup.id}:${event.id}`,
          second: event.second,
          label: "Matchup corregido",
          category: "Auto · Secuencia",
          tone: "good",
          confidence: 82,
          comment: "Cambiaste de línea poco después de detectar un matchup desfavorable. Buena corrección antes de seguir perdiendo presión.",
        });
      }
    }
  }

  const ownDeaths = lastTwo(ordered, "Muerte");
  if (ownDeaths.length === 2 && ownDeaths[1].second - ownDeaths[0].second <= 35) {
    add({
      key: `double-death:${ownDeaths[0].id}:${ownDeaths[1].id}`,
      second: ownDeaths[1].second,
      label: "Cadena de muertes",
      category: "Auto · Secuencia",
      tone: "bad",
      confidence: 79,
      comment: "Dos muertes propias en una ventana corta. Reduce el ritmo de reentrada y espera una salida conjunta.",
    });
  }

  const alliedDeaths = lastTwo(ordered, "Muerte aliada");
  if (alliedDeaths.length === 2 && alliedDeaths[1].second - alliedDeaths[0].second <= 12) {
    add({
      key: `double-ally-death:${alliedDeaths[0].id}:${alliedDeaths[1].id}`,
      second: alliedDeaths[1].second,
      label: "Doble baja aliada",
      category: "Auto · Secuencia",
      tone: "bad",
      confidence: 80,
      comment: "Dos aliados han caído en pocos segundos. Evita regalar la tercera baja y juega por supervivencia, tiempo o salida.",
    });
  }

  const enemyDeaths = lastTwo(ordered, "Eliminación rival");
  if (enemyDeaths.length === 2 && enemyDeaths[1].second - enemyDeaths[0].second <= 12) {
    add({
      key: `double-enemy-death:${enemyDeaths[0].id}:${enemyDeaths[1].id}`,
      second: enemyDeaths[1].second,
      label: "Doble ventaja numérica",
      category: "Auto · Secuencia",
      tone: "good",
      confidence: 81,
      comment: "Dos rivales han caído en una ventana corta. Es momento de convertir: objetivo, control de mapa o posición avanzada segura.",
    });
  }

  return insights;
}
