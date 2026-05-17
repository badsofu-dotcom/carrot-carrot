# PWA_AUDIT.md — Manifest + 설치 가능성 (PR-120)

## A. Manifest 점검

`public/manifest.webmanifest`:

| 필드 | 값 | 평가 |
| --- | --- | --- |
| `name` | "버니타임:집중타이머" | ✅ 한국어 |
| `short_name` | "버니타임" | ✅ 12자 이하 (홈스크린 적합) |
| `description` | 1줄 (한국어) | ✅ |
| `start_url` | `/` | ✅ root |
| `scope` | `/` | ✅ |
| `display` | `standalone` | ✅ 앱 모드 |
| `orientation` | `portrait` | ✅ 모바일 fixed |
| `background_color` | `#FFF8E7` | ✅ light theme splash |
| `theme_color` | `#FF9940` | ✅ orange accent |
| `lang` | `ko` | ✅ |
| `icons` | 3 (192/512/maskable) | ✅ |
| `categories` | **추가 (PR-120)**: ["productivity", "education", "lifestyle"] | ✅ 앱스토어 분류 |

## B. iOS standalone (index.html)

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="버니타임" />
<link rel="apple-touch-icon" sizes="180x180" href="%BASE_URL%icons/app-icon-180.png" />
<link rel="apple-touch-icon" sizes="152x152" href="%BASE_URL%icons/app-icon-152.png" />
<link rel="apple-touch-icon" sizes="120x120" href="%BASE_URL%icons/app-icon-120.png" />
```

→ iOS Safari "홈 화면에 추가" 시 standalone 모드 + 적절 아이콘 표시. ✅

## C. 자산 점검

```
public/icons/
  app-icon-120.png / 152 / 180 / 192 / 512 / 1024 / 600
  app-icon-maskable-512.png
  app-icon-splash-240.webp / 480.webp
  favicon-16.png / 32.png / favicon.ico
```

→ 모든 표준 크기 + maskable + favicons 갖춤. ✅

## D. 베타 검증 시나리오

| 환경 | 설치 prompt | Standalone 작동 |
| --- | --- | --- |
| iOS Safari (15+) | "홈 화면에 추가" 메뉴 | ✅ apple-mobile-web-app-capable |
| Android Chrome | "앱 설치" 자동 banner | ✅ manifest 만족 |
| Desktop Chrome | URL bar 설치 아이콘 | ✅ |

## E. Beta ship 평가

**0건 blocker**. Manifest 완성도 충분 + 모든 표준 자산 보유.

### 추가 enhancement (PR-120 적용)

- `categories: ["productivity", "education", "lifestyle"]` 추가 — 앱스토어 분류 향상

### Round 16 후보

1. **Service Worker (오프라인 캐시)** — 현재 없음. 베타 5~20명 대상은 안정 환경이라 미적용. 정식 출시 시 권장.
2. **Screenshots** — manifest 의 `screenshots` 필드. iOS PWA install 시 preview 향상.
3. **App shortcuts** — manifest 의 `shortcuts` 필드 (4 quick links).

## 변경 파일

- `public/manifest.webmanifest` — categories 추가
- `PWA_AUDIT.md` (신규)
