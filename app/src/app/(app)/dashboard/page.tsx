import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";
import { remainingBalance, isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";
import { loadLedgerTaxEstimate } from "@/lib/ledgerTaxEstimate";
import { loadProfitOutlook, ProfitCalculationDetail } from "@/components/sections/ProfitOutlook";
import { HalfYearSettlementInput } from "@/components/sections/HalfYearSettlementInput";
import { DetailToggle } from "@/components/DetailToggle";
import { YearFilter } from "@/components/YearFilter";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { cx } from "@/lib/cx";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { nowKst } from "@/lib/kstDate";

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("font-mono", value < 0 && "text-red-600", className)}>{formatWon(value)}</span>;
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

  const [
    { data: monthTxRaw },
    creditTx,
    creditPayments,
    { data: ongoingProjects },
    { data: recentTxRaw },
    yearTxRaw,
    { data: firstTx },
    { data: yearProjects },
    outlook,
    ledgerTax,
  ] = await Promise.all([
    supabase.from("transactions").select("*").gte("trans_date", monthStart).lte("trans_date", monthEnd),
    fetchAllRows<Transaction>((from, to) =>
      supabase.from("transactions").select("*").eq("payment_type", "credit").order("id", { ascending: true }).range(from, to)
    ),
    fetchAllRows<CreditPayment>((from, to) =>
      supabase.from("credit_payments").select("*").order("id", { ascending: true }).range(from, to)
    ),
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
      sales_amount: number;
      sales_vat: number;
      purchase_amount: number;
      purchase_vat: number;
    }>((from, to) =>
      supabase
        .from("transactions")
        .select("id, type, payment_type, trans_date, sales_amount, sales_vat, purchase_amount, purchase_vat")
        .gte("trans_date", `${selectedYear}-01-01`)
        .lte("trans_date", `${selectedYear}-12-31`)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
    supabase.from("projects").select("contract_amount").eq("year", selectedYear),
    loadProfitOutlook(selectedYear),
    loadLedgerTaxEstimate(selectedYear),
  ]);

  const payments = creditPayments;
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

  // 선택 연도 전체 프로젝트 수주액 합계 — 프로젝트 페이지 하단 "수주액" 합계와 같은 값.
  const totalExpectedRevenue = (yearProjects ?? []).reduce((s, p) => s + (p.contract_amount ?? 0), 0);

  // 부가세는 세금계산서(거래일) 기준이라 외상 미정산 건도 포함한다. 장부에 부가세가 따로
  // 기록된 금액(sales_vat/purchase_vat)만 합산.
  const vatQuarters = [1, 2, 3, 4].map((q) => {
    const rows = yearTxRaw.filter((t) => Math.ceil(Number(t.trans_date.slice(5, 7)) / 3) === q);
    const salesVat = rows.reduce((s, t) => s + t.sales_vat, 0);
    const purchaseVat = rows.reduce((s, t) => s + t.purchase_vat, 0);
    return { q, salesVat, purchaseVat, net: salesVat - purchaseVat };
  });
  const vatTotal = vatQuarters.reduce(
    (acc, v) => ({ salesVat: acc.salesVat + v.salesVat, purchaseVat: acc.purchaseVat + v.purchaseVat, net: acc.net + v.net }),
    { salesVat: 0, purchaseVat: 0, net: 0 }
  );

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  const o = outlook;

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
            sub={<HalfYearSettlementInput year={selectedYear} initialAmount={o.half1Profit} />}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/projects" className="rounded-xl transition hover:ring-2 hover:ring-slate-200">
            <Stat label="공사 완료 · 수금 대기" sub={`${selectedYear}년 프로젝트 ${o.pendingCount}건 수주액 합계`}>
              <Money value={o.pendingReceivable} />
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
        <SectionTitle note="장부에 부가세가 따로 기록된 금액만 합산 · 외상 미정산 건 포함(세금계산서 기준)">
          ④ {selectedYear}년 부가세 (분기별)
        </SectionTitle>
        <Table className="min-w-[480px]">
          <THead>
            <Th className="pr-4">분기</Th>
            <Th className="pr-4 text-right">매출세액</Th>
            <Th className="pr-4 text-right">매입세액</Th>
            <Th className="text-right">납부(−환급) 예상</Th>
          </THead>
          <tbody>
            {vatQuarters.map((v) => (
              <Tr key={v.q}>
                <Td className="pr-4">
                  {v.q}분기 <span className="text-xs text-slate-400">({(v.q - 1) * 3 + 1}~{v.q * 3}월)</span>
                </Td>
                <Td className="pr-4 text-right">
                  <Money value={v.salesVat} />
                </Td>
                <Td className="pr-4 text-right">
                  <Money value={v.purchaseVat} />
                </Td>
                <Td className="text-right font-semibold">
                  <Money value={v.net} />
                </Td>
              </Tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="py-2 pr-4">합계</td>
              <td className="py-2 pr-4 text-right">
                <Money value={vatTotal.salesVat} />
              </td>
              <td className="py-2 pr-4 text-right">
                <Money value={vatTotal.purchaseVat} />
              </td>
              <td className="py-2 text-right">
                <Money value={vatTotal.net} />
              </td>
            </tr>
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-slate-400">
          부가세 신고는 반기(1~6월, 7~12월) 기준이며, 실제 신고 금액은 세무사 확인 후 확정됩니다.
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
