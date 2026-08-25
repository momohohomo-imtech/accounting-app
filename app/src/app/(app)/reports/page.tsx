import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { ProjectProfitReport } from "@/components/ProjectProfitReport";
import { VendorDetailReport } from "@/components/VendorDetailReport";
import { YearFilter } from "@/components/YearFilter";
import { ReportProjectSiteFilter } from "@/components/ReportProjectSiteFilter";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { AutoPrint } from "@/components/AutoPrint";

const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

type Row = {
  id: string;
  trans_date: string;
  type: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  item_name: string | null;
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
  searchParams: Promise<{ year?: string; project?: string; vendor?: string; site?: string; printProjects?: string }>;
}) {
  const { year, project, vendor, site, printProjects } = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;

  const supabase = await createClient();
  const [{ data: rawTx }, { data: projects }, { data: firstTx }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, clients(name), projects(name, sites(name))")
      .gte("trans_date", `${selectedYear}-01-01`)
      .lte("trans_date", `${selectedYear}-12-31`),
    supabase.from("projects").select("id, name, status, progress_pct, site_id, sites(name)").eq("year", selectedYear),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
  ]);

  const transactions = (rawTx ?? []) as unknown as Row[];

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

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

  const byProjectAll = (projects ?? []).map((p) => {
    const rows = transactions.filter((t) => t.project_id === p.id);
    const sales = rows.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
    const purchase = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
    return { ...p, sales, purchase, profit: sales - purchase };
  });

  const projectSummary = {
    count: byProjectAll.length,
    sales: byProjectAll.reduce((s, p) => s + p.sales, 0),
    purchase: byProjectAll.reduce((s, p) => s + p.purchase, 0),
    profit: byProjectAll.reduce((s, p) => s + p.profit, 0),
  };

  const projectSiteOptions = Array.from(
    new Map(
      (projects ?? [])
        .filter((p) => p.site_id)
        .map((p) => [p.site_id as string, (one(p.sites) as { name: string } | null)?.name ?? "-"])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const byProject = site ? byProjectAll.filter((p) => p.site_id === site) : byProjectAll;

  // 현장별 손익 (프로젝트 없는 일반경비는 별도 묶음)
  const siteMap = new Map<string, { name: string; sales: number; purchase: number }>();
  for (const t of transactions) {
    const proj = one(t.projects);
    const s = proj ? one(proj.sites) : null;
    const key = s?.name ?? "일반경비(현장 외)";
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

  const vendorRows = vendor
    ? transactions
        .filter((t) => t.type === "매입" && ((one(t.clients) as { name: string } | null)?.name ?? t.client_name_raw ?? "미지정") === vendor)
        .map((t) => ({ id: t.id, trans_date: t.trans_date, item_name: t.item_name, amount: t.purchase_amount + t.purchase_vat }))
    : [];

  const popupOpen = Boolean(project || vendor);
  const isolateProjects = printProjects === "1";

  return (
    <div className="space-y-6">
      {isolateProjects && <AutoPrint />}

      <div className={popupOpen || isolateProjects ? "space-y-6 print:hidden" : "space-y-6"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">보고서</h1>
          <YearFilter basePath="/reports" years={years} selectedYear={selectedYear} />
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">분기별 매입·매출·손익</h2>
          <SimpleTable
            rows={quarterly.map((q) => [q.label, formatWon(q.sales), formatWon(q.purchase), formatWon(q.profit)])}
            headers={["분기", "매출", "매입", "손익"]}
          />
        </div>

        <CollapsibleSection title="월별 매입·매출·손익">
          <SimpleTable
            rows={monthly.map((m) => [m.label, formatWon(m.sales), formatWon(m.purchase), formatWon(m.profit)])}
            headers={["월", "매출", "매입", "손익"]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="현장별 손익 — 어느 현장에서 얼마를 벌고 썼는지">
          <SimpleTable
            rows={bySite.map((s) => [s.name, formatWon(s.sales), formatWon(s.purchase), formatWon(s.profit)])}
            headers={["현장", "매출", "매입", "손익"]}
            empty="현장 데이터가 없습니다."
          />
        </CollapsibleSection>
      </div>

      <CollapsibleSection
          className={popupOpen ? "print:hidden" : ""}
          title="프로젝트별 손익 (클릭하면 발주금 대비 상세 손익)"
          defaultOpen={isolateProjects}
          headerExtra={
            <div className="flex items-center gap-2 print:hidden">
              <span className="text-xs text-slate-500">
                {selectedYear}년 총 {projectSummary.count}건 · 매출 {formatWon(projectSummary.sales)} · 매입{" "}
                {formatWon(projectSummary.purchase)} · 이익금 {formatWon(projectSummary.profit)}
              </span>
              {projectSiteOptions.length > 0 && (
                <ReportProjectSiteFilter year={selectedYear} siteOptions={projectSiteOptions} selectedSite={site} />
              )}
              <Link
                href={`/reports?year=${selectedYear}${site ? `&site=${site}` : ""}&printProjects=1`}
                className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                인쇄
              </Link>
            </div>
          }
        >
          <p className="mb-3 hidden text-xs text-slate-500 print:block">
            {selectedYear}년 총 {projectSummary.count}건 · 매출 {formatWon(projectSummary.sales)} · 매입{" "}
            {formatWon(projectSummary.purchase)} · 이익금 {formatWon(projectSummary.profit)}
          </p>
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
                        href={`/reports?year=${selectedYear}${site ? `&site=${site}` : ""}&project=${p.id}`}
                        className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline"
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
      </CollapsibleSection>

      <div className={popupOpen || isolateProjects ? "space-y-6 print:hidden" : "space-y-6"}>
        <CollapsibleSection title="매입처별 집계 — 어느 업체에서 얼마를 매입했는지">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-4">거래처</th>
                  <th className="pb-2 pr-4 text-right">건수</th>
                  <th className="pb-2 text-right">매입 합계</th>
                </tr>
              </thead>
              <tbody>
                {byVendor.map((v) => (
                  <tr key={v.name} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/reports?year=${selectedYear}&vendor=${encodeURIComponent(v.name)}`}
                        className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline"
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-700">{v.count}건</td>
                    <td className="py-2 text-right font-mono text-slate-700">{formatWon(v.amount)}</td>
                  </tr>
                ))}
                {byVendor.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      매입 거래가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="매출처별 집계">
          <SimpleTable
            rows={byCustomer.map((v) => [v.name, `${v.count}건`, formatWon(v.amount)])}
            headers={["거래처", "건수", "매출 합계"]}
            empty="매출 거래가 없습니다."
          />
        </CollapsibleSection>
      </div>

      {project && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ProjectProfitReport projectId={project} closeHref={`/reports?year=${selectedYear}${site ? `&site=${site}` : ""}`} />
        </div>
      )}

      {vendor && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <VendorDetailReport vendorName={vendor} year={selectedYear} rows={vendorRows} closeHref={`/reports?year=${selectedYear}`} />
        </div>
      )}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  empty = "데이터가 없습니다.",
}: {
  headers: string[];
  rows: string[][];
  empty?: string;
}) {
  return (
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
                <td key={j} className={`py-2 pr-4 ${j > 0 ? "text-right font-mono text-slate-700" : "text-slate-700"}`}>
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
  );
}
