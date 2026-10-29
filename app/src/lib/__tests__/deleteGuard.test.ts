import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROJECT_LINKS, deleteBlockMessage, deleteBlockReason, deleteErrorMessage } from "@/lib/deleteGuard";

// 가짜 Supabase(실제 자료 아님) — 표·칸별 건수만 돌려줌
function fakeCounts(counts: Record<string, number>, opts: { missing?: string[]; failing?: string[] } = {}) {
  return {
    from(table: string) {
      return {
        select(column: string) {
          return {
            eq() {
              if (opts.missing?.includes(table)) return Promise.resolve({ count: null, error: { code: "PGRST205", message: "no table" } });
              if (opts.failing?.includes(table)) return Promise.resolve({ count: null, error: { code: "XX000", message: "가짜 연결 오류" } });
              return Promise.resolve({ count: counts[`${table}.${column}`] ?? 0, error: null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

test("삭제 막기: 연결된 자료가 있으면 무엇이 몇 건인지, 없으면 null", async () => {
  const supabase = fakeCounts({ "transactions.project_id": 1234, "work_logs.project_id": 3, "projects.parent_project_id": 1 });
  assert.equal(
    await deleteBlockReason(supabase, PROJECT_LINKS, "p1", "이 프로젝트에", "옮긴 뒤 삭제해주세요."),
    "이 프로젝트에 연결된 자료가 있어 삭제할 수 없습니다: 거래 1,234건, 작업일지 3건, 하위 프로젝트 1건. 옮긴 뒤 삭제해주세요."
  );
  assert.equal(await deleteBlockReason(fakeCounts({}), PROJECT_LINKS, "p1", "이 프로젝트에", "x"), null);
  assert.equal(deleteBlockMessage("이 계좌에", [], "x"), null);
});

test("삭제 막기: SQL 실행 전이라 없는 표는 0건, 확인 조회가 실패하면 지우지 않음", async () => {
  const missing = fakeCounts({}, { missing: ["construction_memos", "trip_log_days"] });
  assert.equal(await deleteBlockReason(missing, PROJECT_LINKS, "p1", "이 프로젝트에", "x"), null);
  const failing = fakeCounts({}, { failing: ["work_logs"] });
  assert.match((await deleteBlockReason(failing, PROJECT_LINKS, "p1", "이 프로젝트에", "x")) ?? "", /확인하지 못해 삭제하지 않았습니다.*가짜 연결 오류/);
});

test("삭제 오류: DB 참조 규칙 위반(23503)은 알아볼 수 있는 말로, 나머지는 그대로", () => {
  assert.match(deleteErrorMessage({ code: "23503", message: "update or delete on table ... violates foreign key constraint" }), /다른 자료에서 쓰고 있어/);
  assert.equal(deleteErrorMessage({ code: "42501", message: "permission denied" }), "permission denied");
});
