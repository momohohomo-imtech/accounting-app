import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, runBackup } from "@/lib/backup";

// 복원할 표 — supabase/096의 restore_allowed_tables()와 같게(restore.test.ts가 비교함). 견적서 공급자(company_profiles)는
// 설정값이라 백업 파일에만 담고 복원하지 않음.
export const RESTORE_TABLES = BACKUP_TABLES.filter((t) => t !== "company_profiles");
// 표별 줄 수(__meta)가 없는 예전 방식 백업은 그때 복원하던 표만 바꿈 — 나머지 표는 지금 자료 그대로(복원 함수가 지켜 줌).
const LEGACY_RESTORE_TABLES = [
  "clients",
  "payment_methods",
  "expense_categories",
  "sites",
  "daily_worker_offices",
  "employees",
  "bank_accounts",
  "projects",
  "quotes",
  "quote_items",
  "attachments",
  "project_agency_purchases",
  "work_logs",
  "transactions",
  "credit_payments",
  "payroll",
  "daily_workers",
  "access_lists",
  "access_list_workers",
  "bank_transactions",
  "business_trip_logs",
  "memos",
];
const OLD_BACKUP_LIMIT = 1000;
// 한 번에 올리는 양 — 영수증 인식 원문이 긴 거래가 많아도 한 요청이 너무 커지지 않게 줄 수와 크기 둘 다로 나눔.
const STAGE_MAX_ROWS = 500;
const STAGE_MAX_BYTES = 1_000_000;

type Row = Record<string, unknown>;
type Dump = Record<string, unknown>;
type Meta = { complete?: boolean; row_counts?: Record<string, number> };
const rowsOf = (dump: Dump, table: string) => (Array.isArray(dump[table]) ? (dump[table] as Row[]) : []);
const metaOf = (dump: Dump) => dump.__meta as Meta | undefined;

// 백업 내용으로 바꿀 표 — 새 방식은 백업할 때 있던 표(표별 줄 수가 기록된 표), 예전 방식은 그때 복원하던 표 중 파일에 있는 표
// (그 표가 생기기 전 백업이면 지금 자료를 비우지 않게). 여기 없는 표는 그대로 두고, 바꾸는 표를 참조하는 표(공사 메모 등)는
// 복원 함수가 지금 자료를 보관했다 되돌림.
export function restoreTablesOf(dump: Dump): string[] {
  const meta = metaOf(dump);
  if (meta?.complete) return RESTORE_TABLES.filter((t) => meta.row_counts?.[t] !== undefined);
  return LEGACY_RESTORE_TABLES.filter((t) => Array.isArray(dump[t]));
}

// 복원하면 안 되는 백업인지 — 파일에 빠진 줄은 복원하면 그만큼 사라짐. 예전 방식 백업(표마다 1,000줄까지만 담김)은
// 1,000줄 이상인 표가 잘렸을 수 있어 막고, 새 방식(__meta.complete)은 표별 줄 수가 기록과 같은지 확인. 문제가 없으면 null.
export function restoreBlockReason(dump: Dump): string | null {
  const meta = metaOf(dump);
  if (!meta?.complete) {
    const cut = LEGACY_RESTORE_TABLES.filter((t) => rowsOf(dump, t).length >= OLD_BACKUP_LIMIT);
    return cut.length > 0
      ? `예전 방식 백업이라 ${cut.join("·")} 표가 ${OLD_BACKUP_LIMIT.toLocaleString()}줄에서 잘렸을 수 있어 복원하면 자료가 사라질 수 있습니다. 새로 만든 백업으로 복원해주세요.`
      : null;
  }
  const broken = RESTORE_TABLES.filter(
    (t) => meta.row_counts?.[t] !== undefined && meta.row_counts[t] !== rowsOf(dump, t).length
  );
  return broken.length > 0 ? `백업 파일의 ${broken.join("·")} 표 줄 수가 기록과 달라(파일 손상) 복원을 막았습니다.` : null;
}

// 줄들을 maxRows줄·약 maxBytes씩 나눔(한 줄이 maxBytes보다 크면 그 줄만 한 묶음).
export function chunkRows(rows: Row[], maxRows = STAGE_MAX_ROWS, maxBytes = STAGE_MAX_BYTES): Row[][] {
  const encoder = new TextEncoder();
  const chunks: Row[][] = [];
  let current: Row[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length;
    if (current.length > 0 && (current.length >= maxRows || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function rpcMessage(error: { code?: string; message: string }) {
  // 함수가 없음 = 096 SQL 실행 전
  if (error.code === "PGRST202") return "복원 기능을 쓰려면 Supabase에서 096 SQL을 먼저 실행해주세요. 지금 자료는 바뀌지 않았습니다.";
  return error.message;
}

// 복원은 DB 안에서 한 번에(096 SQL의 restore_commit) — 하나라도 실패하면 전부 취소돼 지금 자료가 그대로 남음. 예전엔 앱이
// 표마다 지우고 다시 넣어서, 거래처의 기본 카테고리 때문에 넣기가 실패하면 표가 전부 빈 채로 끝났고 백업에 없는 표(공사 메모
// 등)는 프로젝트를 지울 때 같이 지워졌음.
export async function restoreFromBackup(supabase: SupabaseClient, dump: Dump) {
  // 올리기 전에 먼저 확인 — 잘린 백업으로 복원하면 자료가 사라짐.
  const blocked = restoreBlockReason(dump);
  if (blocked) throw new Error(blocked);
  const tables = restoreTablesOf(dump);
  if (tables.length === 0) throw new Error("복원할 표가 없는 백업 파일입니다.");

  const restoreId = crypto.randomUUID();
  try {
    // 1) 백업 내용을 나눠 올림(DB의 임시 보관함) — 이때는 아무것도 바뀌지 않음.
    for (const table of tables) {
      for (const rows of chunkRows(rowsOf(dump, table))) {
        const { error } = await supabase.rpc("restore_stage", { p_restore_id: restoreId, p_table: table, p_rows: rows });
        if (error) throw new Error(rpcMessage(error));
      }
    }
    // 2) 혹시 잘못 복원했을 때를 대비해 바꾸기 직전 지금 상태를 한 번 더 백업.
    await runBackup(supabase, "manual");
    // 3) 한 번에 바꿈.
    const counts = Object.fromEntries(tables.map((t) => [t, rowsOf(dump, t).length]));
    const { error } = await supabase.rpc("restore_commit", { p_restore_id: restoreId, p_counts: counts });
    if (error) throw new Error(`복원하지 못했습니다(지금 자료는 그대로입니다): ${rpcMessage(error)}`);
  } catch (err) {
    // 올린 자료만 정리(실패해도 다음 복원 때 하루 지난 것은 자동 정리) — 확정 중에 불려도 그 복원에는 영향 없음(096).
    await supabase.rpc("restore_discard", { p_restore_id: restoreId }).then(
      () => undefined,
      () => undefined
    );
    throw err;
  }
}
