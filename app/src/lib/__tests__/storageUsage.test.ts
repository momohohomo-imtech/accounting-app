import { test } from "node:test";
import assert from "node:assert/strict";
import { storageUsage, formatMb, FREE_STORAGE_LIMIT_MB } from "@/lib/storageUsage";

// 가짜 자료만
test("첨부(바이트) + 백업(MB) 합계와 한도 대비 %", () => {
  const u = storageUsage([1024 * 1024 * 3, 1024 * 1024 * 2, null], [1.25, 0.25]);
  assert.equal(u.attachmentsMb, 5);
  assert.equal(u.attachmentCount, 3);
  assert.equal(u.unknownSizeCount, 1);
  assert.equal(u.backupsMb, 1.5);
  assert.equal(u.backupCount, 2);
  assert.equal(u.totalMb, 6.5);
  assert.equal(u.pct, Math.round((6.5 / FREE_STORAGE_LIMIT_MB) * 1000) / 10);
  assert.equal(u.warn, false);
});

test("80% 넘으면 경고, 비었으면 0", () => {
  assert.equal(storageUsage([], [900]).warn, true);
  assert.equal(storageUsage([], [800]).warn, false);
  const empty = storageUsage([], []);
  assert.deepEqual([empty.totalMb, empty.pct, empty.warn], [0, 0, false]);
  // 이상한 값(음수·숫자 아님)은 크기를 모르는 것으로
  assert.equal(storageUsage([-5, Number.NaN], []).unknownSizeCount, 2);
});

test("크기 글자: MB, 1GB부터 GB", () => {
  assert.equal(formatMb(12.34), "12.3MB");
  assert.equal(formatMb(0), "0MB");
  assert.equal(formatMb(1536), "1.5GB");
});
