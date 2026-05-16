# IMPLEMENTATION_REPORT_PR-35.md — 히든 토끼 등장 (사양 A)

도감 토끼가 농장 화면을 가끔 가로지름 → 탭하면 도감 unlock.

## 사양

- **간격**: 5~30 분 random
- **방향**: 좌→우 또는 우→좌 50/50
- **위치**: top 30-55% (plot 영역 상단~중간)
- **속도**: 5 초 화면 전체 횡단
- **일일 max**: 4 회 (안 흔하게 — anti-flood)
- **풀**: 미획득 캐릭터 우선, 모두 보유 시 전체 풀
- **탭 결과**:
  - 미획득: `forceUnlock(characterId)` → `cc:bunny-gacha:show` dispatch → BunnyGachaModal surface (PR-33 통합 path)
  - 이미 보유: `addItem("gem", 5)` + 토스트

## 사양 B (히든 스팟) 보류

사용자 spec 의 B 옵션 (배경 특정 위치 살짝 보임) 은 follow-up. 현재 PR 은 A 만. 사용자 spec "A + B 둘 다 구현 권장" — 우선 A ship, B 는 다음 라운드.

## 변경 파일

- **`src/components/Farm/HiddenBunnyLayer.tsx`** (new): timer/state/animation 캡슐화. 5 초 framer-motion linear x 트랜지션 (left ↔ right).
- **`src/features/collection/FarmHub.tsx`**: `<HiddenBunnyLayer />` mount.

PR-33 의 `cc:bunny-gacha:show` listener (FarmHub) 가 도감 unlock surface 그대로 재사용 — 별도 wire 없음.

## UX 폴리시

- SFX: `bunny` (PR-13 절차 합성음).
- haptic: success.
- 시각: 64 × 64 emoji 🐰 + warm drop-shadow. v2 에서 PR 캐릭터 PNG 로 교체.
- zIndex 7 (drop layer zIndex 6 보다 위, ToolDock zIndex 와 분리).

## anti-abuse

- 클라 카운터 only (`cc.hiddenBunny.dailyCount.<KST_DAY>`). 매일 4 회 cap.
- forceUnlock 은 collectionStore 의 기존 메서드 — 별도 검증 없음. 향후 worker `/farm/bunny/discover` 라우트로 검증 가능.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-38 (도감 패시브 효과). PR-37/36 reload, PR-39 docs, PR-40 검증.
