import type { SupabaseClient } from "@supabase/supabase-js";
import { runBackup } from "@/lib/backup";

// 자식 → 부모 순서 (삭제용). 복원할 때는 이 배열을 뒤집어서 부모 → 자식 순서로 넣는다.
const DELETE_ORDER = [
  "bank_transactions",
  "access_list_workers",
  "access_lists",
  "daily_workers",
  "payroll",
  "credit_payments",
  "transactions",
  "work_logs",
  "projects",
  "bank_accounts",
  "employees",
  "daily_worker_offices",
  "sites",
  "expense_categories",
  "payment_methods",
  "clients",
];

const INSERT_ORDER = [...DELETE_ORDER].reverse();

export async function restoreFromBackup(supabase: SupabaseClient, dump: Record<string, Record<string, unknown>[]>) {
  // 혹시 잘못 복구했을 때를 대비해 복구 직전 현재 상태를 한 번 더 백업해둠.
  await runBackup(supabase, "manual");

  for (const table of DELETE_ORDER) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`${table} 삭제 실패: ${error.message}`);
  }

  for (const table of INSERT_ORDER) {
    const rows = dump[table] ?? [];
    if (rows.length === 0) continue;

    if (table === "projects") {
      // parent_project_id가 같은 배치 안의 다른 행을 가리킬 수 있어 2단계로 나눠 넣는다.
      const withoutParent = rows.map((r) => ({ ...r, parent_project_id: null }));
      const { error } = await supabase.from(table).insert(withoutParent);
      if (error) throw new Error(`projects 복원 실패: ${error.message}`);
      for (const r of rows) {
        if (r.parent_project_id) {
          await supabase.from(table).update({ parent_project_id: r.parent_project_id }).eq("id", r.id as string);
        }
      }
      continue;
    }

    const { error } = await supabase.from(table).insert(rows);
    if (error) throw new Error(`${table} 복원 실패: ${error.message}`);
  }
}
