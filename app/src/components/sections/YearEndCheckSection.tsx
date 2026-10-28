import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { unbilledRemainingByGroup, type OutlookProject, type OutlookTx } from "@/lib/projectProfit";
import { formatWon } from "@/lib/format";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { YearEndCheckTable, type YearEndRow } from "@/components/YearEndCheckTable";

// 연말 점검(사용자 요청) — 그 해 귀속 프로젝트 중 세금계산서를 아직 다 발행하지 않은 묶음(어미 + 귀속 하위)과 남은 발행
// 예정액. 12월 31일까지 다 못 끊을 프로젝트는 여기서 골라 귀속 연도를 다음 해로 옮김. 계산은 lib/projectProfit.ts의
// unbilledRemainingByGroup(1월 부가세 미발행 예상분과 같은 기준). 남은 것이 없으면 아무것도 안 보임.
export async function YearEndCheckSection({ year }: { year: number }) {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, quote_amount, parent_project_id")
    .eq("year", year);
  const yearProjects = (projects ?? []) as OutlookProject[];
  if (yearProjects.length === 0) return null;
  const ids = yearProjects.map((p) => p.id);

  const [salesTx, agencyRows] = await Promise.all([
    fetchAllRows<OutlookTx>((from, to) =>
      supabase
        .from("transactions")
        .select("id, type, payment_type, sales_amount, sales_vat, purchase_amount, purchase_vat, project_id, trans_date, expense_categories(*)")
        .eq("type", "매출")
        .in("project_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ project_id: string; amount: number }>((from, to) =>
      supabase
        .from("project_agency_purchases")
        .select("project_id, amount")
        .in("project_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  const agencyByProject = new Map<string, number>();
  for (const a of agencyRows) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + Number(a.amount));
  }

  const rows: YearEndRow[] = unbilledRemainingByGroup(yearProjects, salesTx, agencyByProject)
    .filter((g) => g.remaining > 0)
    .map((g) => ({
      key: g.members[0].id,
      label: g.label,
      status: g.status,
      quote: g.quote,
      agency: g.agency,
      billed: g.billed,
      remaining: g.remaining,
      lastBilled: g.lastBilled,
      memberIds: g.members.map((p) => p.id),
    }));
  if (rows.length === 0) return null;
  const remainingTotal = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <CollapsibleSection
      title={
        <span>
          {year}년 연말 점검{" "}
          <span className="text-sm font-normal text-slate-500">
            — 세금계산서 미발행 {rows.length}건 · 남은 발행 예정액 {formatWon(remainingTotal)}
          </span>
        </span>
      }
      className="print:hidden"
    >
      <YearEndCheckTable year={year} rows={rows} />
    </CollapsibleSection>
  );
}
