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
 * 노출한다. PR-139 (Round 20) 까지는 UA 를 우선했으나 베타6 피드백 (실제 폰
 * 다크인데 라이트로 표시) 으로 우선순위 반전: **matchMedia 가 진실**.
 * UA 는 matchMedia 가 실패/예외일 때만 fallback. 일부 WebView 의 stale UA
 * 문제를 회피하면서 brand-new WebView 의 명시적 라벨도 살림.
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
  // matchMedia 우선 — OS 실제 상태.
  try {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    // mql.media === "not all" 면 브라우저가 쿼리를 지원 안 함 → UA fallback.
    if (mql.media !== "not all") {
      return mql.matches ? "dark" : "light";
    }
  } catch {
    /* matchMedia 미지원 또는 예외 — UA fallback */
  }
  // matchMedia 가 무력화된 환경에서만 UA 신뢰.
  const toss = getTossColorPreference();
  return toss ?? "light";
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
