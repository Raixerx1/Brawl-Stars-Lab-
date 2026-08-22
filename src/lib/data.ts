import brawlersRaw from "@/data/brawlers.json";
import mapsRaw from "@/data/maps.json";
import metaRaw from "@/data/meta.json";
import type { Brawler, MapProfile } from "./types";
import { applySeason53Meta } from "./season53-meta";
import { rankCountersAgainst, rankTargetsFor } from "./counter-engine";

export const brawlers = applySeason53Meta(brawlersRaw as Brawler[]);

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

export const maps = mapsRaw as MapProfile[];
export const meta = metaRaw;
export const brawlerByName = (name: string) => brawlers.find((brawler) => brawler.name.toLowerCase() === name.toLowerCase());
export const brawlerBySlug = (slug: string) => brawlers.find((brawler) => brawler.slug === slug);
export const mapBySlug = (slug: string) => maps.find((map) => map.slug === slug);
export const modes = [...new Set(maps.map((map) => map.mode))];
