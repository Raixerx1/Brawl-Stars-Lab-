import brawlersRaw from "@/data/brawlers.json";
import mapsRaw from "@/data/maps.json";
import metaRaw from "@/data/meta.json";
import type { Brawler, MapProfile } from "./types";
import { applySeason53Meta } from "./season53-meta";
import { applyUpdate69Live } from "./update69-live";
import { update69LiveSources, update69MetaLive } from "./update69-meta";
import { applyUpdate69Maps } from "./update69-maps";
import { applyPostBalance1709 } from "./post-balance-1709";
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

const currentMetaSources = [
  ...metaRaw.sources.filter(({ url }) => !update69LiveSources.some((source) => source.url === url)),
  ...update69LiveSources,
];

/**
 * Update 69 + balance 16/09. The patch layer applies the official mechanical
 * changes first; the 17/09 layer then updates the observed competitive baseline
 * using the first cleaner post-maintenance Ranked sample.
 */
export const brawlers = applyPostBalance1709(
  applyUpdate69Live(applySeason53Meta(brawlersRaw as Brawler[])),
);

const isStrongDraftMatchup = (matchup: ReturnType<typeof rankTargetsFor>[number]) =>
  (matchup.score >= 70 && matchup.confidence !== "Baja") ||
  (matchup.explicit && matchup.score >= 66);

/**
 * Draft Engine consumes counters/counteredBy as strong tactical relationships.
 * Rebuild them from the current reciprocal engine after the 17/09 calibration,
 * so old static relations cannot override the September 16 balance. We admit a
 * slightly wider explicit relation (>=66) but keep calculated matchups at >=70
 * and require at least medium confidence.
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
  updated: "2026-09-17",
  rankedDataThrough: "17/09/2026 · BrawlBetter patch-aware + Brawl Time Ninja live + NOFF 24 h · baseline Ranked alto 03/09",
  update69BalanceStatus: "BALANCE 16/09 APLICADO · meta recalibrado 17/09 con la primera jornada post-mantenimiento. Se conserva freno anti-sobreajuste para señales sin consenso.",
  nextBalanceWindow: "Seguimiento postparche 18–19/09/2026 · confirmar estabilidad de Gus, Wendy, Poco, R-T y las promociones de control/soporte",
  update69Highlights: [
    "Balance oficial del 16/09 plenamente aplicado al Draft Engine y al Counter Engine.",
    "La primera jornada postparche consolida a Gus como referencia del grupo alto; Amber, Shade, Wendy y El Primo siguen con prioridad competitiva elevada.",
    "Poco sube al núcleo S del modelo por el doble buff de curación y una señal Ranked favorable tras el mantenimiento.",
    "Wendy baja de S+ a S: sigue fuerte, pero los recortes de escudo y torreta aumentan el riesgo de abrirla a ciegas.",
    "Lou, Sandy, Larry & Lawrie, Gale y Maisie reciben promoción prudente por señal postparche; se limitan a A mientras no exista consenso suficiente para S.",
    "R-T queda en B global pese al buff: gana valor específico como antidive y counterpick, pero la señal general todavía no justifica A.",
    "Nori, Meg y Brock mantienen la penalización posterior al nerf; Colette conserva su función antitanque pese al recorte del Buffie.",
    "Los counters del Draft Assist se regeneran desde el motor recíproco actual y ya no dependen de listas históricas estáticas."
  ],
  sources: currentMetaSources,
};

export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(maps.map((map) => map.mode))];