import { SignJWT, jwtVerify } from "jose";
import type { AppJwtPayload } from "../types.js";

const ALG = "HS256";
const ACCESS_TTL_SEC = 60 * 60 * 24; // 24h
const ISSUER = "carrot-carrot-api";

function secretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAppJwt(
  userKey: string,
  name: string | null,
  secret: string,
  ttlSec: number = ACCESS_TTL_SEC,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({ name: name ?? undefined })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setSubject(userKey)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec);
  return builder.sign(secretBytes(secret));
}

export async function verifyAppJwt(
  token: string,
  secret: string,
): Promise<AppJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(secret), {
      issuer: ISSUER,
      algorithms: [ALG],
    });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : undefined,
      iat: typeof payload.iat === "number" ? payload.iat : 0,
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}
