/**
 * InAppBanner (PR-61) — `cc:notify:in-app` 이벤트의 fallback UI.
 *
 * Web Notification API 권한 거부 / 미지원 환경에서 `webNotify.notify()`
 * 가 native 대신 dispatch 하는 in-app event 를 받아 화면 상단 banner
 * 로 표시. 4 초 후 auto-dismiss. tap → 즉시 닫힘.
 *
 * App root (또는 가장 외곽 layout) 에 mount. 동시 여러 알림 발생 시
 * 마지막 것만 표시 (queue X — 노이즈 최소화).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NotifyDetail } from "../../lib/webNotify";

const AUTO_DISMISS_MS = 4_000;

export function InAppBanner() {
  const [detail, setDetail] = useState<NotifyDetail | null>(null);

  useEffect(() => {
    const onEvent = (ev: Event) => {
      const d = (ev as CustomEvent<NotifyDetail>).detail;
      if (!d?.title || !d?.body) return;
      setDetail(d);
    };
    window.addEventListener("cc:notify:in-app", onEvent);
    return () => window.removeEventListener("cc:notify:in-app", onEvent);
  }, []);

  useEffect(() => {
    if (!detail) return;
    const t = window.setTimeout(() => setDetail(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [detail]);

  return (
    <AnimatePresence>
      {detail && (
        <motion.div
          role="alert"
          aria-live="polite"
          data-testid="in-app-banner"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 0px) + 12px)",
            left: 16,
            right: 16,
            zIndex: 1200,
            background: "rgba(255, 248, 238, 0.96)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 123, 97, 0.35)",
            borderRadius: 14,
            padding: "10px 14px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "rgba(43, 24, 16, 0.92)",
              }}
            >
              {detail.title}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "rgba(43, 24, 16, 0.62)",
                lineHeight: 1.35,
              }}
            >
              {detail.body}
            </p>
          </div>
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: "rgba(43, 24, 16, 0.4)",
              flexShrink: 0,
            }}
          >
            탭하여 닫기
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
