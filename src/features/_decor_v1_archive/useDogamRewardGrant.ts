/**
 * useDogamRewardGrant (Round 24, PR-150) — 도감 100% 자동 보상.
 *
 * 도감 12/12 (DOGAM_TOTAL) 완성 순간 1회 `golden_carrot_statue` 가구를
 * 무료로 지급. localStorage flag 로 중복 방지 — 사용자가 가구를 제거해도
 * (placement) 보유(owned)는 유지되고, 도감을 reset 해도 보상은 재지급
 * 안 됨 (악용 방지).
 *
 * 사용처: CollectionPage FarmView 의 useEffect 에서 mount.
 */

import { useEffect, useRef } from "react";
import { useCollectionStore } from "../collection/collectionStore";
import { DOGAM_TOTAL } from "../collection/collectionData";
import { useDecorStore } from "./decorStore";
import { safeStorage } from "../../lib/safeStorage";
import { toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";

const STORAGE_KEY = "cc.decor.dogam100_granted.v1";
const REWARD_ID = "golden_carrot_statue";

function alreadyGranted(): boolean {
  return safeStorage.get(STORAGE_KEY) === "1";
}

function markGranted(): void {
  try {
    safeStorage.set(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function useDogamRewardGrant(): void {
  const ownedCount = useCollectionStore((s) => s.ownedCharacters.length);
  // ref 로 동일 frame 내 중복 dispatch 방지.
  const inFlight = useRef(false);

  useEffect(() => {
    if (inFlight.current) return;
    if (ownedCount < DOGAM_TOTAL) return;
    if (alreadyGranted()) return;
    inFlight.current = true;
    const ok = useDecorStore.getState().grantReward(REWARD_ID);
    if (ok) {
      markGranted();
      // UX: haptic + toast. 가구 자동 owned 만, 배치는 사용자가 수동
      // (야외 슬롯 활성 후 R24+).
      haptic("success");
      toast("🥕 도감 마스터! 황금 당근 동상 획득! (보관함에서 배치 가능)");
    }
    // 한 번 시도 후 ref reset — 다른 effect 분기에선 alreadyGranted()
    // 가 true 이므로 재진입 자동 차단.
    inFlight.current = false;
  }, [ownedCount]);
}
