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

  // Priors 2/2 prevent the first review from overcorrecting future detections.
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
  label: string,
  second: number,
  maxSeconds: number,
) => [...events]
  .reverse()
  .find((event) => event.label === label && second - event.second >= 0 && second - event.second <= maxSeconds);

const lastTwo = (events: LiveMatchEvent[], label: string) =>
  events.filter((event) => event.label === label).slice(-2);

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
          comment: "La muerte llegó pocos segundos después de una interacción intensa. Probable entrada demasiado profunda o retirada tardía.",
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
          comment: "Posible super seguida de muerte sin conversión clara. Revisa si la activaste sin salida segura o sin apoyo.",
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

    if (event.label === "Cambio de objetivo") {
      const recentDeath = recentBefore(ordered, "Muerte", event.second, 8);
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
      }

      const recentSuper = recentBefore(ordered, "Super utilizada", event.second, 8);
      if (recentSuper && !recentDeath) {
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
    }
  }

  const deaths = lastTwo(ordered, "Muerte");
  if (
    deaths.length === 2 &&
    deaths[1].second - deaths[0].second <= 35
  ) {
    add({
      key: `double-death:${deaths[0].id}:${deaths[1].id}`,
      second: deaths[1].second,
      label: "Cadena de muertes",
      category: "Auto · Secuencia",
      tone: "bad",
      confidence: 79,
      comment: "Dos muertes en una ventana corta. Reduce el ritmo de reentrada y espera una salida conjunta.",
    });
  }

  return insights;
}
