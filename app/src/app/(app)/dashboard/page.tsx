import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";
import { remainingBalance, isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";
import { TaxEstimateSection } from "@/components/sections/TaxEstimateSection";
import { PendingPaymentProfitSection } from "@/components/sections/PendingPaymentProfitSection";
import { YearFilter } from "@/components/YearFilter";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { cx } from "@/lib/cx";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const selectedYear = year ? Number(year) : currentYear;
  const monthStart = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: monthTxRaw },
    { data: creditTx },
    { data: creditPayments },
    { data: sites },
    { data: recentTxRaw },
    { data: yearTxRaw },
    { data: firstTx },
    { data: yearProjects },
  ] = await Promise.all([
    supabase.from("transactions").select("*").gte("trans_date", monthStart),
    supabase.from("transactions").select("*").eq("payment_type", "credit"),
    supabase.from("credit_payments").select("*"),
    supabase.from("projects").select("id, status").eq("status", "ongoing"),
    supabase
      .from("transactions")
      .select("*, clients(name), projects(name)")
      .order("trans_date", { ascending: false })
      .limit(20),
    supabase
      .from("transactions")
      .select("id, type, payment_type, sales_amount, sales_vat, purchase_amount, purchase_vat")
      .gte("trans_date", `${selectedYear}-01-01`)
      .lte("trans_date", `${selectedYear}-12-31`),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
    supabase.from("projects").select("contract_amount").eq("year", selectedYear),
  ]);

  const payments = (creditPayments ?? []) as CreditPayment[];
  const monthTx = (monthTxRaw ?? []).filter((t) => isLedgerVisible(t as Transaction, payments));
  const recentTx = (recentTxRaw ?? []).filter((t) => isLedgerVisible(t as Transaction, payments)).slice(0, 8);
  const yearTx = (yearTxRaw ?? []).filter((t) => isLedgerVisible(t, payments));

  const monthPurchase = monthTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const monthSales = monthTx.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);

  const totalCredit = (creditTx ?? []).reduce(
    (s, t) => s + remainingBalance(t as Transaction, payments),
    0
  );

  const yearSales = yearTx.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
  const yearPurchase = yearTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const yearProfit = yearSales - yearPurchase;

  // 선택된 연도(연도별 실적과 동일한 연도 필터)의 전체 프로젝트 수주액 합계 — 발주액
  // 대체 없이 순수 수주액만 더해서, 프로젝트 페이지 하단의 "수주액" 합계와 항상
  // 정확히 같은 값이 나오게 함(예전엔 수주액이 비어있으면 발주액으로 대신 더해서
  // 두 페이지 값이 서로 안 맞는 경우가 있었음).
  const totalExpectedRevenue = (yearProjects ?? []).reduce((s, p) => s + (p.contract_amount ?? 0), 0);

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  const yearCards = [
    { label: `${selectedYear}년 매출액`, value: formatWon(yearSales) },
    { label: `${selectedYear}년 매입액`, value: formatWon(yearPurchase) },
    { label: `${selectedYear}년 이익금`, value: formatWon(yearProfit) },
  ];

  const cards = [
    { label: "이번달 매출", value: formatWon(monthSales), href: "/transactions" },
    { label: "이번달 매입", value: formatWon(monthPurchase), href: "/transactions" },
    { label: "미수/미지급 외상 잔액", value: formatWon(totalCredit), href: "/transactions?tab=credit", highlight: true },
    { label: "진행중 현장/프로젝트", value: `${sites?.length ?? 0}건`, href: "/projects" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
        <p className="font-mono text-sm text-slate-400">
          {now.getFullYear()}.{String(now.getMonth() + 1).padStart(2, "0")} · 전체 현황 요약
        </p>
      </div>

      <TaxEstimateSection />
      <PendingPaymentProfitSection year={selectedYear} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">연도별 실적</h2>
          <YearFilter basePath="/dashboard" years={years} selectedYear={selectedYear} />
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            아이엠테크 {selectedYear}년 총 예상 매출 <span className="text-red-600">(진행중)</span>
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatWon(totalExpectedRevenue)}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {yearCards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={cx(
              "rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
              c.highlight ? "border-amber-200 bg-amber-50 hover:border-amber-300" : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{c.value}</p>
          </Link>
        ))}
      </div>

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
