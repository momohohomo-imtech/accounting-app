import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerEditHref } from "@/lib/ledgerLinks";

test("수정 팝업 주소: 지금 목록 그대로 + editTx, 글자 검색이 있으면 q도", () => {
  const base = { year: 2026, month: "current", type: "", project_id: "" };
  assert.equal(ledgerEditHref(base, "t1"), "/transactions?year=2026&month=current&type=&project_id=&editTx=t1");
  const url = new URL(ledgerEditHref({ ...base, month: "11", type: "매입", q: "가짜 볼트" }, "t2"), "http://x");
  assert.equal(url.pathname, "/transactions");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    year: "2026",
    month: "11",
    type: "매입",
    project_id: "",
    editTx: "t2",
    q: "가짜 볼트",
  });
});
