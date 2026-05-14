import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// 소셜 크롤러는 base path 를 모르므로 og:image / og:url 은 절대 https URL
// 이어야 한다. Apps in Toss 콘솔 배포 URL 을 기본값으로 사용하고, 필요 시
// PUBLIC_APP_URL (또는 VITE_PUBLIC_APP_URL) 으로 override 한다.
const DEFAULT_PUBLIC_APP_URL = "https://apps-in-toss.com/web/carrot-carrot";

function ogMetaPlugin(publicAppUrl: string): Plugin {
  const root = publicAppUrl.replace(/\/+$/, "");
  return {
    name: "carrot-og-meta",
    transformIndexHtml(html) {
      return html
        .replace(/%OG_PUBLIC_URL%/g, root)
        .replace(/%OG_IMAGE_URL%/g, `${root}/og/carrotcarrot_og_main.png`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicAppUrl = (
    env.PUBLIC_APP_URL ||
    env.VITE_PUBLIC_APP_URL ||
    DEFAULT_PUBLIC_APP_URL
  ).trim();

  return {
    plugins: [react(), ogMetaPlugin(publicAppUrl)],
    // 상대경로 base — iframe / S3 정적 호스팅 어디든 안전.
    base: "./",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
