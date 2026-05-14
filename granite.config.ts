import { defineConfig } from "@apps-in-toss/web-framework/config";

// `brand.icon` 은 Apps in Toss 콘솔에 등록된 아이콘과 **같은 파일**의
// 공개 HTTPS URL 이어야 한다. 콘솔 심사는 granite 메타의 아이콘과 콘솔
// 등록 아이콘을 비교해 다르면 거부한다 (실제 거부 사례 있음).
//
// 콘솔이 발급한 CDN URL — 콘솔 → 앱 정보 → 아이콘 슬롯에 업로드한 600×600
// 원본의 공개 URL. 환경변수로 override 가능하지만 기본값이 박혀 있으므로
// 별도 설정 없이도 콘솔 등록 아이콘과 일치하는 ait 가 만들어진다.
// 콘솔에서 아이콘을 다시 업로드해 URL 이 바뀌면 본 상수도 함께 갱신한다.
const CONSOLE_BRAND_ICON_URL =
  "https://static.toss.im/appsintoss/9399/e8354053-e837-4e0e-ad25-8a0834f06620.png";
const PLACEHOLDER = "REPLACE_WITH_CONSOLE_ICON_URL";

const RAW_BRAND_ICON_URL =
  process.env.APPS_IN_TOSS_BRAND_ICON_URL?.trim() || CONSOLE_BRAND_ICON_URL;

if (
  !RAW_BRAND_ICON_URL ||
  RAW_BRAND_ICON_URL === PLACEHOLDER ||
  !/^https:\/\//.test(RAW_BRAND_ICON_URL)
) {
  const reason =
    RAW_BRAND_ICON_URL === PLACEHOLDER
      ? `placeholder(${PLACEHOLDER}) 그대로`
      : "https:// 가 아님";
  throw new Error(
    [
      `✗ APPS_IN_TOSS_BRAND_ICON_URL override 값이 ${reason} — granite.config.ts 가 빌드를 중단합니다.`,
      "",
      "기본값(콘솔 등록 CDN URL) 을 그대로 쓰려면 환경변수를 비워두면 된다.",
      "다른 URL 로 override 할 때는 콘솔에 등록한 아이콘과 동일한 파일의",
      "공개 https:// URL 이어야 한다.",
    ].join("\n"),
  );
}

export default defineConfig({
  appName: "carrot-carrot",
  brand: {
    displayName: "버니타임:집중타이머",
    primaryColor: "#FF6A35",
    icon: RAW_BRAND_ICON_URL,
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "npm run dev",
      build: "npm run build",
    },
  },
  permissions: [],
  outdir: "dist",
});
