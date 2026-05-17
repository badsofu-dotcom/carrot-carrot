# Decor — Room Backgrounds

버섯집 / 농장 야외 인테리어용 탑다운 배경.

## 사양

| 항목 | 값 |
| --- | --- |
| 비율 | **9:16** (mobile portrait) |
| 해상도 | **1080 × 1920** (or 1440 × 2560 retina) |
| 포맷 | PNG (alpha 없음) 또는 JPG (q=85+) |
| 카메라 | **탑다운 75 ~ 80도** (지면 plot 보이게) |
| 빛 | **균일 honey-amber 톤** (그림자 X, 빛 효과 X — 가구가 빛 효과 owner) |
| 바닥 | **균일 패턴** (벽돌 / 나무 결 / 잔디 — 가구 배치 가독성) |
| 가구 자리 | **plot 영역 + 가구 격자 6×4 (또는 5×5)** 비어있는 채로 (가구는 sprite 가 별도 레이어로 올라옴) |

## 권장 파일명

```
room_topdown_day.jpg       메인 (밝은 낮)
room_topdown_evening.jpg   저녁 (옵션, KST 18~22시 자동 전환)
room_topdown_night.jpg     밤 (옵션, 22~05시)
```

R23 시점에는 1개 (day) 만 있어도 충분. R25+ 에서 시간대 전환 wire.

## 디자이너 메모

- **plot 영역과 가구 격자 사이 명확한 구분**: 화분/벤치 같은 야외 가구가 plot 위에 안 올라가게.
- **벽 / 모서리**: 가구가 그 옆에 붙는 게 자연스럽도록 보더 ~20px.
- **그림자 / 빛 X**: 가구 sprite 가 자체 drop-shadow 들고 옴. 배경이 빛을 띠면 가구의 그림자 방향과 충돌.
- **저장 시 메타데이터**: JPG XMP 또는 PNG iTXt 에 `farm-furniture-bg v1` 명시 권장 (자산 추적용).

## 파일 도착 후 와이어업 (R24+)

1. 이 폴더에 `room_topdown_day.jpg` 업로드.
2. `src/features/decor/rooms.ts` (신규) 에서 `INDOOR_ROOM_BG` 상수에 path 박기.
3. `MushroomRoomPage.tsx` (신규) 가 background-image 로 import.
