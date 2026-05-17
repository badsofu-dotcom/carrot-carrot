/**
 * SpriteView (Round 23, PR-147) — Sprite union 렌더러.
 *
 * 베타에서 모든 sprite 는 `{kind: "emoji"}`. R24+ 자산 도착 시 catalog
 * entry 가 `{kind: "image"}` 로 전환되어도 호출처는 변경 없음.
 *
 * Props 의 size 는 px (emoji fontSize / image width&height).
 */

import type { Sprite } from "./types";

interface SpriteViewProps {
  sprite: Sprite;
  size: number;
  alt?: string;
}

export function SpriteView({ sprite, size, alt }: SpriteViewProps) {
  if (sprite.kind === "image") {
    return (
      <img
        src={sprite.src}
        alt={alt ?? ""}
        width={size}
        height={size}
        draggable={false}
        style={{
          display: "block",
          width: size,
          height: size,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        fontSize: size * 0.85,
        lineHeight: 1,
      }}
    >
      {sprite.value}
    </span>
  );
}
