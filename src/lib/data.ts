import brawlersRaw from "@/data/brawlers.json";
import mapsRaw from "@/data/maps.json";
import metaRaw from "@/data/meta.json";
import type { Brawler, MapProfile } from "./types";
import { applySeason53Meta } from "./season53-meta";
import { applyUpdate69Live } from "./update69-live";
import { update69LiveSources, update69MetaLive } from "./update69-meta";
import { applyUpdate69Maps } from "./update69-maps";
import { applyPostBalance1709 } from "./post-balance-1709";
import { applyPostBalance2509 } from "./post-balance-2509";
import { applyPostBalance2609 } from "./post-balance-2609";
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

const currentMetaSources = [
  ...metaRaw.sources.filter(({ url }) => !update69LiveSources.some((source) => source.url === url)),
  ...update69LiveSources,
];

/**
 * Update 69 + balance 16/09. Mechanical changes are applied first, followed by
 * the 17/09 baseline, the 25/09 viability review and the 26/09 recommendation
 * calibration that tightens stale broad-safety profiles without deleting valid
 * contextual counterpicks.
 */
export const brawlers = applyPostBalance2609(
  applyPostBalance2509(
    applyPostBalance1709(
      applyUpdate69Live(applySeason53Meta(brawlersRaw as Brawler[])),
    ),
  ),
);

const isStrongDraftMatchup = (matchup: ReturnType<typeof rankTargetsFor>[number]) =>
  (matchup.score >= 70 && matchup.confidence !== "Baja") ||
  (matchup.explicit && matchup.score >= 66);

/**
 * Draft Engine consumes counters/counteredBy as strong tactical relationships.
 * Rebuild them from the current reciprocal engine after the v0.36.0 calibration,
 * so stale profile assumptions cannot keep dominating the shortlist. Calculated
 * matchups require >=70 plus at least medium confidence; explicit reviewed
 * relations are admitted from >=66.
 */
export const draftBrawlers: Brawler[] = brawlers.map((brawler) => ({
  ...brawler,
  counters: rankTargetsFor(brawler, brawlers, 8)
    .filter(isStrongDraftMatchup)
    .slice(0, 6)
    .map((matchup) => matchup.target.name),
  counteredBy: rankCountersAgainst(brawler, brawlers, 8)
    .filter((matchup) =>
      (matchup.score >= 70 && matchup.confidence !== "Baja") ||
      (matchup.explicit && matchup.score >= 66)
    )
    .slice(0, 6)
    .map((matchup) => matchup.candidate.name),
}));

/** Update 69 adds the current competitive rotation without destroying history. */
export const maps = applyUpdate69Maps(mapsRaw as MapProfile[]).map((map) => {
  if (!map.status.includes("Update 69")) return map;
  return {
    ...map,
    status: map.status
      .replace("rotación anunciada 29/08/2026", "rotación live 01/09/2026")
      .replace("Sale de la rotación con Update 69 · revisado 30/08/2026", "Sale de la rotación con Update 69 · live 01/09/2026"),
    poolCheckedAt: "01/09/2026",
  };
});

/** meta.json keeps the auditable historical baseline; live layers add current state. */
export const meta = {
  ...metaRaw,
  ...update69MetaLive,
  updated: "2026-09-26",
  rankedDataThrough: "26/09/2026 · calibración v0.36.0: contraste BrawlBetter + NOFF tras balance 16/09; el motor separa fuerza global de utilidad contextual",
  update69BalanceStatus: "BALANCE 16/09 APLICADO · v0.36.0 calibrado 26/09. Wendy, Gale y Lou ya no reciben prioridad universal por perfiles antiguos; conservan sus ventanas reales por mapa y matchup.",
  nextBalanceWindow: "Seguir estabilidad post-16/09 y revisar si la divergencia entre BrawlBetter y NOFF se resuelve con más muestra Ranked",
  update69Highlights: [
    "Balance oficial del 16/09 plenamente aplicado al Draft Engine y al Counter Engine.",
    "Calibración 26/09: Wendy queda A general y deja de tratarse como blind pick universal; mantiene valor alto en mapas compatibles.",
    "Gale queda C general en el modelo: sigue siendo counter antidive válido, pero pierde la etiqueta de pick seguro y baja su afinidad automática fuera de Balón Brawl/Zona Restringida.",
    "Lou queda B general: conserva identidad fuerte en Zona Restringida y como antitanque/control, pero no se fuerza como respuesta genérica.",
    "Pam queda C general. Conserva valor B/A contextual en Zona Restringida y escenarios estáticos que protegen la torreta.",
    "Los counters del Draft Assist se regeneran desde el motor recíproco sobre el roster v0.36.0, por lo que la nueva calibración se propaga también a Counter Explorer.",
    "Mapa, geometría, orden del draft y matchup uno a uno siguen prevaleciendo sobre el tier global."
  ],
  sources: currentMetaSources,
};

export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(maps.map((map) => map.mode))];
