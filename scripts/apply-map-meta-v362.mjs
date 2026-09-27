import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/draft-engine.ts";
let source = await readFile(path, "utf8");

function replace(before, after, label) {
  if (!source.includes(before)) throw new Error(`No se encontró: ${label}`);
  source = source.replace(before, after);
}

replace(
`  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  const firstPickIndex = input.map.firstPicks.indexOf(brawler.name);
  const firstPickEvaluation = input.position === "First pick"
    ? evaluateFirstPick(brawler, input.map)
    : undefined;
`,
`  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  const rankedMetaIndex = input.map.rankedMetaCore?.indexOf(brawler.name) ?? -1;
  const rankedMetaConfidence = Math.min(1, Math.max(.62, (input.map.rankedMetaSample || 10000) / 25000));
  const firstPickIndex = input.map.firstPicks.indexOf(brawler.name);
  const firstPickEvaluation = input.position === "First pick"
    ? evaluateFirstPick(brawler, input.map)
    : undefined;
`,
"índice Ranked en scoreCandidate",
);

replace(
`  } else if (aIndex >= 0) {
    const mapBonus =
      input.position === "First pick" ? 10 - aIndex :
      input.position === "Pick intermedio" ? 4 - aIndex * .35 :
      2 - aIndex * .18;
    score += Math.max(.5, mapBonus);
    mapFit += input.position === "First pick"
      ? 14 - aIndex
      : input.position === "Pick intermedio"
        ? 7 - aIndex * .5
        : 4 - aIndex * .25;
    reasons.push("Tier A editorial del mapa");
  }

  if (firstPickEvaluation) {
`,
`  } else if (aIndex >= 0) {
    const mapBonus =
      input.position === "First pick" ? 10 - aIndex :
      input.position === "Pick intermedio" ? 4 - aIndex * .35 :
      2 - aIndex * .18;
    score += Math.max(.5, mapBonus);
    mapFit += input.position === "First pick"
      ? 14 - aIndex
      : input.position === "Pick intermedio"
        ? 7 - aIndex * .5
        : 4 - aIndex * .25;
    reasons.push("Tier A editorial del mapa");
  }

  if (rankedMetaIndex >= 0) {
    const stageBase =
      input.position === "First pick" ? 6.5 :
      input.position === "Pick intermedio" ? 5.5 :
      4.5;
    const empiricalBonus = Math.max(1, stageBase - rankedMetaIndex * .8) * rankedMetaConfidence;
    score += empiricalBonus;
    mapFit += Math.max(2, 8 - rankedMetaIndex) * rankedMetaConfidence;
    meta += Math.max(1, 5 - rankedMetaIndex * .7) * rankedMetaConfidence;
    reasons.push("Meta Ranked del mapa" + (input.map.rankedMetaSample ? " · " + input.map.rankedMetaSample.toLocaleString("es-ES") + " partidas" : ""));
  }

  if (firstPickEvaluation) {
`,
"prior Ranked moderado en recomendación",
);

replace(
`      const mapBanIndex = input.map.bans.indexOf(brawler.name);
      const tierIndex = input.map.tierS.indexOf(brawler.name);
      if (mapBanIndex >= 0) { score += 35 - mapBanIndex * 5; reasons.push("Ban prioritario del mapa"); }
      if (tierIndex >= 0) { score += 18 - tierIndex * 2; reasons.push("Tier S del mapa"); }
`,
`      const mapBanIndex = input.map.bans.indexOf(brawler.name);
      const tierIndex = input.map.tierS.indexOf(brawler.name);
      const rankedMetaIndex = input.map.rankedMetaCore?.indexOf(brawler.name) ?? -1;
      const rankedMetaConfidence = Math.min(1, Math.max(.62, (input.map.rankedMetaSample || 10000) / 25000));
      if (mapBanIndex >= 0) { score += 35 - mapBanIndex * 5; reasons.push("Ban prioritario editorial del mapa"); }
      if (tierIndex >= 0) { score += 18 - tierIndex * 2; reasons.push("Tier S editorial del mapa"); }
      if (rankedMetaIndex >= 0) {
        score += Math.max(2, 11 - rankedMetaIndex * 1.6) * rankedMetaConfidence;
        reasons.push("Amenaza frecuente y eficaz en Ranked del mapa");
      }
`,
"prior Ranked en bans",
);

replace(
`      const tierIndex = input.map.tierS.indexOf(brawler.name);
      const aIndex = input.map.tierA.indexOf(brawler.name);

      if (tierIndex >= 0) {
        score += 18 - tierIndex * 2;
        reasons.push("Prioridad natural del mapa");
      } else if (aIndex >= 0) {
        score += 9 - aIndex;
        reasons.push("Buen encaje con el mapa");
      }
`,
`      const tierIndex = input.map.tierS.indexOf(brawler.name);
      const aIndex = input.map.tierA.indexOf(brawler.name);
      const rankedMetaIndex = input.map.rankedMetaCore?.indexOf(brawler.name) ?? -1;
      const rankedMetaConfidence = Math.min(1, Math.max(.62, (input.map.rankedMetaSample || 10000) / 25000));

      if (tierIndex >= 0) {
        score += 18 - tierIndex * 2;
        reasons.push("Prioridad editorial del mapa");
      } else if (aIndex >= 0) {
        score += 9 - aIndex;
        reasons.push("Buen encaje editorial con el mapa");
      }
      if (rankedMetaIndex >= 0) {
        score += Math.max(1.5, 7 - rankedMetaIndex) * rankedMetaConfidence;
        reasons.push("Alta presencia/rendimiento Ranked en este mapa");
      }
`,
"prior Ranked en predicción rival",
);

replace(
`  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  if (sIndex >= 0) score += 18 - sIndex * 1.8;
  else if (aIndex >= 0) score += 10 - aIndex * 1.2;

  if (input.map.layout === "Abierto") {
`,
`  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  const rankedMetaIndex = input.map.rankedMetaCore?.indexOf(brawler.name) ?? -1;
  const rankedMetaConfidence = Math.min(1, Math.max(.62, (input.map.rankedMetaSample || 10000) / 25000));
  if (sIndex >= 0) score += 18 - sIndex * 1.8;
  else if (aIndex >= 0) score += 10 - aIndex * 1.2;
  if (rankedMetaIndex >= 0) score += Math.max(1, 6 - rankedMetaIndex) * rankedMetaConfidence;

  if (input.map.layout === "Abierto") {
`,
"prior Ranked en fuerza base del mapa",
);

await writeFile(path, source);
console.log("Draft Engine v0.36.2: prior Ranked separado aplicado a picks, bans, predicción rival y fuerza de mapa.");
