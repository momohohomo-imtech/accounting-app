import { test } from "node:test";
import assert from "node:assert/strict";
import { isYearLocked, loadLockedYears } from "@/lib/yearLock";

test("신고 끝난 해 잠금: 097 실행 전이면 화면 숨김, 오류는 오류로, 최근 해 먼저", async () => {
  assert.deepEqual(await loadLockedYears(() => Promise.resolve({ data: null, error: { code: "PGRST205", message: "no table" } })), {
    ready: false,
    years: [],
    error: null,
  });
  const failed = await loadLockedYears(() => Promise.resolve({ data: null, error: { code: "XX000", message: "가짜 연결 오류" } }));
  assert.equal(failed.ready, true);
  assert.equal(failed.error, "가짜 연결 오류");
  const ok = await loadLockedYears(() =>
    Promise.resolve({
      data: [
        { year: 2024, locked_at: "2025-06-01T00:00:00Z", memo: null },
        { year: 2025, locked_at: "2026-06-01T00:00:00Z", memo: "가짜 메모" },
      ],
      error: null,
    })
  );
  assert.deepEqual(ok.years.map((y) => y.year), [2025, 2024]);
  assert.equal(isYearLocked(ok.years, 2025), true);
  assert.equal(isYearLocked(ok.years, 2026), false);
});
