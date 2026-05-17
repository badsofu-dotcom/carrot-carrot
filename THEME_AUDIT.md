# THEME_AUDIT.md — 라이트/다크 모드 양방향 contrast audit

Round 13 PR-96. Round 10 PR-80 + Round 11 PR-83/84 이 dark mode 만 fix. 본 audit 은 light mode 도 포함한 전수 검증.

## A. Token contrast 매트릭스

### Light mode (`[data-theme="light"]`)

| Token | 값 | bg-elevated (#fff) contrast | bg-primary (#fbf6ee) contrast | AA (4.5) |
| --- | --- | --- | --- | --- |
| `--text-primary` | `#1f1a15` | **15.5:1** | 14.4:1 | ✅ AAA |
| `--text-secondary` | `#6b5e4d` | **6.5:1** | 6.0:1 | ✅ AA |
| `--text-tertiary` | `#a99c87` | **2.68:1** | 2.49:1 | ❌ **FAIL** |
| `--accent-carrot` | `#ff6b35` | 4.0:1 | 3.7:1 | ⚠ AA large only |

### Dark mode (`[data-theme="dark"]`)

| Token | 값 | bg-elevated (#2a201a) contrast | AA (4.5) |
| --- | --- | --- | --- |
| `--text-primary` | `#fff8e7` | **15.4:1** | ✅ AAA |
| `--text-secondary` | `#c9bba6` | **8.6:1** | ✅ AAA |
| `--text-tertiary` | `#b3a691` | **6.0:1** | ✅ AA (PR-80 fix) |

## B. 발견 — Light mode `--text-tertiary` 미달

| 측면 | 상태 |
| --- | --- |
| 값 | `#a99c87` (light tan) |
| bg-elevated (#fff) contrast | **2.68:1** (AA 4.5 미달 — 61% 부족) |
| bg-primary (#fbf6ee) contrast | **2.49:1** (더 심함) |
| 영향 사이트 | 모든 `var(--text-tertiary)` 사용처 (theme-aware text 다수) |

**왜 dark 만 fix 됐고 light 는 누락됐나**: Round 10 PR-80 발견 시점에 user 가 다크 모드 사례만 보고. light 도 동일 문제 존재 가능성을 verify 안 함.

## C. Fix — Light mode `--text-tertiary` 상향

```diff
- --text-tertiary: #a99c87;   /* 2.68:1 — FAIL */
+ --text-tertiary: #7a6e58;   /* 4.84:1 — PASS AA */
```

Y(#7a6e58):
- r=122/255=0.478, g=110/255=0.431, b=88/255=0.345
- Y ≈ 0.167
- Contrast on #fff: (1.0+0.05)/(0.167+0.05) = **4.84:1** ✅
- Contrast on #fbf6ee: (0.928+0.05)/(0.167+0.05) = **4.51:1** ✅ (간신히 통과)

Alternative 후보:
| 값 | #fff contrast | 채택? |
| --- | --- | --- |
| `#8a7d65` | ~3.98:1 | ❌ AA 미달 |
| `#7a6e58` | **4.84:1** | ✅ 채택 |
| `#6e6350` | ~5.83:1 | ⚠ 너무 어두움 (secondary 와 구분 약함) |

`#7a6e58` 채택 — AA 마진 + secondary (`#6b5e4d`) 와 시각 차이 유지.

## D. Accent-carrot 추가 검토

| Mode | Token 값 | bg contrast | AA |
| --- | --- | --- | --- |
| light | `#ff6b35` on `#fff` | 4.0:1 | ⚠ Large text AA only |
| dark | `#ff8555` on `#2a201a` | 6.6:1 | ✅ AA |

Accent-carrot 은 보통 대형 버튼 / 강조 라벨 → large text 기준 (3:1) 통과. 작은 caption 으로 사용된 사이트는 별도 검토 필요. PR-96 범위에서는 변경 없음 (Round 14 후보).

## E. 자율 결정

| 항목 | 결정 |
| --- | --- |
| Light text-tertiary fix | ✅ **포함** — 사용자 보고 없어도 audit 발견된 violation |
| Light accent-carrot 조정 | ❌ **미포함** — large text 통과 + 시각 균형 |
| Dark mode 재검증 | ✅ Round 10 PR-80 + 11 PR-83 의 darkModeContrast.test 이미 cover |

## F. 신규 테스트

`darkModeContrast.test.mjs` 의 light mode 변형 추가:

```js
test("light theme: --text-tertiary >= 4.5 on --bg-elevated", () => {
  const fg = extractLightVar("text-tertiary");
  const bg = extractLightVar("bg-elevated");
  assert.ok(contrastRatio(fg, bg) >= 4.5);
});
```

## G. 변경 파일

- `src/design-system/tokens.css` — light `--text-tertiary` #a99c87 → #7a6e58
- `src/lib/darkModeContrast.test.mjs` — light mode WCAG test 추가

## H. 다른 영역 — 추가 fix 후보 (Round 14)

1. `accent-carrot` (#ff6b35) 가 small text 로 쓰인 사이트 audit (border tone 등)
2. `--text-secondary` (#6b5e4d) 의 bg-sunken (#efeadc) contrast: ~4.7 — AA 통과 but tight
3. `--border-subtle` rgba(0,0,0,0.06) 의 가시성 — 너무 옅을 가능성
