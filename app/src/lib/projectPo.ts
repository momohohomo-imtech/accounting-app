// 프로젝트 발주서 발급 여부(11/27 사용자 요청 "프로젝트마다 발주서 발급 유무 체크 란 + 보고서에서 발급 유무 보기", 110 SQL
// `projects.po_issued` — 없으면 미발급). 110 실행 전엔 칸이 없어서 체크칸·보고서 칸·일괄 변경의 발주서 칸을 숨김(poIssuedReady).
// 보고서 "발주서 발급 현황"의 줄·요약·거르기는 여기로만. 검사: projectPo.test.ts
import { compareProjectCodeDesc } from "@/lib/projectCode";
import { PROJECT_STATUS_REVIEW } from "@/lib/projectStatus";

export function poIssuedLabel(issued: boolean | null | undefined) {
  return issued ? "발급" : "미발급";
}

type ProbeClient = {
  from: (table: string) => { select: (columns: string) => { limit: (n: number) => PromiseLike<{ error: unknown }> } };
};

/** 110 SQL을 실행했는지(발주서 칸이 있는지) — 칸을 한 줄 읽어 봄(오류면 아직 없음으로 보고 숨김). */
export async function poIssuedReady(supabase: ProbeClient): Promise<boolean> {
  try {
    const { error } = await supabase.from("projects").select("po_issued").limit(1);
    return !error;
  } catch {
    return false;
  }
}

/** 보고서 거르기(주소 ?po=) — 전체·발급만·미발급만 */
export type PoFilter = "all" | "issued" | "not";
export function parsePoFilter(value: string | null | undefined): PoFilter {
  return value === "issued" || value === "not" ? value : "all";
}
export const PO_FILTER_LABEL: Record<PoFilter, string> = { all: "발주서 전체", issued: "발급만", not: "미발급만" };

export type PoProject = {
  id: string;
  project_code: string | null;
  name: string;
  status: string | null;
  progress_pct: number | null;
  quote_amount: number | null;
  order_date: string | null;
  parent_project_id?: string | null;
  siteName?: string | null;
};

export type PoReportRow = {
  id: string;
  code: string | null;
  name: string;
  siteName: string;
  status: string | null;
  quote: number;
  progress: number;
  orderDate: string | null;
  issued: boolean;
  /** 다른 프로젝트에 귀속된 하위 — 표에 "귀속" 표시 */
  child: boolean;
};

/** 프로젝트마다 한 줄(귀속 하위도 자기 줄 — 발주서는 프로젝트마다 따로 체크), 기본 순서 = 프로젝트 번호 최신순(보고서 다른 표와 같게). */
export function poReportRows(projects: PoProject[], issuedById: ReadonlyMap<string, boolean>): PoReportRow[] {
  return [...projects]
    .sort((a, b) => compareProjectCodeDesc(a.project_code, b.project_code))
    .map((p) => ({
      id: p.id,
      code: p.project_code,
      name: p.name,
      siteName: p.siteName ?? "-",
      status: p.status,
      quote: p.quote_amount ?? 0,
      progress: Math.max(0, Math.min(100, Math.round(p.progress_pct ?? 0))),
      orderDate: p.order_date,
      issued: issuedById.get(p.id) === true,
      child: Boolean(p.parent_project_id),
    }));
}

export function filterPoRows(rows: PoReportRow[], filter: PoFilter): PoReportRow[] {
  if (filter === "issued") return rows.filter((r) => r.issued);
  if (filter === "not") return rows.filter((r) => !r.issued);
  return rows;
}

/** 요약 — 발급·미발급 건수와 발주액 합계, 미발급 중 검토중(아직 수주 전이라 발주서가 없는 게 보통) 건수 */
export function poSummary(rows: PoReportRow[]) {
  const issued = rows.filter((r) => r.issued);
  const notIssued = rows.filter((r) => !r.issued);
  return {
    total: rows.length,
    issued: { count: issued.length, quote: issued.reduce((s, r) => s + r.quote, 0) },
    notIssued: { count: notIssued.length, quote: notIssued.reduce((s, r) => s + r.quote, 0) },
    notIssuedReview: notIssued.filter((r) => r.status === PROJECT_STATUS_REVIEW).length,
  };
}
