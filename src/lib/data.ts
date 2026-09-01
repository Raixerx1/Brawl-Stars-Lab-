import brawlersRaw from "@/data/brawlers.json";
import mapsRaw from "@/data/maps.json";
import metaRaw from "@/data/meta.json";
import type { Brawler, MapProfile } from "./types";
import { applySeason53Meta } from "./season53-meta";
import { applyUpdate69Live } from "./update69-live";
import { update69LiveSources, update69MetaLive } from "./update69-meta";
import { applyUpdate69Maps } from "./update69-maps";
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

/**
 * La fotografía estadística del 30/08 sigue siendo la base observable, pero
 * Update 69 ya está live. La segunda capa aplica un prior conservador de día 1
 * para que Draft, Counter Explorer y voz no sigan tratando el balance anterior
 * como si continuara vigente mientras acumulamos muestra Ranked post-parche.
 */
export const brawlers = applyUpdate69Live(applySeason53Meta(brawlersRaw as Brawler[]));

/**
 * Draft Engine 2.0 todavía consume las listas counters/counteredBy del perfil.
 * Esta vista deriva únicamente relaciones fuertes (>=72/100) del motor recíproco
 * actual, de forma que el Draft no se quede anclado a listas históricas.
 * CounterExplorer y voz siguen calculando cada matchup directamente.
 */
export const draftBrawlers: Brawler[] = brawlers.map((brawler) => ({
  ...brawler,
  counters: rankTargetsFor(brawler, brawlers, 8)
    .filter((matchup) => matchup.score >= 72)
    .map((matchup) => matchup.target.name),
  counteredBy: rankCountersAgainst(brawler, brawlers, 8)
    .filter((matchup) => matchup.score >= 72)
    .map((matchup) => matchup.candidate.name),
}));

/**
 * Update 69 añade la nueva rotación competitiva sin destruir el histórico.
 * Al hacerse live 69.230, actualizamos la etiqueta visible y la fecha de pool,
 * manteniendo intacta la confianza estructural de los mapas nuevos.
 */
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

/**
 * meta.json conserva la fotografía auditable pre-parche. La capa live permite
 * actualizar el estado del producto sin borrar ese baseline histórico.
 */
export const meta = {
  ...metaRaw,
  ...update69MetaLive,
  sources: [...metaRaw.sources, ...update69LiveSources],
};

export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(maps.map((map) => map.mode))];
