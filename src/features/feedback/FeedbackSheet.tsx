/**
 * FeedbackSheet (PR-122) — 인앱 피드백 시트.
 *
 * 사용자 메시지 입력 + 전송. 환경 정보 (app version / mode / UA) 는
 * 자동 첨부 (sendFeedback 내부).
 *
 * 트리거: SettingsPage 의 "피드백 보내기" Row → cc:feedback:open.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUserStore } from "../../store/userStore";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import {
  safeAreaBackdropStyle,
  safeAreaModalStyle,
} from "../../lib/ui/safeAreaModal";
import { isFeedbackConfigured, sendFeedback } from "./feedbackChannel";

export const FEEDBACK_OPEN_EVENT = "cc:feedback:open";

export function FeedbackSheet() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const authMode = useUserStore((s) => s.mode);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(FEEDBACK_OPEN_EVENT, handler);
    return () => window.removeEventListener(FEEDBACK_OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onSubmit = async () => {
    if (busy) return;
    if (!message.trim()) {
      toast("내용을 입력해주세요");
      return;
    }
    setBusy(true);
    haptic("light");
    const r = await sendFeedback({ message, authMode });
    setBusy(false);
    if (r.ok) {
      toast("🥕 의견 보내주셔서 감사합니다!");
      setMessage("");
      setOpen(false);
    } else if (r.reason === "no_webhook") {
      // 개발 환경 / env 미설정 fallback — clipboard 복사.
      try {
        await navigator.clipboard.writeText(message);
        toast("의견을 클립보드에 복사했어요 — 직접 보내주세요");
      } catch {
        toast("전송 채널 설정 중이에요. 잠시 후 다시 시도해주세요");
      }
    } else if (r.reason === "network") {
      toast("네트워크 오류 — 잠시 후 다시 시도해주세요");
    } else {
      toast("전송 실패 — 잠시 후 다시 시도해주세요");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          style={{ ...safeAreaBackdropStyle, zIndex: 1100 }}
          data-testid="feedback-backdrop"
        >
          <motion.div
            data-testid="feedback-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="피드백 보내기"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...safeAreaModalStyle({ maxWidth: 380 }),
              background: "#FFF8EE",
              borderRadius: 20,
              boxShadow: "0 12px 36px rgba(0,0,0,0.32)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#2b2b2b" }}>
              💬 피드백 보내기
            </h3>
            <p style={{ margin: "6px 0 12px", fontSize: 12, color: "#6a6055" }}>
              버그 · 아이디어 · 불만 환영해요. 익명으로 전달돼요.
            </p>
            <textarea
              data-testid="feedback-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="이곳에 자유롭게 적어주세요"
              rows={5}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 100,
                boxSizing: "border-box",
                background: "#fff",
                color: "#2b2b2b",
              }}
            />
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "#6a6055" }}>
              자동 첨부: 앱 버전 · 사용 모드 · 브라우저 (개인정보 X)
              {!isFeedbackConfigured() && " · ⚠ 개발 모드 (클립보드 fallback)"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  color: "#2b2b2b",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy || !message.trim()}
                data-testid="feedback-submit"
                style={{
                  flex: 2,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background:
                    busy || !message.trim()
                      ? "rgba(0,0,0,0.08)"
                      : "var(--accent-carrot, #FF7B61)",
                  color:
                    busy || !message.trim() ? "#888" : "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor:
                    busy || !message.trim() ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "보내는 중..." : "보내기"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
