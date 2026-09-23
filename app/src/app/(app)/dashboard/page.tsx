import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate, moneyClass } from "@/lib/format";
import { remainingBalance, isLedgerVisible } from "@/lib/credit";
import type { ExpenseCategory, Transaction } from "@/lib/types";
import { vatOf, salesSupplyOf, purchaseCostOf } from "@/lib/vatBasis";
import { taxEstimate } from "@/lib/tax";
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
import { nowKst } from "@/lib/kstDate";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";

const EXPECTED_RECEIVABLE_STATUSES = [
  { value: "ongoing", label: "진행중" },
  { value: "done", label: "공사 완료" },
  { value: PROJECT_STATUS_AWAITING_PAYMENT, label: "수금 대기" },
];

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("font-mono", moneyClass(value), className)}>{formatWon(value)}</span>;
}

function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-bold text-slate-900">{children}</h2>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  );
}

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
    <div className={cx("rounded-xl p-4", emphasis ? "bg-slate-900 text-white" : "bg-slate-50")}>
      <p className={cx("text-xs", emphasis ? "text-slate-300" : "text-slate-500")}>{label}</p>
      <p className={cx("mt-1 text-xl font-bold", emphasis ? "text-white" : "text-slate-900")}>{children}</p>
      {sub && <div className={cx("mt-1 text-xs", emphasis ? "text-slate-300" : "text-slate-500")}>{sub}</div>}
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
    { data: yearProjects },
    o,
    { data: categoryRows },
    { data: receivableProjects },
  ] = await Promise.all([
    supabase.from("transactions").select("*").gte("trans_date", monthStart).lte("trans_date", monthEnd),
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
      category_id: string | null;
      sales_amount: number;
      sales_vat: number;
      purchase_amount: number;
      purchase_vat: number;
    }>((from, to) =>
      supabase
        .from("transactions")
        .select("id, type, payment_type, trans_date, category_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
        .gte("trans_date", `${selectedYear}-01-01`)
        .lte("trans_date", `${selectedYear}-12-31`)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
    supabase.from("projects").select("contract_amount").eq("year", selectedYear),
    loadProfitOutlook(selectedYear, creditPaymentsPromise),
    // select("*") — 불공제 칸(082 마이그레이션) 실행 전에도 조회가 깨지지 않게.
    supabase.from("expense_categories").select("*"),
    supabase
      .from("projects")
      .select("id, status, quote_amount")
      .eq("year", selectedYear)
      .in("status", EXPECTED_RECEIVABLE_STATUSES.map((s) => s.value)),
  ]);

  const receivableProjectIds = (receivableProjects ?? []).map((p) => p.id);
  const receivableAgencyRows = receivableProjectIds.length
    ? await fetchAllRows<{ project_id: string; amount: number }>((from, to) =>
        supabase
          .from("project_agency_purchases")
          .select("project_id, amount")
          .in("project_id", receivableProjectIds)
          .order("id", { ascending: true })
          .range(from, to)
      )
    : [];
  const agencyByReceivableProject = new Map<string, number>();
  for (const a of receivableAgencyRows) {
    agencyByReceivableProject.set(a.project_id, (agencyByReceivableProject.get(a.project_id) ?? 0) + Number(a.amount));
  }

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

  // 예상 미수액 — 아직 돈을 다 받지 않은 프로젝트(진행중·공사 완료·완료 수금대기)의 받을 금액.
  // 프로젝트 목록의 "수주예상액"과 같은 기준: 발주액 − 대행구매액.
  const expectedReceivableByStatus = EXPECTED_RECEIVABLE_STATUSES.map(({ value, label }) => {
    const rows = (receivableProjects ?? []).filter((p) => p.status === value);
    return {
      label,
      count: rows.length,
      amount: rows.reduce((s, p) => s + (p.quote_amount ?? 0) - (agencyByReceivableProject.get(p.id) ?? 0), 0),
    };
  });
  const expectedReceivable = expectedReceivableByStatus.reduce((s, r) => s + r.amount, 0);
  // "공사 완료 · 수금 대기" 칸도 같은 수주예상액 기준 — 두 칸의 수금 대기 금액이 항상 같게.
  const awaitingPayment = expectedReceivableByStatus[EXPECTED_RECEIVABLE_STATUSES.findIndex((st) => st.value === PROJECT_STATUS_AWAITING_PAYMENT)];

  // 선택 연도 전체 프로젝트 수주액 합계 — 프로젝트 페이지 하단 "수주액" 합계와 같은 값.
  const totalExpectedRevenue = (yearProjects ?? []).reduce((s, p) => s + (p.contract_amount ?? 0), 0);

  // 부가세는 세금계산서(거래일) 기준이라 외상 미정산 건도 포함한다. 금액은 총액(부가세 포함)에서
  // 계산(lib/vatBasis.ts)하고, 매입세액 불공제 카테고리(승용차 등)는 공제 대상에서 빼서 따로 표시.
  const categoryById = new Map(((categoryRows ?? []) as ExpenseCategory[]).map((c) => [c.id, c]));
  const categoryRel = (categoryId: string | null) => (categoryId ? categoryById.get(categoryId) ?? null : null);

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

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
          <p className="mt-0.5 font-mono text-xs text-slate-400">
            {today.year}.{mm}.{String(today.day).padStart(2, "0")} 기준
          </p>
        </div>
        <YearFilter basePath="/dashboard" years={years} selectedYear={selectedYear} />
      </div>

      {/* ① 올해 번 돈과 세금 */}
      <Card>
        <SectionTitle note="개인사업자 종합소득세 기준 · 지방소득세 10% 포함 · 공제 미반영(참고용)">
          ① {selectedYear}년 이익과 세금
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="상반기 확정 이익금 (세무사 결산)"
            sub={<HalfYearSettlementInput key={selectedYear} year={selectedYear} initialAmount={o.half1Profit} />}
          >
            {o.half1Profit != null ? <Money value={o.half1Profit} /> : <span className="text-base text-slate-400">미입력</span>}
          </Stat>
          <Stat label="하반기 예상 이익금 (7~12월)" sub="장부 + 세금계산서 미발행분 − 인건비">
            <Money value={o.h2EstimatedProfit} />
          </Stat>
          <Stat label="연간 합계 예상 이익금">
            {o.combinedProfit != null ? (
              <Money value={o.combinedProfit} />
            ) : (
              <span className="text-base text-slate-400">상반기 입력 필요</span>
            )}
          </Stat>
          <Stat
            label="예상 세액"
            emphasis
            sub={o.combinedTax ? `세율 ${o.combinedTax.ratePct}% 구간` : "상반기 확정 이익금을 입력하면 계산됩니다"}
          >
            {o.combinedTax ? <Money value={o.combinedTax.totalTax} className="text-white" /> : "-"}
          </Stat>
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
          <DetailToggle label="계산 과정 보기">
            <ProfitCalculationDetail year={selectedYear} o={o} />
          </DetailToggle>
          <p className="text-xs text-slate-500">
            참고: 장부 매출−매입(부가세 제외)만으로 보면 {formatWon(ledgerTax.taxBase)} 기준, 세율 {ledgerTax.ratePct}%,
            예상 세액 약 {formatWon(ledgerTax.totalTax)}
          </p>
        </div>
      </Card>

      {/* ② 받을 돈 · 줄 돈 */}
      <Card>
        <SectionTitle note="외상은 정산 등록 전까지 매입매출장 합계에서 빠져 있음">② 받을 돈 · 줄 돈</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/projects" className="rounded-xl transition hover:ring-2 hover:ring-slate-200">
            <Stat
              label="예상 미수액 (수주예상액 기준 · 진행중·공사 완료·수금 대기)"
              emphasis
              sub={
                <ul className="space-y-0.5">
                  {expectedReceivableByStatus.map((r) => (
                    <li key={r.label} className="flex justify-between gap-2">
                      <span>
                        {r.label} {r.count}건
                      </span>
                      <span className="font-mono">{formatWon(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              }
            >
              <Money value={expectedReceivable} className="text-white" />
            </Stat>
          </Link>
          <Link href="/projects" className="rounded-xl transition hover:ring-2 hover:ring-slate-200">
            <Stat label="공사 완료 · 수금 대기" sub={`${selectedYear}년 프로젝트 ${awaitingPayment.count}건 · 수주예상액 기준`}>
              <Money value={awaitingPayment.amount} />
            </Stat>
          </Link>
          <Link href="/transactions?tab=credit" className="rounded-xl transition hover:ring-2 hover:ring-slate-200">
            <Stat label="외상 매출 미수금 (받을 돈)" sub={`세금계산서 발행 후 입금 대기 ${creditReceivableCount}건`}>
              <Money value={creditReceivable} />
            </Stat>
          </Link>
          <Link href="/transactions?tab=credit" className="rounded-xl transition hover:ring-2 hover:ring-slate-200">
            <Stat label="외상 매입 미지급금 (줄 돈)" sub={`미정산 ${creditPayableCount}건`}>
              <Money value={creditPayable} className="text-slate-600" />
            </Stat>
          </Link>
        </div>
      </Card>

      {/* ③ 진행 중 예상 이익금 */}
      {o.hasProjectsWithProfit && (
        <Card>
          <SectionTitle note="추가 지출이 생기면 실시간으로 바뀜">③ {selectedYear}년 예상 이익금 (진행 중 포함)</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat label="예상 이익금" sub="프로젝트 총이익금 − 일반경비 − 직원급여/상여/4대보험">
              <Money value={o.profitEstimate} />
            </Stat>
            <Stat label="이 기준 예상 세액" sub={`세율 ${o.profitTax.ratePct}% 구간`}>
              <Money value={o.profitTax.totalTax} />
            </Stat>
          </div>
          {o.hasIncompleteProjects && (
            <p className="mt-2 text-xs font-semibold text-red-600">
              진행 중인 프로젝트가 있어 추가 매입/매출이 생길 수 있습니다.
            </p>
          )}
        </Card>
      )}

      {/* ④ 부가세 */}
      <Card>
        <SectionTitle note="총액(부가세 포함)에서 계산 · 인건비 등 비과세 제외 · 외상 미정산 건 포함(세금계산서 기준)">
          ④ {selectedYear}년 부가세 (분기별)
        </SectionTitle>
        <VatQuarterTable rows={vatQuarters} total={vatTotal} />
        <p className="mt-2 text-xs text-slate-400">
          불공제 매입세액은 지출카테고리에서 &quot;매입세액 불공제&quot;로 체크한 카테고리(승용차 렌트·유류비 등) 몫으로, 납부
          예상에서 빼주지 않습니다. 부가세 신고는 반기(1~6월, 7~12월) 기준이며, 실제 신고 금액은 세무사 확인 후 확정됩니다.
        </p>
      </Card>

      {/* 참고 현황 */}
      <Card>
        <SectionTitle note="매입매출장 기준 · 부가세 포함 금액">참고 현황</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`${selectedYear}년 매출액`}>
            <Money value={yearSales} />
          </Stat>
          <Stat label={`${selectedYear}년 매입액`}>
            <Money value={yearPurchase} />
          </Stat>
          <Stat label={`${selectedYear}년 매출−매입`}>
            <Money value={yearProfit} />
          </Stat>
          <Stat label={`${selectedYear}년 총 예상 매출 (수주액)`}>
            <Money value={totalExpectedRevenue} />
          </Stat>
          <Stat label={`이번 달(${today.month}월) 매출`}>
            <Money value={monthSales} />
          </Stat>
          <Stat label={`이번 달(${today.month}월) 매입`}>
            <Money value={monthPurchase} />
          </Stat>
          <Link href="/projects" className="rounded-xl transition hover:ring-2 hover:ring-slate-200">
            <Stat label="진행 중 프로젝트">{ongoingProjects?.length ?? 0}건</Stat>
          </Link>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">최근 거래</h2>
          <Link href="/transactions" className="text-sm text-slate-500 transition-colors hover:text-slate-800">
            전체보기
          </Link>
        </div>
        <div className="mt-4">
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
