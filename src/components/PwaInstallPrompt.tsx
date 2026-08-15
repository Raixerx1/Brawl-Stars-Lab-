"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "brawl-lab:pwa-install-dismissed-v1";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const classicIOS = /iPhone|iPad|iPod/i.test(ua);
  const modernIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return classicIOS || modernIPad;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = (navigator as NavigatorWithStandalone).standalone === true;
  return navigatorStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export default function PwaInstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [safari, setSafari] = useState(true);

  useEffect(() => {
    const appleMobile = isAppleMobile();
    const installed = isStandalone();
    const wasDismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    setSafari(isSafariBrowser());
    setEligible(appleMobile && !installed);
    setDismissed(wasDismissed);
  }, []);

  if (!eligible) return null;

  const dismiss = () => {
    setDismissed(true);
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // La instalación sigue funcionando aunque Safari bloquee localStorage.
    }
  };

  const reopen = () => {
    setDismissed(false);
    setOpen(true);
    try {
      window.localStorage.removeItem(DISMISSED_KEY);
    } catch {
      // No es crítico para el funcionamiento de la PWA.
    }
  };

  if (dismissed) {
    return <button type="button" className="pwa-install-pill" onClick={reopen} aria-label="Instalar Brawl Draft Lab en el iPhone">
      <span>＋</span> Instalar app
    </button>;
  }

  return <>
    <div className="pwa-install-banner" role="region" aria-label="Instalar Brawl Draft Lab">
      <div className="pwa-install-icon">★</div>
      <div className="pwa-install-copy">
        <b>Instala Brawl Draft Lab en tu iPhone</b>
        <span>Ábrela desde la pantalla de inicio como una app, sin la barra de Safari.</span>
      </div>
      <button type="button" className="pwa-install-primary" onClick={() => setOpen(true)}>Cómo instalar</button>
      <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Cerrar aviso">×</button>
    </div>

    {open && <div className="pwa-install-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section className="pwa-install-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" onClick={(event) => event.stopPropagation()}>
        <div className="pwa-install-modal-heading">
          <div><span className="eyebrow">iPhone · PWA</span><h2 id="pwa-install-title">Instalar como app</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
        </div>

        {!safari && <div className="pwa-install-warning">
          <b>Abre primero esta web en Safari.</b>
          <span>La instalación como web app se realiza desde las acciones de Safari.</span>
        </div>}

        <ol className="pwa-install-steps">
          <li><strong>1</strong><span>En Safari, abre <b>Compartir</b> desde la barra del navegador.</span></li>
          <li><strong>2</strong><span>Pulsa <b>Añadir a pantalla de inicio</b>.</span></li>
          <li><strong>3</strong><span>Activa <b>Abrir como app web</b>.</span></li>
          <li><strong>4</strong><span>Pulsa <b>Añadir</b>. Aparecerá el icono de Draft Lab en tu pantalla de inicio.</span></li>
        </ol>

        <div className="pwa-install-result">
          <span>✓</span>
          <p><b>Después de instalarla</b> se abrirá en modo independiente y conservará el acceso al Draft Assistant, Counters y Meta.</p>
        </div>

        <div className="pwa-install-modal-actions">
          <button type="button" className="secondary-button" onClick={dismiss}>Entendido</button>
          <button type="button" className="pwa-install-primary" onClick={() => setOpen(false)}>Voy a instalarla</button>
        </div>
      </section>
    </div>}
  </>;
}
