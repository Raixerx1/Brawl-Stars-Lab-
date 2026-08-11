import { analyzeDraft } from "./draft-engine";
import type {
  Brawler,
  DraftInput,
  DraftStressAnalysis,
  DraftStressResult,
  DraftStressScenario,
  EnemyPickPrediction,
} from "./types";

const normalize = (value: string) => value.trim().toLocaleLowerCase("es");
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function verdictFor(resilience: number, directThreats: number): DraftStressResult["verdict"] {
  if (resilience >= 78 && directThreats <= 1) return "Blindado";
  if (resilience >= 68 && directThreats <= 2) return "Estable";
  if (resilience >= 56) return "Vigilable";
  return "Frágil";
}

function scenarioReason(
  prediction: EnemyPickPrediction,
  scoreDrop: number,
  directThreat: boolean,
) {
  if (directThreat) return `${prediction.brawler.name} aparece como counter directo`;
  if (scoreDrop >= 10) return `${prediction.brawler.name} reduce el encaje ${scoreDrop} puntos`;
  if (scoreDrop >= 5) return `${prediction.brawler.name} obliga a jugar con más cautela`;
  return `Conserva un plan estable contra ${prediction.brawler.name}`;
}

function stressCandidate(
  input: DraftInput,
  roster: Brawler[],
  candidate: DraftStressResult["recommendation"],
  scenarioLimit: number,
): DraftStressResult {
  const candidateName = candidate.brawler.name;
  const candidateAnalysis = analyzeDraft({ ...input, myPick: candidateName }, roster);
  const unavailable = new Set(
    [...input.allies, ...input.enemies, ...input.bans, candidateName].map(normalize),
  );
  const predictions = candidateAnalysis.predictedEnemyPicks
    .filter((prediction) => !unavailable.has(normalize(prediction.brawler.name)))
    .slice(0, scenarioLimit);

  const scenarios: DraftStressScenario[] = predictions.map((prediction) => {
    const stressed = analyzeDraft({
      ...input,
      position: input.position === "Last pick" ? "Last pick" : "Pick intermedio",
      enemies: [...input.enemies, prediction.brawler.name],
      myPick: candidateName,
    }, roster);
    const evaluated = stressed.selectedPick || candidate;
    const candidateScore = evaluated.score;
    const scoreDrop = Math.max(0, candidate.score - candidateScore);
    const directThreat =
      evaluated.exposedTo.some((name) => normalize(name) === normalize(prediction.brawler.name)) ||
      candidate.brawler.counteredBy.some((name) => normalize(name) === normalize(prediction.brawler.name)) ||
      prediction.brawler.counters.some((name) => normalize(name) === normalize(candidateName));

    return {
      enemy: prediction.brawler,
      likelihood: prediction.score,
      candidateScore,
      scoreDrop,
      directThreat,
      reason: scenarioReason(prediction, scoreDrop, directThreat),
    };
  });

  if (!scenarios.length) {
    const resilience = clamp(candidate.score * .72 + candidate.metrics.safety * .28);
    return {
      recommendation: candidate,
      resilience,
      averageScore: candidate.score,
      worstScore: candidate.score,
      directThreats: 0,
      verdict: verdictFor(resilience, 0),
      scenarios,
    };
  }

  const totalWeight = scenarios.reduce((total, scenario) => total + Math.max(1, scenario.likelihood), 0);
  const averageScore = Math.round(
    scenarios.reduce(
      (total, scenario) => total + scenario.candidateScore * Math.max(1, scenario.likelihood),
      0,
    ) / totalWeight,
  );
  const worstScore = Math.min(...scenarios.map((scenario) => scenario.candidateScore));
  const directThreats = scenarios.filter((scenario) => scenario.directThreat).length;
  const resilience = clamp(
    candidate.score * .30 +
    averageScore * .25 +
    worstScore * .18 +
    candidate.metrics.mapFit * .12 +
    candidate.metrics.meta * .10 +
    candidate.metrics.safety * .05 -
    directThreats * 3,
  );

  return {
    recommendation: candidate,
    resilience,
    averageScore,
    worstScore,
    directThreats,
    verdict: verdictFor(resilience, directThreats),
    scenarios,
  };
}

export function analyzeRecommendationResilience(
  input: DraftInput,
  roster: Brawler[],
  scenarioLimit = 4,
  candidateLimit = 5,
): DraftStressAnalysis {
  const base = analyzeDraft(input, roster);
  const results = base.recommendations
    .slice(0, candidateLimit)
    .map((candidate) => stressCandidate(input, roster, candidate, scenarioLimit))
    .sort((a, b) =>
      b.resilience - a.resilience ||
      b.averageScore - a.averageScore ||
      b.recommendation.score - a.recommendation.score
    );
  const primary = base.recommendations[0];
  const strongest = results[0];
  const primaryStress = results.find((result) =>
    normalize(result.recommendation.brawler.name) === normalize(primary?.brawler.name || "")
  );
  // Una diferencia pequeña no justifica contradecir la recomendación principal.
  // Solo proponemos un cambio defensivo cuando la prueba de estrés aporta una
  // mejora clara frente a las respuestas rivales simuladas.
  const robustPick = strongest && primaryStress && strongest.resilience < primaryStress.resilience + 5
    ? primaryStress
    : strongest;
  const scenarioCount = results.reduce((total, result) => total + result.scenarios.length, 0);
  const summary = !robustPick || !primary
    ? "Faltan candidatos para ejecutar la prueba de respuestas."
    : robustPick.recommendation.brawler.name === primary.brawler.name
      ? `${primary.brawler.name} también es la opción que mejor resiste las respuestas probables.`
      : `${robustPick.recommendation.brawler.name} es más resistente que ${primary.brawler.name} si priorizas seguridad frente al siguiente counter.`;

  return { results, robustPick, scenarioCount, summary };
}
