# IMPLEMENTATION_REPORT_PR-72.md — Round 9 정합 검증 + 통합 보고

Round 7 의 5-section 보고 형식 그대로.

---

## A. PR 1줄 요약

| PR | SHA | 요약 |
| --- | --- | --- |
| PR-68 | `9ebe389` | InventoryModal bottom 을 `--tabbar-reserved` 위로 띄움 — DetailPanel / ActionBar TabBar 겹침 fix |
| PR-69 | `2f01b7a` | SettingsPage 4 master + 고급 disclosure 패턴 + emoji prefix + 부제 단축 |
| PR-70 | `484d3b4` | `SEED_ICON_REL` 상수 추출 — 3 site 동일 자산 single SoT |
| PR-71 | `47e6031` | 12-char universe 에 맞춰 dogam medal + passive 임계 재배치 (25→3, 50→6, 75→9, 100→12) |
| PR-72 | (this) | 잔여 정합 (MEDAL_LABELS, reward-disclosure.md) + Round 9 보고 |

## B. 메트릭 (Round 9 종료 시점)

| 항목 | 값 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **130 / 130 pass** (dogamPassives.test.mjs 7 케이스 갱신, 다른 lib 영향 없음) |
| `npm run typecheck` | clean |
| `npm run build` | OK, dist index ≈ 387 kB / gzip 124 kB |
| `npm run build:preview` | OK |
| 금지 토큰 (`localStorage` / `sessionStorage` / `indexedDB` / `requestFullscreen` / `exitFullscreen` / `requestPointerLock` / `exitPointerLock`) in dist-preview | **0** |
| `"/assets/farm"` 리터럴 in dist-preview | **0** |
| `DEV*` token (`__REACT_DEVTOOLS_GLOBAL_HOOK__` 제외 우리 `import.meta.env.DEV`) | **0** — DCE OK |

## C. Round 9 에서 자율 적용한 추가 아이디어

원 계획 (PR-68 hotfix / PR-69 SettingsPage / PR-70 seed naming / PR-71 dogam universe / PR-72 통합 보고) 외 자율 권한으로 추가한 항목:

1. **InventoryModal `maxHeight` 동적 계산 (PR-68)** — bottom 을 들어올린 만큼 maxHeight 도 `calc(100dvh - tabbar-reserved - safearea - 12px)` 로 동적 계산. 단순 90vh 유지 시 작은 viewport (iPhone SE 568px) 에서 모달 상단이 화면 밖으로 나가던 회귀 차단.
2. **`minHeight: 60vh` (PR-68)** — bottom 이 올라간 만큼 사용 가능 공간 감소. 60vh 로 낮춰서 작은 viewport 에서도 잘림 없이 fit.
3. **AdvancedDisclosure animated height (PR-69)** — framer-motion AnimatePresence + `height: auto` 애니메이션. 단순 conditional render 보다 부드러운 disclosure 경험.
4. **NotifyMasterRow active counter (PR-69)** — 마스터 ON 시 sub 텍스트에 `· N개 활성` 표시. 사용자가 disclosure 안 펼쳐도 활성 알림 종류 수 인지.
5. **HapticToggleRow 분리 (PR-69)** — 기존 `PushSettingsGroup` 내부 inline 이었던 햅틱 토글을 자체 컴포넌트로 추출. 다른 그룹으로 이동 자유.
6. **PushReminderRow / EndAlertRow 분리 (PR-69)** — 위와 같이 component extraction. 고급 disclosure 로 이동 + state 분리.
7. **부제 단축 13개 (PR-69)** — 효과음 / BGM / 알림 권한 / 배경 / 4 NotifyKind / 매일 22시 / 끝 알림 / 친구 코드 2 + 진동 — 사용자 인지 부하 감소.
8. **`SEED_ICON_REL` single SoT (PR-70)** — 3 site hardcode 를 상수 1곳으로 통합. 자산 path 변경 시 1줄만 수정.
9. **`DOGAM_TOTAL = CHARACTERS.length` 동적 임계 (PR-71)** — Medal threshold 를 `Math.ceil(DOGAM_TOTAL * 0.25/0.5/0.75/1.0)` 로 계산. 캐릭터 추가 시 자동 재계산.
10. **MEDAL_LABELS dogam_* "도감 N%" 표기 (PR-72)** — `"도감 25"` → `"도감 25%"` 명시. rewardsStore 의 짧은 label 도 비율 의미 명확화.
11. **`reward-disclosure.md` 100마리 → "도감 100% 완성" (PR-72)** — 법적 공시 문서의 misleading "100마리" 표현 수정. 실제로는 12 캐릭터 unlock 시 +10 P 보너스.
12. **`reward-disclosure.md` 5/25 마리 → 1/2 마리 (PR-72)** — 패시브 임계 재배치 (PR-71) 와 동기화.

## D. 사용자가 다음에 직접 사용해보면 좋을 곳 (3~5)

1. **InventoryModal 자원 / 도구 탭 끝까지 확인** — "당근 코인" / "번개" / "모래시계" 카드 탭 → DetailPanel 의 "획득 방법" 줄 + ActionBar "사용하기" 버튼이 TabBar 에 가려지지 않고 보이는지. iPhone SE 568px / iPad 등 다양한 viewport 에서.
2. **Settings → 알림 & 소리 → 고급 설정 ▼** — 한 번 펼쳐서 6개 토글 (매일 22시 리마인더 / 4 NotifyKind / 끝 알림) 보이는지. 다시 페이지 떠났다 돌아와도 펼친 상태 유지되는지 (safeStorage 영속).
3. **Settings → 알림 받기 OFF → 고급 설정 펼치기** — 4 NotifyKind 가 자동 disabled 되는지. master OFF 상태에서 "꺼짐" sub 표시되는지.
4. **도감 진행도 banner** — Collection 탭 → 도전 과제 카드 상단 banner — `다음: 1마리: 캔디 확률 +0.1%p` 같은 새 임계 라벨 표시 확인. 0/12 → 12/12 로 늘어날 때마다 banner 가 정상 갱신되는지.
5. **친구 초대 sub** — Settings 의 친구 초대 섹션. 부제가 "씨앗 +10, 보석 +5 (1회 한정)" → "보상 받기 (1회)" 로 짧아짐. 적용 후 toast 는 여전히 보상 detail ("씨앗 +10, 보석 +5") 표시.

## E. Round 10 후보 이슈

Round 9 작업 중 발견 / 미해결 + Round 8 보고서에서 이월:

1. **Worker `dailyCapBoost` enforcement** (이월) — PR-71 로 임계는 12마리로 명확해졌으나 worker `/economy` 의 daily cap enforcement 가 여전히 클라이언트 표시만. `cloudflare/.../routes/economy.ts` D1 마이그레이션 + +10 P 보너스 worker side 적용 필요.
2. **친구 시스템 백엔드** (이월) — PR-62 친구 코드 UI 는 클라 stub. worker `/economy/invite` 가 placeholder. 실제 친구 등록 → 방문 토끼 (PR-5) 연동 필요.
3. **푸시 알림 백엔드** (이월) — PR-61 클라이언트 toggle 작동, 실제 Toss notification API 미연결.
4. **AdRewardChannelModal nonce + channel post** (이월) — `src/components/Inventory/AdRewardChannelModal.tsx:113` TODO. ad-token 검증 wire 필요.
5. **AdvancedDisclosure 의 첫 번째 row (PushReminderRow) 가 border-top 없이 시작** — disclosure 펼침 시 위쪽 disclosure trigger 와 시각적 연결성 향상 가능. 현재는 자연스럽지만 약간의 hairline 구분 가능.
6. **도감 캐릭터 풀 확장** — `CHARACTERS.length = 12` 현재. 100-slot grid 구조 (`TOTAL_SLOTS = 100`) 가 미래 확장 대비. 캐릭터 정의 추가 시 PR-71 의 비율 기반 임계가 자동 재계산되므로 추가 작업 없이 medal/passive 가 새 universe 에 맞춰짐.
7. **NotifyMasterRow active counter — disclosure 펼치지 않은 사용자가 counter 클릭으로 disclosure 펼침** — UX 개선 후보. 현재는 disclosure 트리거 row 만 펼침.

---

## F. 결론

Round 9 (PR-68~72, 5 PRs) 완료.

Round 7 = "UX 안정화" (InventoryModal grid / 버프 UX / seed icon)
Round 8 = "잠재 시스템 surface" (알림 UI / 친구 초대 / dogam banner / 히든 토끼 B)
**Round 9 = "보이지 않는 부정합 정리"** — TabBar 겹침 hotfix / Settings 14→4+6 단순화 / SEED single SoT / dogam 시스템 12-char universe 로 현실화.

핵심은 **"버그처럼 보이지 않지만 실제로는 절반 비활성이었던 시스템"** (dogam medal/passive 의 25-marker) 을 발견 + 수정한 PR-71. Banner 가 영영 도달 못 하는 라벨을 표시하던 것을 사용자가 실제로 도달할 수 있는 라벨로 교체.

Round 10 은 backend wire (worker dailyCapBoost / friend / push) 가 자연스러운 다음 단계.
