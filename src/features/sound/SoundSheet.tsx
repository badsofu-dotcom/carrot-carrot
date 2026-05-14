/**
 * Phase 8.0-b — 백색소음 카탈로그 BottomSheet.
 *
 * 구조:
 *   상단: title `백색소음`, volume slider.
 *   섹션 1: free (무음 + 4종).
 *   섹션 2: premium (8종) + `광고 보기` CTA. 잠금 시 자물쇠 + opacity 0.5.
 *
 * 선택 시 currentSoundId 즉시 갱신. 닫을 때 재생 상태 유지.
 * 잠금 premium 탭 시 AdPassModal 호출.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { BottomSheet, Button } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { FREE_SOUNDS, PREMIUM_SOUNDS, type SoundDef } from "../../data/sounds";
import {
  useSoundStore,
  isSoundAvailable,
  isPassActive,
} from "../../store/soundStore";
import { AdPassModal } from "./AdPassModal";

interface SoundSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SoundSheet({ open, onClose }: SoundSheetProps) {
  const currentSoundId = useSoundStore((s) => s.currentSoundId);
  const volume = useSoundStore((s) => s.volume);
  const setSound = useSoundStore((s) => s.setSound);
  const setVolume = useSoundStore((s) => s.setVolume);
  const passExpiresAt = useSoundStore((s) => s.soundPassExpiresAt);
  const permanentUnlocks = useSoundStore((s) => s.permanentUnlocks);
  const activateSoundPass = useSoundStore((s) => s.activateSoundPass);

  const [adOpen, setAdOpen] = useState(false);

  const passActive = isPassActive(passExpiresAt);

  const handleSelect = (def: SoundDef) => {
    const available = isSoundAvailable(def.id, {
      soundPassExpiresAt: passExpiresAt,
      permanentUnlocks,
    });
    if (!available) {
      haptic("medium");
      setAdOpen(true);
      return;
    }
    haptic("light");
    setSound(def.id);
  };

  const handleWatchAdCta = () => {
    haptic("medium");
    setAdOpen(true);
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="사운드">
        <div data-testid="sound-sheet" style={{ paddingBottom: 8 }}>
          {/* Volume slider */}
          <div style={{ padding: "4px 4px 18px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                className="t-micro"
                style={{ color: "var(--text-tertiary)" }}
              >
                볼륨
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                }}
              >
                {volume}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              data-testid="sound-volume"
              aria-label="볼륨"
              style={{
                width: "100%",
                accentColor: "var(--accent-carrot)",
              }}
            />
          </div>

          {/* Free section */}
          <SoundSection title="기본">
            {FREE_SOUNDS.map((s) => (
              <SoundRow
                key={s.id}
                sound={s}
                active={currentSoundId === s.id}
                locked={false}
                onClick={() => handleSelect(s)}
              />
            ))}
          </SoundSection>

          {/* Premium section */}
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
                padding: "0 4px",
              }}
            >
              <p
                className="t-micro"
                style={{ margin: 0, color: "var(--text-tertiary)" }}
              >
                프리미엄
              </p>
              {!passActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleWatchAdCta}
                  data-testid="sound-watch-ad"
                  style={{ color: "var(--accent-carrot)", fontWeight: 700 }}
                >
                  광고 보기
                </Button>
              )}
              {passActive && (
                <span
                  className="t-caption"
                  style={{
                    color: "var(--accent-carrot)",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  ✨ 패스 활성
                </span>
              )}
            </div>
            <SoundSection>
              {PREMIUM_SOUNDS.map((s) => {
                const available = isSoundAvailable(s.id, {
                  soundPassExpiresAt: passExpiresAt,
                  permanentUnlocks,
                });
                // 잠금 상태에서는 active 표시를 숨겨 stale currentSoundId 가
                // 잠긴 premium tile 을 outline 으로 보여주지 않게 한다.
                const isActive = available && currentSoundId === s.id;
                return (
                  <SoundRow
                    key={s.id}
                    sound={s}
                    active={isActive}
                    locked={!available}
                    onClick={() => handleSelect(s)}
                  />
                );
              })}
            </SoundSection>
          </div>
        </div>
      </BottomSheet>

      <AdPassModal
        open={adOpen}
        onClose={() => setAdOpen(false)}
        onGranted={activateSoundPass}
      />
    </>
  );
}

function SoundSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title && (
        <p
          className="t-micro"
          style={{
            margin: "0 0 10px",
            padding: "0 4px",
            color: "var(--text-tertiary)",
          }}
        >
          {title}
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SoundRow({
  sound,
  active,
  locked,
  onClick,
}: {
  sound: SoundDef;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      data-testid={`sound-row-${sound.id}`}
      aria-pressed={active}
      aria-disabled={locked || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 14,
        border: active
          ? "1.5px solid var(--accent-carrot)"
          : "1px solid var(--border-subtle)",
        background: active
          ? "color-mix(in oklab, var(--accent-carrot) 8%, var(--bg-elevated))"
          : "var(--bg-elevated)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "var(--accent-carrot)" : "var(--text-primary)",
        opacity: locked ? 0.5 : 1,
        transition:
          "background-color 0.18s var(--ease-smooth), border-color 0.18s var(--ease-smooth)",
        textAlign: "left",
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>
        {locked ? "🔒" : iconFor(sound.id)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{sound.name}</span>
    </motion.button>
  );
}

function iconFor(id: string): string {
  switch (id) {
    case "none":
      return "⏸";
    case "rain":
      return "🌧";
    case "forest":
      return "🌲";
    case "cafe":
      return "☕";
    case "white-noise":
      return "📻";
    case "fireplace":
      return "🔥";
    case "ocean":
      return "🌊";
    case "thunder":
      return "⚡";
    case "stream":
      return "💧";
    case "wind":
      return "🍃";
    case "clock":
      return "⏰";
    case "keyboard":
      return "⌨️";
    case "bunny-purr":
      return "🐰";
    default:
      return "🎵";
  }
}

