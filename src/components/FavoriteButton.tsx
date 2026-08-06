"use client";
import { useEffect, useState } from "react";
export default function FavoriteButton({type,id}:{type:"map"|"brawler";id:string}){
 const key=`brawl-lab:${type}:favorites`; const [saved,setSaved]=useState(false);
 useEffect(()=>{const a=JSON.parse(localStorage.getItem(key)||"[]") as string[];setSaved(a.includes(id))},[id,key]);
 const toggle=()=>{const a=JSON.parse(localStorage.getItem(key)||"[]") as string[];const next=a.includes(id)?a.filter(x=>x!==id):[...a,id];localStorage.setItem(key,JSON.stringify(next));setSaved(next.includes(id));window.dispatchEvent(new Event("brawl-favorites"))};
 return <button className={`favorite ${saved?"is-saved":""}`} onClick={toggle} aria-label="Guardar favorito">★</button>
}
