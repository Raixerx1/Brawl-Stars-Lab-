import Link from "next/link";
import type { MapProfile } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import { MapArtwork } from "./GameArtwork";

export default function MapCard({ map }: { map: MapProfile }) {
  return <article className="card map-card">
    <FavoriteButton type="map" id={map.slug} />
    <Link href={`/maps/${map.slug}`}>
      <MapArtwork name={map.name} className="map-card-art" />
      <div className="map-card-copy">
        <div className="card-kicker">{map.mode}</div>
        <h3>{map.name}</h3>
        <p>{map.layout} · {map.traits.slice(0, 2).join(" · ")}</p>
        <div className="mini-row">
          <span>S: {map.tierS.slice(0, 2).join(", ")}</span>
          <span>{map.rotationStatus === "Actual" ? "Ranked actual" : "Histórico"}</span>
        </div>
      </div>
    </Link>
  </article>;
}
