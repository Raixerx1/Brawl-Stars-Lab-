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
import { applyDraftCalibration2709 } from "./draft-calibration-2709";
import { applyRankedPool2709, recalibrateRankedFirstPicks2709 } from "./ranked-pool-2709";
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

const currentMetaSources = [
  ...metaRaw.sources.filter(({ url }) => !update69LiveSources.some((source) => source.url === url)),
  ...update69LiveSources,
];

/**
 * Update 69 + balance 16/09. Mechanical changes are applied first, followed by
 * the 17/09 baseline, the 25/09 viability review, the 26/09 recommendation
 * calibration and the 27/09 blind-pick correction for R-T.
 */
export const brawlers = applyDraftCalibration2709(
  applyPostBalance2609(
    applyPostBalance2509(
      applyPostBalance1709(
        applyUpdate69Live(applySeason53Meta(brawlersRaw as Brawler[])),
      ),
    ),
  ),
);

const isStrongDraftMatchup = (matchup: ReturnType<typeof rankTargetsFor>[number]) =>
  (matchup.score >= 70 && matchup.confidence !== "Baja") ||
  (matchup.explicit && matchup.score >= 66);

/**
 * Draft Engine consumes counters/counteredBy as strong tactical relationships.
 * Rebuild them from the current reciprocal engine after the v0.36.1 calibration,
 * so stale static relations cannot override the current roster model.
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

const update69Maps = applyUpdate69Maps(mapsRaw as MapProfile[]).map((map) => {
  if (!map.status.includes("Update 69")) return map;
  return {
    ...map,
    status: map.status
      .replace("rotación anunciada 29/08/2026", "rotación live 01/09/2026")
      .replace("Sale de la rotación con Update 69 · revisado 30/08/2026", "Sale de la rotación con Update 69 · live 01/09/2026"),
  };
});

/**
 * v0.36.1 establishes one canonical Ranked pool. Historical maps remain
 * browsable in Map Explorer but cannot leak into Draft Assist. First-pick lists
 * for the 28 current maps are rebuilt from the current brawler profiles.
 */
export const maps = recalibrateRankedFirstPicks2709(
  applyRankedPool2709(update69Maps),
  brawlers,
);

export const rankedMaps = maps.filter((map) => map.rotationStatus === "Actual");

/** meta.json keeps the auditable historical baseline; live layers add current state. */
export const meta = {
  ...metaRaw,
  ...update69MetaLive,
  updated: "2026-09-27",
  rankedDataThrough: "27/09/2026 · v0.36.1: 28 mapas Ranked actuales, mapas destacados estacionales y first picks recalculados con perfiles post-16/09",
  update69BalanceStatus: "BALANCE 16/09 APLICADO · v0.36.1. Wendy, Gale y Lou conservan valor contextual; R-T mantiene su fuerza antidive/counter sin recibir prioridad artificial como blind pick.",
  nextBalanceWindow: "Seguir estabilidad post-16/09 y recalibrar solo cuando nueva evidencia Ranked cambie de forma consistente mapa, matchup o seguridad de first pick",
  update69Highlights: [
    "Balance oficial del 16/09 plenamente aplicado al Draft Engine y al Counter Engine.",
    "Pool Ranked v0.36.1: 28 mapas actuales separados de los históricos; Draft Assist ya no mezcla mapas fuera de rotación.",
    "Se incorporan los mapas destacados estacionales Spiraling Out, Beach Ball, In the Liminal y Quick Travel al pool de Ranked correspondiente.",
    "Los first picks de los 28 mapas actuales se recalculan con meta, seguridad a ciegas, geometría y utilidad del modo, en lugar de arrastrar sin cambios la fotografía editorial de agosto.",
    "R-T conserva su fortaleza contra dive y como counterpick, pero pierde la etiqueta heredada de pick seguro que lo hacía dominar demasiados mapas como apertura.",
    "Wendy queda A general; Gale C general; Lou B general. Los tres conservan ventanas contextuales cuando el mapa y el matchup realmente las justifican.",
    "Los counters del Draft Assist se regeneran desde el motor recíproco sobre el roster v0.36.1 y se comparten con Counter Explorer.",
    "Mapa, geometría, orden del draft y matchup uno a uno siguen prevaleciendo sobre el tier global."
  ],
  sources: currentMetaSources,
};

export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(rankedMaps.map((map) => map.mode))];
