import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";
import { ProjectReportActions } from "@/components/ProjectReportActions";

export async function ProjectProfitReport({ projectId, closeHref }: { projectId: string; closeHref: string }) {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!project) return null;

  const { data: children } = await supabase.from("projects").select("*").eq("parent_project_id", projectId);
  const group = [project, ...(children ?? [])];
  const groupIds = group.map((p) => p.id);

  const { data: purchaseRows } = await supabase
    .from("transactions")
    .select("*, clients(name)")
    .in("project_id", groupIds)
    .eq("type", "매입")
    .order("trans_date", { ascending: true });

  const rows = purchaseRows ?? [];
  const purchaseTotal = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const quoteTotal = group.reduce((s, p) => s + (p.quote_amount ?? 0), 0);
  const contractTotal = group.reduce((s, p) => s + (p.contract_amount ?? 0), 0);
  // 이익금 = 발주액 - (발주액 - 수주액) - 매입합계 = 수주액 - 매입합계
  const gap = quoteTotal - contractTotal;
  const profit = contractTotal ? contractTotal - purchaseTotal : null;
  // 이익율은 발주액 대비 비율
  const margin = quoteTotal && profit !== null ? (profit / quoteTotal) * 100 : null;

  const exportRows = rows.map((t) => [
    formatDate(t.trans_date),
    t.clients?.name ?? t.client_name_raw ?? "-",
    t.item_name ?? "-",
    t.purchase_amount + t.purchase_vat,
  ]);

  const summaryRows: [string, string | number][] = [
    ["발주액 (원청 발주금액)", formatWon(quoteTotal)],
    ["차액 (발주액-수주액)", `-${formatWon(gap)}`],
    ["수주액 (실수령액)", formatWon(contractTotal)],
    ["매입 합계", `-${formatWon(purchaseTotal)}`],
    ["이익금", profit === null ? "수주액 미입력" : formatWon(profit)],
    ["이익율", margin === null ? "-" : `${margin.toFixed(2)}%`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-slate-400">{project.project_code ?? "-"}</p>
          <h2 className="text-lg font-semibold text-slate-900">
            {project.name}
            {children && children.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                + {children.map((c) => c.name).join(", ")}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ProjectReportActions
            filename={`${project.project_code ?? project.name}_손익보고서`}
            title={`${project.project_code ?? ""} ${project.name}`.trim()}
            exportRows={exportRows}
            summaryRows={summaryRows}
          />
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800 print:hidden">
            닫기
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
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

      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <p className="text-xs text-slate-500">발주액 (원청 발주금액)</p>
          <p className="font-mono text-lg font-bold text-slate-900">{formatWon(quoteTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">차액 (발주액-수주액)</p>
          <p className="font-mono text-lg font-bold text-slate-500">-{formatWon(gap)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">수주액 (실수령액)</p>
          <p className="font-mono text-lg font-bold text-slate-900">{formatWon(contractTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">매입 합계</p>
          <p className="font-mono text-lg font-bold text-slate-500">-{formatWon(purchaseTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">이익금</p>
          <p className={`font-mono text-lg font-bold ${profit === null ? "text-slate-400" : profit >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {profit === null ? "수주액 미입력" : formatWon(profit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">이익율</p>
          <p className={`font-mono text-lg font-bold ${margin === null ? "text-slate-400" : margin >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {margin === null ? "-" : `${margin.toFixed(2)}%`}
          </p>
        </div>
      </div>
    </div>
  );
}
