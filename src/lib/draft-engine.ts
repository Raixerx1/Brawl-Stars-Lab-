import type { Brawler, DraftInput, DraftRecommendation } from "./types";
const tierScore:Record<string,number>={S:86,"A+":80,A:74,"B+":68,B:62,"Sin evaluar":50};
const norm=(s:string)=>s.trim().toLowerCase();
export function recommendDraft(input:DraftInput, roster:Brawler[]):DraftRecommendation[]{
 const unavailable=new Set([...input.allies,...input.enemies,...input.bans].map(norm));
 const enemyProfiles=input.enemies.map(n=>roster.find(b=>norm(b.name)===norm(n))).filter(Boolean) as Brawler[];
 const allyProfiles=input.allies.map(n=>roster.find(b=>norm(b.name)===norm(n))).filter(Boolean) as Brawler[];
 return roster.filter(b=>!unavailable.has(norm(b.name))).map(b=>{
   let score=tierScore[b.tier]??50; const reasons:string[]=[];
   const mode=b.modes[input.map.mode]??0; score+=mode*1.7;
   if(mode>=8) reasons.push(`Afinidad alta con ${input.map.mode}`);
   const sIndex=input.map.tierS.indexOf(b.name), aIndex=input.map.tierA.indexOf(b.name);
   if(sIndex>=0){score+=18-sIndex*1.5;reasons.push("Tier S editorial del mapa");}
   else if(aIndex>=0){score+=10-aIndex;reasons.push("Tier A editorial del mapa");}
   if(input.position==="First pick"){
     if(b.tags.includes("safe")) {score+=9;reasons.push("Pick estable a ciegas");}
     if(b.tags.includes("lastpick")||b.tags.includes("assassin")) score-=7;
   }
   if(input.position==="Last pick"){
     if(b.tags.includes("lastpick")||b.tags.includes("assassin")) {score+=9;reasons.push("Escala como counterpick");}
   }
   const enemyTags=new Set(enemyProfiles.flatMap(e=>e.tags));
   if(enemyTags.has("tank")&&b.tags.includes("antitank")){score+=12;reasons.push("Cubre antitanque");}
   if(enemyTags.has("assassin")&&b.tags.includes("antidive")){score+=11;reasons.push("Protege frente a dive");}
   if(enemyTags.has("thrower")&&(b.tags.includes("assassin")||b.tags.includes("mobile"))){score+=9;reasons.push("Acceso contra artilleros");}
   if(input.map.layout==="Abierto"&&(b.tags.includes("sniper")||b.range==="Muy largo")){score+=8;reasons.push("Aprovecha el mapa abierto");}
   if(input.map.layout==="Cerrado"&&(b.tags.includes("tank")||b.tags.includes("walls")||b.tags.includes("thrower"))){score+=7;reasons.push("Aprovecha cobertura y pasillos");}
   const allyRoles=new Set(allyProfiles.map(a=>a.role));
   if(!allyRoles.has(b.role)) score+=3;
   if(allyProfiles.length&&allyProfiles.every(a=>a.role==="Tirador")&&["Control","Tanque","Apoyo"].includes(b.role)){score+=6;reasons.push("Equilibra la composición");}
   if(!b.profileComplete) score-=16;
   score=Math.max(0,Math.min(100,Math.round(score)));
   return {brawler:b,score,reasons:reasons.slice(0,4),warning:!b.profileComplete?"Perfil aún sin validación táctica completa":undefined};
 }).sort((a,b)=>b.score-a.score).slice(0,8);
}
