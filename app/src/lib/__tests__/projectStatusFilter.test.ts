import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveStatusParam, statusFilterCookieValue, statusesFromCookie } from "@/lib/projectStatusFilter";

test("프로젝트 상태 체크 저장: 쿠키 값은 정해진 순서·쉼표 없이, 모르는 값은 버림, 전체는 all", () => {
  assert.equal(statusFilterCookieValue(["done", "ongoing", "모르는값"]), "ongoing.done");
  assert.equal(statusFilterCookieValue([]), "all");
  assert.deepEqual(statusesFromCookie("ongoing.done_awaiting_payment.x"), ["ongoing", "done_awaiting_payment"]);
  assert.deepEqual(statusesFromCookie("all"), []);
  assert.deepEqual(statusesFromCookie(undefined), []);
});

test("프로젝트 상태 체크 저장: 주소에 상태가 있으면 그것, 없으면 저장된 체크", () => {
  assert.equal(effectiveStatusParam("review,etc", "ongoing"), "review,etc");
  assert.equal(effectiveStatusParam(undefined, "ongoing.done"), "ongoing,done");
  assert.equal(effectiveStatusParam(undefined, "all"), "");
  assert.equal(effectiveStatusParam(undefined, undefined), "");
});
