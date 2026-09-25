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
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

const currentMetaSources = [
  ...metaRaw.sources.filter(({ url }) => !update69LiveSources.some((source) => source.url === url)),
  ...update69LiveSources,
];

/**
 * Update 69 + balance 16/09. The patch layer applies the official mechanical
 * changes first; the 17/09 layer establishes the first clean post-maintenance
 * baseline; v0.34.0 then consolidates the later 25/09 review without rewriting
 * unrelated roster decisions.
 */
export const brawlers = applyPostBalance2509(
  applyPostBalance1709(
    applyUpdate69Live(applySeason53Meta(brawlersRaw as Brawler[])),
  ),
);

const isStrongDraftMatchup = (matchup: ReturnType<typeof rankTargetsFor>[number]) =>
  (matchup.score >= 70 && matchup.confidence !== "Baja") ||
  (matchup.explicit && matchup.score >= 66);

/**
 * Draft Engine consumes counters/counteredBy as strong tactical relationships.
 * Rebuild them from the current reciprocal engine after the v0.34.0 calibration,
 * so old static relations cannot override the September 16 balance or the later
 * 25/09 viability review. Calculated matchups require >=70 plus at least medium
 * confidence; explicit reviewed relations are admitted from >=66.
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
  updated: "2026-09-25",
  rankedDataThrough: "25/09/2026 · revisión v0.34.0 post-balance; BrawlBetter/NOFF priorizados y Brawl Time Ninja usado solo como contraste agregado",
  update69BalanceStatus: "BALANCE 16/09 APLICADO · v0.34.0 consolidado 25/09. Los tiers globales no sustituyen el ajuste por mapa, modo, orden y matchup.",
  nextBalanceWindow: "Seguimiento posterior a v0.34.0 · vigilar estabilidad de Wendy y Pam y mantener los picks contextuales separados del tier global",
  update69Highlights: [
    "Balance oficial del 16/09 plenamente aplicado al Draft Engine y al Counter Engine.",
    "Wendy queda A general: sigue siendo competitiva, pero los recortes de escudos y torreta ya no justifican una prioridad S global.",
    "Pam queda C general. Conserva valor B/A contextual en Zona Restringida y escenarios estáticos que protegen la torreta, y deja de tratarse como first pick seguro.",
    "Nori queda B general con ventanas A contextuales; Rico A con techo S contextual; Belle B con valor A contextual en mapas abiertos.",
    "Brock se mantiene A y Trunk se mantiene B; no se fuerzan promociones por señales puntuales.",
    "Los counters del Draft Assist se regeneran desde el motor recíproco sobre el roster v0.34.0, por lo que tier y perfiles revisados se propagan a Counter Explorer y Draft Assist.",
    "Mapa, geometría, orden del draft y matchup uno a uno siguen prevaleciendo sobre el tier global."
  ],
  sources: currentMetaSources,
};

export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(maps.map((map) => map.mode))];
