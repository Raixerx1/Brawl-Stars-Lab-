import type { Brawler, DraftInput, DraftRecommendation } from "./types";

const tierScore: Record<string, number> = { S: 86, "A+": 80, A: 74, "B+": 68, B: 62, "Sin evaluar": 50 };
const norm = (value: string) => value.trim().toLowerCase();
const includesName = (list: string[], name: string) => list.some((item) => norm(item) === norm(name));

export function recommendDraft(input: DraftInput, roster: Brawler[]): DraftRecommendation[] {
  const unavailable = new Set([...input.allies, ...input.enemies, ...input.bans].map(norm));
  const enemyProfiles = input.enemies
    .map((name) => roster.find((brawler) => norm(brawler.name) === norm(name)))
    .filter(Boolean) as Brawler[];
  const allyProfiles = input.allies
    .map((name) => roster.find((brawler) => norm(brawler.name) === norm(name)))
    .filter(Boolean) as Brawler[];

  return roster
    .filter((brawler) => !unavailable.has(norm(brawler.name)))
    .map((brawler) => {
      let score = tierScore[brawler.tier] ?? 50;
      const reasons: string[] = [];
      const warnings: string[] = [];
      const modeScore = brawler.modes[input.map.mode] ?? 0;
      score += modeScore * 1.7;
      if (modeScore >= 8) reasons.push(`Afinidad alta con ${input.map.mode}`);

      const sIndex = input.map.tierS.indexOf(brawler.name);
      const aIndex = input.map.tierA.indexOf(brawler.name);
      if (sIndex >= 0) {
        score += 18 - sIndex * 1.5;
        reasons.push("Tier S editorial del mapa");
      } else if (aIndex >= 0) {
        score += 10 - aIndex;
        reasons.push("Tier A editorial del mapa");
      }

      if (input.position === "First pick") {
        if (brawler.tags.includes("safe")) {
          score += 9;
          reasons.push("Pick estable a ciegas");
        }
        if (brawler.tags.includes("lastpick") || brawler.tags.includes("assassin")) score -= 7;
      }
      if (input.position === "Last pick" && (brawler.tags.includes("lastpick") || brawler.tags.includes("assassin") || brawler.role === "Asesino")) {
        score += 9;
        reasons.push("Escala como counterpick");
      }

      for (const enemy of enemyProfiles) {
        if (includesName(brawler.counters, enemy.name)) {
          score += 13;
          reasons.push(`Counter directo de ${enemy.name}`);
        }
        if (includesName(brawler.counteredBy, enemy.name)) {
          score -= 14;
          warnings.push(`${enemy.name} lo frena`);
        }
        if (includesName(enemy.counteredBy, brawler.name)) score += 5;
        if (includesName(enemy.counters, brawler.name)) score -= 6;
      }

      const enemyTags = new Set(enemyProfiles.flatMap((enemy) => enemy.tags));
      if (enemyTags.has("tank") && brawler.tags.includes("antitank")) {
        score += 10;
        reasons.push("Cubre antitanque");
      }
      if (enemyTags.has("assassin") && brawler.tags.includes("antidive")) {
        score += 10;
        reasons.push("Protege frente a dive");
      }
      if (enemyTags.has("thrower") && (brawler.tags.includes("assassin") || brawler.tags.includes("mobile"))) {
        score += 8;
        reasons.push("Acceso contra artilleros");
      }
      if (input.map.layout === "Abierto" && (brawler.tags.includes("sniper") || brawler.range === "Muy largo")) {
        score += 8;
        reasons.push("Aprovecha el mapa abierto");
      }
      if (input.map.layout === "Cerrado" && (brawler.tags.includes("tank") || brawler.tags.includes("walls") || brawler.tags.includes("thrower"))) {
        score += 7;
        reasons.push("Aprovecha cobertura y pasillos");
      }

      const allyRoles = new Set(allyProfiles.map((ally) => ally.role));
      if (!allyRoles.has(brawler.role)) score += 3;
      if (allyProfiles.length && allyProfiles.every((ally) => ally.role === "Tirador") && ["Control", "Tanque", "Apoyo"].includes(brawler.role)) {
        score += 6;
        reasons.push("Equilibra la composición");
      }
      if (!brawler.profileComplete) score -= 7;

      score = Math.max(0, Math.min(100, Math.round(score)));
      const warning = warnings.length
        ? warnings.slice(0, 2).join(" · ")
        : !brawler.profileComplete
          ? "Build aún pendiente de validación táctica completa"
          : undefined;

      return { brawler, score, reasons: [...new Set(reasons)].slice(0, 5), warning };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
