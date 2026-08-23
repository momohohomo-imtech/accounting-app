import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";
import { remainingBalance } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";
import { TaxEstimateSection } from "@/components/sections/TaxEstimateSection";

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: monthTx }, { data: creditTx }, { data: creditPayments }, { data: sites }, { data: recentTx }] =
    await Promise.all([
      supabase.from("transactions").select("*").gte("trans_date", monthStart),
      supabase.from("transactions").select("*").eq("payment_type", "credit"),
      supabase.from("credit_payments").select("*"),
      supabase.from("projects").select("id, status").eq("status", "ongoing"),
      supabase
        .from("transactions")
        .select("*, clients(name), projects(name)")
        .order("trans_date", { ascending: false })
        .limit(8),
    ]);

  const monthPurchase = (monthTx ?? []).reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const monthSales = (monthTx ?? []).reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);

  const totalCredit = (creditTx ?? []).reduce(
    (s, t) => s + remainingBalance(t as Transaction, (creditPayments ?? []) as CreditPayment[]),
    0
  );

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-2xl border p-5 shadow-sm transition hover:border-slate-300 ${
              c.highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{c.value}</p>
          </Link>
        ))}
      </div>

      <TaxEstimateSection />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">최근 거래</h2>
          <Link href="/transactions" className="text-sm text-slate-500 hover:text-slate-800">
            전체보기
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">날짜</th>
                <th className="pb-2 pr-4">구분</th>
                <th className="pb-2 pr-4">거래처</th>
                <th className="pb-2 pr-4">프로젝트</th>
                <th className="pb-2 pr-4">품목</th>
                <th className="pb-2 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {(recentTx ?? []).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-600">{formatDate(t.trans_date)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.type === "매출" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{t.clients?.name ?? t.client_name_raw ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.projects?.name ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.item_name ?? "-"}</td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    {formatWon(t.type === "매출" ? t.sales_amount + t.sales_vat : t.purchase_amount + t.purchase_vat)}
                  </td>
                </tr>
              ))}
              {(recentTx ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    거래 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
