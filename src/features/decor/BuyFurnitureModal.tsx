/**
 * BuyFurnitureModal (R27 PHASE 2.C) — 보관함 strip 의 자물쇠 슬롯
 * 탭 시 열리는 가구 구매 모달.
 *
 * MushroomHouseRoom 풀스크린 (z 1100) 안에서 absolute overlay 로
 * 렌더 (Portal X). 자체 backdrop scrim + 카드 + CTA 버튼.
 *
 * CTA 분기:
 *   - 도감 자격 X (dogamCount < targetStep) → "도감 N마리 더 모으기" 비활성
 *   - 도감 OK + 당근 부족 → "🥕 부족 — 농장에서 수확하기" (모달 닫기 only)
 *   - 도감 OK + 당근 OK → "✨ 구매하기" (primary, 100당근 이상은 confirm)
 *
 * confirm skip: localStorage cc.farmhub.skip_confirm = "1".
 */
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FARMHUB_BY_STEP,
  FARMHUB_FINAL_STEP,
} from "./farmhubCatalog";
import { getFurniturePrice } from "./farmhubFurniturePrices";
import { useFarmhubStore } from "./farmhubStore";
import { useFarmStore } from "../collection/farmStore";
import { useCollectionStore } from "../collection/collectionStore";
import { haptic } from "../../design-system/haptic";
import { toast } from "../../design-system/ui";
import { safeStorage } from "../../lib/safeStorage";
import { logFarmhubBuy } from "../../lib/analytics";

const SKIP_CONFIRM_KEY = "cc.farmhub.skip_confirm";
const CONFIRM_THRESHOLD = 100;

export interface BuyFurnitureModalProps {
  /** open 시 보여줄 targetStep (1..8). null 이면 닫힘. */
  targetStep: number | null;
  onClose: () => void;
}

export function BuyFurnitureModal({
  targetStep,
  onClose,
}: BuyFurnitureModalProps) {
  const carrots = useFarmStore((s) => s.carrots);
  const dogamCount = useCollectionStore((s) => s.ownedCharacters.length);
  const currentStep = useFarmhubStore((s) => s.step);
  const buyNextStep = useFarmhubStore((s) => s.buyNextStep);

  const [confirming, setConfirming] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);

  const open = targetStep !== null;
  const def = targetStep !== null ? FARMHUB_BY_STEP[targetStep] : null;
  const price = useMemo(
    () => (targetStep !== null ? getFurniturePrice(targetStep) : null),
    [targetStep],
  );

  const dogamOk =
    targetStep !== null && dogamCount >= targetStep;
  const carrotOk = price !== null && carrots >= price;
  const isNextStep = targetStep === currentStep + 1;

  const close = () => {
    setConfirming(false);
    onClose();
  };

  const doBuy = () => {
    if (price === null || def === null) return;
    logFarmhubBuy("attempt", {
      step: def.step,
      price,
      balance: carrots,
      ok: false,
    });
    const r = buyNextStep();
    if (!r.ok) {
      haptic("warning");
      const reasonLabel: Record<string, string> = {
        max_step: "이미 모든 가구를 모았어요",
        already_pending: "보관함에 도착한 가구를 먼저 배치해요",
        step_locked: "도감을 더 모아야 해요",
        insufficient_carrot: "🥕 당근이 모자라요",
      };
      toast(reasonLabel[r.reason ?? ""] ?? "구매할 수 없어요");
      logFarmhubBuy("attempt", {
        step: def.step,
        price,
        balance: carrots,
        ok: false,
        reason: r.reason ?? "unknown",
      });
      return;
    }
    haptic("success");
    toast(`🥕 ${price} → ${def.name} 보관함 도착!`);
    logFarmhubBuy("success", {
      step: def.step,
      price,
      balance: carrots - price,
      ok: true,
    });
    if (skipConfirm) {
      try {
        safeStorage.set(SKIP_CONFIRM_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    close();
  };

  const handleBuyClick = () => {
    if (!def || price === null) return;
    const alreadySkip = safeStorage.get(SKIP_CONFIRM_KEY) === "1";
    if (price >= CONFIRM_THRESHOLD && !alreadySkip && !confirming) {
      setConfirming(true);
      return;
    }
    doBuy();
  };

  return (
    <AnimatePresence>
      {open && def && price !== null && (
        <>
          <motion.div
            key="buy-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 12, 8, 0.55)",
              zIndex: 7,
            }}
            aria-hidden
          />
          <motion.div
            key="buy-card"
            role="dialog"
            aria-modal="true"
            aria-label="가구 구매"
            data-testid="buy-furniture-modal"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            style={{
              position: "absolute",
              left: "50%",
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              transform: "translateX(-50%)",
              width: "min(360px, calc(100% - 24px))",
              padding: "18px 16px 16px",
              borderRadius: 18,
              background: "#fffaf2",
              boxShadow: "0 12px 32px rgba(0,0,0,0.32)",
              zIndex: 8,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={close}
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                width: 28,
                height: 28,
                padding: 0,
                border: "none",
                background: "transparent",
                fontSize: 18,
                fontWeight: 800,
                color: "#7a6a5a",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <div
              style={{
                width: 96,
                height: 96,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff",
                borderRadius: 14,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
              }}
            >
              <img
                src={def.sprite}
                alt=""
                draggable={false}
                style={{
                  width: "85%",
                  height: "85%",
                  objectFit: "contain",
                  filter: dogamOk ? undefined : "grayscale(1)",
                }}
              />
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#a08c75",
                  letterSpacing: "0.04em",
                }}
              >
                STEP {def.step} / {FARMHUB_FINAL_STEP}
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#2b1810",
                  marginTop: 2,
                }}
              >
                {def.name}
              </div>
            </div>

            {!dogamOk ? (
              <div
                role="status"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#a8826a",
                  textAlign: "center",
                  lineHeight: 1.4,
                  padding: "8px 4px",
                }}
              >
                🔒 도감 {dogamCount} / {def.step} 마리
                <br />
                {def.step - dogamCount} 마리 더 모아야 해요
              </div>
            ) : (
              <div style={{ textAlign: "center", lineHeight: 1.5 }}>
                <div style={{ fontSize: 14, color: "#2b1810" }}>
                  🥕 <strong>{price}</strong> 당근으로 구매할까요?
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: carrotOk ? "#5c4a3a" : "#c05a3a",
                    fontWeight: carrotOk ? 500 : 700,
                  }}
                >
                  보유 {carrots} 당근
                  {!carrotOk && ` (${price - carrots} 부족)`}
                </div>
              </div>
            )}

            {!isNextStep && dogamOk && (
              <div
                role="note"
                style={{
                  fontSize: 11,
                  color: "#a8826a",
                  textAlign: "center",
                }}
              >
                step {currentStep + 1} 부터 차례로 구매할 수 있어요
              </div>
            )}

            {confirming ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  width: "100%",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#2b1810",
                    textAlign: "center",
                  }}
                >
                  정말 {price} 당근을 사용할까요?
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "#7a6a5a",
                    justifyContent: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={skipConfirm}
                    onChange={(e) => setSkipConfirm(e.target.checked)}
                  />
                  다시 묻지 않기
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e0d4c0",
                      background: "#fff",
                      color: "#7a6a5a",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={doBuy}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "none",
                      background: "#FF7B61",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    ✨ 구매
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-testid="buy-furniture-cta"
                disabled={!dogamOk || !carrotOk || !isNextStep}
                onClick={
                  !dogamOk
                    ? undefined
                    : !carrotOk
                      ? close
                      : !isNextStep
                        ? undefined
                        : handleBuyClick
                }
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  marginTop: 4,
                  borderRadius: 12,
                  border: "none",
                  background: !dogamOk
                    ? "#e6dccc"
                    : !carrotOk
                      ? "#f5b39c"
                      : !isNextStep
                        ? "#e6dccc"
                        : "#FF7B61",
                  color: !dogamOk || !isNextStep ? "#9a8870" : "#fff",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor:
                    !dogamOk || !isNextStep ? "default" : "pointer",
                }}
              >
                {!dogamOk
                  ? `도감 ${def.step - dogamCount}마리 더 모으기`
                  : !carrotOk
                    ? "🥕 부족 — 농장에서 수확하기"
                    : !isNextStep
                      ? `먼저 STEP ${currentStep + 1} 부터`
                      : "✨ 구매하기"}
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
