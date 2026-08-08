"use client";

import { useEffect, useState } from "react";

type BrawlApiBrawler = {
  name: string;
  imageUrl?: string;
  imageUrl2?: string;
  imageUrl3?: string;
};

type BrawlApiMap = {
  name: string;
  imageUrl?: string;
};

type ApiList<T> = { list: T[] };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

let brawlerAssetsPromise: Promise<Map<string, BrawlApiBrawler>> | null = null;
let mapAssetsPromise: Promise<Map<string, BrawlApiMap>> | null = null;

function loadBrawlerAssets() {
  if (!brawlerAssetsPromise) {
    brawlerAssetsPromise = fetch("https://api.brawlapi.com/v1/brawlers")
      .then((response) => {
        if (!response.ok) throw new Error("BrawlAPI brawlers unavailable");
        return response.json() as Promise<ApiList<BrawlApiBrawler>>;
      })
      .then(({ list }) => new Map(list.map((item) => [normalize(item.name), item])));
  }
  return brawlerAssetsPromise;
}

function loadMapAssets() {
  if (!mapAssetsPromise) {
    mapAssetsPromise = fetch("https://api.brawlapi.com/v1/maps")
      .then((response) => {
        if (!response.ok) throw new Error("BrawlAPI maps unavailable");
        return response.json() as Promise<ApiList<BrawlApiMap>>;
      })
      .then(({ list }) => new Map(list.map((item) => [normalize(item.name), item])));
  }
  return mapAssetsPromise;
}

export function BrawlerPortrait({
  name,
  className = "",
  priority = false,
}: {
  name: string;
  className?: string;
  priority?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadBrawlerAssets()
      .then((assets) => {
        const asset = assets.get(normalize(name));
        if (active) setUrl(asset?.imageUrl2 || asset?.imageUrl || asset?.imageUrl3 || null);
      })
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [name]);

  return (
    <div className={`brawler-portrait ${className}`} aria-label={`Imagen de ${name}`}>
      {url ? (
        <img
          src={url}
          alt={name}
          loading={priority ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function MapArtwork({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMapAssets()
      .then((assets) => {
        const asset = assets.get(normalize(name));
        if (active) setUrl(asset?.imageUrl || null);
      })
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [name]);

  return (
    <div className={`map-artwork ${className}`} aria-label={`Mapa ${name}`}>
      {url ? <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" /> : <span>◇</span>}
    </div>
  );
}
