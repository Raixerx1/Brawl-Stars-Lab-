"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DraftFirstPickOwner } from "@/lib/types";

const MODE_LABELS: Record<string, string> = {
  "atrapagemas": "Gem Grab",
  "gem grab": "Gem Grab",
  "balon brawl": "Brawl Ball",
  "brawl ball": "Brawl Ball",
  "noqueo": "Knockout",
  "knockout": "Knockout",
  "caza estelar": "Bounty",
  "bounty": "Bounty",
  "zona restringida": "Hot Zone",
  "hot zone": "Hot Zone",
  "atraco": "Heist",
  "heist": "Heist",
  "supervivencia": "Showdown",
  "showdown": "Showdown",
  "duelos": "Duels",
  "duels": "Duels",
  "balon basket": "Basket Brawl",
  "basket brawl": "Basket Brawl",
  "aniquilacion": "Wipeout",
  "wipeout": "Wipeout",
  "pintura": "Paint Brawl",
  "paint brawl": "Paint Brawl",
  "caza de trofeos": "Trophy Escape",
  "trophy escape": "Trophy Escape",
};

type ModeOption = { value: string; label: string };

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function englishModeLabel(value: string, fallback: string) {
  return MODE_LABELS[normalizeLabel(value)] || MODE_LABELS[normalizeLabel(fallback)] || fallback;
}

function labelPrefix(label: HTMLLabelElement) {
  const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  return textNode?.textContent?.trim() || "";
}

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function readModeOptions(select: HTMLSelectElement): ModeOption[] {
  return [...select.options].map((option) => ({
    value: option.value,
    label: englishModeLabel(option.value, option.textContent || option.value),
  }));
}

export default function DraftUiEnhancer() {
  const [modeHost, setModeHost] = useState<HTMLLabelElement | null>(null);
  const [modeSelect, setModeSelect] = useState<HTMLSelectElement | null>(null);
  const [modeValue, setModeValue] = useState("");
  const [modeOptions, setModeOptions] = useState<ModeOption[]>([]);
  const [coinHost, setCoinHost] = useState<HTMLLabelElement | null>(null);
  const [firstPickSelect, setFirstPickSelect] = useState<HTMLSelectElement | null>(null);
  const [owner, setOwner] = useState<DraftFirstPickOwner>("Aliado");
  const modeSelectRef = useRef<HTMLSelectElement | null>(null);
  const firstPickSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    let disposed = false;

    const enhance = () => {
      if (disposed) return;
      const context = document.querySelector<HTMLElement>(".ordered-draft-context-v5");
      if (!context) return;

      const labels = [...context.querySelectorAll<HTMLLabelElement>("label")];
      const modeLabel = labels.find((label) => normalizeLabel(labelPrefix(label)) === "modo");
      const firstLabel = labels.find((label) => normalizeLabel(labelPrefix(label)) === "first pick");

      if (modeLabel) {
        const select = modeLabel.querySelector<HTMLSelectElement>(":scope > select");
        if (select) {
          modeLabel.classList.add("draft-mode-english-host-v215");
          select.setAttribute("aria-hidden", "true");
          if (modeSelectRef.current !== select) {
            modeSelectRef.current = select;
            setModeHost(modeLabel);
            setModeSelect(select);
            setModeValue(select.value);
            setModeOptions(readModeOptions(select));
          }
        }
      }

      if (firstLabel) {
        const select = firstLabel.querySelector<HTMLSelectElement>(":scope > select");
        if (select) {
          firstLabel.classList.add("draft-first-pick-coin-host-v214");
          select.setAttribute("aria-hidden", "true");
          if (firstPickSelectRef.current !== select) {
            firstPickSelectRef.current = select;
            const nextOwner: DraftFirstPickOwner = select.value === "Rival" ? "Rival" : "Aliado";
            setOwner(nextOwner);
            setFirstPickSelect(select);
            setCoinHost(firstLabel);
          }
        }
      }
    };

    enhance();
    const observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!modeSelect) return;
    const sync = () => {
      setModeValue(modeSelect.value);
      setModeOptions(readModeOptions(modeSelect));
    };
    modeSelect.addEventListener("change", sync);
    return () => modeSelect.removeEventListener("change", sync);
  }, [modeSelect]);

  useEffect(() => {
    if (!firstPickSelect) return;
    const sync = () => setOwner(firstPickSelect.value === "Rival" ? "Rival" : "Aliado");
    firstPickSelect.addEventListener("change", sync);
    return () => firstPickSelect.removeEventListener("change", sync);
  }, [firstPickSelect]);

  const changeMode = (value: string) => {
    if (!modeSelect) return;
    setModeValue(value);
    setNativeSelectValue(modeSelect, value);
  };

  const flipCoin = () => {
    if (!firstPickSelect) return;
    const next: DraftFirstPickOwner = owner === "Aliado" ? "Rival" : "Aliado";
    setOwner(next);
    setNativeSelectValue(firstPickSelect, next);
  };

  const allied = owner === "Aliado";

  return <>
    {modeHost && createPortal(
      <div className="draft-mode-english-control-v215">
        <span>MODE</span>
        <select
          className="draft-mode-display-v215"
          value={modeValue}
          onChange={(event) => changeMode(event.target.value)}
          aria-label="Game mode"
        >
          {modeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </div>,
      modeHost,
    )}

    {coinHost && createPortal(
      <div className="draft-first-pick-coin-control-v214">
        <span className="draft-coin-label-v214">FIRST PICK</span>
        <button
          type="button"
          className={`draft-team-coin-v214 ${allied ? "ally" : "enemy"}`}
          onClick={flipCoin}
          aria-label={allied ? "Mi equipo tiene first pick. Cambiar a equipo rival" : "El equipo rival tiene first pick. Cambiar a mi equipo"}
          title="Clic para cambiar quién tiene el first pick"
        >
          <span className="draft-team-coin-face-v214">{allied ? "MI" : "RIV"}</span>
        </button>
        <span className="draft-coin-copy-v214">
          <b>{allied ? "Mi equipo" : "Equipo rival"}</b>
          <small>{allied ? "Azul · nosotros primero" : "Rojo · rival primero"}</small>
        </span>
      </div>,
      coinHost,
    )}
  </>;
}
