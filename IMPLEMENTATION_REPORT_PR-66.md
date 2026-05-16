# IMPLEMENTATION_REPORT_PR-66.md — Round 8 정합 검증 + 통합 보고

Round 7 (PR-56..60) 보고 형식 (5 section) 그대로.

---

## A. PR 1줄 요약

| PR | SHA | 요약 |
| --- | --- | --- |
| PR-61 | `4c784d7` | 알림: in-app banner + Settings 토글 5종 + HomePage session trigger |
| PR-67 | `a3b51c0` | InventoryModal `minHeight: 70vh` 회귀 fix + `tool_fertilizer.png` 자산 복원 |
| PR-62 | `c4d0eda` | 친구 초대 UI — code copy/share + apply + 4상태 결과 toast (SettingsPage) |
| PR-63 | `7311c5e` | 도감 패시브 wire — sessionCarrotMul (10마리 ×1.05) + giftBoostX (20마리 ×1.5) |
| PR-64 | `878bc57` | 히든 토끼 사양 B — 5 spot peek 10~30분 / 3초 / 일일 3 (사양 A 와 독립) |
| PR-65 | `5282aa8` | AchievementsCard 패시브 banner + GemTradeModal disabled 옵션 shortfall UX |

총 6 PRs (5 feat + 1 mid-round hotfix). Docs commit 도 매 PR 별 1개씩 분리.

## B. 메트릭 (Round 8 종료 시점)

| 항목 | 값 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **130 / 130 pass** (Round 7 종료와 동일 — 새 helper 모듈은 buffEffects / dogamPassives 가 이미 PR-59/PR-38 부터 cover) |
| `npm run typecheck` | **clean** |
| `npm run build` | OK, dist 사이즈: index 387.87 kB / gzip 124.02 kB |
| `npm run build:preview` | OK, dist-preview 사이즈: index 388.13 kB / gzip 124.05 kB |
| 금지 토큰 (`localStorage` / `sessionStorage` / `indexedDB` / `requestFullscreen` / `exitFullscreen` / `requestPointerLock` / `exitPointerLock`) in dist-preview | **0** |
| `"/assets/farm"` 리터럴 in dist-preview | **0** |
| `DEV*` token (`__REACT_DEVTOOLS_GLOBAL_HOOK__` 제외 우리 `import.meta.env.DEV`) | **0** — DCE OK |

## C. Round 8 에서 자율 적용한 추가 아이디어

원 계획에 명시적이지 않았으나 자율 권한으로 추가한 항목 (Round 7 spec 의 "어색한 카피 다듬기 / 회귀 자율 fix / micro-interaction / 테스트 자율 추가" 권한):

1. **InAppBanner 신규 컴포넌트 (PR-61)** — Notification 권한 거부/iframe 인 경우의 fallback. App.tsx 최상단에 mount. 4초 auto-dismiss + tap-to-dismiss. iOS notch safe-area-inset-top 적용.
2. **Settings 알림 master 토글 + 4 kind 토글 (PR-61)** — Round 7 PR-53 의 `useNotificationsStore` 가 무 UI 였음. master off 시 4 kind 흐릿 표시 + Native permission 요청 자동.
3. **친구 초대 코드 4상태 toast (PR-62)** — `ok / self / already / invalid` 4 분기 사용자 메시지. Web Share API 우선, fallback clipboard, 둘 다 실패 시 toast.
4. **PR-67 InventoryModal `minHeight: 70vh` 회귀 fix** — PR-56 의 `height: 70vh → maxHeight` 변경이 컨텐츠 적은 경우 모달이 끝까지 안 올라오는 회귀 유발. min+max combo 로 안정화.
5. **tool_fertilizer 자산 복원 (PR-67)** — PR-58 에서 자산 미존재로 seed_pack 으로 대체했던 것을 사용자가 PNG 추가하자 복원. 3 site 동시 교체 (itemsStore / FarmDropLayer / CollectionPage CurrencyChip).
6. **GemTradeModal disabled 옵션 emoji grayscale + shortfall 라벨 (PR-65)** — 비활성인 옵션이 왜 비활성인지 명시적 표시 ("보석 N개 더 필요해요"). 접근성: `aria-label` 에 shortfall 포함.
7. **AchievementsCard 패시브 banner (PR-65)** — 도전 과제 그리드 위에 도감 진행도 + 다음 패시브 이정표. `nextPassiveLabel` (PR-38 부터 존재) 가 surface 안 되어 있던 것을 채움.
8. **HiddenBunnyPeek 별도 카운터 (PR-64)** — 사양 A 와 B 가 동시 존재할 수 있도록 `cc.hiddenBunny.dailyCount.*` 와 `cc.hiddenBunnyPeek.dailyCount.*` 를 분리. 일일 cap 도 A=4 / B=3 별개.
9. **giftBoostX `Math.max(1, ...)` 안전 가드 (PR-63)** — round-down 으로 0 이 되는 케이스 차단 (amount=1, giftBoost=1 → round(1) = 1 자체는 안전하지만 미래 변화 대비).
10. **세션 알림 trigger gate (PR-61)** — HomePage focus-complete 에서 `notif.shouldNotify("session")` 게이트. master OR per-kind 둘 다 켜진 경우만 발사.

## D. 사용자가 다음에 직접 사용해보면 좋을 곳 (3~5)

1. **알림 UI 종합 확인** — Settings 의 알림 마스터 토글 ON → permission 허용 → 25분 세션 완료 시 native notification + in-app banner 어느 쪽 트리거 되는지 확인. iframe preview 에서는 native 불가 → in-app banner 만 떠야 함.
2. **친구 초대 코드 자가 입력** — Settings → 친구 초대 → 본인 코드 입력 → "자기 자신은 친구로 등록 못 해요" toast 확인. 이어서 정상 코드 (다른 디바이스에서 시작) 면 "친구 등록 완료". 동일 코드 재입력 → "이미 친구" toast.
3. **도감 진행도 banner** — Collection 탭 → 도전 과제 카드 상단에 `🐰 도감 N마리 / 다음: 5마리: 황금 확률 +0.1%p` 같이 표시. N 늘릴 때마다 다음 이정표가 다음 임계로 점프하는지.
4. **GemTradeModal shortfall** — Inventory 의 💎 사용하기 → 보석이 적은 옵션은 회색 + "보석 N개 더 필요해요" 라벨. 보석 충분한 옵션만 컬러풀.
5. **HiddenBunnyPeek (사양 B) 확인** — 농장 화면 오래 켜두면 (10~30분 random) 배경 spot 중 하나에서 🐰 3초 살짝 나타남. 사양 A 의 가로지름과 동시 진행. 일일 cap 분리.

## E. Round 9 후보

Round 8 작업 중 발견 / 미해결 + Round 7 보고서에서 이월:

1. **Worker dailyCapBoost wire** — PR-63 노트: `passivesFromOwned(25+).dailyCapBoost = 10` 는 클라이언트 표시만, worker `/economy` 의 daily cap enforcement 미연결. `cloudflare/.../routes/economy.ts` 또는 마이그레이션 0007+ 가 필요.
2. **친구 시스템 백엔드** — PR-62 친구 코드 UI 는 클라이언트 stub 만. worker `/friends/code/apply` 가 placeholder. 실제 친구 등록 → 방문 토끼 (PR-5) 연동 필요.
3. **알림 푸시 백엔드** — PR-61 클라이언트 toggle 은 모두 작동. 실제 푸시 전송 (Toss notification API) 미연결. session/midnight/treasure trigger 는 클라이언트 in-app 만.
4. **도감 dogam_100 medal vs 25마리 패시브 정합** — `AchievementsCard` 의 dogam_100 메달 + `nextPassiveLabel` 둘 다 25마리 surface. CHARACTERS.length 가 실제 몇인지 확인하고 25 가 도달 가능한지 검증 필요.
5. **InventoryModal usable item action - 광고 채널 (PR-67)** — `AdRewardChannelModal` 의 nonce + channel 을 worker 에 post 하는 로직이 미연결 (`InventoryModal.tsx:112` TODO).
6. **PR-58 seed 자산 → fertilizer / seed 일관성** — PR-67 에서 fertilizer 로 되돌렸으나 사용자가 추후 "seed pack" 으로 다시 바꿀 수 있음. itemsStore 의 seed.displayName 도 "씨앗 묶음" 인지 확인 필요.

---

## F. 결론

Round 8 (6 PRs, hotfix 1 포함) 완료. Round 7 의 5 PR 보다 1 PR 많음.

Round 7 = "UX 안정화" (InventoryModal grid + 버프 UX 풀 리뉴얼 + seed icon 일관성).
Round 8 = "잠재 시스템 surface" (알림 UI / 친구 초대 / 도감 패시브 banner / 히든 토끼 사양 B).

Round 8 의 핵심은 "코드는 있는데 보이지 않던" 것들 (`nextPassiveLabel`, 알림 store, sessionCarrotMul/giftBoostX) 을 모두 UI 표면으로 끌어올린 것.

다음 Round 9 는 backend wire (worker dailyCapBoost / 친구 백엔드 / push notification 연결) 가 자연스러운 다음 단계.
