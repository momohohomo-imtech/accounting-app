import { test } from "node:test";
import assert from "node:assert/strict";
import { LOGIN_ERROR_MESSAGES, loginErrorCode, loginErrorMessage } from "@/lib/loginError";

test("Supabase 오류 → 화면 코드(코드가 먼저, 없으면 문구·상태)", () => {
  assert.equal(loginErrorCode({ code: "invalid_credentials", message: "Invalid login credentials" }), "invalid");
  assert.equal(loginErrorCode({ message: "Invalid login credentials" }), "invalid");
  assert.equal(loginErrorCode({ code: "user_banned", message: "User is banned" }), "banned");
  assert.equal(loginErrorCode({ message: "Email not confirmed" }), "unconfirmed");
  assert.equal(loginErrorCode({ status: 429, message: "Request rate limit reached" }), "rate");
  assert.equal(loginErrorCode({ code: "over_request_rate_limit" }), "rate");
  assert.equal(loginErrorCode({ message: "fetch failed" }), "failed");
  assert.equal(loginErrorCode({}), "failed");
});

test("주소 글자는 그대로 보이지 않음 — 정해 둔 코드만 그 문구, 나머지는 일반 문구", () => {
  assert.equal(loginErrorMessage(undefined), null);
  assert.equal(loginErrorMessage(""), null);
  assert.equal(loginErrorMessage("invalid"), LOGIN_ERROR_MESSAGES.invalid);
  assert.equal(loginErrorMessage("norole"), LOGIN_ERROR_MESSAGES.norole);
  assert.equal(loginErrorMessage("timeout"), LOGIN_ERROR_MESSAGES.timeout);
  assert.equal(loginErrorMessage("계정이 정지되었습니다. 010-0000-0000으로 연락하세요"), LOGIN_ERROR_MESSAGES.failed);
  assert.equal(loginErrorMessage("toString"), LOGIN_ERROR_MESSAGES.failed, "객체 기본 이름도 문구로 안 바뀜");
  assert.equal(loginErrorMessage("__proto__"), LOGIN_ERROR_MESSAGES.failed);
});
