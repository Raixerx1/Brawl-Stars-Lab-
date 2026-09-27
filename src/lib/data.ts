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
import { applyMapMeta2509 } from "./map-meta-2509";
import { applyRankedPool2709, recalibrateRankedFirstPicks2709 } from "./ranked-pool-2709";
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

const mapMetaSource = {
  name: "SeeMeta — Ranked por mapa · 25/09/2026",
  url: "https://seemeta.com/es/brawl-stars/maps",
  kind: "Tier lists por mapa calculadas exclusivamente con partidas Ranked; señal empírica usada como prior, no como orden literal de draft",
};

const currentMetaSources = [
  ...metaRaw.sources.filter(({ url }) => !update69LiveSources.some((source) => source.url === url)),
  ...update69LiveSources,
  mapMetaSource,
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
 * v0.36.2: first establish the canonical 28-map Ranked pool, then overlay the
 * current Ranked-only statistical core for every map, and only then calculate
 * blind-pick candidates. Historical maps remain browsable but never enter Draft Assist.
 */
const rankedPoolWithCurrentMeta = applyMapMeta2509(applyRankedPool2709(update69Maps));

export const maps = recalibrateRankedFirstPicks2709(rankedPoolWithCurrentMeta, brawlers);
export const rankedMaps = maps.filter((map) => map.rotationStatus === "Actual");

export const meta = {
  ...metaRaw,
  ...update69MetaLive,
  updated: "2026-09-27",
  rankedDataThrough: "25/09/2026 · v0.36.2: meta Ranked específico de los 28 mapas actuales + balance 16/09",
  update69BalanceStatus: "BALANCE 16/09 APLICADO · v0.36.2. El Draft Assist incorpora señal Ranked por mapa sin convertir win rate/pick rate en una recomendación automática.",
  nextBalanceWindow: "Seguir estabilidad post-16/09 y recalibrar cuando la evidencia específica de mapa cambie de forma consistente el prior, el matchup o la seguridad de first pick",
  update69Highlights: [
    "Balance oficial del 16/09 plenamente aplicado al Draft Engine y al Counter Engine.",
    "Pool Ranked corregido: Noqueo usa New Horizons, Out in the Open, Belle's Rock y Flaring Phoenix; Call of the Water y Stroke of Luck quedan fuera del pool actual.",
    "Los 28 mapas actuales reciben un prior estadístico específico basado en partidas Ranked del propio mapa.",
    "El top estadístico de cada mapa no se copia como first pick: se combina con seguridad a ciegas, geometría, utilidad del modo, counters, composición y orden del draft.",
    "Los mapas destacados Spiraling Out, Beach Ball, In the Liminal y Quick Travel mantienen una confianza más prudente cuando la muestra es menor.",
    "Quick Travel deja de usar un perfil genérico: la señal actual favorece Nita, Shade, Ash, Bibi y Emz como núcleo estadístico del mapa.",
    "R-T conserva sus ventanas contextuales —por ejemplo en mapas donde el antidive importa— sin volver a recibir prioridad global artificial como apertura.",
    "Los counters del Draft Assist se regeneran desde el motor recíproco sobre el roster post-16/09 y se comparten con Counter Explorer.",
    "Mapa, geometría, orden del draft y matchup uno a uno siguen prevaleciendo sobre el tier global."
  ],
  sources: currentMetaSources,
};

export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(rankedMaps.map((map) => map.mode))];
