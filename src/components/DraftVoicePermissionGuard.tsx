"use client";

import { useEffect } from "react";

const READY_ATTR = "data-draft-mic-ready";
const GUARD_ATTR = "data-draft-mic-guard";
const CONTROL_SELECTOR = ".voice-draft-control-v185";
const BUTTON_SELECTOR = ".voice-draft-button-v185";

type NavigatorWithPermissions = Navigator & {
  permissions?: Permissions;
};

type GuardBinding = {
  button: HTMLButtonElement;
  handler: (event: MouseEvent) => void;
};

let microphoneGrantedForPage = false;

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

function setReadyOnAllControls() {
  document.querySelectorAll<HTMLButtonElement>(`${CONTROL_SELECTOR} ${BUTTON_SELECTOR}`).forEach((button) => {
    button.setAttribute(READY_ATTR, "1");
  });
}

function setControlState(control: HTMLElement, state: "requesting" | "denied" | "ready") {
  control.classList.toggle("mic-requesting-v350", state === "requesting");
  control.classList.toggle("mic-denied-v350", state === "denied");
}

export default function DraftVoicePermissionGuard() {
  useEffect(() => {
    let disposed = false;
    const bindings = new Map<HTMLButtonElement, GuardBinding>();

    const detachMissing = () => {
      for (const [button, binding] of bindings) {
        if (document.contains(button)) continue;
        button.removeEventListener("click", binding.handler, true);
        bindings.delete(button);
      }
    };

    const attach = async () => {
      if (disposed) return;
      detachMissing();

      const permission = microphoneGrantedForPage ? "granted" : await microphonePermissionState();
      if (disposed) return;
      if (permission === "granted") {
        microphoneGrantedForPage = true;
        setReadyOnAllControls();
      }

      const controls = document.querySelectorAll<HTMLElement>(CONTROL_SELECTOR);
      for (const control of controls) {
        const button = control.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);
        if (!button || bindings.has(button)) continue;

        button.setAttribute(GUARD_ATTR, "1");
        if (microphoneGrantedForPage) button.setAttribute(READY_ATTR, "1");

        const handler = (event: MouseEvent) => {
          if (button.disabled) return;
          if (button.getAttribute(READY_ATTR) === "1") return;
          if (!speechSupported()) return;
          if (!navigator.mediaDevices?.getUserMedia) return;

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          setControlState(control, "requesting");
          const status = control.querySelector<HTMLElement>(".voice-draft-status-v185");
          if (status) status.textContent = "Solicitando acceso al micrófono…";

          void navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              stream.getTracks().forEach((track) => track.stop());
              if (disposed || !document.contains(button)) return;

              microphoneGrantedForPage = true;
              setReadyOnAllControls();
              setControlState(control, "ready");
              if (status) status.textContent = "Micrófono listo. Iniciando escucha…";

              // Repite el click una vez que el permiso del sistema ya está concedido.
              // El atributo READY evita que esta segunda pulsación vuelva a ser interceptada.
              window.setTimeout(() => {
                if (!disposed && document.contains(button)) button.click();
              }, 0);
            })
            .catch((error: unknown) => {
              if (disposed || !document.contains(button)) return;
              setControlState(control, "denied");
              const name = error instanceof DOMException ? error.name : "";
              if (status) {
                status.textContent = name === "NotFoundError"
                  ? "No se detecta ningún micrófono disponible."
                  : "No puedo usar el micrófono. Permite el acceso para este sitio y vuelve a pulsar.";
              }
            });
        };

        button.addEventListener("click", handler, true);
        bindings.set(button, { button, handler });
      }
    };

    void attach();
    const observer = new MutationObserver(() => void attach());
    observer.observe(document.body, { childList: true, subtree: true });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void attach();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const { button, handler } of bindings.values()) {
        button.removeEventListener("click", handler, true);
      }
      bindings.clear();
    };
  }, []);

  return null;
}
