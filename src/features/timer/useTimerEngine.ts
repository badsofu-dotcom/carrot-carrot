/**
 * Timer engine hook — 매 250ms 마다 store.tick() 호출 + visibilitychange 시 즉시 재동기화.
 *
 * 250ms 주기는 부드러운 진행률(60fps 까지는 아니어도 사람이 인지하기 자연스러움)을 주면서
 * 백그라운드에서도 throttling 영향이 적도록 설정한 값. 최종 정확도는 store.tick 의
 * Date.now() 재계산이 보장한다.
 */

import { useEffect } from "react";
import { useTimerStore } from "../../store/timerStore";

const TICK_MS = 250;

export function useTimerEngine() {
  const status = useTimerStore((s) => s.status);
  const tick = useTimerStore((s) => s.tick);

  useEffect(() => {
    if (status !== "FOCUSING") return;
    const id = window.setInterval(() => tick(), TICK_MS);
    return () => window.clearInterval(id);
  }, [status, tick]);

  // visibilitychange — 탭 복귀 즉시 재계산 (백그라운드 throttling 보정).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        tick(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [tick]);
}
