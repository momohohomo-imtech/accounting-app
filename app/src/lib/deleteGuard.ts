import type { SupabaseClient } from "@supabase/supabase-js";

// 지우면 DB 규칙대로 같이 지워지거나(직원 → 급여 기록, 계좌 → 통장 거래 등) 연결이 끊기는(거래처 → 거래의 거래처 칸 등)
// 자료가 있으면 삭제를 막고 무엇이 몇 건인지 알려 줌. 예전엔 "정말 삭제?" 한 번에 같이 사라졌음(확인창에 안내 없음).
export type LinkedRef = { table: string; column: string; label: string };
export type LinkedCount = { label: string; count: number };

export const PROJECT_LINKS: LinkedRef[] = [
  { table: "transactions", column: "project_id", label: "거래" },
  { table: "work_logs", column: "project_id", label: "작업일지" },
  { table: "project_agency_purchases", column: "project_id", label: "대행구매" },
  { table: "attachments", column: "project_id", label: "첨부 파일" },
  { table: "construction_memos", column: "project_id", label: "공사 메모" },
  { table: "quality_checklist_items", column: "project_id", label: "품질 점검" },
  { table: "trip_log_days", column: "project_id", label: "출장일지" },
  { table: "quotes", column: "project_id", label: "견적서" },
  { table: "purchase_orders", column: "project_id", label: "발주서" },
  { table: "tool_checklists", column: "project_id", label: "공구 명세서" },
  { table: "projects", column: "parent_project_id", label: "하위 프로젝트" },
];
export const CLIENT_LINKS: LinkedRef[] = [
  { table: "transactions", column: "client_id", label: "거래" },
  { table: "sites", column: "client_id", label: "현장" },
  { table: "quotes", column: "client_id", label: "견적서" },
  { table: "purchase_orders", column: "client_id", label: "발주서" },
  { table: "bank_transactions", column: "matched_client_id", label: "통장 거래" },
];
export const EMPLOYEE_LINKS: LinkedRef[] = [
  { table: "payroll", column: "employee_id", label: "급여 기록" },
  { table: "access_list_workers", column: "employee_id", label: "출입 명단" },
];
export const DAILY_WORKER_LINKS: LinkedRef[] = [
  { table: "daily_worker_usage_logs", column: "daily_worker_id", label: "사용내역" },
  { table: "access_list_workers", column: "daily_worker_id", label: "출입 명단" },
];
export const BANK_ACCOUNT_LINKS: LinkedRef[] = [{ table: "bank_transactions", column: "bank_account_id", label: "통장 거래" }];
export const SITE_LINKS: LinkedRef[] = [
  { table: "projects", column: "site_id", label: "프로젝트" },
  { table: "work_logs", column: "site_id", label: "작업일지" },
  { table: "access_lists", column: "site_id", label: "출입 명단" },
  { table: "daily_worker_usage_logs", column: "site_id", label: "일용직 사용내역" },
];
export const CATEGORY_LINKS: LinkedRef[] = [
  { table: "transactions", column: "category_id", label: "거래" },
  { table: "project_agency_purchases", column: "category_id", label: "대행구매" },
];
export const PAYMENT_METHOD_LINKS: LinkedRef[] = [{ table: "transactions", column: "payment_method_id", label: "거래" }];
export const OFFICE_LINKS: LinkedRef[] = [{ table: "daily_workers", column: "office_id", label: "일용직" }];

// SQL 실행 전이라 아직 없는 표는 0건으로
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

export async function linkedCounts(supabase: SupabaseClient, links: LinkedRef[], id: string): Promise<LinkedCount[]> {
  const counts = await Promise.all(
    links.map(async (link) => {
      const { count, error } = await supabase
        .from(link.table)
        .select(link.column, { count: "exact", head: true })
        .eq(link.column, id);
      if (error && !MISSING_TABLE.has(error.code ?? "")) throw new Error(error.message);
      return { label: link.label, count: count ?? 0 };
    })
  );
  return counts.filter((c) => c.count > 0);
}

// "이 프로젝트에 연결된 자료가 있어 삭제할 수 없습니다: 거래 12건, 작업일지 3건. (다음 할 일)" — 없으면 null.
export function deleteBlockMessage(subject: string, linked: LinkedCount[], hint: string): string | null {
  if (linked.length === 0) return null;
  const list = linked.map((l) => `${l.label} ${l.count.toLocaleString()}건`).join(", ");
  return `${subject} 연결된 자료가 있어 삭제할 수 없습니다: ${list}. ${hint}`;
}

// 확인 조회가 실패하면 지우지 않음(모르는 채로 지우지 않게).
export async function deleteBlockReason(
  supabase: SupabaseClient,
  links: LinkedRef[],
  id: string,
  subject: string,
  hint: string
) {
  try {
    return deleteBlockMessage(subject, await linkedCounts(supabase, links, id), hint);
  } catch (err) {
    return `연결된 자료를 확인하지 못해 삭제하지 않았습니다: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// 위에서 못 거른 DB 참조 규칙 위반(23503)은 영어 원문 대신 알아볼 수 있는 말로.
export function deleteErrorMessage(error: { code?: string; message: string }) {
  return error.code === "23503" ? "다른 자료에서 쓰고 있어 삭제할 수 없습니다. 연결된 자료를 먼저 정리해주세요." : error.message;
}
