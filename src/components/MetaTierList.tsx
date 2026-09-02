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
const CURRENT_MODEL_LABEL = "Motor U69 · 02/09";

export default function MetaTierList({
  data,
  brawlers,
}: {
  data: TierListData;
  brawlers: Brawler[];
}) {
  const patchDaySnapshot = useMemo(() => {
    const grouped: TierSnapshot = {};
    for (const brawler of brawlers) {
      const tier = brawler.tier || "Sin datos";
      (grouped[tier] ||= []).push(brawler.name);
    }
    return grouped;
  }, [brawlers]);

  const snapshots = useMemo<Record<string, TierSnapshot>>(() => ({
    [CURRENT_MODEL_LABEL]: patchDaySnapshot,
    ...data.snapshots,
  }), [data.snapshots, patchDaySnapshot]);

  const snapshotNames = Object.keys(snapshots);
  const [snapshot, setSnapshot] = useState(CURRENT_MODEL_LABEL);
  const selected = snapshots[snapshot] || patchDaySnapshot;
  const isCurrentModel = snapshot === CURRENT_MODEL_LABEL;
  const snapshotDate = snapshot.match(/(\d{2}\/\d{2})/)?.[1] || "02/09";
  const isBrawlBetterSnapshot = snapshot.startsWith("BrawlBetter");
  const snapshotSource = isBrawlBetterSnapshot ? "BrawlBetter Ranked · archivo histórico" : data.source;
  const snapshotSourceUrl = isBrawlBetterSnapshot ? "https://www.brawlbetter.com/meta" : data.sourceUrl;
  const lookup = useMemo(
    () => new Map(brawlers.map((brawler) => [brawler.name, brawler])),
    [brawlers],
  );

  return <section className="panel meta-tierlist-v11">
    <div className="section-title">
      <div>
        <span className="eyebrow">Tier list competitiva</span>
        <h2>Update 69: modelo calibrado + datos observados</h2>
        <p>{isCurrentModel
          ? "Ranking operativo del Draft Engine. Combina la muestra top-200 del 02/09, el balance oficial y la estabilidad a 30 días; corrige la distorsión de picks muy populares o con poco volumen."
          : snapshot.includes("02/09")
            ? "Fotografía postparche sin suavizar. Úsala para ver la señal temprana; el motor no copia automáticamente sus extremos."
            : "Snapshot histórico anterior al parche, conservado para medir el cambio real de Update 69."}</p>
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
      <span><b>Actualización</b>{isCurrentModel ? "02/09/2026 · Update 69" : `${snapshotDate}/2026`}</span>
      <span><b>{isCurrentModel ? "Base del modelo" : "Fuente estadística"}</b>{isCurrentModel ? "Meta 24 h 02/09 + General 30 d + balance oficial" : snapshotSource}{!isCurrentModel && <a href={snapshotSourceUrl} target="_blank" rel="noreferrer">Abrir fuente ↗</a>}</span>
      <span><b>Criterio</b>{isCurrentModel
        ? "Mapa, modo, geometría, orden y matchup prevalecen. Asesinos populares no se convierten en first picks por su tier global."
        : snapshot.includes("02/09")
          ? "Dato temprano sin calibrar: el bajo volumen puede enviar brawlers válidos a extremos artificiales."
          : "Control histórico para separar el efecto del parche del ruido diario."}</span>
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
