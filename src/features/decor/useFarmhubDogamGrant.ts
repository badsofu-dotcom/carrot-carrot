/**
 * useFarmhubDogamGrant (Round 26, PR-155) — 도감 owned 변화 감지 →
 * 버섯집 다음 가구 자동 grantNext().
 *
 * 마운트 위치: App level (CollectionPage 또는 main.tsx). React tree 의
 * root 에 1회만. tab 이동 / mount 재진입 시 재발화 — 자동.
 *
 * 조건 (getNextGrantStep helper):
 *   - dogamCount > currentStep
 *   - currentStep < 8
 *   - pendingFurnitureId === null
 *
 * 결과: 한 번에 1 step 만 grant. 사용자가 배치 → place() → hook 의
 * useEffect 가 step 변경 감지 → 다시 평가 → 다음 step grant. 점진적.
 *
 * UX: 토스트 "🐰 다음 가구가 보관함에 도착했어요!" + haptic("success").
 * 사용자가 농장 외 화면 (홈 / 리포트) 에 있어도 toast 가 floating 으로
 * 뜨므로 인지 가능. MushroomHouseRoom 열어서 배치.
 */

import { useEffect, useRef } from "react";
import { useCollectionStore } from "../collection/collectionStore";
import { useFarmhubStore } from "./farmhubStore";
import { getNextGrantStep } from "./farmhubGrantTriggers";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

export function useFarmhubDogamGrant(): void {
  const dogamCount = useCollectionStore((s) => s.ownedCharacters.length);
  const step = useFarmhubStore((s) => s.step);
  const pending = useFarmhubStore((s) => s.pendingFurnitureId);

  // 동일 frame 내 중복 dispatch 방지 — getNextGrantStep 가 step/pending
  // 변화로 stale 일 때 한 useEffect 사이클 안에서 grantNext 가 store 를
  // 갱신하지만 subscription 이 다음 frame 에 도착. ref 로 lock.
  const inFlight = useRef(false);

  useEffect(() => {
    if (inFlight.current) return;
    const nextStep = getNextGrantStep(dogamCount, step, pending !== null);
    if (nextStep === null) return;
    inFlight.current = true;
    const result = useFarmhubStore.getState().grantNext();
    if (result.ok) {
      toast("🐰 다음 가구가 보관함에 도착했어요!");
      haptic("success");
    }
    // 작은 delay 후 lock 풀어서 다음 step 평가 가능.
    const t = window.setTimeout(() => {
      inFlight.current = false;
    }, 200);
    return () => window.clearTimeout(t);
  }, [dogamCount, step, pending]);
}
