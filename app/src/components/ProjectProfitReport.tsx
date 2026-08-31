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
import { ProjectAgencyPurchaseList } from "@/components/ProjectAgencyPurchaseList";
import { AttachmentList } from "@/components/AttachmentList";
import { SettlementFinalizedCheckbox } from "@/components/SettlementFinalizedCheckbox";
import { ReportPrintChart } from "@/components/ReportPrintChart";
import { ReportChartProvider } from "@/components/ReportChartProvider";
import { ReportChartToggle } from "@/components/ReportChartToggle";
import { CollapsibleSection } from "@/components/CollapsibleSection";

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

  // 작업일지(달력)에서 이 프로젝트(+귀속 하위 프로젝트)가 직접 선택된 날짜 수만 집계.
  // 작업일지 줄마다 현장뿐 아니라 프로젝트도 선택하게 바뀌기 전에 입력된 과거 항목은
  // project_id가 비어있어서 잡히지 않음 — 프로젝트를 선택하며 입력한 날부터 정확해짐.
  const { data: workLogDateRows } = await supabase.from("work_logs").select("log_date").in("project_id", groupIds);
  const workDayCount = new Set((workLogDateRows ?? []).map((r) => r.log_date)).size;

  // 이 프로젝트가 속한 현장에서 현장은 골랐지만 프로젝트를 연결 안 한 작업일지 항목 —
  // 위 근무일수 집계에서 빠진 후보들을 화면에서 검토해서 나중에 연결할 수 있게 보여줌.
  const siteIds = Array.from(new Set(group.map((p) => p.site_id).filter((id): id is string => Boolean(id))));
  const { data: unassignedLogRows } = siteIds.length
    ? await supabase
        .from("work_logs")
        .select("id, log_date, site_id, title")
        .in("site_id", siteIds)
        .is("project_id", null)
        .order("log_date", { ascending: true })
    : { data: [] };
  const { data: unassignedSiteRows } = siteIds.length
    ? await supabase.from("sites").select("id, name").in("id", siteIds)
    : { data: [] };
  const unassignedSiteNameById = new Map((unassignedSiteRows ?? []).map((s) => [s.id, s.name]));
  const unassignedDayCount = new Set((unassignedLogRows ?? []).map((r) => r.log_date)).size;

  const { data: purchaseRows } = await supabase
    .from("transactions")
    .select("*, clients(name), expense_categories(name, project_only, color)")
    .in("project_id", groupIds)
    .eq("type", "매입")
    .order("trans_date", { ascending: true });

  const { data: agencyRows } = await supabase
    .from("project_agency_purchases")
    .select("*, expense_categories(name, project_only, color)")
    .in("project_id", groupIds)
    .order("created_at", { ascending: true });

  const { data: expenseCategories } = await supabase.from("expense_categories").select("id, name, project_only, color").order("sort_order");

  const { data: clientRows } = await supabase.from("clients").select("name").order("name");
  const clientNames = (clientRows ?? []).map((c) => c.name);

  const { data: attachmentRows } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, file_size, memo, storage_path")
    .in("project_id", groupIds)
    .order("created_at", { ascending: false });

  const attachments = await Promise.all(
    (attachmentRows ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("project-files").createSignedUrl(a.storage_path, 3600);
      return {
        id: a.id,
        file_name: a.file_name,
        mime_type: a.mime_type,
        file_size: a.file_size,
        memo: a.memo,
        url: signed?.signedUrl ?? null,
      };
    })
  );

  const rows = purchaseRows ?? [];
  const purchaseTotal = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const agencyTotal = (agencyRows ?? []).reduce((s, a) => s + a.amount, 0);

  const categoryBreakdown = (() => {
    const map = new Map<string, number>();
    for (const t of rows) {
      const name = (one(t.expense_categories) as { name: string } | null)?.name ?? "미분류";
      map.set(name, (map.get(name) ?? 0) + t.purchase_amount + t.purchase_vat);
    }
    for (const a of agencyRows ?? []) {
      const name = (one(a.expense_categories) as { name: string } | null)?.name ?? "미분류";
      map.set(name, (map.get(name) ?? 0) + a.amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  })();
  const quoteTotal = group.reduce((s, p) => s + (p.quote_amount ?? 0), 0);
  const contractTotal = group.reduce((s, p) => s + (p.contract_amount ?? 0), 0);
  // 이익금 = 발주액 - 매입합계 - 대행구매액(부속비·수수료 등 전부 여기에 품목으로 기록).
  // 수주액은 더 이상 이익 계산에 안 쓰고 참고용(예상금액/최소금액 표시 등)으로만 남겨둠.
  // gap/otherDeduction은 "수주액이 발주액-대행구매액과 실제로 맞는지" 확인용 참고치일 뿐임.
  const gap = quoteTotal - contractTotal;
  const otherDeduction = gap - agencyTotal;
  const profit = quoteTotal ? quoteTotal - purchaseTotal - agencyTotal : null;
  // 이익율은 발주액 대비 비율
  const margin = quoteTotal && profit !== null ? (profit / quoteTotal) * 100 : null;

  const exportRows = rows.map((t) => [
    formatDate(t.trans_date),
    t.clients?.name ?? t.client_name_raw ?? "-",
    t.item_name ?? "-",
    t.purchase_amount + t.purchase_vat,
  ]);

  const agencyExportRows: [string, number][] = (agencyRows ?? []).map((a) => {
    let label = a.item_name ?? "-";
    if (a.client_name) label += ` - ${a.client_name}`;
    if (a.memo) label += ` (${a.memo})`;
    return [label, a.amount];
  });

  const summaryRows: [string, string | number][] = [
    ["발주액 (원청 발주금액)", formatWon(quoteTotal)],
    ["대행구매액", `-${formatWon(agencyTotal)}`],
    ["기타 공제 (수수료 등)", `-${formatWon(otherDeduction)}`],
    [
      `수주액 (실수령액)${project.contract_amount_estimated ? " - 예상금액" : project.contract_amount_minimum ? " - 최소금액 산정액" : ""}`,
      formatWon(contractTotal),
    ],
    ["매입 합계", `-${formatWon(purchaseTotal)}`],
    ["이익금", profit === null ? "발주액 미입력" : formatWon(profit)],
    ["이익율", margin === null ? "-" : `${margin.toFixed(2)}%`],
  ];

  const parentLabel = parentProject
    ? `${parentProject.project_code ? `${parentProject.project_code} ` : ""}${parentProject.name}`
    : null;

  const infoLines = [
    `현장: ${siteName ?? "-"}    상태: ${projectStatusLabel(project.status)}`,
    `기간: ${formatDate(project.start_date)} ~ ${formatDate(project.end_date)}    발주서일자: ${formatDate(project.order_date)}    근무일수: ${workDayCount}일`,
    ...(parentLabel ? [`귀속 프로젝트: ${parentLabel}`] : []),
  ];

  return (
    <ProjectMemoProvider projectId={project.id} initialMemo={project.memo ?? ""} closeHref={closeHref}>
    <ReportChartProvider>
    <div className="flex flex-col gap-4 print:gap-2 print:text-[11px] print:leading-snug">
      <div className="order-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-slate-400 print:text-xs">{project.project_code ?? "-"}</p>
          <h2 className="text-lg font-semibold text-slate-900 print:text-base">
            {project.name}
            {children && children.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                + {children.map((c) => c.name).join(", ")}
              </span>
            )}
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 print:text-[10px]">
            {infoLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ProjectPurchaseChartButton
            data={categoryBreakdown}
            title={`${project.project_code ?? ""} ${project.name}`.trim()}
            quoteTotal={quoteTotal}
            contractTotal={contractTotal}
            profit={profit}
            margin={margin}
          />
          <ReportChartToggle />
          <ProjectReportActions
            filename={`${project.project_code ?? project.name}_손익보고서`}
            title={`${project.project_code ?? ""} ${project.name}`.trim()}
            infoLines={infoLines}
            exportRows={exportRows}
            agencyExportRows={agencyExportRows}
            summaryRows={summaryRows}
          />
          <ReportCloseButton />
        </div>
      </div>

      <div className="order-5 print:order-2 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 print:grid-cols-4 print:gap-2 print:border-b print:pt-2 print:pb-2 print:break-inside-avoid">
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">발주액 (원청 발주금액)</p>
          <p className="font-mono text-base font-bold whitespace-nowrap text-slate-900 print:text-xs">{formatWon(quoteTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">대행구매액</p>
          <p className="font-mono text-base font-bold whitespace-nowrap text-slate-500 print:text-xs">-{formatWon(agencyTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">기타 공제 (수수료 등)</p>
          <p className="font-mono text-base font-bold whitespace-nowrap text-slate-500 print:text-xs">-{formatWon(otherDeduction)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">
            수주액 (실수령액)
            {project.contract_amount_estimated && <span className="ml-1 text-red-600">예상</span>}
            {project.contract_amount_minimum && <span className="ml-1 text-green-600">최소</span>}
          </p>
          <p
            className={`font-mono text-base font-bold whitespace-nowrap print:text-xs ${
              project.contract_amount_estimated
                ? "text-red-600"
                : project.contract_amount_minimum
                  ? "text-green-600"
                  : "text-slate-900"
            }`}
          >
            {formatWon(contractTotal)}
          </p>
          {contractTotal > 0 && otherDeduction !== 0 && (
            <p className="mt-0.5 text-[11px] text-amber-600 print:text-[8px]">
              발주액-대행구매액 기준 예상 {formatWon(quoteTotal - agencyTotal)} (차이 {formatWon(Math.abs(otherDeduction))})
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">매입 합계</p>
          <p className="font-mono text-base font-bold whitespace-nowrap text-slate-500 print:text-xs">-{formatWon(purchaseTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">이익금</p>
          <p className={`font-mono text-base font-bold whitespace-nowrap print:text-xs ${profit === null ? "text-slate-400" : profit >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {profit === null ? "발주액 미입력" : formatWon(profit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 print:text-[9px]">이익율</p>
          <p className={`font-mono text-base font-bold whitespace-nowrap print:text-xs ${margin === null ? "text-slate-400" : margin >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {margin === null ? "-" : `${margin.toFixed(2)}%`}
          </p>
        </div>
      </div>

      <CollapsibleSection title="매입내역 · 대행구매액" defaultOpen printAlways bare className="order-2 print:order-3">
        <div className="space-y-4">
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

          <div className="print:mt-2 print:border-t print:border-slate-400 print:pt-2">
            <ProjectAgencyPurchaseList
              projectId={project.id}
              categories={expenseCategories ?? []}
              clientNames={clientNames}
              items={(agencyRows ?? []).map((a) => {
                const category = one(a.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
                return {
                  id: a.id,
                  item_name: a.item_name,
                  amount: a.amount,
                  category_id: a.category_id,
                  category_name: category?.name ?? null,
                  category_color: category ? resolveCategoryColor(category) : undefined,
                  memo: a.memo,
                  client_name: a.client_name,
                };
              })}
            />
          </div>
        </div>
      </CollapsibleSection>

      <div className="order-6 print:order-5 border-t border-slate-100 pt-4 space-y-3 print:break-inside-avoid">
        <SettlementFinalizedCheckbox projectId={project.id} initialChecked={Boolean(project.settlement_finalized)} />
        <ReportMemoField />
      </div>

      <div className="order-7 print:order-6 print:break-inside-avoid">
        <ReportPrintChart data={categoryBreakdown} quoteTotal={quoteTotal} />
      </div>

      <CollapsibleSection title="첨부파일 (사양서·도면·사진 등)" defaultOpen printAlways bare className="order-4 print:order-7">
        <AttachmentList projectId={project.id} items={attachments} title="" />
      </CollapsibleSection>

      <CollapsibleSection
        title="작업일지내 프로젝트 미선정"
        headerExtra={<span className="text-sm font-normal text-slate-500">총 {unassignedDayCount}일</span>}
        bare
        className="order-8 print:hidden border-t border-slate-100 pt-4"
      >
        {unassignedLogRows && unassignedLogRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-4">날짜</th>
                  <th className="pb-2 pr-4">현장</th>
                  <th className="pb-2">내용</th>
                </tr>
              </thead>
              <tbody>
                {unassignedLogRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 text-slate-600">{formatDate(r.log_date)}</td>
                    <td className="py-2 pr-4 text-slate-700">{unassignedSiteNameById.get(r.site_id ?? "") ?? "-"}</td>
                    <td className="py-2 text-slate-700">{r.title || "(내용 없음)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">미선정 항목이 없습니다.</p>
        )}
      </CollapsibleSection>
    </div>
    </ReportChartProvider>
    </ProjectMemoProvider>
  );
}
