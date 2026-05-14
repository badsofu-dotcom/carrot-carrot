/**
 * Phase 7.9 polish — 홈 타이머 CTA 아래에 깔리는 토끼 말풍선.
 *
 * - Home body 의 focus-only 원칙은 유지: 이 컴포넌트는 timer 상태에 대한 emotional
 *   feedback 일 뿐, 다른 페이지로의 navigation CTA 가 아니다.
 * - 메시지는 status × progress 버킷별 큐레이션된 한 줄 (악동·음흉·내꺼야 톤).
 * - 1분마다 같은 버킷 내에서 다른 한 줄로 천천히 회전.
 * - 진입은 framer-motion 으로 가벼운 fade/scale.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bunny } from "../../components/Bunny";
import type { BunnyKey } from "../../assets/characters";

type Status = "IDLE" | "FOCUSING" | "PAUSED" | "COMPLETED" | "ABANDONED";

interface Props {
  status: Status;
  /** 0..1 */
  progress: number;
  /** ms */
  remainingMs: number;
  selectedMinutes: number;
}

type Bucket =
  | "idle-fresh"
  | "idle-streak"
  | "focus-start"
  | "focus-mid"
  | "focus-deep"
  | "focus-final"
  | "focus-last-min"
  | "paused"
  | "completed"
  | "abandoned";

/** 버킷별 큐레이션된 한 줄 모음 — 악동·음흉·내꺼야 톤. */
const LINES: Record<Bucket, string[]> = {
  "idle-fresh": [
    "오늘 당근 누가 먹을까, 흐흐",
    "한 판 시작해보자, 킥킥",
    "타이머 누르면 내가 다 먹어줄게",
  ],
  "idle-streak": [
    "어제처럼만 가자",
    "한 번 더 가볼까, 흐흐",
    "내 손맛 또 보고 싶지?",
  ],
  "focus-start": [
    "흐흐 시작이네, 야금야금",
    "도망가지 마라잉",
    "한 입씩 먹는 중이야",
  ],
  "focus-mid": [
    "지금이 제일 맛있어",
    "킥킥, 잘 버티네",
    "당근 반쯤 내꺼야",
  ],
  "focus-deep": [
    "거의 다 먹었어, 흐흐",
    "끝까지 가자, 도둑님",
    "한 판 더 먹고 싶다",
  ],
  "focus-final": [
    "마지막 한 입 남았어",
    "조금만 더, 흐흐",
    "끝이 보인다 킥킥",
  ],
  "focus-last-min": [
    "1분 남았어. 멈추면 운다?",
    "끝까지 — 내꺼야",
    "지금 도망가면 진짜 울어",
  ],
  paused: [
    "어, 어디 가? 다시 와줘",
    "흐흥... 기다릴게, 빨리 와",
    "당근 식어. 빨리.",
  ],
  completed: [
    "다 먹었다, 흐흐 잘했어",
    "한 판 더? 킥킥",
    "오늘 당근 내가 다 가져간다",
  ],
  abandoned: [
    "흐ㅣㅣ... 또 도망갔어",
    "다음 판은 잡을 거야",
    "내 눈물 닦아줘 흑",
  ],
};

function pickBucket(status: Status, progress: number, remainingMs: number): Bucket {
  if (status === "COMPLETED") return "completed";
  if (status === "ABANDONED") return "abandoned";
  if (status === "PAUSED") return "paused";
  if (status === "FOCUSING") {
    if (remainingMs > 0 && remainingMs <= 60_000) return "focus-last-min";
    if (progress >= 0.85) return "focus-final";
    if (progress >= 0.55) return "focus-deep";
    if (progress >= 0.2) return "focus-mid";
    return "focus-start";
  }
  // IDLE
  // streak 정보를 모르니 fresh 로 통일.
  return "idle-fresh";
}

function pickAvatar(status: Status, progress: number, remainingMs: number): BunnyKey {
  if (status === "ABANDONED") return "cry";
  if (status === "COMPLETED") return "success";
  if (status === "PAUSED") return "idle";
  if (status === "FOCUSING") {
    if (remainingMs > 0 && remainingMs <= 60_000) return "eat75";
    if (progress >= 0.75) return "eat75";
    if (progress >= 0.5) return "eat50";
    if (progress >= 0.25) return "eat25";
    return "focus";
  }
  return "idle";
}

export function BunnyChatter({
  status,
  progress,
  remainingMs,
  selectedMinutes,
}: Props) {
  const bucket = pickBucket(status, progress, remainingMs);
  const avatar = pickAvatar(status, progress, remainingMs);

  // 같은 버킷 안에서 1분마다 다른 라인으로 회전.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const lines = LINES[bucket];
  // bucket 이 바뀌거나 tick 이 진행하면 다른 한 줄.
  const message = useMemo(() => {
    if (lines.length === 0) return "";
    const idx = Math.abs(hash(bucket) + tick) % lines.length;
    return lines[idx];
  }, [bucket, tick, lines]);

  // selectedMinutes 는 idle 첫 노출 시 살짝 다른 hint 로 활용 가능 — 현재는 사용 안 함.
  void selectedMinutes;

  return (
    <section
      aria-label="오늘의 토끼 한 마디"
      data-testid="bunny-chatter"
      style={{
        marginTop: 18,
        display: "flex",
        gap: 10,
        // 아바타가 말풍선 본체와 수직 중앙 정렬되도록 — 카톡식 chat row.
        alignItems: "center",
        padding: "0 4px",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
          background: "var(--bg-elevated)",
        }}
      >
        <Bunny
          variant={avatar}
          size={44}
          frame="circle"
          breathe={false}
          alt="토끼"
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="chat-bubble" data-testid="bunny-chatter-bubble">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${bucket}-${tick}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="t-body"
              style={{
                margin: 0,
                color: "var(--text-primary)",
                fontWeight: 500,
                lineHeight: 1.5,
                wordBreak: "keep-all",
              }}
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/** Bucket 이름 → 작은 정수 hash. 같은 bucket 이라도 다른 인덱스로 시작하기 위한 시드. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
