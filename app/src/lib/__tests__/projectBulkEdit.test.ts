import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJECT_BULK_KEEP, PROJECT_BULK_STATUS_OPTIONS, projectBulkConfirmText, projectBulkFieldCount, projectBulkPatchFromForm } from "@/lib/projectBulkEdit";

const form = (v: Record<string, string>) => (k: string) => v[k] ?? null;

test("고른 칸만 — 그대로·빈칸은 건너뜀", () => {
  assert.deepEqual(projectBulkPatchFromForm(form({})).patch, {});
  assert.deepEqual(projectBulkPatchFromForm(form({ po_issued: PROJECT_BULK_KEEP, status: PROJECT_BULK_KEEP, progress_pct: "" })).patch, {});
  assert.deepEqual(projectBulkPatchFromForm(form({ po_issued: "1" })).patch, { po_issued: true });
  assert.deepEqual(projectBulkPatchFromForm(form({ po_issued: "0", status: "done", progress_pct: " 100 % " })).patch, {
    po_issued: false,
    status: "done",
    progress_pct: 100,
  });
  assert.deepEqual(projectBulkPatchFromForm(form({ progress_pct: "0" })).patch, { progress_pct: 0 }, "0%도 바꿀 값");
  assert.equal(projectBulkFieldCount({ po_issued: true, progress_pct: 0 }), 2);
});

test("이상한 값은 아무것도 안 바꾸고 이유 — 귀속 상태·범위 밖 진행률·소수", () => {
  const bads: Record<string, string>[] = [{ status: "merged" }, { status: "xx" }, { progress_pct: "101" }, { progress_pct: "-1" }, { progress_pct: "12.5" }, { progress_pct: "가" }, { po_issued: "yes" }];
  for (const bad of bads) {
    const r = projectBulkPatchFromForm(form(bad));
    assert.ok(r.error, JSON.stringify(bad));
    assert.deepEqual(r.patch, {});
  }
  assert.ok(!PROJECT_BULK_STATUS_OPTIONS.some((o) => o.value === "merged"), "타 프로젝트 귀속은 목록에 없음");
  assert.ok(PROJECT_BULK_STATUS_OPTIONS.some((o) => o.value === "collected"));
});

test("확인창 — 바꿀 칸을 한 줄씩", () => {
  assert.equal(
    projectBulkConfirmText(3, { po_issued: true, status: "done_awaiting_payment", progress_pct: 80 }),
    "선택한 3개 프로젝트를 이렇게 바꿀까요?\n· 발주서 → 발급\n· 상태 → 완료 수금대기\n· 진행률 → 80%\n발주액·이름·날짜 등 다른 칸은 그대로예요."
  );
  assert.equal(projectBulkConfirmText(1, { po_issued: false }), "선택한 1개 프로젝트를 이렇게 바꿀까요?\n· 발주서 → 미발급\n발주액·이름·날짜 등 다른 칸은 그대로예요.");
});
