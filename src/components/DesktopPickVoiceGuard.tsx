"use client";

import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 901px)";
const READY_ATTR = "data-desktop-mic-ready";
const GUARD_ATTR = "data-desktop-mic-guard";

type NavigatorWithPermissions = Navigator & {
  permissions?: Permissions;
};

function speechSupported() {
  const speechWindow = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
}

async function microphonePermissionState(): Promise<PermissionState | "unknown"> {
  const nav = navigator as NavigatorWithPermissions;
  if (!nav.permissions?.query) return "unknown";
  try {
    const status = await nav.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

export default function DesktopPickVoiceGuard() {
  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    let disposed = false;
    let observedButton: HTMLButtonElement | null = null;
    let captureHandler: ((event: MouseEvent) => void) | null = null;

    const detach = () => {
      if (observedButton && captureHandler) {
        observedButton.removeEventListener("click", captureHandler, true);
      }
      observedButton = null;
      captureHandler = null;
    };

    const attach = async () => {
      if (disposed || !mediaQuery.matches) {
        detach();
        return;
      }

      const control = document.querySelector<HTMLElement>(".common-pick-search .voice-target-pick");
      const button = control?.querySelector<HTMLButtonElement>(".voice-draft-button-v185") || null;
      if (!control || !button || button === observedButton) return;

      detach();
      observedButton = button;
      control.classList.add("persistent-pick-voice-v216", "desktop-pick-voice-v221");
      button.setAttribute(GUARD_ATTR, "1");

      const state = await microphonePermissionState();
      if (disposed || observedButton !== button) return;
      if (state === "granted") button.setAttribute(READY_ATTR, "1");

      captureHandler = (event: MouseEvent) => {
        if (!mediaQuery.matches || button.disabled) return;
        if (button.getAttribute(READY_ATTR) === "1") return;
        if (!speechSupported()) return;
        if (!navigator.mediaDevices?.getUserMedia) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        control.classList.add("desktop-mic-requesting-v221");
        const status = control.querySelector<HTMLElement>(".voice-draft-status-v185");
        const previousText = status?.textContent || "";
        if (status) status.textContent = "Activando micrófono del PC…";

        void navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((track) => track.stop());
            if (disposed || observedButton !== button) return;
            button.setAttribute(READY_ATTR, "1");
            control.classList.remove("desktop-mic-requesting-v221", "desktop-mic-denied-v221");
            window.setTimeout(() => button.click(), 0);
          })
          .catch(() => {
            if (disposed || observedButton !== button) return;
            control.classList.remove("desktop-mic-requesting-v221");
            control.classList.add("desktop-mic-denied-v221");
            if (status) status.textContent = "El navegador ha bloqueado el micrófono. Permítelo para este sitio y vuelve a pulsar.";
            window.setTimeout(() => {
              if (status && status.textContent?.includes("navegador ha bloqueado")) {
                status.textContent = previousText;
              }
            }, 7000);
          });
      };

      button.addEventListener("click", captureHandler, true);
    };

    void attach();
    const observer = new MutationObserver(() => void attach());
    observer.observe(document.body, { childList: true, subtree: true });
    const handleMediaChange = () => void attach();
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      disposed = true;
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
      detach();
    };
  }, []);

  return null;
}
