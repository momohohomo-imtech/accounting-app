import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatWon, formatDate } from "@/lib/format";
import { projectStatusLabel } from "@/lib/projectStatus";
import { ProjectReportActions } from "@/components/ProjectReportActions";
import { ProjectMemoProvider } from "@/components/ProjectMemoProvider";
import { ReportCloseButton } from "@/components/ReportCloseButton";
import { ReportMemoField } from "@/components/ReportMemoField";
import { ProjectPurchaseChartButton } from "@/components/ProjectPurchaseChartButton";
import { ProjectPurchaseTable } from "@/components/ProjectPurchaseTable";
import { resolveCategoryColor } from "@/lib/categoryColor";

export async function ProjectProfitReport({ projectId, closeHref }: { projectId: string; closeHref: string }) {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*, sites(name)").eq("id", projectId).single();
  if (!project) return null;

  const siteName = (one(project.sites) as { name: string } | undefined)?.name;
  const { data: parentProject } = project.parent_project_id
    ? await supabase.from("projects").select("name, project_code").eq("id", project.parent_project_id).single()
    : { data: null };

  const { data: children } = await supabase.from("projects").select("*").eq("parent_project_id", projectId);
  const group = [project, ...(children ?? [])];
  const groupIds = group.map((p) => p.id);

  const { data: purchaseRows } = await supabase
    .from("transactions")
    .select("*, clients(name), expense_categories(name, project_only, color)")
    .in("project_id", groupIds)
    .eq("type", "매입")
    .order("trans_date", { ascending: true });

  const rows = purchaseRows ?? [];
  const purchaseTotal = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);

  const categoryBreakdown = (() => {
    const map = new Map<string, number>();
    for (const t of rows) {
      const name = (one(t.expense_categories) as { name: string } | null)?.name ?? "미분류";
      map.set(name, (map.get(name) ?? 0) + t.purchase_amount + t.purchase_vat);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  })();
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
    [
      `수주액 (실수령액)${project.contract_amount_estimated ? " - 예상금액" : project.contract_amount_minimum ? " - 최소금액 산정액" : ""}`,
      formatWon(contractTotal),
    ],
    ["매입 합계", `-${formatWon(purchaseTotal)}`],
    ["이익금", profit === null ? "수주액 미입력" : formatWon(profit)],
    ["이익율", margin === null ? "-" : `${margin.toFixed(2)}%`],
  ];

  const parentLabel = parentProject
    ? `${parentProject.project_code ? `${parentProject.project_code} ` : ""}${parentProject.name}`
    : null;

  const infoLines = [
    `현장: ${siteName ?? "-"}    상태: ${projectStatusLabel(project.status)}`,
    `기간: ${formatDate(project.start_date)} ~ ${formatDate(project.end_date)}    발주서일자: ${formatDate(project.order_date)}`,
    ...(parentLabel ? [`귀속 프로젝트: ${parentLabel}`] : []),
  ];

  return (
    <ProjectMemoProvider projectId={project.id} initialMemo={project.memo ?? ""} closeHref={closeHref}>
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
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
            {infoLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectPurchaseChartButton
            data={categoryBreakdown}
            title={`${project.project_code ?? ""} ${project.name}`.trim()}
            quoteTotal={quoteTotal}
            contractTotal={contractTotal}
            profit={profit}
            margin={margin}
          />
          <ProjectReportActions
            filename={`${project.project_code ?? project.name}_손익보고서`}
            title={`${project.project_code ?? ""} ${project.name}`.trim()}
            infoLines={infoLines}
            exportRows={exportRows}
            summaryRows={summaryRows}
          />
          <ReportCloseButton />
        </div>
      </div>

      <ProjectPurchaseTable
        rows={rows.map((t) => {
          const category = one(t.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
          return {
            id: t.id,
            date: t.trans_date,
            vendor: t.clients?.name ?? t.client_name_raw ?? "-",
            item: t.item_name ?? "-",
            category: category?.name ?? "미분류",
            categoryColor: category ? resolveCategoryColor(category) : undefined,
            amount: t.purchase_amount + t.purchase_vat,
          };
        })}
      />

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
          <p className="text-xs text-slate-500">
            수주액 (실수령액)
            {project.contract_amount_estimated && <span className="ml-1 text-red-600">예상</span>}
            {project.contract_amount_minimum && <span className="ml-1 text-green-600">최소</span>}
          </p>
          <p
            className={`font-mono text-lg font-bold ${
              project.contract_amount_estimated
                ? "text-red-600"
                : project.contract_amount_minimum
                  ? "text-green-600"
                  : "text-slate-900"
            }`}
          >
            {formatWon(contractTotal)}
          </p>
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

      <div className="border-t border-slate-100 pt-4">
        <ReportMemoField />
      </div>
    </div>
    </ProjectMemoProvider>
  );
}
