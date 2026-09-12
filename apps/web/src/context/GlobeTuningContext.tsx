import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_GLOBE_TUNING, type GlobeTuning } from "../lib/globeTuning";

type GlobeTuningContextValue = {
  tuning: GlobeTuning;
  setTuning: (patch: Partial<GlobeTuning>) => void;
  resetTuning: () => void;
};

const GlobeTuningContext = createContext<GlobeTuningContextValue | null>(null);

export function GlobeTuningProvider({ children }: { children: ReactNode }) {
  const [tuning, setTuningState] = useState<GlobeTuning>(DEFAULT_GLOBE_TUNING);

  const setTuning = useCallback((patch: Partial<GlobeTuning>) => {
    setTuningState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetTuning = useCallback(() => {
    setTuningState(DEFAULT_GLOBE_TUNING);
  }, []);

  const value = useMemo(
    () => ({ tuning, setTuning, resetTuning }),
    [tuning, setTuning, resetTuning],
  );

  return (
    <GlobeTuningContext.Provider value={value}>{children}</GlobeTuningContext.Provider>
  );
}

export function useGlobeTuning() {
  const ctx = useContext(GlobeTuningContext);
  if (!ctx) {
    throw new Error("useGlobeTuning must be used within GlobeTuningProvider");
  }
  return ctx;
}

export function useGlobeTuningOptional() {
  return useContext(GlobeTuningContext);
}
