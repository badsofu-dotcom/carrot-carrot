/**
 * MushroomHouseRoom (Round 25, PR-152) — 9-step 프리렌더 인테리어 +
 * 보관함 strip + 토끼 온보딩 말풍선.
 *
 * 진입: RewardsPanel "🍄 버섯집 들어가기" 카드 또는 외부 트리거.
 *   window.dispatchEvent(new CustomEvent("cc:mushroom-house:open"));
 *
 * 화면 레이아웃 (z-index 1080+):
 *   - 풀스크린 fixed 오버레이 (z 1080, scrim 0.65)
 *   - 9:16 비율 카드 (max 480 × 854, viewport 작으면 cover) → bg image
 *   - 상단 우측 ✕ 닫기
 *   - 하단 보관함 strip (가구 8개 가로 스크롤)
 *   - 좌하단 토끼 말풍선 (조건부)
 *
 * 다음 step bg 는 useEffect 에서 new Image().src 로 preload.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFarmhubStore } from "./farmhubStore";
import {
  FARMHUB_BG,
  FARMHUB_FURNITURE,
  FARMHUB_BY_ID,
  FARMHUB_FINAL_STEP,
} from "./farmhubCatalog";
import { haptic } from "../../design-system/haptic";

export const MUSHROOM_HOUSE_OPEN_EVENT = "cc:mushroom-house:open";

const BUNNY_SPEECH_BY_PENDING_STEP: Record<number, string> = {
  // pending 가구의 step 키 (1..8). step 0 + pending=carpet → key 1.
  1: "🐰 카펫이 도착했어! 보관함에서 카펫을 터치해줘",
  2: "🐰 이번엔 푹신한 침대야! 어디 놓을까?",
  3: "🐰 친구랑 차 마실 테이블이 왔어!",
  4: "🐰 책장에 책 가득 꽂아두자",
  5: "🐰 초록 화분으로 방을 살리자",
  6: "🐰 옷 정리할 서랍장이야",
  7: "🐰 장난감 상자도 도착!",
  8: "🐰 마지막! 의자만 놓으면 완성이야 🎉",
};

const PLACE_CONFIRM_SPEECHES: ReadonlyArray<string> = [
  "🐰 멋진 자리에 깔았어!",
  "🥕 완벽해!",
  "🐰 우와 자연스럽다",
  "🥕 이 자리에 딱이야",
  "🐰 점점 우리 집 같아져",
];

const COMPLETE_SPEECH = "🐰 우와 우리 집 완성됐어! 정말 아늑해 🥕";

function preloadImage(src: string): void {
  if (typeof window === "undefined") return;
  try {
    const img = new Image();
    img.src = src;
  } catch {
    /* ignore */
  }
}

export function MushroomHouseRoom() {
  const [open, setOpen] = useState(false);
  const step = useFarmhubStore((s) => s.step);
  const pending = useFarmhubStore((s) => s.pendingFurnitureId);
  const onboardingShown = useFarmhubStore((s) => s.onboardingShown);
  const place = useFarmhubStore((s) => s.place);
  const markOnboardingShown = useFarmhubStore((s) => s.markOnboardingShown);

  // 1회용 축하 말풍선 (배치 직후 ~2s)
  const [confirmText, setConfirmText] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(MUSHROOM_HOUSE_OPEN_EVENT, onOpen);
    return () =>
      window.removeEventListener(MUSHROOM_HOUSE_OPEN_EVENT, onOpen);
  }, []);

  // 다음 step bg preload (step + 1 <= FINAL).
  useEffect(() => {
    if (!open) return;
    if (step < FARMHUB_FINAL_STEP) {
      preloadImage(FARMHUB_BG(step + 1));
    }
  }, [open, step]);

  // 토끼 온보딩 발화 — pending 의 step 기준 1회 mark.
  const pendingDef = pending ? FARMHUB_BY_ID[pending] : null;
  const pendingStep = pendingDef?.step ?? null;
  const showOnboarding =
    pendingStep !== null &&
    !onboardingShown.includes(pendingStep) &&
    confirmText === null;

  useEffect(() => {
    if (!open || pendingStep === null) return;
    if (onboardingShown.includes(pendingStep)) return;
    // 사용자가 모달 열고 첫 frame 후 1회만 mark — 동일 step pending
    // 동안 재진입 시 안 보이게.
    const t = window.setTimeout(() => markOnboardingShown(pendingStep), 250);
    return () => window.clearTimeout(t);
  }, [open, pendingStep, onboardingShown, markOnboardingShown]);

  // step 8 완성 1회 발화 — onboardingShown 에 sentinel -1 사용.
  const completed = step >= FARMHUB_FINAL_STEP;
  const completeShown = onboardingShown.includes(-1);
  useEffect(() => {
    if (!open || !completed || completeShown) return;
    const t = window.setTimeout(() => markOnboardingShown(-1), 400);
    return () => window.clearTimeout(t);
  }, [open, completed, completeShown, markOnboardingShown]);

  const handlePlaceTap = (id: string) => {
    if (pending !== id) return;
    haptic("medium");
    const r = place();
    if (r.ok) {
      const speech =
        PLACE_CONFIRM_SPEECHES[
          Math.floor(Math.random() * PLACE_CONFIRM_SPEECHES.length)
        ];
      setConfirmText(speech);
      window.setTimeout(() => setConfirmText(null), 1800);
    }
  };

  const closeRoom = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="mushroom-house-room"
          role="dialog"
          aria-modal="true"
          aria-label="버섯집 인테리어"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1080,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "min(100vw, 480px)",
              height: "min(100vh, calc(min(100vw, 480px) * 16 / 9))",
              maxHeight: "100vh",
              overflow: "hidden",
              background: "#1a1410",
            }}
          >
            {/* Background — step 별 crossfade */}
            <AnimatePresence mode="sync">
              <motion.img
                key={step}
                src={FARMHUB_BG(step)}
                alt=""
                draggable={false}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </AnimatePresence>

            {/* Close button */}
            <button
              type="button"
              data-testid="mushroom-house-close"
              aria-label="닫기"
              onClick={closeRoom}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                padding: 0,
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
                border: "none",
                fontSize: 18,
                fontWeight: 800,
                color: "#2b2b2b",
                cursor: "pointer",
                zIndex: 5,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              ✕
            </button>

            {/* Step indicator (top-left) */}
            <div
              aria-label={`현재 진행 ${step}/${FARMHUB_FINAL_STEP}`}
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
                color: "#2b2b2b",
                fontSize: 12,
                fontWeight: 800,
                zIndex: 5,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              🪑 {step} / {FARMHUB_FINAL_STEP}
            </div>

            {/* 토끼 말풍선 — pending 시 onboarding 또는 완성 시 1회 */}
            <AnimatePresence>
              {(showOnboarding || (completed && !completeShown) || confirmText) && (
                <motion.div
                  data-testid="mushroom-house-bunny-speech"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    position: "absolute",
                    left: 16,
                    bottom: 130,
                    maxWidth: "calc(100% - 32px)",
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.92)",
                    color: "#2b2b2b",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
                    zIndex: 6,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  {confirmText ??
                    (completed
                      ? COMPLETE_SPEECH
                      : pendingStep !== null
                        ? BUNNY_SPEECH_BY_PENDING_STEP[pendingStep] ?? ""
                        : "")}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 보관함 strip (하단) */}
            <div
              data-testid="mushroom-house-storage"
              role="list"
              aria-label="보관함"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "10px 12px 14px",
                paddingBottom:
                  "calc(14px + env(safe-area-inset-bottom, 0px))",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))",
                display: "flex",
                gap: 8,
                overflowX: "auto",
                scrollbarWidth: "none",
                zIndex: 4,
              }}
            >
              {FARMHUB_FURNITURE.map((f) => {
                const isPlaced = step >= f.step;
                const isActive = pending === f.id;
                const isLocked = !isPlaced && !isActive;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="listitem"
                    data-testid={`mushroom-house-item-${f.id}`}
                    aria-label={
                      isPlaced
                        ? `${f.name} 배치 완료`
                        : isActive
                          ? `${f.name} 보관함 — 탭하면 배치`
                          : `${f.name} 잠금 — step ${f.step}`
                    }
                    onClick={() => isActive && handlePlaceTap(f.id)}
                    disabled={!isActive}
                    style={{
                      flexShrink: 0,
                      width: 64,
                      height: 64,
                      padding: 4,
                      borderRadius: 14,
                      border: isActive
                        ? "2px solid #FF7B61"
                        : "1px solid rgba(255,255,255,0.4)",
                      background: isActive
                        ? "rgba(255,255,255,0.95)"
                        : "rgba(255,255,255,0.55)",
                      cursor: isActive ? "pointer" : "default",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isPlaced ? 0.4 : isLocked ? 0.5 : 1,
                      filter: isLocked ? "grayscale(1)" : undefined,
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                      animation: isActive
                        ? "mushroom-pulse 1.4s ease-in-out infinite"
                        : undefined,
                    }}
                  >
                    <img
                      src={f.sprite}
                      alt=""
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                    {isLocked && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 4,
                          fontSize: 12,
                        }}
                      >
                        🔒
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
