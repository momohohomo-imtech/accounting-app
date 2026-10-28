import type { SupabaseClient } from "@supabase/supabase-js";
import { runBackup } from "@/lib/backup";

// 자식 → 부모 순서 (삭제용). 복원할 때는 이 배열을 뒤집어서 부모 → 자식 순서로 넣는다.
const DELETE_ORDER = [
  "memos",
  "business_trip_logs",
  "bank_transactions",
  "access_list_workers",
  "access_lists",
  "daily_workers",
  "payroll",
  "credit_payments",
  "transactions",
  "work_logs",
  "project_agency_purchases",
  "attachments",
  "quote_items",
  "quotes",
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
// 한 번에 넣는 줄 수 — 수천 줄을 한 요청에 넣다 크기 제한에 걸리지 않게 나눠 넣음.
const INSERT_CHUNK = 500;
const OLD_BACKUP_LIMIT = 1000;

type Dump = Record<string, unknown>;
const rowsOf = (dump: Dump, table: string) => (Array.isArray(dump[table]) ? (dump[table] as Record<string, unknown>[]) : []);

// 복원하면 안 되는 백업인지 — 지금 거래를 다 지우고 파일 내용만 다시 넣으므로, 빠진 줄이 있으면 그만큼 영구히 사라짐.
// 예전 방식 백업(표마다 1,000줄까지만 담김)은 1,000줄 이상인 표가 잘렸을 수 있어 막고, 새 방식(__meta.complete)은 표별
// 줄 수가 기록과 같은지 확인. 문제가 없으면 null.
export function restoreBlockReason(dump: Dump): string | null {
  const meta = dump.__meta as { complete?: boolean; row_counts?: Record<string, number> } | undefined;
  if (!meta?.complete) {
    const cut = DELETE_ORDER.filter((t) => rowsOf(dump, t).length >= OLD_BACKUP_LIMIT);
    return cut.length > 0
      ? `예전 방식 백업이라 ${cut.join("·")} 표가 ${OLD_BACKUP_LIMIT.toLocaleString()}줄에서 잘렸을 수 있어 복원하면 자료가 사라질 수 있습니다. 새로 만든 백업으로 복원해주세요.`
      : null;
  }
  const broken = DELETE_ORDER.filter(
    (t) => meta.row_counts?.[t] !== undefined && meta.row_counts[t] !== rowsOf(dump, t).length
  );
  return broken.length > 0 ? `백업 파일의 ${broken.join("·")} 표 줄 수가 기록과 달라(파일 손상) 복원을 막았습니다.` : null;
}

async function insertInChunks(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + INSERT_CHUNK));
    if (error) throw new Error(`${table} 복원 실패: ${error.message}`);
  }
}

export async function restoreFromBackup(supabase: SupabaseClient, dump: Dump) {
  // 지우기 전에 먼저 확인 — 잘린 백업으로 복원하면 거래가 영구히 사라짐.
  const blocked = restoreBlockReason(dump);
  if (blocked) throw new Error(blocked);

  // 혹시 잘못 복구했을 때를 대비해 복구 직전 현재 상태를 한 번 더 백업해둠.
  await runBackup(supabase, "manual");

  for (const table of DELETE_ORDER) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`${table} 삭제 실패: ${error.message}`);
  }

  for (const table of INSERT_ORDER) {
    const rows = rowsOf(dump, table);
    if (rows.length === 0) continue;

    if (table === "projects") {
      // parent_project_id가 같은 배치 안의 다른 행을 가리킬 수 있어 2단계로 나눠 넣는다.
      await insertInChunks(supabase, table, rows.map((r) => ({ ...r, parent_project_id: null })));
      for (const r of rows) {
        if (r.parent_project_id) {
          await supabase.from(table).update({ parent_project_id: r.parent_project_id }).eq("id", r.id as string);
        }
      }
      continue;
    }

    await insertInChunks(supabase, table, rows);
  }
}
