"use client";

import { useMemo, useState } from "react";
import type { Brawler } from "@/lib/types";
import { BrawlerPortrait } from "./GameArtwork";

type TierSnapshot = Record<string, string[]>;

type TierListData = {
  updated: string;
  source: string;
  sourceUrl: string;
  method: string;
  snapshots: Record<string, TierSnapshot>;
};

const tierOrder = ["S+", "S", "A+", "A", "B+", "B", "C", "D", "F", "Sin datos"];
const CURRENT_MODEL_LABEL = "Motor U69 · 03/09";

function sourceForSnapshot(snapshot: string, data: TierListData) {
  if (snapshot.startsWith("BrawlMetrics Legendary")) {
    return {
      label: "BrawlMetrics Ranked Legendary · 03/09 · 4,34 M de apariciones",
      url: "https://brawlmetrics.gg/tier-list/ranked/legendary",
    };
  }
  if (snapshot.startsWith("BrawlBetter")) {
    return {
      label: "BrawlBetter Ranked · archivo histórico",
      url: "https://www.brawlbetter.com/meta",
    };
  }
  if (snapshot.startsWith("NOFF") || snapshot.startsWith("Meta 24 h") || snapshot.startsWith("General 30 d")) {
    return {
      label: "NOFF · top 200 global",
      url: "https://www.noff.gg/brawl-stars/tier-list",
    };
  }
  return { label: data.source, url: data.sourceUrl };
}

export default function MetaTierList({
  data,
  brawlers,
}: {
  data: TierListData;
  brawlers: Brawler[];
}) {
  const rosterFallback = useMemo(() => {
    const grouped: TierSnapshot = {};
    for (const brawler of brawlers) {
      const tier = brawler.tier || "Sin datos";
      (grouped[tier] ||= []).push(brawler.name);
    }
    return grouped;
  }, [brawlers]);

  const currentModel = data.snapshots[CURRENT_MODEL_LABEL] || rosterFallback;
  const snapshots = useMemo<Record<string, TierSnapshot>>(() => ({
    [CURRENT_MODEL_LABEL]: currentModel,
    ...data.snapshots,
  }), [currentModel, data.snapshots]);

  const snapshotNames = Object.keys(snapshots);
  const [snapshot, setSnapshot] = useState(CURRENT_MODEL_LABEL);
  const selected = snapshots[snapshot] || currentModel;
  const isCurrentModel = snapshot === CURRENT_MODEL_LABEL;
  const snapshotDate = snapshot.match(/(\d{2}\/\d{2})/)?.[1] || "03/09";
  const snapshotSource = sourceForSnapshot(snapshot, data);
  const lookup = useMemo(
    () => new Map(brawlers.map((brawler) => [brawler.name, brawler])),
    [brawlers],
  );

  return <section className="panel meta-tierlist-v11">
    <div className="section-title">
      <div>
        <span className="eyebrow">Tier list competitiva</span>
        <h2>Update 69: tier operativo tras los primeros días</h2>
        <p>{isCurrentModel
          ? "Ranking operativo orientado a Ranked alto. Da más peso a Legendary y Masters del 03/09, contrasta la señal diaria del top 200 y aplica los buffs/nerfs oficiales. Pro se excluye por muestra todavía insuficiente."
          : snapshot.startsWith("BrawlMetrics Legendary")
            ? "Fotografía específica de Legendary del 03/09. Sirve como ancla principal del modelo porque refleja draft real en el rango competitivo objetivo y ya acumula varios millones de apariciones."
            : snapshot.includes("02/09")
              ? "Fotografía postparche temprana sin suavizar. Úsala para ver la señal diaria; el motor no copia automáticamente sus extremos."
              : "Snapshot histórico conservado para separar el efecto del parche del ruido diario."}</p>
      </div>
      <div className="meta-tier-tabs" role="tablist" aria-label="Periodo de la tier list">
        {snapshotNames.map((name) => <button
          type="button"
          role="tab"
          aria-selected={snapshot === name}
          className={snapshot === name ? "active" : ""}
          key={name}
          onClick={() => setSnapshot(name)}
        >{name}</button>)}
      </div>
    </div>

    <div className="meta-tier-source">
      <span><b>Actualización</b>{isCurrentModel ? "03/09/2026 · días 1–3 de Update 69" : `${snapshotDate}/2026`}</span>
      <span><b>{isCurrentModel ? "Base del modelo" : "Fuente estadística"}</b>{isCurrentModel
        ? "Legendary 4,34 M + Masters 440 k + NOFF 24 h + balance oficial"
        : snapshotSource.label}{!isCurrentModel && <a href={snapshotSource.url} target="_blank" rel="noreferrer">Abrir fuente ↗</a>}</span>
      <span><b>Criterio</b>{isCurrentModel
        ? "Prioridad a rendimiento de Ranked alto y consistencia entre fuentes. Mapa, modo, geometría, orden y matchup siguen prevaleciendo sobre el tier global."
        : snapshot.startsWith("BrawlMetrics Legendary")
          ? "Dato de Legendary: win rate y uso ponderados por muestra; no equivale por sí solo a seguridad de first pick."
          : snapshot.includes("02/09")
            ? "Señal temprana sin calibrar: popularidad y poco volumen pueden empujar brawlers a extremos artificiales."
            : "Control histórico para medir el desplazamiento real del meta."}</span>
    </div>

    <div className="meta-tier-rows">
      {tierOrder.map((tier) => {
        const names = selected[tier] || [];
        if (!names.length) return null;
        return <article className={`meta-tier-row tier-${tier.toLowerCase().replace(/\+/g, "plus").replace(/\s+/g, "-")}`} key={tier}>
          <div className="meta-tier-label">
            <strong>{tier}</strong>
            <span>{names.length}</span>
          </div>
          <div className="meta-tier-brawlers">
            {names.map((name) => {
              const brawler = lookup.get(name);
              return <div className="meta-tier-brawler" key={name} title={`${name}${brawler ? ` · ${brawler.role}` : ""}`}>
                <BrawlerPortrait name={name} className="meta-tier-avatar" />
                <span>{name}</span>
              </div>;
            })}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
