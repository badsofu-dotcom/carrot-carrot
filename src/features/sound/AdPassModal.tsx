/**
 * 24시간 백색소음 패스 광고 흐름.
 *
 * 두 단계:
 *  1) prompt — `프리미엄 사운드 열기` 모달.
 *     copy: 광고 한 번 보면 24시간 동안 프리미엄 백색소음 무료.
 *     buttons: `광고 보고 열기` / `다음에`.
 *  2) ad — Apps in Toss 보상형 광고 어댑터(`tossRewardedAd.watch`) 호출.
 *     - 토스 환경 + 광고 그룹 ID 설정 + SDK 지원 시 실제 보상형 광고 노출.
 *     - 외부 브라우저 / mock env / SDK 미지원 시 simulation 으로 안전하게 통과.
 *     보상 또는 simulation 종료 시 onGranted → soundStore.activateSoundPass().
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "../../components/Bunny";
import { Button, toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { watchRewardedAd } from "../../lib/tossRewardedAd";
import { useTossBackButton } from "../../lib/tossBackButton";

interface AdPassModalProps {
  open: boolean;
  onClose: () => void;
  onGranted: () => void;
}

export function AdPassModal({ open, onClose, onGranted }: AdPassModalProps) {
  const [stage, setStage] = useState<"prompt" | "ad">("prompt");

  // 콜백 ref — 부모 rerender 로 새 함수 인스턴스가 들어와도 effect 가 재실행되지 않도록.
  const onCloseRef = useRef(onClose);
  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);

  // 모달 닫힐 때 상태 초기화.
  useEffect(() => {
    if (!open) {
      setStage("prompt");
    }
  }, [open]);

  // R35 — 토스/하드웨어 back 시 광고 단계가 아닐 때만 닫기.
  // 광고 재생 중에는 SDK 가 자체 close 흐름을 가짐.
  useTossBackButton(() => {
    if (stage === "ad") return;
    onClose();
  }, open);

  // 광고 단계 진입 시 실제 토스 보상형 광고(또는 simulation) 시도.
  useEffect(() => {
    if (stage !== "ad" || !open) return;

    let cancelled = false;
    void (async () => {
      const result = await watchRewardedAd();
      if (cancelled) return;

      if (result.kind === "granted" || result.kind === "simulated") {
        try {
          haptic("success");
        } catch {
          /* ignore */
        }
        onGrantedRef.current();
        toast("패스 받았어!");
        onCloseRef.current();
        return;
      }
      if (result.kind === "cancelled") {
        toast("광고가 취소됐어");
        onCloseRef.current();
        return;
      }
      // failed / unsupported — 사용자가 다시 시도할 수 있게 친절히 닫음.
      toast("지금은 광고를 보여줄 수 없어. 잠시 후 다시 시도해줘");
      onCloseRef.current();
    })();

    return () => {
      cancelled = true;
    };
  }, [stage, open]);

  const handleStartAd = () => {
    haptic("medium");
    setStage("ad");
  };

  const handleLater = () => {
    haptic("light");
    onClose();
  };

  // Mount via createPortal to document.body so the modal escapes any ancestor
  // stacking/transform/contain context (BottomSheet drag transform, .app-shell
  // isolation, etc.) and is positioned relative to the viewport.
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ad-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={stage === "prompt" ? handleLater : undefined}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 12, 8, 0.6)",
              zIndex: 400,
            }}
            aria-hidden
          />
          {/* Centering wrapper — `position: fixed; inset: 0; display: grid;
              place-items: center` is the most robust viewport-centering primitive
              and survives any framer-motion transform applied to the inner card. */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: "16px",
              zIndex: 401,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="ad-modal"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              data-testid="ad-pass-modal"
              style={{
                width: "min(360px, 100%)",
                maxWidth: "calc(100vw - 32px)",
                background: "var(--bg-elevated)",
                borderRadius: 24,
                padding: "26px 22px 22px",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--border-subtle)",
                pointerEvents: "auto",
              }}
            >
              {stage === "prompt" ? (
                <PromptContent
                  onStartAd={handleStartAd}
                  onLater={handleLater}
                />
              ) : (
                <AdContent />
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PromptContent({
  onStartAd,
  onLater,
}: {
  onStartAd: () => void;
  onLater: () => void;
}) {
  return (
    <div data-testid="ad-prompt">
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          textAlign: "center",
        }}
      >
        프리미엄 사운드 열기
      </h2>
      <p
        className="t-body"
        style={{
          margin: "12px 0 22px",
          textAlign: "center",
          color: "var(--text-secondary)",
          lineHeight: 1.55,
          wordBreak: "keep-all",
        }}
      >
        광고 한 번 보고 오면 프리미엄 사운드를
        <br />
        24시간 동안 무료로 들을 수 있어.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Button
          variant="ghost"
          size="md"
          onClick={onLater}
          style={{ flex: 1 }}
          data-testid="ad-btn-later"
        >
          다음에
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onStartAd}
          style={{ flex: 2 }}
          data-testid="ad-btn-watch"
        >
          광고 보고 열기
        </Button>
      </div>
    </div>
  );
}

function AdContent() {
  return (
    <div data-testid="ad-watching" style={{ textAlign: "center" }}>
      <div
        style={{
          width: 140,
          height: 140,
          margin: "8px auto 16px",
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--bg-sunken)",
          display: "grid",
          placeItems: "center",
          position: "relative",
        }}
      >
        <Bunny
          variant="eat50"
          size={140}
          frame="circle"
          breathe
          eager
          alt="광고 보는 토끼"
        />
      </div>
      <p
        className="t-caption"
        style={{
          margin: 0,
          color: "var(--text-tertiary)",
          fontSize: 12,
        }}
      >
        광고 파트너를 찾는 중...
      </p>
      <p
        className="t-caption"
        style={{
          margin: "10px 0 0",
          color: "var(--text-tertiary)",
          fontSize: 11,
        }}
      >
        잠깐만, 토끼가 당근 다 먹는 동안 기다려줘
      </p>
    </div>
  );
}
