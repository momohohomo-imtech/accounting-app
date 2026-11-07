import { test } from "node:test";
import assert from "node:assert/strict";
import { SQL_ITEMS, checkSqlStatus, probeOutcome, sqlState } from "@/lib/sqlStatus";
import { readdirSync } from "node:fs";
import path from "node:path";

test("조회 오류 → 표·칸이 있는지: 없음 오류만 missing, 다른 오류는 unknown", () => {
  assert.equal(probeOutcome(null), "found");
  assert.equal(probeOutcome({ code: "PGRST205" }), "missing");
  assert.equal(probeOutcome({ code: "42P01" }), "missing");
  assert.equal(probeOutcome({ code: "42703" }), "missing");
  assert.equal(probeOutcome({ code: "PGRST204" }), "missing");
  assert.equal(probeOutcome({ code: "42501" }), "unknown");
  assert.equal(probeOutcome({}), "unknown");
});

test("SQL 상태: 모두 있으면 실행됨, 하나라도 없으면 실행 필요, 지우는 SQL은 표가 없어야 실행됨", () => {
  const two = { file: "x", feature: "x", probes: [{ kind: "table", table: "a", column: "id" }, { kind: "table", table: "b", column: "id" }] } as const;
  assert.equal(sqlState({ ...two, probes: [...two.probes] }, ["found", "found"]), "done");
  assert.equal(sqlState({ ...two, probes: [...two.probes] }, ["found", "missing"]), "needed");
  assert.equal(sqlState({ ...two, probes: [...two.probes] }, ["found", "unknown"]), "unknown");
  assert.equal(sqlState({ ...two, probes: [...two.probes] }, ["missing", "unknown"]), "needed");
  const gone = { file: "088", feature: "x", probes: [{ kind: "tableGone" as const, table: "old", column: "id" }] };
  assert.equal(sqlState(gone, ["missing"]), "done");
  assert.equal(sqlState(gone, ["found"]), "needed");
});

test("확인 목록: 번호가 겹치지 않고 supabase 폴더에 그 번호의 SQL 파일이 있음", () => {
  const files = readdirSync(path.join(process.cwd(), "..", "supabase"));
  const seen = new Set<string>();
  for (const item of SQL_ITEMS) {
    assert.ok(!seen.has(item.file), `겹친 번호 ${item.file}`);
    seen.add(item.file);
    assert.ok(files.some((f) => f.startsWith(`${item.file}_`)), `${item.file} SQL 파일 없음`);
    assert.ok(item.probes.length > 0);
  }
  // 번호 순서대로 적혀 있음(화면 기본 순서)
  assert.deepEqual([...SQL_ITEMS].map((i) => i.file), [...SQL_ITEMS].map((i) => i.file).sort());
});

test("확인은 읽기 1줄씩만, 없음 오류·연결 오류를 상태로", async () => {
  const calls: string[] = [];
  const missing = new Set(["work_sequences.memo", "vat_prepayment_notices.year"]);
  const fake = {
    from: (table: string) => ({
      select: (column: string) => ({
        limit: async (n: number) => {
          calls.push(`${table}.${column}:${n}`);
          if (table === "report_ai_insights") return { error: { code: "PGRST205" } };
          if (table === "locked_years") throw new Error("연결 끊김");
          return { error: missing.has(`${table}.${column}`) ? { code: table === "work_sequences" ? "42703" : "PGRST205" } : null };
        },
      }),
    }),
  };
  const rows = await checkSqlStatus(fake);
  const state = (file: string) => rows.find((r) => r.file === file)?.state;
  assert.equal(state("103"), "needed");
  assert.equal(state("093"), "needed");
  assert.equal(state("088"), "done");
  assert.equal(state("097"), "unknown");
  assert.equal(state("101"), "done");
  assert.ok(calls.every((c) => c.endsWith(":1")), "모두 1줄만 읽음");
  assert.equal(rows.length, SQL_ITEMS.length);
});
