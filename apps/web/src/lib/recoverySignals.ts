import { useEffect, useRef } from "react";

/** Arms on tab hide; fires when the user returns so the toast is visible. */
export function useAbandonSignals(options: {
  enabled: boolean;
  onAbandon: (trigger: "visibility_hidden") => void;
}) {
  const { enabled, onAbandon } = options;
  const onAbandonRef = useRef(onAbandon);
  onAbandonRef.current = onAbandon;
  const leftWhileEnabled = useRef(false);

  useEffect(() => {
    if (!enabled) {
      leftWhileEnabled.current = false;
      return;
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leftWhileEnabled.current = true;
        return;
      }
      if (document.visibilityState === "visible" && leftWhileEnabled.current) {
        leftWhileEnabled.current = false;
        onAbandonRef.current("visibility_hidden");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);
}

const LOCAL_SESSION_KEY = "veya-recovery-session";

export function stashLocalRecovery(payload: unknown) {
  try {
    sessionStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readLocalRecovery(): unknown | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
