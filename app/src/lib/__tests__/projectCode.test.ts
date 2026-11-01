import { test } from "node:test";
import assert from "node:assert/strict";
import { compareProjectCodeDesc } from "@/lib/projectCode";

test("프로젝트 번호 순서: 최근 번호가 위로 — 연도 먼저, 1,000번 넘어도 숫자로, 번호 없으면 맨 뒤", () => {
  const codes = ["2026-003", null, "2025-045", "2026-999", "2026-1000", "2026-010", "2024-200"];
  assert.deepEqual([...codes].sort(compareProjectCodeDesc), [
    "2026-1000",
    "2026-999",
    "2026-010",
    "2026-003",
    "2025-045",
    "2024-200",
    null,
  ]);
});
