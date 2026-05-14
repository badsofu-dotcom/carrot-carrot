import { Hono } from "hono";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ ok: true, time: new Date().toISOString() }));

export default app;
