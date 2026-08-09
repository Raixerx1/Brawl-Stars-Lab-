import type { Metadata } from "next";
import PlayerPool from "@/components/PlayerPool";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Mi pool" };

export default function PoolPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Personalización</span>
      <h1>Mi pool competitivo</h1>
      <p>Configura disponibilidad, Fuerza 11, hipercarga, favoritos y dominio personal. Puedes exportar el pool y usarlo como preferencia o filtro estricto del Draft Coach. Los datos se guardan únicamente en tu navegador.</p>
    </div>
    <PlayerPool brawlers={brawlers} />
  </div>;
}
