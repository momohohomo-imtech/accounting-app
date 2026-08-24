import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";

const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

type Row = {
  id: string;
  trans_date: string;
  type: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
  clients: { name: string } | { name: string }[] | null;
  projects: { name: string; sites: { name: string } | { name: string }[] | null } | { name: string; sites: { name: string } | { name: string }[] | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; project?: string }>;
}) {
  const { year, project } = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

  const supabase = await createClient();
  const [{ data: rawTx }, { data: projects }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, clients(name), projects(name, sites(name))")
      .gte("trans_date", `${selectedYear}-01-01`)
      .lte("trans_date", `${selectedYear}-12-31`),
    supabase.from("projects").select("id, name, status, progress_pct, site_id, sites(name)").eq("year", selectedYear),
  ]);

  const transactions = (rawTx ?? []) as unknown as Row[];

  const monthly = MONTH_LABELS.map((label, i) => {
    const rows = transactions.filter((t) => new Date(t.trans_date).getMonth() === i);
    const sales = rows.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
    const purchase = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
    return { label, sales, purchase, profit: sales - purchase };
  });

  const quarterly = [0, 1, 2, 3].map((q) => {
    const months = monthly.slice(q * 3, q * 3 + 3);
    return {
      label: `${q + 1}분기`,
      sales: months.reduce((s, m) => s + m.sales, 0),
      purchase: months.reduce((s, m) => s + m.purchase, 0),
      profit: months.reduce((s, m) => s + m.profit, 0),
    };
  });

  const yearTotal = {
    sales: monthly.reduce((s, m) => s + m.sales, 0),
    purchase: monthly.reduce((s, m) => s + m.purchase, 0),
  };

  const byProject = (projects ?? []).map((p) => {
    const rows = transactions.filter((t) => t.project_id === p.id);
    const sales = rows.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
    const purchase = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
    return { ...p, sales, purchase, profit: sales - purchase };
  });

  // 현장별 손익 (프로젝트 없는 일반경비는 별도 묶음)
  const siteMap = new Map<string, { name: string; sales: number; purchase: number }>();
  for (const t of transactions) {
    const project = one(t.projects);
    const site = project ? one(project.sites) : null;
    const key = site?.name ?? "일반경비(현장 외)";
    const entry = siteMap.get(key) ?? { name: key, sales: 0, purchase: 0 };
    entry.sales += t.sales_amount + t.sales_vat;
    entry.purchase += t.purchase_amount + t.purchase_vat;
    siteMap.set(key, entry);
  }
  const bySite = Array.from(siteMap.values())
    .map((s) => ({ ...s, profit: s.sales - s.purchase }))
    .sort((a, b) => b.sales + b.purchase - (a.sales + a.purchase));

  // 거래처별 매입/매출 집계
  function clientBreakdown(type: "매입" | "매출") {
    const map = new Map<string, { name: string; count: number; amount: number }>();
    for (const t of transactions.filter((t) => t.type === type)) {
      const client = one(t.clients);
      const name = client?.name ?? t.client_name_raw ?? "미지정";
      const amount = type === "매입" ? t.purchase_amount + t.purchase_vat : t.sales_amount + t.sales_vat;
      const entry = map.get(name) ?? { name, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += amount;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }
  const byVendor = clientBreakdown("매입");
  const byCustomer = clientBreakdown("매출");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">보고서</h1>
        <div className="flex gap-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/reports?year=${y}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                y === selectedYear ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{selectedYear}년 총 매출액</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatWon(yearTotal.sales)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{selectedYear}년 총 매입액</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatWon(yearTotal.purchase)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{selectedYear}년 순손익</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {formatWon(yearTotal.sales - yearTotal.purchase)}
          </p>
        </div>
      </div>

      <ReportTable
        title="분기별 매입·매출·손익"
        rows={quarterly.map((q) => [q.label, formatWon(q.sales), formatWon(q.purchase), formatWon(q.profit)])}
        headers={["분기", "매출", "매입", "손익"]}
      />

      <ReportTable
        title="월별 매입·매출·손익"
        rows={monthly.map((m) => [m.label, formatWon(m.sales), formatWon(m.purchase), formatWon(m.profit)])}
        headers={["월", "매출", "매입", "손익"]}
      />

      <ReportTable
        title="현장별 손익 — 어느 현장에서 얼마를 벌고 썼는지"
        rows={bySite.map((s) => [s.name, formatWon(s.sales), formatWon(s.purchase), formatWon(s.profit)])}
        headers={["현장", "매출", "매입", "손익"]}
        empty="현장 데이터가 없습니다."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">프로젝트별 손익 (클릭하면 발주금 대비 상세 손익)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">프로젝트</th>
                <th className="pb-2 pr-4 text-right">진행률</th>
                <th className="pb-2 pr-4 text-right">매출</th>
                <th className="pb-2 pr-4 text-right">매입</th>
                <th className="pb-2 text-right">손익</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/reports?year=${selectedYear}&project=${p.id}`}
                      className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-700">{p.progress_pct ?? 0}%</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(p.sales)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(p.purchase)}</td>
                  <td className="py-2 text-right font-mono text-slate-700">{formatWon(p.profit)}</td>
                </tr>
              ))}
              {byProject.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {selectedYear}년 프로젝트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {project && <ProjectProfitDetail projectId={project} year={selectedYear} />}

      <ReportTable
        title="매입처별 집계 — 어느 업체에서 얼마를 매입했는지"
        rows={byVendor.map((v) => [v.name, `${v.count}건`, formatWon(v.amount)])}
        headers={["거래처", "건수", "매입 합계"]}
        empty="매입 거래가 없습니다."
      />

      <ReportTable
        title="매출처별 집계"
        rows={byCustomer.map((v) => [v.name, `${v.count}건`, formatWon(v.amount)])}
        headers={["거래처", "건수", "매출 합계"]}
        empty="매출 거래가 없습니다."
      />
    </div>
  );
}

async function ProjectProfitDetail({ projectId, year }: { projectId: string; year: number }) {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!project) return null;

  const { data: children } = await supabase.from("projects").select("*").eq("parent_project_id", projectId);
  const group = [project, ...(children ?? [])];
  const groupIds = group.map((p) => p.id);

  const { data: purchaseRows } = await supabase
    .from("transactions")
    .select("*, clients(name), projects(name)")
    .in("project_id", groupIds)
    .eq("type", "매입")
    .order("trans_date", { ascending: true });

  const rows = purchaseRows ?? [];
  const purchaseTotal = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const quoteTotal = group.reduce((s, p) => s + (p.quote_amount ?? 0), 0);
  const contractTotal = group.reduce((s, p) => s + (p.contract_amount ?? 0), 0);
  // 이익 계산은 실제 받는 금액인 수주액 기준. 수주액 미입력 시 발주액으로 대체.
  const budget = contractTotal || quoteTotal;
  const profit = budget - purchaseTotal;
  const margin = budget ? (profit / budget) * 100 : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          {project.name}
          {children && children.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">
              + {children.map((c) => c.name).join(", ")}
            </span>
          )}
        </h2>
        <Link href={`/reports?year=${year}`} className="text-sm text-slate-500 hover:text-slate-800">
          닫기
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4">날짜</th>
              <th className="pb-2 pr-4">거래처</th>
              <th className="pb-2 pr-4">품목</th>
              <th className="pb-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4 text-slate-600">{formatDate(t.trans_date)}</td>
                <td className="py-2 pr-4 text-slate-700">{t.clients?.name ?? t.client_name_raw ?? "-"}</td>
                <td className="py-2 pr-4 text-slate-700">{t.item_name ?? "-"}</td>
                <td className="py-2 text-right font-mono text-slate-900">{formatWon(t.purchase_amount + t.purchase_vat)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  매입 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
        <div>
          <p className="text-xs text-slate-500">매입 합계</p>
          <p className="font-mono text-lg font-bold text-slate-900">{formatWon(purchaseTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">발주액 (원청 발주금액)</p>
          <p className="font-mono text-lg font-bold text-slate-900">{formatWon(quoteTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">수주액 (실수령액)</p>
          <p className="font-mono text-lg font-bold text-slate-900">{formatWon(contractTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">이익금 (수주액 기준)</p>
          <p className={`font-mono text-lg font-bold ${profit >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {formatWon(profit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">이익율</p>
          <p className={`font-mono text-lg font-bold ${profit >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {margin === null ? "-" : `${margin.toFixed(2)}%`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  empty = "데이터가 없습니다.",
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {headers.map((h, i) => (
                <th key={h} className={`pb-2 pr-4 ${i > 0 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={`py-2 pr-4 ${j > 0 ? "text-right font-mono text-slate-700" : "text-slate-700"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="py-8 text-center text-slate-400">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
