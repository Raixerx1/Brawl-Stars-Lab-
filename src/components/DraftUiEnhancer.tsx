"use client";

import { useEffect, useState } from "react";
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

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

export default function DraftUiEnhancer() {
  const [coinHost, setCoinHost] = useState<HTMLLabelElement | null>(null);
  const [firstPickSelect, setFirstPickSelect] = useState<HTMLSelectElement | null>(null);
  const [owner, setOwner] = useState<DraftFirstPickOwner>("Aliado");

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
        modeLabel.classList.add("draft-mode-english-v214");
        const select = modeLabel.querySelector<HTMLSelectElement>("select");
        if (select) {
          select.setAttribute("aria-label", "Game mode");
          [...select.options].forEach((option) => {
            const translated = MODE_LABELS[normalizeLabel(option.value)] || MODE_LABELS[normalizeLabel(option.textContent || "")];
            if (translated && option.textContent !== translated) option.textContent = translated;
          });
        }
      }

      if (firstLabel) {
        firstLabel.classList.add("draft-first-pick-coin-host-v214");
        const select = firstLabel.querySelector<HTMLSelectElement>("select");
        if (select) {
          select.setAttribute("aria-hidden", "true");
          const nextOwner: DraftFirstPickOwner = select.value === "Rival" ? "Rival" : "Aliado";
          setOwner(nextOwner);
          setFirstPickSelect(select);
          setCoinHost(firstLabel);
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
    if (!firstPickSelect) return;
    const sync = () => setOwner(firstPickSelect.value === "Rival" ? "Rival" : "Aliado");
    firstPickSelect.addEventListener("change", sync);
    return () => firstPickSelect.removeEventListener("change", sync);
  }, [firstPickSelect]);

  const flipCoin = () => {
    if (!firstPickSelect) return;
    const next: DraftFirstPickOwner = owner === "Aliado" ? "Rival" : "Aliado";
    setOwner(next);
    setNativeSelectValue(firstPickSelect, next);
  };

  if (!coinHost) return null;

  const allied = owner === "Aliado";
  return createPortal(
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
  );
}
