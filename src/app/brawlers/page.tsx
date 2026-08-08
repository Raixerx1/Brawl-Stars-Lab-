import type { Metadata } from "next";
import BrawlerExplorer from "@/components/BrawlerExplorer";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Brawlers" };

export default function BrawlersPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Roster completo</span>
      <h1>106 brawlers</h1>
      <p>Todos incluyen cinco objetivos favorables y cinco amenazas. Las builds y tiers marcados como “Sin evaluar” continúan en revisión.</p>
    </div>
    <BrawlerExplorer brawlers={brawlers} />
  </div>;
}
