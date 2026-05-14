/**
 * Phase 8.1 — 백색소음 카탈로그.
 *
 * 모든 트랙은 Freesound CC0 현장 녹음 (licensed field recordings).
 * 60초 MP3 96kbps 44.1kHz mono, loudnorm 처리. 출처는
 * public/sounds/SOURCES.md 참조.
 *
 * free 5종 + premium 8종. file 은 base-relative path.
 * `none` 은 무음 — file: null, 항상 free 로 노출.
 */

export type SoundTier = "free" | "premium";

export interface SoundDef {
  id: string;
  name: string;
  tier: SoundTier;
  /** base-relative path. null 이면 무음. */
  file: string | null;
}

export const SOUNDS: readonly SoundDef[] = [
  // ---- free ----
  { id: "none", name: "무음", tier: "free", file: null },
  { id: "rain", name: "빗소리", tier: "free", file: "/sounds/rain.mp3" },
  { id: "forest", name: "숲속", tier: "free", file: "/sounds/forest.mp3" },
  { id: "cafe", name: "카페", tier: "free", file: "/sounds/cafe.mp3" },
  {
    id: "air-purifier",
    name: "공기청정기",
    tier: "free",
    file: "/sounds/air-purifier.mp3",
  },
  {
    id: "white-noise",
    name: "화이트노이즈",
    tier: "free",
    file: "/sounds/white.mp3",
  },

  // ---- premium ----
  { id: "fireplace", name: "모닥불", tier: "premium", file: "/sounds/fire.mp3" },
  { id: "ocean", name: "파도", tier: "premium", file: "/sounds/ocean.mp3" },
  {
    id: "thunder",
    name: "천둥",
    tier: "premium",
    file: "/sounds/thunder.mp3",
  },
  {
    id: "stream",
    name: "시냇물",
    tier: "premium",
    file: "/sounds/stream.mp3",
  },
  { id: "wind", name: "바람", tier: "premium", file: "/sounds/wind.mp3" },
  {
    id: "clock",
    name: "시계 초침",
    tier: "premium",
    file: "/sounds/clock.mp3",
  },
  {
    id: "keyboard",
    name: "타자기",
    tier: "premium",
    file: "/sounds/keyboard.mp3",
  },
  {
    id: "bunny-purr",
    name: "토끼 숨소리",
    tier: "premium",
    file: "/sounds/bunny.mp3",
  },
] as const;

export const SOUNDS_BY_ID: Record<string, SoundDef> = SOUNDS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, SoundDef>,
);

export const FREE_SOUNDS = SOUNDS.filter((s) => s.tier === "free");
export const PREMIUM_SOUNDS = SOUNDS.filter((s) => s.tier === "premium");

export function findSound(id: string): SoundDef | undefined {
  return SOUNDS_BY_ID[id];
}

/** Vite base 를 적용한 실제 fetch URL 로 변환. file 이 null 이면 null. */
export function soundUrl(file: string | null): string | null {
  if (!file) return null;
  const base = (import.meta as ImportMeta & { env: { BASE_URL?: string } }).env
    .BASE_URL ?? "/";
  // 파일 경로는 항상 `/` 로 시작하도록 정의되어 있다 → base 와 합치고 중복 슬래시 정리.
  const trimmed = file.replace(/^\//, "");
  if (base.endsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}
