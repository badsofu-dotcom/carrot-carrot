/**
 * AdSuggestionModal (PR-27) — "자원 부족할 때 광고로 채우세요" 안내.
 *
 * Opens via `cc:ad-suggest:open` CustomEvent with `{ resource, title,
 * body, channel? }`. `[광고 보기]` 버튼은 본 모달을 닫고 곧장
 * `cc:ad-channel:open` 을 dispatch 해서 AdRewardChannelModal 로 넘김.
 *
 * Spam guard (safeStorage `cc.adPrompt.lastShownAt.<resource>`):
 *   - 같은 자원 부족은 `COOLDOWN_MIN` 분간 다시 안 뜸 (지나친 권유 방지).
 *   - 하루(KST) 최대 `DAILY_CAP` 회 — 닫은 횟수도 카운트.
 *
 * 가드는 dispatch 직전 (FarmHub 등) 에서 호출하는 `shouldShowAdSuggestion`
 * 헬퍼로 노출 — 모달 자체는 비-가드 (open=true 면 항상 표시).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "../../design-system/haptic";
import { safeStorage } from "../../lib/safeStorage";

const COOLDOWN_MIN = 5;
const DAILY_CAP = 3;
const KEY_LAST = (r: string) => `cc.adPrompt.lastShownAt.${r}`;
const KEY_COUNT = (r: string) => `cc.adPrompt.dailyCount.${r}`;

function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface CountState {
  day: string;
  count: number;
}

function readCount(resource: string): CountState {
  const raw = safeStorage.get(KEY_COUNT(resource));
  if (!raw) return { day: "", count: 0 };
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.day === "string" && typeof v.count === "number") {
      return { day: v.day, count: v.count };
    }
  } catch {
    /* corrupted */
  }
  return { day: "", count: 0 };
}

function writeCount(resource: string, state: CountState) {
  try {
    safeStorage.set(KEY_COUNT(resource), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * Returns true iff opening a suggestion for the given resource is
 * allowed by both the per-resource cooldown and the daily cap. Side-
 * effect-free — pure check.
 */
export function shouldShowAdSuggestion(resource: string): boolean {
  const lastRaw = safeStorage.get(KEY_LAST(resource));
  const last = lastRaw ? Number(lastRaw) : 0;
  if (Number.isFinite(last) && last > 0) {
    const diffMs = Date.now() - last;
    if (diffMs < COOLDOWN_MIN * 60 * 1000) return false;
  }
  const today = kstDayKey();
  const state = readCount(resource);
  if (state.day === today && state.count >= DAILY_CAP) return false;
  return true;
}

/**
 * Mark the suggestion as shown — bumps both the timestamp and the
 * daily count. Caller is responsible for calling this once when the
 * modal actually opens.
 */
function markShown(resource: string): void {
  try {
    safeStorage.set(KEY_LAST(resource), String(Date.now()));
  } catch {
    /* ignore */
  }
  const today = kstDayKey();
  const state = readCount(resource);
  const next: CountState =
    state.day === today
      ? { day: today, count: state.count + 1 }
      : { day: today, count: 1 };
  writeCount(resource, next);
}

interface SuggestionDetail {
  resource: string;
  title: string;
  body: string;
}

export function AdSuggestionModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SuggestionDetail | null>(null);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const d = (ev as CustomEvent<SuggestionDetail>).detail;
      if (!d?.resource || !d?.title || !d?.body) return;
      if (!shouldShowAdSuggestion(d.resource)) return;
      markShown(d.resource);
      setDetail(d);
      setOpen(true);
    };
    window.addEventListener("cc:ad-suggest:open", onOpen);
    return () => window.removeEventListener("cc:ad-suggest:open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onWatchAd = () => {
    haptic("medium");
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent("cc:ad-channel:open"));
    } catch {
      /* SSR */
    }
  };

  const onClose = () => {
    haptic("light");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && detail && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            data-testid="ad-suggest-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1080,
              background: "rgba(0,0,0,0.5)",
            }}
          />
          <motion.div
            data-testid="ad-suggest-modal"
            role="alertdialog"
            aria-modal="true"
            aria-label={detail.title}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              marginLeft: "auto",
              marginRight: "auto",
              top: "30%",
              zIndex: 1081,
              width: "100%",
              maxWidth: 360,
              background: "#FFF8EE",
              borderRadius: 20,
              padding: 22,
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              boxSizing: "border-box",
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              {detail.title}
            </h3>
            <p
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: 13,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              {detail.body}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                data-testid="ad-suggest-close"
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  color: "#444",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={onWatchAd}
                data-testid="ad-suggest-watch"
                style={{
                  flex: 1.4,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--accent-carrot, #FF7B61)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                광고 보기
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Convenience helper — dispatches the open event with default copy.
 * Returns true iff the modal will actually open (cooldown + daily cap
 * gate passed); call sites can decide whether to also toast a fallback.
 */
export function suggestAdFor(
  resource: string,
  title: string,
  body: string,
): boolean {
  if (!shouldShowAdSuggestion(resource)) return false;
  try {
    window.dispatchEvent(
      new CustomEvent("cc:ad-suggest:open", {
        detail: { resource, title, body },
      }),
    );
  } catch {
    return false;
  }
  return true;
}
