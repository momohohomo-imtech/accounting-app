import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment } from "@/lib/types";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createProjectRecord, updateProjectRecord, deleteProjectRecord } from "@/lib/actions/projects";
import type { FieldConfig, RowBgColor } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { SitesSection } from "@/components/sections/SitesSection";
import { QuotesSection } from "@/components/sections/QuotesSection";
import { PurchaseOrdersSection } from "@/components/sections/PurchaseOrdersSection";
import { YearFilter } from "@/components/YearFilter";
import { ProjectProfitReport } from "@/components/ProjectProfitReport";
import { LinkButton } from "@/components/ui/Button";
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_AWAITING_PAYMENT, PROJECT_STATUS_MERGED } from "@/lib/projectStatus";
import { formatWon } from "@/lib/format";
import { ProjectListExportButtons } from "@/components/ProjectListExportButtons";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { PageMemo } from "@/components/PageMemo";
import { YearEndCheckSection } from "@/components/sections/YearEndCheckSection";
import { updateProjectsPageMemo } from "@/lib/actions/projectsPageMemo";
import { fetchAllRowsIn, fetchAllCreditPayments, fetchAllData } from "@/lib/supabaseFetchAll";
import { purchaseCostOf } from "@/lib/vatBasis";
import { groupProjectProfit } from "@/lib/projectProfit";
import { expectedReceivableByStatus, receivableOf, receivedSalesByProject } from "@/lib/expectedReceivable";
import { nowKst } from "@/lib/kstDate";

const TABS = [
  { key: "list", label: "프로젝트" },
  { key: "sites", label: "현장 / 거래처" },
  { key: "quotes", label: "견적서" },
  { key: "purchase_orders", label: "발주서" },
];

// 프로젝트 목록 행 배경색 — 상태 기준: 진행중 옅은 빨강, 완료 수금대기 파랑, 공사 완료 녹색,
// 검토중/기타 옅은 회색. 타 프로젝트 귀속 행은 자기 상태색 대신 귀속 대상(부모) 프로젝트의
// 상태색을 그대로 물려받는다(부모와 같은 배경으로 묶여 보이게).
function statusRowColor(status: string | null | undefined): RowBgColor | undefined {
  if (status === "done") return "green";
  if (status === "review" || status === "etc") return "gray";
  if (status === "ongoing") return "red";
  if (status === PROJECT_STATUS_AWAITING_PAYMENT) return "blue";
  return undefined;
}
// rowColorKey 필드는 색상 이름을 그대로 값으로 쓰므로(예: "green" → "green") 항등 매핑이면 충분.
const ROW_COLOR_IDENTITY_MAP: Record<string, RowBgColor> = Object.fromEntries(
  (["green", "gray", "blue", "red"] as RowBgColor[]).map((c) => [c, c])
);
// 귀속 그룹(부모 프로젝트 id 기준) 표시용 — 프로젝트명 옆 동그라미 색. 같은 부모로 묶인 행끼리
// 같은 색, 서로 다른 그룹은 이 팔레트를 돌려가며 다른 색을 쓴다.
const MERGE_GROUP_PALETTE: RowBgColor[] = ["purple", "amber", "teal", "pink", "indigo", "cyan", "orange", "fuchsia"];

// 확인 필요/우선순위 등 사용자가 직접 지정하는 강조색 — 지정되면 자동 상태색 대신 이 색(진한
// 배경)을 쓴다. 프로젝트 수정 팝업에서 색상 선택기로 고른다.
const HIGHLIGHT_COLOR_OPTIONS: { value: RowBgColor; label: string }[] = [
  { value: "red", label: "빨강" },
  { value: "orange", label: "주황" },
  { value: "amber", label: "노랑" },
  { value: "green", label: "초록" },
  { value: "teal", label: "청록" },
  { value: "cyan", label: "시안" },
  { value: "blue", label: "파랑" },
  { value: "indigo", label: "남색" },
  { value: "purple", label: "보라" },
  { value: "fuchsia", label: "자홍" },
  { value: "pink", label: "분홍" },
  { value: "gray", label: "회색" },
];
const HIGHLIGHT_COLOR_IDENTITY_MAP: Record<string, RowBgColor> = Object.fromEntries(
  HIGHLIGHT_COLOR_OPTIONS.map((o) => [o.value, o.value])
);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    year?: string;
    site_id?: string;
    status?: string;
    report?: string;
    own?: string;
    suppliers?: string;
  }>;
}) {
  const { tab, year, site_id, status, report, own, suppliers } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">프로젝트·현장</h1>
      <div className="print:hidden">
        <PageTabs basePath="/projects" tabs={TABS} active={active} />
      </div>
      {active === "sites" && <SitesSection />}
      {active === "quotes" && <QuotesSection suppliersOpen={suppliers === "1"} />}
      {active === "purchase_orders" && <PurchaseOrdersSection />}
      {active === "list" && (
        <ProjectListSection year={year} siteId={site_id} status={status} report={report} ownOnly={own === "1"} />
      )}
    </div>
  );
}

async function ProjectListSection({
  year,
  siteId,
  status,
  report,
  ownOnly,
}: {
  year?: string;
  siteId?: string;
  status?: string;
  report?: string;
  // 보고서를 귀속 하위 없이 그 프로젝트만(묶음을 펼친 어미 줄의 "보고서").
  ownOnly: boolean;
}) {
  const supabase = await createClient();
  const today = nowKst();
  const currentYear = today.year;
  const selectedYear = year ? Number(year) : currentYear;
  // 연말 점검은 그 해 10월부터(지난 해는 늘) — 계산서를 다 못 끊을 프로젝트를 귀속 연도 다음 해로 옮길 때.
  const showYearEndCheck = selectedYear < currentYear || (selectedYear === currentYear && today.month >= 10);
  // 상태 필터는 체크박스로 여러 개를 동시에 고를 수 있어서 콤마로 구분된 값으로 옴.
  const statusList = status ? status.split(",").filter(Boolean) : [];

  let projectsQuery = supabase
    .from("projects")
    .select("*, sites(name)")
    .eq("year", selectedYear)
    .order("created_at", { ascending: false });
  if (siteId) projectsQuery = projectsQuery.eq("site_id", siteId);
  if (statusList.length > 0) projectsQuery = projectsQuery.in("status", statusList);

  const [{ data: sites }, { data: allProjects }, { data: projects }, { data: allYears }, { data: pageMemo }] =
    await Promise.all([
      fetchAllData((from, to) =>
        supabase.from("sites").select("id, name, clients(name)").order("name").order("id").range(from, to)
      ),
      fetchAllData((from, to) =>
        supabase
          .from("projects")
          .select("id, name, year, site_id, parent_project_id, quote_amount")
          .order("id")
          .range(from, to)
      ),
      projectsQuery,
      fetchAllData((from, to) => supabase.from("projects").select("year").order("id").range(from, to)),
      supabase.from("projects_page_memo").select("content").maybeSingle(),
    ]);

  const siteOptions = (sites ?? []).map((s) => {
    const clientName = (one(s.clients) as { name: string } | undefined)?.name;
    return { value: s.id, label: clientName ? `${clientName} · ${s.name}` : s.name };
  });
  const siteLabelMap = new Map(siteOptions.map((s) => [s.value, s.label]));

  // 귀속 대상은 어미가 될 수 있는 프로젝트(다른 프로젝트에 귀속 안 된 것)만 — 귀속은 한 단계(서버에서도 확인). 예전에 3단으로
  // 저장된 자료의 가운데 프로젝트는 그 값을 가진 줄의 수정 화면에서만 보이게 남겨 둠(빠지면 "없음"으로 보여 다른 칸만 고쳐도
  // 귀속이 풀리고, 다른 줄에서 고르면 서버가 거절해서 선택 목록에서는 뺌 — onlyIfCurrent).
  const usedAsParent = new Set((allProjects ?? []).map((p) => p.parent_project_id).filter(Boolean));
  const parentProjectOptions = (allProjects ?? [])
    .filter((p) => !p.parent_project_id || usedAsParent.has(p.id))
    .map((p) => ({
      value: p.id,
      label: p.name,
      year: p.year,
      siteLabel: siteLabelMap.get(p.site_id) ?? "미지정 현장",
      onlyIfCurrent: Boolean(p.parent_project_id),
    }));

  // 어미 프로젝트의 이익금·이익율·총 매입은 손익보고서처럼 귀속 하위 프로젝트까지 합산 —
  // 하위가 필터(상태·현장)에 안 걸려 목록에 없어도 합산되게 전체 프로젝트에서 찾는다.
  const displayedIds = new Set((projects ?? []).map((p) => p.id));
  const projectById = new Map((allProjects ?? []).map((p) => [p.id, p]));
  // 목록에 보이는 맨 위 조상(묶음 어미) — 예전에 3단(어미 ← 하위 ← 하위의 하위)으로 저장된 자료도 맨 위 어미 묶음으로(표
  // EntityTable의 묶음과 같은 기준, 예전엔 맨 아래 줄이 목록에서 사라졌음). 서로를 가리키는 잘못된 자료는 묶지 않음.
  function displayedTopOf(id: string) {
    let top: string | null = null;
    const seen = new Set([id]);
    for (let pid = projectById.get(id)?.parent_project_id; pid; pid = projectById.get(pid)?.parent_project_id) {
      if (seen.has(pid)) return null;
      seen.add(pid);
      if (displayedIds.has(pid)) top = pid;
    }
    return top;
  }
  const childrenByParent = new Map<string, { id: string; quote_amount: number | null }[]>();
  // 묶음 하위 → 그 묶음 어미 id.
  const groupTopOf = new Map<string, string>();
  for (const c of allProjects ?? []) {
    const top = displayedTopOf(c.id);
    if (!top) continue;
    childrenByParent.set(top, [...(childrenByParent.get(top) ?? []), c]);
    groupTopOf.set(c.id, top);
  }
  const projectIds = Array.from(
    new Set([...displayedIds, ...Array.from(childrenByParent.values()).flat().map((c) => c.id)])
  );
  // 어미+귀속 하위는 목록에서 한 묶음(접힌 요약 줄)이라, 상태·현장 필터에 안 걸린 하위도 어미와 함께 보이게 가져옴.
  const hiddenChildIds = projectIds.filter((id) => !displayedIds.has(id));
  const hiddenChildrenPromise = hiddenChildIds.length
    ? fetchAllRowsIn(hiddenChildIds, (ids, from, to) =>
        supabase.from("projects").select("*, sites(name)").in("id", ids).order("id", { ascending: true }).range(from, to)
      )
    : Promise.resolve([]);
  type ProjectTxRow = {
    id: string;
    type: string;
    payment_type: string;
    sales_amount: number;
    sales_vat: number;
    project_id: string | null;
    purchase_amount: number;
    purchase_vat: number;
    expense_categories: { name: string } | { name: string }[] | null;
  };
  // 프로젝트에 붙은 거래 전부(매입은 이익·총 매입, 매출은 미수 금액의 받은 돈). 프로젝트가 수백 개여도 요청 주소가 너무
  // 길어지지 않게 나눠 조회(fetchAllRowsIn).
  const [projectTxRows, { data: agencyRows }, creditPayments] = projectIds.length
    ? await Promise.all([
        fetchAllRowsIn<ProjectTxRow>(projectIds, (ids, from, to) =>
          supabase
            .from("transactions")
            .select("id, type, payment_type, sales_amount, sales_vat, project_id, purchase_amount, purchase_vat, expense_categories(*)")
            .in("project_id", ids)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsIn<{ project_id: string; amount: number }>(projectIds, (ids, from, to) =>
          supabase
            .from("project_agency_purchases")
            .select("project_id, amount")
            .in("project_id", ids)
            .order("id", { ascending: true })
            .range(from, to)
        ).then((data) => ({ data })),
        fetchAllCreditPayments(supabase),
      ])
    : [[] as ProjectTxRow[], { data: [] as { project_id: string; amount: number }[] }, [] as CreditPayment[]];

  // 외상(미완납)은 완납 전까지 장부에서 제외 — 대시보드·보고서와 동일한 기준.
  const purchaseRows = projectTxRows.filter((t) => t.type === "매입" && isLedgerVisible(t, creditPayments));
  // 이미 받은 매출(즉시결제·정산 끝난 외상) — 미수 금액 = 수주예상액 − 받은 매출(대시보드 수금 예정액과 같은 계산).
  const receivedByProject = receivedSalesByProject(projectTxRows, creditPayments);

  // 발주액·대행구매액이 부가세 제외라 매입도 공급가(부가세 제외)로 맞춰 이익을 계산.
  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseRows) {
    if (!t.project_id) continue;
    purchaseByProject.set(t.project_id, (purchaseByProject.get(t.project_id) ?? 0) + purchaseCostOf(t));
  }

  const agencyByProject = new Map<string, number>();
  for (const a of agencyRows ?? []) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + a.amount);
  }

  const fields: FieldConfig[] = [
    { name: "project_code", label: "프로젝트번호", readOnly: true, width: "7%" },
    {
      name: "site_id",
      label: "현장",
      type: "select",
      required: true,
      options: siteOptions,
      width: "10%",
    },
    {
      name: "name",
      label: "프로젝트명",
      required: true,
      width: "13%",
      tertiaryColorField: "contractMismatch",
      dotColorField: "mergeGroupColor",
    },
    {
      name: "parent_project_id",
      label: "귀속 프로젝트 (비용 합산 대상)",
      tableLabel: "귀속",
      type: "project-search",
      projectSearchOptions: parentProjectOptions,
      width: "5%",
      toggleable: true,
      defaultVisible: false,
    },
    {
      name: "status",
      label: "상태",
      type: "select",
      options: PROJECT_STATUS_OPTIONS,
      // 8%: "완료 수금대기"·"타 프로젝트 귀속"이 6%에선 "완료 수…"로 잘림
      width: "8%",
    },
    {
      name: "rowColorKey",
      label: "행 색상",
      readOnly: true,
      hideInTable: true,
      rowBackgroundByValue: ROW_COLOR_IDENTITY_MAP,
    },
    {
      name: "highlight_color",
      label: "강조색 (확인 필요·우선순위 표시)",
      type: "color-swatch",
      options: HIGHLIGHT_COLOR_OPTIONS,
      hideInTable: true,
      strongRowBackgroundByValue: HIGHLIGHT_COLOR_IDENTITY_MAP,
    },
    {
      name: "is_service",
      label: "서비스(무상) 작업",
      tableLabel: "무상",
      type: "checkbox",
      width: "5%",
      toggleable: true,
      defaultVisible: false,
    },
    { name: "start_date", label: "시작일", type: "date", hideInTable: true },
    { name: "end_date", label: "완료일", type: "date", width: "7%", toggleable: true, defaultVisible: false },
    { name: "order_date", label: "발주서일자", type: "date", hideInTable: true },
    {
      name: "quote_amount",
      label: "발주액",
      type: "number",
      format: "currency",
      width: "8%",
      toggleable: true,
      defaultVisible: true,
    },
    {
      name: "contractAmountExpected",
      label: "수주예상액",
      readOnly: true,
      format: "currency",
      width: "8%",
      colorField: "contract_amount_estimated",
      secondaryColorField: "contract_amount_minimum",
      toggleable: true,
      defaultVisible: false,
    },
    {
      // 미수 금액(받을 금액) = 수주예상액 − 받은 매출 — 진행중·공사 완료·수금 대기만(검토중·수금 완료·귀속 하위 줄은 "-"),
      // 대시보드 수금 예정액·프로젝트 보고서 남은 금액과 같은 계산(lib/expectedReceivable.ts의 receivableOf).
      name: "receivable",
      label: "미수 금액 (받을 금액 = 수주예상액 − 받은 금액)",
      tableLabel: "미수 금액",
      readOnly: true,
      format: "currency",
      width: "8%",
      toggleable: true,
      defaultVisible: true,
    },
    {
      name: "contract_amount",
      label: "수주액 (수기 입력, 다른 보고서용 · 표에는 수주예상액으로 표시됨)",
      type: "number",
      format: "currency",
      hideInTable: true,
    },
    {
      name: "contract_amount_estimated",
      label: "수주액 예상금액 (체크 시 빨간색으로 표시)",
      type: "checkbox",
      hideInTable: true,
      exclusiveWith: "contract_amount_minimum",
    },
    {
      name: "contract_amount_minimum",
      label: "최소금액 산정액 (체크시 녹색으로 표시)",
      type: "checkbox",
      hideInTable: true,
      exclusiveWith: "contract_amount_estimated",
    },
    {
      name: "profit",
      label: "이익금",
      readOnly: true,
      format: "currency",
      width: "8%",
      colorField: "contract_amount_estimated",
      secondaryColorField: "contract_amount_minimum",
      toggleable: true,
      defaultVisible: false,
    },
    {
      name: "totalPurchase",
      label: "총 매입 (매입 공급가+구매대행, 부가세 제외)",
      tableLabel: "총 매입(VAT제외)",
      readOnly: true,
      format: "currency",
      width: "8%",
      toggleable: true,
      defaultVisible: false,
    },
    {
      name: "profitRate",
      label: "이익율",
      readOnly: true,
      width: "6%",
      colorField: "contract_amount_estimated",
      secondaryColorField: "contract_amount_minimum",
    },
    {
      name: "progress_pct",
      label: "진행률",
      tableLabel: "진행률",
      type: "number",
      display: "progress",
      width: "8%",
      toggleable: true,
      defaultVisible: true,
    },
    { name: "year", label: "연도", type: "number", required: true, hideInTable: true },
    { name: "memo", label: "메모", type: "textarea", width: "15%", toggleable: true, defaultVisible: false },
  ];

  const years = Array.from(
    new Set([...(allYears ?? []).map((p) => p.year), currentYear, selectedYear])
  ).sort((a, b) => b - a);

  const listProjects = [...(projects ?? []), ...(await hiddenChildrenPromise)];
  const tableRows = listProjects.map((p) => {
    const agencyAmount = agencyByProject.get(p.id) ?? 0;
    // 수주액이 발주액-대행구매액과 다르면(입력 실수 가능성) 프로젝트명을 노란색으로 표시.
    // 단, 결산 정리가 끝난 프로젝트는 목록에서 일반 검정으로 되돌림(보고서 팝업 안 경고는 별개, 항상 유지).
    const contractMismatch =
      !p.settlement_finalized &&
      (p.contract_amount ?? 0) > 0 && (p.quote_amount ?? 0) - (p.contract_amount ?? 0) - agencyAmount !== 0;
    // 줄마다 자기 값(사용자 요청: 묶음을 펼치면 각자 따로 보고 수정) — 어미+귀속 하위의 합산은 접힌 요약 줄(groupSummaries).
    const own = groupProjectProfit([p], purchaseByProject, agencyByProject);
    // 이익율은 발주액 대비 비율 — 손익보고서 팝업/보고서 페이지와 동일한 계산 기준.
    const profitRate = own.rate !== null ? `${own.rate.toFixed(1)}%` : "-";
    // 수주예상액 = 발주액 - 구매 대행비.
    const contractAmountExpected = (p.quote_amount ?? 0) - agencyAmount;
    // 총 매입 = 매입 합계 + 구매대행 합계.
    const totalPurchase = own.purchase + own.agency;
    const ownReceivable = receivableOf([p], agencyByProject, receivedByProject);
    return {
      ...p,
      site_name: (one(p.sites) as { name: string } | undefined)?.name,
      profit: own.profit,
      profitRate,
      contractMismatch,
      contractAmountExpected,
      totalPurchase,
      receivable: ownReceivable && ownReceivable.quote > 0 ? ownReceivable.amount : null,
      // 상태·현장 필터에 걸린 줄(어미 묶음 때문에 함께 가져온 하위는 false).
      inFilter: displayedIds.has(p.id),
    };
  });

  // 귀속 그룹(묶음 어미, 목록에 없으면 부모 프로젝트 id 기준) 동그라미 색 배정 — 처음 등장하는 순서대로 팔레트를 돌려 배정.
  const groupRootOf = (p: { id: string; parent_project_id: string | null }) => groupTopOf.get(p.id) ?? p.parent_project_id;
  const groupRootIds = Array.from(
    new Set(tableRows.map(groupRootOf).filter((id): id is string => Boolean(id)))
  );
  const groupColorByRootId = new Map<string, RowBgColor>(
    groupRootIds.map((id, i) => [id, MERGE_GROUP_PALETTE[i % MERGE_GROUP_PALETTE.length]])
  );
  const statusByProjectId = new Map(tableRows.map((p) => [p.id, p.status as string | null]));

  const coloredRows = tableRows.map((p) => {
    const rootId = groupRootOf(p);
    const mergeGroupColor = groupColorByRootId.get(rootId ?? p.id);
    // 귀속(merged) 상태는 자기 상태색이 없으니 귀속 대상(묶음 어미) 프로젝트의 상태색을 그대로 물려받는다.
    const effectiveStatus =
      p.status === PROJECT_STATUS_MERGED && rootId ? (statusByProjectId.get(rootId) ?? p.status) : p.status;
    return { ...p, rowColorKey: statusRowColor(effectiveStatus), mergeGroupColor };
  });

  // 어미+귀속 하위 묶음의 접힌 요약 줄 — 이름은 어미 이름(표가 뒤에 "외 N건"을 붙임), 발주액·수주예상액·총 매입은 합계,
  // 이익금·이익율은 손익보고서와 같은 묶음 기준(groupProjectProfit — 발주액 없는 하위의 매입도 빠짐). 펼치면 어미·하위가 각자
  // 원래 줄(자기 값·수정·자기 보고서).
  const rowById = new Map(coloredRows.map((r) => [r.id, r]));
  const groupSummaries: Record<string, (typeof coloredRows)[number]> = {};
  for (const [parentId, kids] of childrenByParent) {
    const parent = rowById.get(parentId);
    if (!parent) continue;
    const members = [
      parent,
      ...kids.map((k) => rowById.get(k.id)).filter((r): r is (typeof coloredRows)[number] => Boolean(r)),
    ];
    if (members.length < 2) continue;
    const g = groupProjectProfit(members, purchaseByProject, agencyByProject);
    // 미수 금액은 합산 보고서와 같은 묶음 기준(어미 + 귀속 하위 한 단위, 자기 상태가 있는 하위는 따로 — receivableOf).
    const groupReceivable = receivableOf(members, agencyByProject, receivedByProject);
    groupSummaries[parentId] = {
      ...parent,
      id: `group:${parentId}`,
      quote_amount: members.some((m) => m.quote_amount != null)
        ? members.reduce((sum, m) => sum + (m.quote_amount ?? 0), 0)
        : null,
      contractAmountExpected: members.reduce((sum, m) => sum + m.contractAmountExpected, 0),
      profit: g.profit,
      profitRate: g.rate !== null ? `${g.rate.toFixed(1)}%` : "-",
      totalPurchase: g.purchase + g.agency,
      receivable: groupReceivable && groupReceivable.quote > 0 ? groupReceivable.amount : null,
      contractMismatch: members.some((m) => m.contractMismatch),
    };
  }
  // 묶음(요약 줄이 있는 어미)에 들어간 하위 줄인지.
  const inGroup = (p: { id: string }) => Boolean(groupSummaries[groupTopOf.get(p.id) ?? ""]);
  // 엑셀은 예전처럼 어미 줄에 묶음 이익금, 묶음 안 하위 줄은 이익금 빈칸(엑셀에서 합계를 내도 두 번 세지 않게).
  const exportRows = coloredRows.map((p) =>
    groupSummaries[p.id]
      ? { ...p, profit: groupSummaries[p.id].profit, receivable: groupSummaries[p.id].receivable }
      : inGroup(p)
        ? { ...p, profit: null, receivable: null }
        : p
  );
  const listHref = `/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`;

  // 하단 합계 — 그 해 프로젝트만(다른 해 하위는 묶음 표시용으로만 가져온 것 — 그 해 목록에서 셈, 여기서도 세면 두 해에 두 번
  // 들어감). 발주액·수주예상액·총 매입은 줄마다 자기 값의 합, 이익금은 묶음이면 그 해 프로젝트끼리의 묶음 이익금(발주액 없는
  // 하위의 매입까지 빠지게, groupProjectProfit), 아니면 자기 이익금.
  const footerRows = tableRows.filter((p) => p.year === selectedYear);
  const otherYearChildCount = tableRows.length - footerRows.length;
  const broughtInChildCount = footerRows.filter((p) => !p.inFilter).length;
  const filteredQuoteSum = footerRows.reduce((sum, p) => sum + (p.quote_amount ?? 0), 0);
  const filteredContractSum = footerRows.reduce((sum, p) => sum + p.contractAmountExpected, 0);
  const filteredProfitSum = footerRows.reduce((sum, p) => {
    if (inGroup(p)) return sum;
    if (!groupSummaries[p.id]) return sum + (p.profit ?? 0);
    const members = footerRows.filter((m) => m.id === p.id || groupTopOf.get(m.id) === p.id);
    return sum + (groupProjectProfit(members, purchaseByProject, agencyByProject).profit ?? 0);
  }, 0);
  const filteredPurchaseSum = footerRows.reduce((sum, p) => sum + p.totalPurchase, 0);
  // 미수 금액 합계 — 묶음은 그 해 프로젝트끼리의 묶음 미수 금액, 아니면 자기 것(필터 없으면 대시보드 수금 예정액과 같음).
  const filteredReceivableSum = footerRows.reduce((sum, p) => {
    if (inGroup(p)) return sum;
    if (!groupSummaries[p.id]) return sum + (p.receivable ?? 0);
    const members = footerRows.filter((m) => m.id === p.id || groupTopOf.get(m.id) === p.id);
    return sum + (receivableOf(members, agencyByProject, receivedByProject)?.amount ?? 0);
  }, 0);
  // 공사완료 예상 미수액 — 완료 수금대기(귀속 하위는 어미 상태)의 미수 금액(예전엔 받은 돈을 빼지 않은 수주예상액 합계였음).
  // 대시보드 "공사 완료 · 수금 대기"와 같은 계산.
  const awaitingReceivable = expectedReceivableByStatus(
    footerRows,
    [PROJECT_STATUS_AWAITING_PAYMENT],
    agencyByProject,
    receivedByProject
  )[0];

  return (
    <div className="space-y-6">
      <div className={report ? "space-y-6 print:hidden" : "space-y-6"}>
        {awaitingReceivable.count > 0 && (
          <CollapsibleSection
            bare
            defaultOpen={false}
            title={<span className="text-red-600">공사완료 예상 미수액</span>}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 print:hidden"
          >
            <p className="text-xs text-red-600">
              완료 수금대기 {awaitingReceivable.count}건의 미수 금액 합계(수주예상액 − 받은 금액)
            </p>
            <p className="mt-1 tabular-nums text-xl font-bold text-red-600">{formatWon(awaitingReceivable.amount)}</p>
          </CollapsibleSection>
        )}

        <PageMemo
          initialContent={pageMemo?.content ?? ""}
          placeholder="프로젝트 관련 메모..."
          save={updateProjectsPageMemo}
        />

        {showYearEndCheck && <YearEndCheckSection year={selectedYear} />}

        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <YearFilter
            basePath="/projects"
            years={years}
            selectedYear={selectedYear}
            siteOptions={siteOptions}
            selectedSiteId={siteId}
            statusOptions={PROJECT_STATUS_OPTIONS}
            selectedStatuses={statusList}
          />
          <ProjectListExportButtons year={selectedYear} rows={exportRows} />
        </div>

        <div className="print:hidden">
          <CreatePanel title="프로젝트" fields={fields} createAction={createProjectRecord} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <EntityTable
            fields={fields}
            rows={coloredRows}
            groupByField="parent_project_id"
            groupSummaries={groupSummaries}
            // 접힌 묶음 줄 — 어미+귀속 하위 합산 보고서(ProjectProfitReport는 어미 id로 열면 하위까지 합침).
            groupActions={Object.fromEntries(
              Object.keys(groupSummaries).map((parentId) => [
                parentId,
                <LinkButton key={parentId} href={`${listHref}&report=${parentId}`} variant="secondary" size="xs">
                  합산 보고서
                </LinkButton>,
              ])
            )}
            updateAction={updateProjectRecord}
            deleteAction={deleteProjectRecord}
            editPopup
            // 줄마다 자기 보고서(사용자 요청: 묶음 안에서도 각자 따로) — 묶음 어미 줄은 하위를 뺀 자기 것만(own=1),
            // 하위는 자기 id로 열면 자기 것만(보고서에 "귀속 상위" 표시).
            extraActions={Object.fromEntries(
              tableRows.map((p) => [
                p.id,
                <LinkButton
                  key={p.id}
                  href={`${listHref}&report=${p.id}${groupSummaries[p.id] ? "&own=1" : ""}`}
                  variant="secondary"
                  size="xs"
                >
                  보고서
                </LinkButton>,
              ])
            )}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span className="font-medium text-slate-500">
              필터된 {footerRows.length - broughtInChildCount}건{broughtInChildCount > 0 && ` + 묶음 하위 ${broughtInChildCount}건`} 합계
              {otherYearChildCount > 0 && (
                <span className="font-normal text-slate-400"> (다른 해 하위 {otherYearChildCount}건 제외)</span>
              )}
            </span>
            <span>
              발주액 <span className="tabular-nums font-semibold text-slate-900">{formatWon(filteredQuoteSum)}</span>
            </span>
            <span>
              수주예상액 <span className="tabular-nums font-semibold text-slate-900">{formatWon(filteredContractSum)}</span>
            </span>
            <span>
              미수 금액 <span className="tabular-nums font-semibold text-slate-900">{formatWon(filteredReceivableSum)}</span>
            </span>
            <span>
              이익금 <span className="tabular-nums font-semibold text-slate-900">{formatWon(filteredProfitSum)}</span>
            </span>
            <span>
              총 매입 <span className="tabular-nums font-semibold text-slate-900">{formatWon(filteredPurchaseSum)}</span>
            </span>
          </div>
        </div>
      </div>

      {report && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:bg-transparent print:p-0"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <ProjectProfitReport
              projectId={report}
              ownOnly={ownOnly}
              closeHref={listHref}
            />
          </div>
        </div>
      )}
    </div>
  );
}
