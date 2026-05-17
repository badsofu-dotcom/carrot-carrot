# Decor — Furniture Sprites

22 가구 (10 실내 + 8 야외 + 4 계절) 의 sprite. 베타10 현재 emoji
placeholder 사용 중 (`src/features/decor/catalog.ts` 의 `sprite` 필드).
정식 sprite 도착 후 catalog 의 sprite type 을 emoji → image 로 전환.

## 폴더 구조

```
furniture/
├── indoor/      (10)
├── outdoor/     (8)
└── seasonal/    (4)
```

## 사양

| 항목 | 값 |
| --- | --- |
| 비율 | **카메라 각도 일치** (75 ~ 80도 탑다운, room bg 와 동일) |
| 해상도 | sprite 격자 1셀 = **128 × 128 px** (logical). 2×2 가구는 256 × 256. |
| 포맷 | **PNG with alpha** (투명 배경 필수). |
| 그림자 | sprite 안에 drop-shadow 포함 (지면 닿는 영역만 부드러운 그림자). |
| 라이팅 | room bg 와 동일 톤 (honey-amber). 강한 highlight X. |
| 회전 | base sprite 는 정면 (rotation=0). 90/180/270 은 CSS transform 으로. |

## 파일명 ↔ catalog.ts id 매핑

`src/features/decor/catalog.ts` 의 `id` 와 1:1.

### indoor (10)
| id | filename | size (cells) |
| --- | --- | --- |
| `desk` | `indoor/desk.png` | 2×1 |
| `chair` | `indoor/chair.png` | 1×1 |
| `bed` | `indoor/bed.png` | 2×2 |
| `carpet` | `indoor/carpet.png` | 2×2 |
| `frame` | `indoor/frame.png` | 1×1 |
| `bookshelf` | `indoor/bookshelf.png` | 2×2 |
| `plant` | `indoor/plant.png` | 1×1 |
| `lamp` | `indoor/lamp.png` | 1×1 |
| `tv` | `indoor/tv.png` | 2×1 |
| `teddy` | `indoor/teddy.png` | 1×1 |

### outdoor (8)
| id | filename | size (cells) |
| --- | --- | --- |
| `scarecrow` | `outdoor/scarecrow.png` | 1×2 |
| `totem` | `outdoor/totem.png` | 1×2 |
| `well` | `outdoor/well.png` | 2×2 |
| `bench` | `outdoor/bench.png` | 2×1 |
| `windmill` | `outdoor/windmill.png` | 2×3 |
| `balloon` | `outdoor/balloon.png` | 1×1 |
| `mailbox` | `outdoor/mailbox.png` | 1×1 |
| `stone` | `outdoor/stone.png` | 1×2 |

### seasonal (4)
| id | filename | size (cells) |
| --- | --- | --- |
| `xmas_tree` | `seasonal/xmas_tree.png` | 2×3 |
| `autumn_leaves` | `seasonal/autumn_leaves.png` | 2×1 |
| `pumpkin` | `seasonal/pumpkin.png` | 1×1 |
| `cherry_blossom` | `seasonal/cherry_blossom.png` | 2×2 |

## 파일 도착 후 와이어업 (R24+)

1. 이 폴더에 22 PNG 업로드.
2. `src/features/decor/catalog.ts` 의 `Sprite` 타입 union 활용 — `sprite: { kind: "image", src: "/assets/decor/furniture/indoor/desk.png" }` 로 전환.
3. `FurnitureShopModal` / `OutdoorSlots` 가 `sprite.kind === "image"` 분기로 자동 렌더 (이미 R23 PR-147 에서 type 확장 완료 — 다음 commit).
4. `featureFlags.ts` 의 `ENABLE_DECOR_OUTDOOR_SLOTS` 를 `true` 로.
