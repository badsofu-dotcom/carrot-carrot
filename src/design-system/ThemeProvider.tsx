import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { safeStorage } from "../lib/safeStorage";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "cc.theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function safeRead(): ThemeMode | null {
  const v = safeStorage.get(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return null;
}

function safeWrite(mode: ThemeMode) {
  safeStorage.set(STORAGE_KEY, mode);
}

/**
 * Apps in Toss WebView 가 user-agent 에 `TossColorPreference/<light|dark>` 를
 * 노출한다. matchMedia 가 일부 WebView 에서 잘못 응답하는 경우가 있어
 * UA 가 명시적이면 그것을 우선 신뢰한다.
 */
function getTossColorPreference(): ResolvedTheme | null {
  if (typeof navigator === "undefined") return null;
  try {
    const ua = navigator.userAgent || "";
    const m = ua.match(/TossColorPreference\/(light|dark)/i);
    if (m) return m[1].toLowerCase() === "dark" ? "dark" : "light";
  } catch {
    /* ignore */
  }
  return null;
}

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const toss = getTossColorPreference();
  if (toss) return toss;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => safeRead() ?? "system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemPreference);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    // 마운트 시점 동기화 — UA 우선, 없으면 mql.
    setSystemTheme(getSystemPreference());
    const onChange = () => setSystemTheme(getSystemPreference());
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    const legacy = mql as MediaQueryList & {
      addListener?: (fn: () => void) => void;
      removeListener?: (fn: () => void) => void;
    };
    legacy.addListener?.(onChange);
    return () => legacy.removeListener?.(onChange);
  }, []);

  // resolved 는 항상 explicit light 또는 dark — system 일 땐 systemTheme 으로 해소.
  const resolved: ResolvedTheme = mode === "system" ? systemTheme : mode;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    // system 일 때도 CSS @media 에 의존하지 않고 명시적 data-theme 를 박아
    // 인앱 WebView 에서 시각/라벨이 어긋나지 않도록 한다.
    root.setAttribute("data-theme", resolved);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = resolved === "dark" ? "#1A1410" : "#FFF8E7";
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    safeWrite(next);
    // mode 가 system 으로 바뀌면 즉시 현재 시스템 값을 다시 읽어 stale 방지.
    if (next === "system") setSystemTheme(getSystemPreference());
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      safeWrite(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
