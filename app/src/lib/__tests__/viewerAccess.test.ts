import { test } from "node:test";
import assert from "node:assert/strict";
import { isViewerBlockedApi, isViewerBlockedPage } from "@/lib/viewerAccess";

test("조회 전용 계정: 개인정보·백업 화면은 막고 나머지는 허용", () => {
  for (const p of ["/employees", "/employees/abc", "/daily-workers", "/daily-workers?tab=tax", "/backups"]) {
    assert.equal(isViewerBlockedPage(p.split("?")[0]), true, p);
  }
  for (const p of ["/dashboard", "/transactions", "/projects", "/reports", "/worklogs", "/bank", "/employees-x"]) {
    assert.equal(isViewerBlockedPage(p), false, p);
  }
});

test("조회 전용 계정: AI·OCR 호출은 막고 엑셀 내려받기는 허용", () => {
  assert.equal(isViewerBlockedApi("/api/ocr"), true);
  assert.equal(isViewerBlockedApi("/api/payroll-ocr"), true);
  assert.equal(isViewerBlockedApi("/api/reports-ai"), true);
  assert.equal(isViewerBlockedApi("/api/transactions-excel"), false);
});
