import { createClient } from "@/lib/supabase/server";
import { formatWon, moneyClass } from "@/lib/format";
import { taxEstimate } from "@/lib/tax";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import {
  expectedRevenueOf,
  projectBasedProfit,
  secondHalfOutlook,
  countedQuote,
  unbilledInvoiceVat,
  type OutlookProject,
  type OutlookTx,
} from "@/lib/projectProfit";

// 대시보드의 이익·세금 추정치를 한 번에 계산 — 계산식은 lib/projectProfit.ts(자동 검사 있음), 여기서는 조회만.
// 선택 연도의 거래·프로젝트는 대시보드가 이미 받아온 것을 그대로 넘겨받아 같은 데이터를 다시 조회하지 않는다.
// 거래는 세금계산서 기준(외상 미정산 포함) — yearTx도 정산 여부로 거르지 않은 그 해 거래 전부를 넘길 것.
export async function loadProfitOutlook(
  year: number,
  { yearProjects, yearTx }: { yearProjects: OutlookProject[]; yearTx: OutlookTx[] }
) {
  const supabase = await createClient();
  const projectIds = yearProjects.map((p) => p.id);

  // 상반기 확정 이익 — 아래 프로젝트 거래 조회와 동시에 보내려고 먼저 시작(.then으로 바로 요청이 나가게).
  const halfYearPromise = supabase
    .from("half_year_settlements")
    .select("profit_amount")
    .eq("year", year)
    .eq("half", 1)
    .maybeSingle()
    .then((r) => r);
  // 그 해 귀속 프로젝트에 붙은 거래 전부(기간 무관, 매출·매입) + 대행구매.
  const [projectTx, agencyRows] = projectIds.length
    ? await Promise.all([
        fetchAllRows<OutlookTx>((from, to) =>
          supabase
            .from("transactions")
            .select("id, type, payment_type, sales_amount, sales_vat, project_id, purchase_amount, purchase_vat, trans_date, expense_categories(*)")
            .in("project_id", projectIds)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        fetchAllRows<{ project_id: string; amount: number }>((from, to) =>
          supabase
            .from("project_agency_purchases")
            .select("project_id, amount")
            .in("project_id", projectIds)
            .order("id", { ascending: true })
            .range(from, to)
        ),
      ])
    : [[] as OutlookTx[], [] as { project_id: string; amount: number }[]];
  const { data: halfYearRow } = await halfYearPromise;

  const agencyByProject = new Map<string, number>();
  for (const a of agencyRows) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + Number(a.amount));
  }

  // 프로젝트 기준 예상 이익(진행 중 포함) — 귀속 연도 프로젝트의 발주액(검토중 제외) 기준.
  const estimate = projectBasedProfit(yearProjects, projectTx, yearTx, agencyByProject);
  const profitTax = taxEstimate(estimate.profit);

  // 연간 예상 이익 = 상반기 확정 이익(세무사 결산) + 하반기 예상 이익.
  const h2 = secondHalfOutlook(year, yearProjects, projectTx, yearTx, agencyByProject);
  const half1Profit = halfYearRow?.profit_amount ?? null;
  const combinedProfit = half1Profit != null ? Number(half1Profit) + h2.h2EstimatedProfit : null;
  const combinedTax = combinedProfit != null ? taxEstimate(combinedProfit) : null;

  return {
    expectedRevenue: expectedRevenueOf(yearProjects, agencyByProject),
    hasProjectsWithProfit: yearProjects.some((p) => countedQuote(p) > 0),
    profitEstimate: estimate.profit,
    profitTax,
    // 추가 매출·매입이 더 생길 수 있는 건 아직 공사 중인 프로젝트뿐(검토중은 계산에 안 넣음).
    hasIncompleteProjects: yearProjects.some((p) => p.status === "ongoing"),
    half1Profit: half1Profit != null ? Number(half1Profit) : null,
    ...h2,
    combinedProfit,
    combinedTax,
    // 1월 부가세(제2기 확정) 추정에 따로 더하는 미발행 계산서 예상분.
    unbilledVat: unbilledInvoiceVat(yearProjects, projectTx, agencyByProject),
  };
}

export type ProfitOutlook = Awaited<ReturnType<typeof loadProfitOutlook>>;

export function ProfitCalculationDetail({ year, o }: { year: number; o: ProfitOutlook }) {
  return (
    <div className="space-y-1 text-sm text-slate-700">
      <p>
        <span className="font-semibold">{year}년 하반기 매출-매입</span>
        {" — 매출 "}
        <span className="tabular-nums font-semibold">{formatWon(o.h2Sales)}</span>
        {" − 매입 "}
        <span className="tabular-nums font-semibold">{formatWon(o.h2Purchase)}</span>
        {" = "}
        <span className={`tabular-nums font-semibold ${moneyClass(o.h2Profit)}`}>{formatWon(o.h2Profit)}</span>
        {" (7~12월 세금계산서 기준·외상 미정산 포함, 공급가액, 일반경비 포함)"}
      </p>
      <p>
        <span className="font-semibold">{year}년 세금계산서 미발행분 예상 이익</span>
        {" — "}
        <span className={`tabular-nums font-semibold ${moneyClass(o.unbilledPendingProfit)}`}>
          {formatWon(o.unbilledPendingProfit)}
        </span>
        {` (수금 대기·공사 완료·진행중 ${o.unbilledProjectNames.length}건)`}
        {o.h1BilledSales > 0 && (
          <span className="text-slate-500">
            {" — 상반기에 이미 발행한 기성금 "}
            <span className="tabular-nums">{formatWon(o.h1BilledSales)}</span>
            {"은 상반기 확정 이익에 포함되어 차감"}
          </span>
        )}
      </p>
      {o.unbilledProjectNames.length > 0 && (
        <p className="pl-4 text-xs text-slate-500">{o.unbilledProjectNames.join(", ")}</p>
      )}
      <p>
        <span className="font-semibold">{year}년 하반기 직원급여/상여/4대보험</span>
        {" — "}
        <span className="tabular-nums font-semibold">{formatWon(o.h2PayrollCost)}</span>
      </p>
      <p className="text-slate-500">
        하반기 예상 이익 = 하반기 매출-매입 + 세금계산서 미발행분 예상 이익 − 하반기 인건비
        <br />
        연간 예상 이익 = 상반기 확정 이익 + 하반기 예상 이익
      </p>

      <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">산출 방식 안내</p>
        <p>
          하반기(7~12월) 원장에는 두 종류의 프로젝트가 섞여 있습니다.
          <br />
          (가) 세금계산서를 모두 발행하고 마감된 프로젝트 — 매출·매입이 모두 원장에 반영되어 있어 원장
          합계만으로 손익이 산출됩니다.
          <br />
          (나) 수금 대기·공사 완료·진행중(발주액 등록) 프로젝트 — 자재비·인건비 등 매입은 이미 원장에
          반영되었으나, 세금계산서(매출)는 아직 발행 전이어서 매출이 누락되어 있습니다.
          <br />
          검토중 프로젝트의 발주액은 반영하지 않음(이미 지출한 매입은 반영) · 귀속 연도가 그 해인 프로젝트만 대상(다음
          해에 세금계산서를 발행할 프로젝트는 귀속 연도를 다음 해로 변경) · 외상 미정산 거래도 세금계산서 기준으로 반영
        </p>
        <p>
          (나)를 원장 그대로 &quot;하반기 매출-매입&quot;에 합산하면 매입만 반영되고 매출은 누락된 불완전한
          수치가 섞여 전체 손익이 왜곡됩니다. 따라서 (나)에 해당하는 거래는 &quot;하반기 매출-매입&quot;
          계산에서 제외하고, 대신 &quot;세금계산서 미발행분 예상 이익&quot;에서 &quot;발주액 − 하반기
          매입 − 대행구매액&quot;으로 별도 추정합니다. 이 방식으로 (나) 프로젝트의 매입은 어느 한쪽에서
          정확히 한 번만 반영됩니다.
        </p>
        <p>
          (나) 프로젝트에 상반기(1~6월)에 이미 발행한 기성금이 있으면, 해당 매출은 상반기 확정 이익(세무사
          결산)에 포함되어 있으므로 발주액에서 차감한 잔액만 하반기분으로 반영합니다. 예: 발주액 5,000만원 중
          5월에 기성금 2,000만원을 발행했다면 하반기에는 3,000만원만 반영합니다.
        </p>
        <p className="font-semibold text-slate-900">산출 예시</p>
        <p>
          하반기 전체 매출 8,000만원, 전체 매입 1억 2,000만원(그중 (나) 프로젝트 매입 5,000만원)인
          경우:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            하반기 매출-매입 = 8,000만원 − (1억 2,000만원 − 5,000만원) = 8,000만원 − 7,000만원 ={" "}
            <span className="font-semibold">1,000만원</span> ((나) 매입 5,000만원 제외)
          </li>
          <li>
            (나) 프로젝트 발주액 합계 9,000만원, 하반기 매입 5,000만원(위에서 제외한 금액과 동일), 대행구매
            500만원인 경우 → 세금계산서 미발행분 예상 이익 = 9,000만원 − 5,000만원 − 500만원 ={" "}
            <span className="font-semibold">3,500만원</span>
          </li>
          <li>여기서 (나)의 매입 5,000만원은 위 두 항목 중 한쪽에서만 한 번 차감되었습니다.</li>
        </ul>
        <p>
          상반기 확정 이익 3,000만원, 하반기 인건비 800만원까지 반영하면:
          <br />
          연간 예상 이익 = 3,000만원 + 1,000만원 + 3,500만원 − 800만원 ={" "}
          <span className="font-semibold">6,700만원</span>
        </p>
        <p className="text-slate-500">
          참고로 (나)를 제외하지 않고 &quot;하반기 매출-매입&quot;을 원장 그대로 합산한 뒤 &quot;세금계산서
          미발행분 예상 이익&quot;을 더하면, (나) 프로젝트의 매입 5,000만원이 두 번(①하반기 매출-매입,
          ②미발행분 예상 이익 계산) 차감되어 실제보다 5,000만원 적게 산출됩니다.
        </p>
      </div>
    </div>
  );
}
