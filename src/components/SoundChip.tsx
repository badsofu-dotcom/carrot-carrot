/**
 * Phase 8.0-b — sound chip.
 *
 * 현재 선택된 사운드 이름을 표시한다 ('무음', '빗소리', ...). 탭하면 SoundSheet 가 열려
 * 카탈로그를 보여준다. 재생 중이면 작은 carrot dot 가 깜박여 활성 상태 hint.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { haptic } from "../design-system/haptic";
import { useSoundStore, isSoundAvailable } from "../store/soundStore";
import { findSound } from "../data/sounds";
import { SoundSheet } from "../features/sound/SoundSheet";

export function SoundChip() {
  const [open, setOpen] = useState(false);
  const currentSoundId = useSoundStore((s) => s.currentSoundId);
  const isPlaying = useSoundStore((s) => s.isPlaying);
  const passExpiresAt = useSoundStore((s) => s.soundPassExpiresAt);
  const permanentUnlocks = useSoundStore((s) => s.permanentUnlocks);
  const sound = findSound(currentSoundId);
  // 광고 게이트 정책 — premium 이면서 현재 사용 불가능하면 라벨도 숨겨
  // (실제 player 도 무음으로 동작) "백색소음" 으로 표시한다.
  const available = isSoundAvailable(currentSoundId, {
    soundPassExpiresAt: passExpiresAt,
    permanentUnlocks,
  });
  const label = available ? sound?.name ?? "무음" : "사운드";

  return (
    <>
      <motion.button
        type="button"
        aria-label="사운드 선택"
        data-testid="sound-chip"
        onClick={() => {
          haptic("light");
          setOpen(true);
        }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-secondary)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          cursor: "pointer",
        }}
      >
        <span aria-hidden>🎵</span>
        <span>{label}</span>
        {isPlaying && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent-carrot)",
              marginLeft: 4,
            }}
          />
        )}
      </motion.button>

      <SoundSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
