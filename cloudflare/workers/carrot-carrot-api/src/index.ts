import { Hono } from "hono";
import type { Env } from "./types.js";

import healthRoute from "./routes/health.js";
import loginRoute from "./routes/login.js";
import meRoute from "./routes/me.js";
import refreshRoute from "./routes/refresh.js";
import unlinkRoute from "./routes/unlink.js";
import farmRoute from "./routes/farm.js";
import economyRoute from "./routes/economy.js";
import toolsRoute from "./routes/tools.js";
import itemsRoute from "./routes/items.js";
import boxesRoute from "./routes/boxes.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const requestHeaders = c.req.header("Access-Control-Request-Headers");

  /**
   * Apps in Toss WebView 의 Origin 은 기기/토스앱 버전/샌드박스 상태에 따라
   * `https://toss.im`, `null`, 비공개 토스 도메인 등으로 흔들린다.
   *
   * 이 Worker 는 쿠키를 사용하지 않으며 frontend 는 credentials:'omit' 로
   * 호출하므로 `Access-Control-Allow-Credentials` 는 보내지 않는다.
   * non-credentialed CORS 에서는 `Access-Control-Allow-Origin: *` 를 그대로
   * 사용할 수 있고 Origin 이 `null` 인 webview 에서도 안전하게 동작한다.
   *
   * preflight 가 막히면 브라우저가 POST /login 자체를 보내지 않아서 로그인 화면에는
   * network_error 만 보인다 — 그래서 가장 관대한 정책을 사용한다.
   */
  c.header("Access-Control-Allow-Origin", origin && origin !== "null" ? origin : "*");
  c.header("Vary", "Origin, Access-Control-Request-Headers");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    requestHeaders ||
      "authorization,content-type,x-requested-with,x-toss-app-version,x-apps-in-toss",
  );
  c.header("Access-Control-Expose-Headers", "authorization,content-type");
  c.header("Access-Control-Max-Age", "86400");
  c.header("Access-Control-Allow-Private-Network", "true");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
});

app.route("/health", healthRoute);
app.route("/login", loginRoute);
app.route("/me", meRoute);
app.route("/refresh", refreshRoute);
app.route("/unlink", unlinkRoute);
app.route("/farm", farmRoute);
app.route("/economy", economyRoute);
app.route("/tools", toolsRoute);
app.route("/items", itemsRoute);
app.route("/boxes", boxesRoute);

app.notFound((c) =>
  c.json({ ok: false, error: { code: "NOT_FOUND", message: c.req.path } }, 404),
);

app.onError((err, c) => {
  console.error("worker error", err);
  return c.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: "internal error" } },
    500,
  );
});

export default app;
