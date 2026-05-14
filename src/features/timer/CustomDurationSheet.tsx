/**
 * Phase 7.9 — 커스텀 집중 시간 시트.
 *
 * - 1..120 분, 1분 스냅.
 * - 가로 슬라이더(range input) + 빠른 선택 버튼 + 미리보기 토끼.
 * - 확정 시 onConfirm(min) 호출 → 호출자(HomePage) 가 store 갱신.
 * - 새 라이브러리 추가 없이 framer-motion + native range hybrid.
 */

import { useEffect, useState } from "react";
import { BottomSheet, Button } from "../../design-system/ui";
import { Bunny } from "../../components/Bunny";
import type { BunnyKey } from "../../assets/characters";
import { haptic } from "../../design-system/haptic";
import { CUSTOM_MAX, CUSTOM_MIN } from "../../store/timerStore";

const QUICK = [1, 5, 10, 30, 45, 60, 90];

interface Props {
  open: boolean;
  initial: number;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
}

function previewBunny(min: number): BunnyKey {
  if (min <= 9) return "focus";
  if (min <= 30) return "idle";
  if (min <= 60) return "eat50";
  return "eat75";
}

export function CustomDurationSheet({ open, initial, onClose, onConfirm }: Props) {
  const [value, setValue] = useState<number>(clamp(initial));

  useEffect(() => {
    if (open) setValue(clamp(initial));
  }, [open, initial]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clamp(Number(e.target.value));
    if (v !== value) {
      setValue(v);
      haptic("light");
    }
  };

  const handleQuick = (v: number) => {
    haptic("medium");
    setValue(clamp(v));
  };

  const handleConfirm = () => {
    haptic("success");
    onConfirm(clamp(value));
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="커스텀 집중 시간">
      <div data-testid="custom-duration-sheet" style={{ paddingTop: 4 }}>
        {/* 미리보기 — 80px bunny + 큰 숫자 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "8px 4px 18px",
          }}
        >
          <div style={{ width: 80, height: 80, flexShrink: 0 }}>
            <Bunny
              variant={previewBunny(value)}
              size={80}
              frame="circle"
              breathe={false}
              alt={`프리뷰 토끼 ${previewBunny(value)}`}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              className="t-micro"
              style={{ margin: 0, marginBottom: 2 }}
            >
              한 판 집중 시간
            </p>
            <p
              className="tabular-nums"
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                lineHeight: 1,
                fontFeatureSettings: "'tnum' 1",
              }}
              data-testid="custom-preview-value"
            >
              🥕 {value}분
            </p>
            <p
              className="t-caption"
              style={{
                margin: 0,
                marginTop: 6,
                color: "var(--text-secondary)",
              }}
            >
              {previewLabel(value)}
            </p>
          </div>
        </div>

        {/* slider */}
        <div style={{ padding: "0 4px 4px" }}>
          <input
            type="range"
            min={CUSTOM_MIN}
            max={CUSTOM_MAX}
            step={1}
            value={value}
            onChange={handleSlider}
            data-testid="custom-duration-slider"
            aria-label="집중 시간 분"
            style={{
              width: "100%",
              accentColor: "var(--accent-carrot)",
              height: 28,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontWeight: 600,
              marginTop: -4,
              padding: "0 2px",
            }}
            aria-hidden
          >
            <span>1</span>
            <span>30</span>
            <span>60</span>
            <span>90</span>
            <span>120</span>
          </div>
        </div>

        {/* quick values */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 18,
            padding: "0 2px",
          }}
          role="group"
          aria-label="빠른 선택"
        >
          {QUICK.map((q) => {
            const active = q === value;
            return (
              <button
                key={q}
                type="button"
                onClick={() => handleQuick(q)}
                data-testid={`quick-${q}`}
                style={{
                  flex: "1 0 0",
                  minWidth: 56,
                  padding: "8px 10px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  background: active
                    ? "var(--accent-carrot)"
                    : "var(--bg-sunken)",
                  color: active
                    ? "var(--text-on-accent)"
                    : "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition:
                    "background-color 0.18s var(--ease-smooth), color 0.18s var(--ease-smooth)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {q}분
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            style={{ flex: 1 }}
            data-testid="custom-cancel"
          >
            취소
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            style={{ flex: 2 }}
            data-testid="custom-confirm"
          >
            {value}분으로 시작
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 25;
  return Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, Math.round(n)));
}

function previewLabel(min: number): string {
  if (min <= 10) return "짧게 털고 와, 킥킥";
  if (min <= 25) return "딴짓 금지. 당근은 내꺼야";
  if (min <= 50) return "제법 버티네? 흐흐";
  if (min <= 90) return "길게 잠수 타자, 킥킥";
  return "오래 묶어둘게. 내꺼야";
}
