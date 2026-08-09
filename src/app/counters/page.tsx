import type { Metadata } from "next";
import CounterExplorer from "@/components/CounterExplorer";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Counters" };

export default function CountersPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Matchup Lab v0.8.1</span>
      <h1>Counters y amenazas</h1>
      <p>Roster completo con búsqueda, filtros y auditoría de cobertura. El mapa y la composición pueden invertir un matchup teórico.</p>
    </div>
    <CounterExplorer brawlers={brawlers} />
  </div>;
}
