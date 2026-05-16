# IMPLEMENTATION_REPORT_PR-44.md — InventoryModal 아이콘 사이즈 폭발 핫픽스

PR-41 이후 보고된 회귀: 자원/도구 탭의 일부 아이콘이 cell 거의 가득 (~140 px) 차지. 의도된 40 × 40 무시.

## 원인 추정

`<img width: 40, height: 40>` inline style 만 있고 `maxWidth/maxHeight` 가 없는 상태에서 일부 브라우저 (Mobile WebView) 가 intrinsic 사이즈 (PNG asset 본래 200~512 px) 를 따름. flex column cell 의 `aspectRatio: 1/1` 이 img 의 큰 사이즈를 보호 못 함.

## 수정

1. Grid 셀 button 에:
   - `overflow: "hidden"` — cell 외곽선 너머로 img 안 비져나가게 hard-clip
   - `boxSizing: "border-box"`
2. Grid 셀 img 에:
   - `maxWidth: 40, maxHeight: 40` 추가
   - `flexShrink: 0` 유지
3. DetailPanel img 에 동일 패턴:
   - `width: 42, height: 42, maxWidth: 42, maxHeight: 42` inline style 추가
   - 이전엔 `width={42}` HTML attribute 만 있어 동일한 회귀 위험.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 101/101 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-48 (광고 채널 보물진행 랜덤 보상).
