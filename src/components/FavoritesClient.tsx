"use client";
import { useEffect,useState } from "react";
import type { Brawler,MapProfile } from "@/lib/types";
import MapCard from "./MapCard";
import BrawlerCard from "./BrawlerCard";
export default function FavoritesClient({maps,brawlers}:{maps:MapProfile[];brawlers:Brawler[]}){
 const [mapIds,setMapIds]=useState<string[]>([]);const [bIds,setBIds]=useState<string[]>([]);
 useEffect(()=>{const load=()=>{setMapIds(JSON.parse(localStorage.getItem('brawl-lab:map:favorites')||'[]'));setBIds(JSON.parse(localStorage.getItem('brawl-lab:brawler:favorites')||'[]'))};load();window.addEventListener('brawl-favorites',load);return()=>window.removeEventListener('brawl-favorites',load)},[]);
 return <><div className="section-title"><div><span className="eyebrow">Tu selección</span><h2>Mapas favoritos</h2></div></div><div className="card-grid">{maps.filter(m=>mapIds.includes(m.slug)).map(m=><MapCard map={m} key={m.slug}/>)}{!mapIds.length&&<div className="empty-state">Aún no has guardado mapas.</div>}</div><div className="section-title spaced"><div><span className="eyebrow">Tu roster</span><h2>Brawlers favoritos</h2></div></div><div className="card-grid brawler-grid">{brawlers.filter(b=>bIds.includes(b.slug)).map(b=><BrawlerCard brawler={b} key={b.slug}/>)}{!bIds.length&&<div className="empty-state">Aún no has guardado brawlers.</div>}</div></>
}
