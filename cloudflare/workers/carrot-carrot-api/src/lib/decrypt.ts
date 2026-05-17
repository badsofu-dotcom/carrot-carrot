// Apps in Toss login-me 응답 복호화.
//
// 공식 문서:
//   https://developers-apps-in-toss.toss.im/login/develop.html
//
// 핵심 사실:
//   - userKey 는 암호화되어 있지 않다 (number / string). 그대로 사용한다.
//   - PII 필드 (name, email, phone, birthday, ci, di, gender, nationality)
//     는 모두 동일한 AES-256-GCM 암호문이다.
//   - 암호문 layout: base64( IV(12) || CIPHERTEXT || TAG(16) )
//   - 키: APPS_IN_TOSS_DECRYPTION_KEY (base64 32B)
//   - AAD: APPS_IN_TOSS_DECRYPTION_AAD (예: "TOSS")
//   - WebCrypto AES-GCM 은 자동으로 마지막 16B 를 tag 로 본다.

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Diagnostic helper — wraps b64ToBytes and logs head/tail/length on failure.
// NEVER logs the full string. Safe to keep enabled during beta; remove once
// SERVER_ENV_MISSING/InvalidCharacterError diagnosis is closed.
function b64ToBytesDiag(b64: unknown, label: string): Uint8Array {
  if (typeof b64 !== "string") {
    console.error(
      `[diag/decrypt] ${label} input not string:`,
      `type=${typeof b64}`,
      `isNull=${b64 === null}`,
    );
    throw new TypeError(`${label}: input is ${b64 === null ? "null" : typeof b64}, expected string`);
  }
  try {
    return b64ToBytes(b64);
  } catch (e) {
    const errName = e instanceof Error ? e.name : "Unknown";
    const errMsg = e instanceof Error ? e.message : String(e);
    const head = b64.length > 0 ? b64.slice(0, 4) : "<empty>";
    const tail = b64.length > 0 ? b64.slice(-4) : "<empty>";
    // Charcode map of head/tail bytes — surfaces invisible chars (BOM/ZWSP/etc.)
    const headCp = [...b64.slice(0, 4)].map((c) => c.charCodeAt(0).toString(16)).join(",");
    const tailCp = [...b64.slice(-4)].map((c) => c.charCodeAt(0).toString(16)).join(",");
    console.error(
      `[diag/decrypt] ${label} atob failure:`,
      `name=${errName}`,
      `msg=${errMsg}`,
      `len=${b64.length}`,
      `head=${JSON.stringify(head)}`,
      `tail=${JSON.stringify(tail)}`,
      `headCp=[${headCp}]`,
      `tailCp=[${tailCp}]`,
    );
    throw e;
  }
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

export interface DecryptedPayload {
  userKey: string;
  name?: string;
  email?: string;
  gender?: string;
  // 진단용. 어떤 필드가 복호화 실패했는지만 노출 (값/암호문은 절대 X).
  decryptFailures: string[];
}

export type DecryptOutcome =
  | { ok: true; payload: DecryptedPayload }
  | { ok: false; code: "SERVER_ENV_MISSING" | "DECRYPT_FAILED"; reason: string; failedFields?: string[] };

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64ToBytesDiag(keyB64, "key");
  if (raw.length !== 32) {
    throw new Error(`invalid key length ${raw.length} (expected 32)`);
  }
  console.log(`[diag/decrypt] key decoded ok, raw_len=${raw.length}`);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

interface FieldDecryptResult {
  value: string | null;
  errorClass: string | null;
}

/**
 * 단일 base64 암호화 필드 복호화. 성공 시 plain string, 실패 시 errorClass.
 * 절대 키/암호문/평문을 throw 메시지에 노출하지 않는다.
 */
async function decryptField(
  ciphertextB64: string,
  key: CryptoKey,
  aadBytes: Uint8Array,
  fieldLabel = "field",
): Promise<FieldDecryptResult> {
  try {
    const blob = b64ToBytesDiag(ciphertextB64, fieldLabel);
    if (blob.length < 12 + 16) {
      return { value: null, errorClass: "TOO_SHORT" };
    }
    const iv = blob.slice(0, 12);
    const ctAndTag = blob.slice(12);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aadBytes, tagLength: 128 },
      key,
      ctAndTag,
    );
    return { value: bytesToString(new Uint8Array(plain)), errorClass: null };
  } catch (e) {
    return {
      value: null,
      errorClass: e instanceof Error ? (e.name || "Error") : "Unknown",
    };
  }
}

/**
 * Apps in Toss login-me 응답을 복호화한다.
 *
 *  - userKey 는 평문 (number 또는 string). 누락이면 USERINFO 로 봐야 하므로 ok:false.
 *  - PII 필드는 scope 미동의/미발급 시 응답에 포함되지 않거나 null 일 수 있다.
 *    있는 필드만 복호화하고, 없거나 null 이면 silently skip.
 *  - 어떤 PII 필드라도 base64 형식이지만 복호화에 실패하면 → DECRYPT_FAILED
 *    (key/AAD mismatch 신호). userKey 는 평문이므로 이 분기에 영향 없음.
 */
export async function decryptLoginMe(
  raw: Record<string, unknown>,
  keyB64: string,
  aad: string,
): Promise<DecryptOutcome> {
  // Diagnostic snapshot — presence + length only, never values.
  const fieldShape = Object.keys(raw)
    .map((k) => {
      const v = raw[k];
      if (v == null) return `${k}:null`;
      if (typeof v === "string") return `${k}:str(${v.length})`;
      return `${k}:${typeof v}`;
    })
    .join(",");
  console.log(
    `[diag/decrypt] start:`,
    `keyLen=${typeof keyB64 === "string" ? keyB64.length : "non-string"}`,
    `aadLen=${typeof aad === "string" ? aad.length : "non-string"}`,
    `rawFields=[${fieldShape}]`,
  );

  if (!keyB64) {
    return {
      ok: false,
      code: "SERVER_ENV_MISSING",
      reason: "APPS_IN_TOSS_DECRYPTION_KEY not set (run wrangler secret put)",
    };
  }
  if (!aad) {
    return {
      ok: false,
      code: "SERVER_ENV_MISSING",
      reason: "APPS_IN_TOSS_DECRYPTION_AAD not set",
    };
  }

  // userKey: 평문. number 로 와도 string 으로 정규화한다.
  let userKey: string | null = null;
  if (typeof raw.userKey === "string" && raw.userKey.length > 0) {
    userKey = raw.userKey;
  } else if (typeof raw.userKey === "number" && Number.isFinite(raw.userKey)) {
    userKey = String(raw.userKey);
  }
  if (!userKey) {
    return {
      ok: false,
      code: "DECRYPT_FAILED",
      reason: "userKey missing in login-me payload",
    };
  }

  let key: CryptoKey;
  try {
    key = await importAesKey(keyB64);
  } catch (e) {
    return {
      ok: false,
      code: "SERVER_ENV_MISSING",
      reason: e instanceof Error ? e.message : "key import failed",
    };
  }
  const aadBytes = new TextEncoder().encode(aad);

  const out: DecryptedPayload = { userKey, decryptFailures: [] };

  // 암호화 필드 (login/develop 페이지의 응답 스키마 기준).
  // gender 도 포함. nationality/phone/birthday/ci/di 는 스키마 보존 차원에서
  // 시도만 하고 결과는 폐기 — DB 컬럼이 없다.
  const encryptedFieldNames = [
    "name",
    "email",
    "gender",
    "phone",
    "birthday",
    "ci",
    "di",
    "nationality",
  ] as const;

  // 적어도 하나라도 base64 형태이지만 GCM 검증에 실패하면 key/AAD 가 잘못된 것이다.
  let anyAttempted = false;
  let anyHardFailure = false;
  const failedFields: string[] = [];

  for (const field of encryptedFieldNames) {
    const v = raw[field];
    if (typeof v !== "string" || v.length === 0) continue;
    anyAttempted = true;
    const r = await decryptField(v, key, aadBytes, `field=${field}`);
    if (r.value === null) {
      // OperationError = GCM tag mismatch (key/AAD 잘못). InvalidCharacterError = base64 깨짐.
      // 둘 다 hard failure 로 본다.
      anyHardFailure = true;
      failedFields.push(`${field}:${r.errorClass ?? "?"}`);
      out.decryptFailures.push(`${field}:${r.errorClass ?? "?"}`);
      continue;
    }
    if (field === "name") out.name = r.value;
    else if (field === "email") out.email = r.value;
    else if (field === "gender") out.gender = r.value;
    // 나머지는 현재 저장하지 않는다.
  }

  if (anyAttempted && anyHardFailure && !out.name && !out.email && !out.gender) {
    // 모든 시도가 실패 = key/AAD mismatch 또는 secret 미설정.
    return {
      ok: false,
      code: "DECRYPT_FAILED",
      reason: "all encrypted PII fields failed AES-GCM verify (likely key or AAD mismatch)",
      failedFields,
    };
  }

  return { ok: true, payload: out };
}
