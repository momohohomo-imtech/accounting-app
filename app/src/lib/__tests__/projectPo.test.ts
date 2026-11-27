import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPoRows, parsePoFilter, poIssuedLabel, poIssuedReady, poReportRows, poSummary, type PoProject } from "@/lib/projectPo";

const P = (id: string, code: string, extra: Partial<PoProject> = {}): PoProject => ({
  id, project_code: code, name: `가짜 공사 ${id}`, status: "ongoing", progress_pct: 30, quote_amount: 1000, order_date: null, ...extra,
});

test("줄: 프로젝트 번호 최신순, 발급 여부는 없으면 미발급, 진행률은 0~100 정수, 귀속 하위 표시", () => {
  const rows = poReportRows(
    [P("a", "2026-999"), P("b", "2026-1000", { parent_project_id: "a", progress_pct: 120.4 }), P("c", "2026-0998", { progress_pct: null, quote_amount: null })],
    new Map([["b", true]])
  );
  assert.deepEqual(rows.map((r) => r.id), ["b", "a", "c"], "1000번이 999번보다 위(글자 비교 아님)");
  assert.deepEqual(rows.map((r) => r.issued), [true, false, false]);
  assert.deepEqual(rows.map((r) => r.progress), [100, 30, 0]);
  assert.deepEqual(rows.map((r) => r.child), [true, false, false]);
  assert.equal(rows[2].quote, 0);
  assert.equal(rows[0].siteName, "-");
});

test("거르기·요약 — 미발급 중 검토중 건수 따로", () => {
  const rows = poReportRows(
    [P("a", "2026-1001", { quote_amount: 5000 }), P("b", "2026-1002", { status: "review", quote_amount: 700 }), P("c", "2026-1003", { quote_amount: 300 })],
    new Map([["a", true]])
  );
  assert.deepEqual(filterPoRows(rows, "issued").map((r) => r.id), ["a"]);
  assert.deepEqual(filterPoRows(rows, "not").map((r) => r.id), ["c", "b"]);
  assert.equal(filterPoRows(rows, "all").length, 3);
  assert.deepEqual(poSummary(rows), { total: 3, issued: { count: 1, quote: 5000 }, notIssued: { count: 2, quote: 1000 }, notIssuedReview: 1 });
  assert.deepEqual(poSummary([]), { total: 0, issued: { count: 0, quote: 0 }, notIssued: { count: 0, quote: 0 }, notIssuedReview: 0 });
});

test("주소 값 읽기·이름표", () => {
  assert.equal(parsePoFilter("issued"), "issued");
  assert.equal(parsePoFilter("not"), "not");
  assert.equal(parsePoFilter("x"), "all");
  assert.equal(parsePoFilter(undefined), "all");
  assert.equal(poIssuedLabel(true), "발급");
  assert.equal(poIssuedLabel(false), "미발급");
  assert.equal(poIssuedLabel(null), "미발급");
});

test("110 SQL 실행 여부 — 칸을 한 줄 읽어 오류면 아직 없음", async () => {
  const client = (error: unknown) => ({ from: () => ({ select: () => ({ limit: async () => ({ error }) }) }) });
  assert.equal(await poIssuedReady(client(null)), true);
  assert.equal(await poIssuedReady(client({ code: "42703" })), false);
  const throwing = { from: () => ({ select: () => ({ limit: async () => { throw new Error("연결 끊김"); } }) }) };
  assert.equal(await poIssuedReady(throwing), false);
});
