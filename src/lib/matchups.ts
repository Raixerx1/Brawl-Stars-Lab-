import type { Brawler } from "./types";

const hasAny = (brawler: Brawler, values: string[]) =>
  values.some((value) => brawler.tags.includes(value) || brawler.role.toLowerCase().includes(value));

export function favorableReason(source: Brawler, target: Brawler) {
  const reviewed = source.matchupNotes?.favorable?.[target.name];
  if (reviewed) return reviewed;
  if (hasAny(source, ["antitank", "antitanque"]) && target.role === "Tanque") {
    return "Daño o control especialmente eficiente contra objetivos de mucha vida.";
  }
  if (source.role === "Asesino" && target.role === "Artillero") {
    return "Puede cerrar la distancia y castigar su baja capacidad de respuesta a corta distancia.";
  }
  if (source.role === "Artillero" && ["Tanque", "Control", "Apoyo"].includes(target.role)) {
    return "Aprovecha muros y zonas estrechas para presionar sin exponerse.";
  }
  if (source.role === "Tirador" && ["Control", "Apoyo"].includes(target.role)) {
    return "Tiene ventaja de alcance y puede negar su espacio de trabajo.";
  }
  if (hasAny(source, ["antidive"]) && target.role === "Asesino") {
    return "Dispone de herramientas para cortar la entrada y castigar el dive.";
  }
  if (source.role === "Control" && target.role === "Tanque") {
    return "Reduce su acceso mediante ralentizaciones, área o desplazamientos.";
  }
  if (source.role === "Apoyo" && target.role === "Tanque") {
    return "Su sustain y utilidad permiten desgastar una composición lenta.";
  }
  return "Matchup editorial favorable por alcance, movilidad, presión o interacción de habilidades.";
}

export function threatReason(source: Brawler, threat: Brawler) {
  const reviewed = source.matchupNotes?.threats?.[threat.name];
  if (reviewed) return reviewed;
  if (source.role === "Artillero" && threat.role === "Asesino") {
    return "Amenaza de entrada directa: evita quedarte sin gadget, súper o cobertura aliada.";
  }
  if (source.role === "Tirador" && threat.role === "Asesino") {
    return "Puede eliminar la ventaja de alcance si consigue cerrar la distancia.";
  }
  if (source.role === "Tanque" && hasAny(threat, ["antitank", "antitanque", "antidive"])) {
    return "Tiene daño porcentual, control o desplazamiento que neutraliza la entrada.";
  }
  if (["Control", "Apoyo"].includes(source.role) && threat.role === "Tirador") {
    return "Le obliga a jugar fuera de su rango útil y castiga las posiciones estáticas.";
  }
  if (source.role === "Asesino" && hasAny(threat, ["antidive", "control"])) {
    return "Puede cancelar la entrada o sobrevivir al burst inicial.";
  }
  return "Amenaza editorial por alcance, burst, control de acceso o capacidad de persecución.";
}
