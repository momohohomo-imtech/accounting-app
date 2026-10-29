import type { createClient } from "@/lib/supabase/server";
import { fetchAllRowsIn } from "@/lib/supabaseFetchAll";
import type { OutlookTx } from "@/lib/projectProfit";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type ProjectTx = OutlookTx & { id: string; payment_type: string };

// 그 해 귀속 프로젝트에 붙은 거래(기간 무관) + 프로젝트별 대행구매 합계 — 대시보드 이익 예상(loadProfitOutlook)과 프로젝트 목록
// 연말 점검이 같은 조회로 lib/projectProfit.ts 계산에 넘김(예전엔 두 곳이 따로 조회했음). type을 주면 그 구분 거래만.
export async function loadProjectTxAndAgency(supabase: Supabase, projectIds: string[], opts: { type?: "매출" | "매입" } = {}) {
  const agencyByProject = new Map<string, number>();
  if (projectIds.length === 0) return { projectTx: [] as ProjectTx[], agencyByProject };
  // 프로젝트가 수백 개여도 요청 주소가 너무 길어지지 않게 나눠 조회(fetchAllRowsIn).
  const [projectTx, agencyRows] = await Promise.all([
    fetchAllRowsIn<ProjectTx>(projectIds, (ids, from, to) => {
      let query = supabase
        .from("transactions")
        .select("id, type, payment_type, sales_amount, sales_vat, project_id, purchase_amount, purchase_vat, trans_date, expense_categories(*)")
        .in("project_id", ids);
      if (opts.type) query = query.eq("type", opts.type);
      return query.order("id", { ascending: true }).range(from, to);
    }),
    fetchAllRowsIn<{ project_id: string; amount: number }>(projectIds, (ids, from, to) =>
      supabase
        .from("project_agency_purchases")
        .select("project_id, amount")
        .in("project_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  for (const a of agencyRows) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + Number(a.amount));
  }
  return { projectTx, agencyByProject };
}
