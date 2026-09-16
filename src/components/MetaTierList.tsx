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
const CURRENT_MODEL_LABEL = "Motor post-balance · 16/09";

function sourceForSnapshot(snapshot: string, data: TierListData) {
  if (snapshot.startsWith("BrawlMetrics Legendary")) {
    return {
      label: "BrawlMetrics Ranked Legendary · 03/09 · baseline previo al balance del 16/09",
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
  const snapshotDate = snapshot.match(/(\d{2}\/\d{2})/)?.[1] || "16/09";
  const snapshotSource = sourceForSnapshot(snapshot, data);
  const lookup = useMemo(
    () => new Map(brawlers.map((brawler) => [brawler.name, brawler])),
    [brawlers],
  );

  return <section className="panel meta-tierlist-v11">
    <div className="section-title">
      <div>
        <span className="eyebrow">Tier list competitiva</span>
        <h2>Update 69: tier operativo tras el balance del 16/09</h2>
        <p>{isCurrentModel
          ? "Recalibración provisional del mismo día del mantenimiento. Aplica los buffs/nerfs oficiales y contrasta señal Ranked patch-aware/live, pero conserva el modelo del 03/09 como freno para no convertir unas horas de datos en un meta falso."
          : snapshot.startsWith("Motor U69")
            ? "Fotografía operativa anterior al balance del 16/09. Se conserva para ver qué movimientos vienen del parche y cuáles ya existían antes."
            : snapshot.startsWith("BrawlMetrics Legendary")
              ? "Fotografía específica de Legendary del 03/09. Sirve como baseline de Ranked alto previo al nuevo balance."
              : snapshot.includes("02/09")
                ? "Fotografía post-U69 temprana sin suavizar. Úsala como histórico de la primera fase del parche, no como dato actual."
                : "Snapshot histórico conservado para separar cambios reales del ruido diario."}</p>
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
      <span><b>Actualización</b>{isCurrentModel ? "16/09/2026 · balance oficial aplicado" : `${snapshotDate}/2026`}</span>
      <span><b>{isCurrentModel ? "Base del modelo" : "Fuente estadística"}</b>{isCurrentModel
        ? "Supercell 16/09 + BrawlBetter patch-aware + Brawl Time Ninja live + baseline Ranked alto 03/09"
        : snapshotSource.label}{!isCurrentModel && <a href={snapshotSource.url} target="_blank" rel="noreferrer">Abrir fuente ↗</a>}</span>
      <span><b>Criterio</b>{isCurrentModel
        ? "El cambio oficial pesa desde el minuto uno; la promoción/democión adicional exige señal competitiva. Mapa, modo, geometría, orden y matchup siguen prevaleciendo sobre el tier global."
        : snapshot.startsWith("BrawlMetrics Legendary")
          ? "Dato de Legendary previo al balance: útil como baseline, no como estado actual del parche."
          : snapshot.includes("02/09")
            ? "Señal histórica temprana: popularidad y poco volumen podían empujar brawlers a extremos artificiales."
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
