import { test } from "node:test";
import assert from "node:assert/strict";
import { isCronAuthorized } from "@/lib/cronAuth";

test("CRON_SECRET이 없거나 머리글이 없으면 거부(fail closed)", () => {
  assert.equal(isCronAuthorized("Bearer x", undefined), false);
  assert.equal(isCronAuthorized("Bearer x", ""), false);
  assert.equal(isCronAuthorized(null, "fake-secret"), false);
  assert.equal(isCronAuthorized("", "fake-secret"), false);
});

test("정확히 같을 때만 통과 — 길이가 달라도·한 글자만 달라도·Bearer가 없어도 거부", () => {
  assert.equal(isCronAuthorized("Bearer fake-secret", "fake-secret"), true);
  assert.equal(isCronAuthorized("Bearer fake-secreT", "fake-secret"), false);
  assert.equal(isCronAuthorized("Bearer fake-secret2", "fake-secret"), false);
  assert.equal(isCronAuthorized("fake-secret", "fake-secret"), false);
  assert.equal(isCronAuthorized("bearer fake-secret", "fake-secret"), false);
  assert.equal(isCronAuthorized("Bearer 가짜비밀", "가짜비밀"), true, "한글 비밀값도");
});
