import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate, moneyClass } from "@/lib/format";
import { remainingBalance, isLedgerVisible } from "@/lib/credit";
import type { ExpenseCategory, Transaction } from "@/lib/types";
import { vatOf, salesSupplyOf, purchaseCostOf } from "@/lib/vatBasis";
import { taxEstimate, incomeTaxInstallment, interimPrepayment } from "@/lib/tax";
import {
  estimateOwnerInsurance,
  ownerHealthSettlement,
  ownerPensionBackPay,
  OWNER_INSURANCE_RATES,
} from "@/lib/ownerSocialInsurance";
import { loadProfitOutlook, ProfitCalculationDetail } from "@/components/sections/ProfitOutlook";
import { HalfYearSettlementInput } from "@/components/sections/HalfYearSettlementInput";
import { DetailToggle } from "@/components/DetailToggle";
import { VatQuarterTable } from "@/components/VatQuarterTable";
import { YearFilter } from "@/components/YearFilter";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { cx } from "@/lib/cx";
import { fetchAllRows, fetchAllCreditPayments } from "@/lib/supabaseFetchAll";
import { receivedSalesByProject, remainingReceivable } from "@/lib/expectedReceivable";
import { nowKst } from "@/lib/kstDate";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";

const EXPECTED_RECEIVABLE_STATUSES = [
  { value: "ongoing", label: "진행중" },
  { value: "done", label: "공사 완료" },
  { value: PROJECT_STATUS_AWAITING_PAYMENT, label: "수금 대기" },
];

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("tabular-nums", moneyClass(value), className)}>{formatWon(value)}</span>;
}

// 스크롤을 줄이려고 칸·글씨를 작게 — 설명은 칸 안이 아니라 칸 아래 Footnote로.
const CARD_PAD = "p-3 sm:p-4";

function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
      <h2 className="text-sm font-bold text-slate-900">{children}</h2>
      {note && <p className="text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

function Footnote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mt-1.5 space-y-0.5 text-[11px] leading-snug text-slate-400", className)}>{children}</div>;
}

// emphasis: 중요한 숫자 — 로고 포인트 녹색을 옅게 채운 칸.
function Stat({
  label,
  children,
  sub,
  emphasis,
}: {
  label: ReactNode;
  children: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "h-full rounded-lg px-3 py-2",
        emphasis ? "bg-brand-green/10 ring-1 ring-inset ring-brand-green/25" : "bg-slate-50"
      )}
    >
      <p className={cx("text-[11px] leading-tight", emphasis ? "font-medium text-emerald-800" : "text-slate-500")}>{label}</p>
      <p className={cx("mt-0.5 whitespace-nowrap text-sm font-bold sm:text-base", emphasis ? "text-emerald-900" : "text-slate-900")}>
        {children}
      </p>
      {sub && <div className={cx("mt-0.5 text-[11px] leading-tight", emphasis ? "text-emerald-700" : "text-slate-500")}>{sub}</div>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const supabase = await createClient();
  const today = nowKst();
  const currentYear = today.year;
  const selectedYear = year ? Number(year) : currentYear;
  const mm = String(today.month).padStart(2, "0");
  const monthStart = `${currentYear}-${mm}-01`;
  const monthEnd = `${currentYear}-${mm}-${String(new Date(currentYear, today.month, 0).getDate()).padStart(2, "0")}`;

  // 외상 정산 이력은 한 번만 받아서 이 페이지와 이익 예상 계산(loadProfitOutlook)이 같이 쓴다.
  const creditPaymentsPromise = fetchAllCreditPayments(supabase);

  const [
    { data: monthTxRaw },
    creditTx,
    payments,
    { data: ongoingProjects },
    { data: recentTxRaw },
    yearTxRaw,
    { data: firstTx },
    { data: yearProjectRows },
    { data: categoryRows },
    { data: employeeRows },
  ] = await Promise.all([
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("trans_date", monthStart)
        .lte("trans_date", monthEnd)
        .order("id", { ascending: true })
        .range(from, to)
    ).then((data) => ({ data })),
    fetchAllRows<Transaction>((from, to) =>
      supabase.from("transactions").select("*").eq("payment_type", "credit").order("id", { ascending: true }).range(from, to)
    ),
    creditPaymentsPromise,
    supabase.from("projects").select("id, status").eq("status", "ongoing"),
    supabase
      .from("transactions")
      .select("*, clients(name), projects(name)")
      .order("trans_date", { ascending: false })
      .limit(20),
    fetchAllRows<{
      id: string;
      type: string;
      payment_type: string;
      trans_date: string;
      project_id: string | null;
      category_id: string | null;
      sales_amount: number;
      sales_vat: number;
      purchase_amount: number;
      purchase_vat: number;
    }>((from, to) =>
      supabase
        .from("transactions")
        .select("id, type, payment_type, trans_date, project_id, category_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
        .gte("trans_date", `${selectedYear}-01-01`)
        .lte("trans_date", `${selectedYear}-12-31`)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
    // 선택 연도 프로젝트 — 예상 미수액·총 예상 매출·이익 예상(loadProfitOutlook)이 같이 쓴다.
    supabase.from("projects").select("id, name, status, quote_amount").eq("year", selectedYear),
    // select("*") — 불공제·비과세 칸(082·083 마이그레이션) 실행 전에도 조회가 깨지지 않게.
    supabase.from("expense_categories").select("*"),
    // 대표자 건강보험(사업 첫해) = 최고 급여 직원 기준 — 직원 공제액(본인 절반)의 2배. 조회 전용 계정은
    // 직원 정보를 못 읽어서 null → 정산 추정 칸에 안내만 표시.
    supabase.from("employees").select("health_insurance, long_term_care_insurance, resigned_date"),
  ]);
  const yearProjects = yearProjectRows ?? [];
  const categoryById = new Map(((categoryRows ?? []) as ExpenseCategory[]).map((c) => [c.id, c]));
  const categoryRel = (categoryId: string | null) => (categoryId ? categoryById.get(categoryId) ?? null : null);

  const receivableStatuses = new Set(EXPECTED_RECEIVABLE_STATUSES.map((st) => st.value));
  const receivableProjects = yearProjects.filter((p) => receivableStatuses.has(p.status ?? ""));
  const receivableProjectIds = receivableProjects.map((p) => p.id);
  const [o, receivableAgencyRows, receivableSalesRows] = await Promise.all([
    loadProfitOutlook(selectedYear, {
      payments,
      yearProjects,
      yearTx: yearTxRaw.map((t) => ({ ...t, expense_categories: categoryRel(t.category_id) })),
    }),
    receivableProjectIds.length
      ? fetchAllRows<{ project_id: string; amount: number }>((from, to) =>
          supabase
            .from("project_agency_purchases")
            .select("project_id, amount")
            .in("project_id", receivableProjectIds)
            .order("id", { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    // 기성금 등 이미 받은 매출 — 연도와 상관없이 그 프로젝트로 등록된 매출 전부.
    receivableProjectIds.length
      ? fetchAllRows<{
          id: string;
          type: string;
          payment_type: string;
          project_id: string;
          category_id: string | null;
          sales_amount: number;
          sales_vat: number;
          purchase_amount: number;
          purchase_vat: number;
        }>((from, to) =>
          supabase
            .from("transactions")
            .select("id, type, payment_type, project_id, category_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
            .eq("type", "매출")
            .in("project_id", receivableProjectIds)
            .order("id", { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
  ]);
  const agencyByReceivableProject = new Map<string, number>();
  for (const a of receivableAgencyRows) {
    agencyByReceivableProject.set(a.project_id, (agencyByReceivableProject.get(a.project_id) ?? 0) + Number(a.amount));
  }
  const receivedByProject = receivedSalesByProject(
    receivableSalesRows.map((t) => ({ ...t, expense_categories: categoryRel(t.category_id) })),
    payments
  );

  const monthTx = (monthTxRaw ?? []).filter((t) => isLedgerVisible(t as Transaction, payments));
  const recentTx = (recentTxRaw ?? []).filter((t) => isLedgerVisible(t as Transaction, payments)).slice(0, 8);
  const yearTx = yearTxRaw.filter((t) => isLedgerVisible(t, payments));

  const monthPurchase = monthTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const monthSales = monthTx.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);

  // 받을 돈(외상 매출)과 줄 돈(외상 매입)은 반드시 따로 — 예전엔 둘을 더한 한 숫자로 보여줬음.
  const creditReceivable = creditTx.filter((t) => t.type === "매출").reduce((s, t) => s + remainingBalance(t, payments), 0);
  const creditPayable = creditTx.filter((t) => t.type === "매입").reduce((s, t) => s + remainingBalance(t, payments), 0);
  const creditReceivableCount = creditTx.filter((t) => t.type === "매출" && remainingBalance(t, payments) > 0).length;
  const creditPayableCount = creditTx.filter((t) => t.type === "매입" && remainingBalance(t, payments) > 0).length;

  const yearSales = yearTx.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
  const yearPurchase = yearTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const yearProfit = yearSales - yearPurchase;

  // 예상 미수액 — 아직 돈을 다 받지 않은 프로젝트(진행중·공사 완료·완료 수금대기)의 남은 받을 금액.
  // 프로젝트 목록의 "수주예상액"(발주액 − 대행구매액)에서 이미 받은 매출(기성금 등)을 뺀다
  // (계산은 lib/expectedReceivable.ts — 자동 검사 있음).
  const expectedReceivableByStatus = EXPECTED_RECEIVABLE_STATUSES.map(({ value, label }) => {
    const rows = receivableProjects.filter((p) => p.status === value);
    return {
      label,
      count: rows.length,
      amount: rows.reduce(
        (s, p) =>
          s +
          remainingReceivable(p.quote_amount, agencyByReceivableProject.get(p.id) ?? 0, receivedByProject.get(p.id) ?? 0),
        0
      ),
    };
  });
  const expectedReceivable = expectedReceivableByStatus.reduce((s, r) => s + r.amount, 0);
  const receivedSalesTotal = receivableProjects.reduce((s, p) => s + (receivedByProject.get(p.id) ?? 0), 0);
  // "공사 완료 · 수금 대기" 칸도 같은 기준 — 두 칸의 수금 대기 금액이 항상 같게.
  const awaitingPayment = expectedReceivableByStatus[EXPECTED_RECEIVABLE_STATUSES.findIndex((st) => st.value === PROJECT_STATUS_AWAITING_PAYMENT)];

  // 부가세는 세금계산서(거래일) 기준이라 외상 미정산 건도 포함한다. 금액은 총액(부가세 포함)에서
  // 계산(lib/vatBasis.ts)하고, 매입세액 불공제 카테고리(승용차 등)는 공제 대상에서 빼서 따로 표시.
  // 참고: 장부 매출−매입(부가세 제외, 불공제 부가세는 비용) 기준 연간 예상 세금 — 위에서 받은
  // 연간 거래(외상 미정산 제외)로 바로 계산해서 같은 거래를 다시 조회하지 않는다.
  const ledgerTax = taxEstimate(
    yearTx.reduce((s, t) => {
      const row = { ...t, expense_categories: categoryRel(t.category_id) };
      return s + salesSupplyOf(row) - purchaseCostOf(row);
    }, 0)
  );

  const vatQuarters = [1, 2, 3, 4].map((q) => {
    let salesVat = 0;
    let purchaseVat = 0;
    let nonDeductibleVat = 0;
    for (const t of yearTxRaw) {
      if (Math.ceil(Number(t.trans_date.slice(5, 7)) / 3) !== q) continue;
      const cat = categoryRel(t.category_id);
      const vat = vatOf({ ...t, expense_categories: cat });
      if (t.type === "매출") salesVat += vat;
      else if (cat?.vat_non_deductible) nonDeductibleVat += vat;
      else purchaseVat += vat;
    }
    return { q, salesVat, purchaseVat, nonDeductibleVat, net: salesVat - purchaseVat };
  });
  const vatTotal = vatQuarters.reduce(
    (acc, v) => ({
      salesVat: acc.salesVat + v.salesVat,
      purchaseVat: acc.purchaseVat + v.purchaseVat,
      nonDeductibleVat: acc.nonDeductibleVat + v.nonDeductibleVat,
      net: acc.net + v.net,
    }),
    { salesVat: 0, purchaseVat: 0, nonDeductibleVat: 0, net: 0 }
  );

  // 내년 대표자 국민연금·건강보험 — 연간 합계 예상 이익금(상반기 미입력이면 프로젝트 기준) 기준.
  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  // 사업 첫해: 첫 거래가 있는 해. 그해 사업 기간은 첫 거래 달부터 12월까지.
  const isFirstBusinessYear = selectedYear === firstYear;
  const businessStartMonth = isFirstBusinessYear && firstTx?.[0] ? Number(firstTx[0].trans_date.slice(5, 7)) : 1;
  const businessMonths = 12 - businessStartMonth + 1;

  const insuranceBaseProfit = o.combinedProfit ?? o.profitEstimate;
  const ownerInsurance = estimateOwnerInsurance(insuranceBaseProfit, businessMonths);
  const ofProfit = (yearly: number) =>
    insuranceBaseProfit > 0 ? ` · 이익의 ${((yearly / insuranceBaseProfit) * 100).toFixed(1)}%` : "";

  // 사업 첫해라 이듬해에 몰리는 돈 (첫해는 중간예납이 없어 올해 소득세 전액이 이듬해 5월, 11월엔 중간예납 시작).
  const nextYearTax = o.combinedTax ?? o.profitTax;
  const activeEmployees = (employeeRows ?? []).filter(
    (e) => !e.resigned_date || e.resigned_date > `${today.year}-${mm}-${String(today.day).padStart(2, "0")}`
  );
  const ownerHealthPaidMonthly = activeEmployees.length
    ? 2 * Math.max(...activeEmployees.map((e) => Number(e.health_insurance) + Number(e.long_term_care_insurance)))
    : null;
  const cashOut = {
    vat2: vatQuarters[2].net + vatQuarters[3].net,
    mayTax: nextYearTax.totalTax,
    installment: incomeTaxInstallment(nextYearTax.incomeTax),
    healthSettlement:
      ownerHealthPaidMonthly != null
        ? ownerHealthSettlement(insuranceBaseProfit, businessMonths, ownerHealthPaidMonthly)
        : null,
    interim: interimPrepayment(nextYearTax.incomeTax),
    pensionBackPay: ownerPensionBackPay(insuranceBaseProfit, businessMonths),
  };
  const cashOutTotal =
    cashOut.vat2 + cashOut.mayTax + Math.max(cashOut.healthSettlement ?? 0, 0) + cashOut.interim;
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-slate-900">대시보드</h1>
          <p className="tabular-nums text-xs text-slate-400">
            {today.year}.{mm}.{String(today.day).padStart(2, "0")} 기준
          </p>
        </div>
        <YearFilter basePath="/dashboard" years={years} selectedYear={selectedYear} />
      </div>

      {/* ① 올해 이익과 세금 (+ 진행 중 포함 프로젝트 기준) */}
      <Card padding="none" className={CARD_PAD}>
        <SectionTitle note="개인사업자 종합소득세 기준 · 지방소득세 10% 포함 · 공제 미반영(참고용)">
          ① {selectedYear}년 이익과 세금
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat
            label="상반기 확정 이익금 (세무사 결산)"
            sub={<HalfYearSettlementInput key={selectedYear} year={selectedYear} initialAmount={o.half1Profit} />}
          >
            {o.half1Profit != null ? <Money value={o.half1Profit} /> : <span className="text-sm text-slate-400">미입력</span>}
          </Stat>
          <Stat label="하반기 예상 이익금 (7~12월)">
            <Money value={o.h2EstimatedProfit} />
          </Stat>
          <Stat label="연간 합계 예상 이익금" emphasis>
            {o.combinedProfit != null ? (
              <Money value={o.combinedProfit} />
            ) : (
              <span className="text-sm text-slate-400">상반기 입력 필요</span>
            )}
          </Stat>
          <Stat label="예상 세액" emphasis sub={o.combinedTax ? `세율 ${o.combinedTax.ratePct}% 구간` : "상반기 입력 필요"}>
            {o.combinedTax ? <Money value={o.combinedTax.totalTax} /> : "-"}
          </Stat>
          {o.hasProjectsWithProfit && (
            <>
              <Stat label="프로젝트 기준 이익금 (진행 중 포함)">
                <Money value={o.profitEstimate} />
              </Stat>
              <Stat label="프로젝트 기준 예상 세액" sub={`세율 ${o.profitTax.ratePct}% 구간`}>
                <Money value={o.profitTax.totalTax} />
              </Stat>
            </>
          )}
          <Stat
            label={`${selectedYear + 1}년 국민연금 (대표자, 월)`}
            sub={`연 ${formatWon(ownerInsurance.pensionYearly)}${ofProfit(ownerInsurance.pensionYearly)}`}
          >
            <Money value={ownerInsurance.pensionMonthly} />
          </Stat>
          <Stat
            label={`${selectedYear + 1}년 건강보험 (대표자, 월)`}
            sub={`연 ${formatWon(ownerInsurance.healthYearly)}${ofProfit(ownerInsurance.healthYearly)} · 장기요양 포함`}
          >
            <Money value={ownerInsurance.healthMonthly} />
          </Stat>
        </div>
        {isFirstBusinessYear && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <SectionTitle note={`국민연금 제외 합계 약 ${formatWon(cashOutTotal)} · 첫해는 중간예납이 없어 이듬해에 몰림`}>
              사업 첫해라 {selectedYear + 1}년에 몰리는 돈
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Stat label="1월 · 부가세 2기 확정 (7~12월)" sub="4분기 진행 중이라 늘어날 수 있음">
                <Money value={cashOut.vat2} />
              </Stat>
              <Stat
                label={`5월 · ${selectedYear}년 종합소득세+지방소득세`}
                emphasis
                sub={cashOut.installment > 0 ? `7월 말까지 분납 가능 ${formatWon(cashOut.installment)}` : undefined}
              >
                <Money value={cashOut.mayTax} />
              </Stat>
              <Stat
                label="7월~ · 대표자 건강보험 정산"
                sub={
                  ownerHealthPaidMonthly != null
                    ? `올해 월 ${formatWon(ownerHealthPaidMonthly)}씩 낸 것 제외 · 분할납부 가능`
                    : "직원 급여 정보를 볼 수 있는 계정에서 계산됨"
                }
              >
                {cashOut.healthSettlement != null ? <Money value={cashOut.healthSettlement} /> : "-"}
              </Stat>
              <Stat label={`11월 · ${selectedYear + 1}년 중간예납`} sub={`${selectedYear}년 소득세의 1/2`}>
                <Money value={cashOut.interim} />
              </Stat>
              <Stat label="국민연금 (대표자) · 확인 필요" sub="가입 누락이면 올해분 소급 가능 · 10회 분할">
                <Money value={cashOut.pensionBackPay} />
              </Stat>
            </div>
          </div>
        )}
        <Footnote>
          <p>
            하반기 예상 = 장부 + 세금계산서 미발행분 − 인건비 · 연간 합계 = 상반기 확정 + 하반기 예상
            {o.hasProjectsWithProfit &&
              " · 프로젝트 기준 = 프로젝트 총이익금(발주액 없는 프로젝트 비용 포함) − 일반경비 − 직원급여/상여/4대보험 (추가 지출이 생기면 실시간으로 바뀜)"}
          </p>
          <p>
            참고: 장부 매출−매입(부가세 제외)만으로 보면 {formatWon(ledgerTax.taxBase)} 기준, 세율 {ledgerTax.ratePct}%, 예상
            세액 약 {formatWon(ledgerTax.totalTax)}
          </p>
          <p>
            {selectedYear + 1}년 국민연금·건강보험 = {o.combinedProfit != null ? "연간 합계" : "프로젝트 기준"} 예상
            이익금으로 추정한 대표자 본인 부담(올해 이익이 내년 5월 종합소득세 신고 후 반영) · 국민연금{" "}
            {OWNER_INSURANCE_RATES.pensionRate * 100}%, 기준소득월액 상한 {formatWon(OWNER_INSURANCE_RATES.pensionMonthlyCap)} ·
            건강보험 {(OWNER_INSURANCE_RATES.healthRate * 100).toFixed(2)}% + 장기요양 건강보험료의{" "}
            {(OWNER_INSURANCE_RATES.longTermCareOfHealth * 100).toFixed(2)}% ({OWNER_INSURANCE_RATES.year}년 요율 기준, 장기요양은
            2026년 요율 — 2027년분 10월 이후 결정) · 직원 4대보험은 제외
          </p>
          {isFirstBusinessYear && (
            <p>
              몰리는 돈: 사업 기간 {businessMonths}개월({businessStartMonth}월 첫 거래부터) 기준 · 건강보험 정산 = 올해 이익 기준
              보험료 − 최고 급여 직원 기준으로 낸 금액(직원 공제액의 2배) · 국민연금은 건강보험과 달리 1년치 정산이 없어, 지금
              안 나가고 있다면 가입 누락 여부를 세무사·국민연금공단(1355)에 확인 · 금액은 세무사 확인 전 추정치
            </p>
          )}
          {o.hasIncompleteProjects && (
            <p className="font-semibold text-red-600">진행 중인 프로젝트가 있어 추가 매입/매출이 생길 수 있습니다.</p>
          )}
          <DetailToggle label="계산 과정 보기">
            <ProfitCalculationDetail year={selectedYear} o={o} />
          </DetailToggle>
        </Footnote>
      </Card>

      {/* ② 받을 돈 · 줄 돈 */}
      <Card padding="none" className={CARD_PAD}>
        <SectionTitle note="외상은 정산 등록 전까지 매입매출장 합계에서 빠져 있음">② 받을 돈 · 줄 돈</SectionTitle>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Link href="/projects" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
            <Stat label="예상 미수액 (진행중·공사 완료·수금 대기)" emphasis>
              <Money value={expectedReceivable} />
            </Stat>
          </Link>
          <Link href="/projects" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
            <Stat label="공사 완료 · 수금 대기" sub={`${awaitingPayment.count}건`}>
              <Money value={awaitingPayment.amount} />
            </Stat>
          </Link>
          <Link href="/transactions?tab=credit" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
            <Stat label="외상 매출 미수금 (받을 돈)" sub={`입금 대기 ${creditReceivableCount}건`}>
              <Money value={creditReceivable} />
            </Stat>
          </Link>
          <Link href="/transactions?tab=credit" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
            <Stat label="외상 매입 미지급금 (줄 돈)" sub={`미정산 ${creditPayableCount}건`}>
              <Money value={creditPayable} className="text-slate-600" />
            </Stat>
          </Link>
        </div>
        <Footnote>
          <p>
            예상 미수액 = 수주예상액 − 받은 기성금 ·{" "}
            {expectedReceivableByStatus.map((r) => `${r.label} ${r.count}건 ${formatWon(r.amount)}`).join(" · ")}
            {receivedSalesTotal > 0 && ` · 받은 기성금(이미 뺌, 부가세 제외) ${formatWon(receivedSalesTotal)}`}
          </p>
          <p>외상 매출 미수금 = 세금계산서 발행 후 입금 대기 · 공사 완료·수금 대기는 받은 기성금 제외</p>
        </Footnote>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        {/* ④ 부가세 */}
        <Card padding="none" className={cx(CARD_PAD, "xl:col-span-3")}>
          <SectionTitle note="총액(부가세 포함)에서 계산 · 비과세 제외 · 외상 미정산 포함(세금계산서 기준)">
            ④ {selectedYear}년 부가세 (분기별)
          </SectionTitle>
          <div className="[&_table]:text-xs [&_td]:py-1 [&_th]:pb-1">
            <VatQuarterTable rows={vatQuarters} total={vatTotal} />
          </div>
          <Footnote>
            <p>
              불공제 매입세액(승용차 렌트·유류비 등 &quot;매입세액 불공제&quot; 카테고리)은 납부 예상에서 빼지 않음 · 신고는
              반기(1~6월, 7~12월) 기준, 실제 금액은 세무사 확인 후 확정
            </p>
          </Footnote>
        </Card>

        {/* 참고 현황 */}
        <Card padding="none" className={cx(CARD_PAD, "xl:col-span-2")}>
          <SectionTitle note="매입매출장 기준 · 부가세 포함">참고 현황</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={`${selectedYear}년 매출액`}>
              <Money value={yearSales} />
            </Stat>
            <Stat label={`${selectedYear}년 매입액`}>
              <Money value={yearPurchase} />
            </Stat>
            <Stat label={`${selectedYear}년 매출−매입`}>
              <Money value={yearProfit} />
            </Stat>
            <Stat label={`${selectedYear}년 총 예상 매출 (발주액 − 대행구매)`}>
              <Money value={o.expectedRevenue} />
            </Stat>
            <Stat label={`이번 달(${today.month}월) 매출`}>
              <Money value={monthSales} />
            </Stat>
            <Stat label={`이번 달(${today.month}월) 매입`}>
              <Money value={monthPurchase} />
            </Stat>
            <Link href="/projects" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
              <Stat label="진행 중 프로젝트">{ongoingProjects?.length ?? 0}건</Stat>
            </Link>
          </div>
        </Card>
      </div>

      <Card padding="none" className={CARD_PAD}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">최근 거래</h2>
          <Link href="/transactions" className="text-xs text-slate-500 transition-colors hover:text-slate-800">
            전체보기
          </Link>
        </div>
        <div className="[&_table]:text-xs [&_td]:py-1 [&_th]:pb-1">
          <Table className="min-w-[600px]">
            <THead>
              <Th className="pr-4">날짜</Th>
              <Th className="pr-4">구분</Th>
              <Th className="pr-4">거래처</Th>
              <Th className="pr-4">프로젝트</Th>
              <Th className="pr-4">품목</Th>
              <Th className="text-right">금액</Th>
            </THead>
            <tbody>
              {recentTx.map((t) => (
                <Tr key={t.id}>
                  <Td className="pr-4">{formatDate(t.trans_date)}</Td>
                  <Td className="pr-4">
                    <Badge variant={t.type === "매출" ? "blue" : "orange"}>{t.type}</Badge>
                  </Td>
                  <Td className="pr-4">{t.clients?.name ?? t.client_name_raw ?? "-"}</Td>
                  <Td className="pr-4">{t.projects?.name ?? "-"}</Td>
                  <Td className="pr-4">{t.item_name ?? "-"}</Td>
                  <Td className="text-right font-medium text-slate-900">
                    {formatWon(t.type === "매출" ? t.sales_amount + t.sales_vat : t.purchase_amount + t.purchase_vat)}
                  </Td>
                </Tr>
              ))}
              {recentTx.length === 0 && <EmptyRow colSpan={6}>거래 내역이 없습니다.</EmptyRow>}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
