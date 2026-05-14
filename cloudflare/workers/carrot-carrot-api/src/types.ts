export interface Env {
  DB: D1Database;
  TOSS_MTLS: Fetcher;
  APPS_IN_TOSS_APP_NAME: string;
  APPS_IN_TOSS_API_BASE: string;
  APPS_IN_TOSS_DECRYPTION_AAD: string;
  ALLOW_MOCK_LOGIN: string;
  APPS_IN_TOSS_DECRYPTION_KEY: string;
  JWT_SECRET: string;
}

export type AppErrorCode =
  | "AUTHORIZE_FAILED"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_RESPONSE_INVALID"
  | "USERINFO_FAILED"
  | "USERINFO_RESPONSE_INVALID"
  | "DECRYPT_FAILED"
  | "SERVER_ENV_MISSING"
  | "MTLS_HANDSHAKE_FAILED"
  | "DB_WRITE_FAILED"
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export interface UserRow {
  user_key: string;
  name_encrypted: string | null;
  email_encrypted: string | null;
  gender: string | null;
  created_at: number;
  last_login_at: number;
}

export interface TossLoginMe {
  userKey: string;
  name?: string;
  email?: string;
  gender?: string;
}

export interface AppJwtPayload {
  sub: string;
  name?: string;
  iat: number;
  exp: number;
}
