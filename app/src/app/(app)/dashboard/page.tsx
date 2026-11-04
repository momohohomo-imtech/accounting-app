import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate, moneyClass } from "@/lib/format";
import { remainingBalance, isLedgerVisible } from "@/lib/credit";
import type { ExpenseCategory, Transaction } from "@/lib/types";
import { vatOf, salesSupplyOf, purchaseCostOf } from "@/lib/vatBasis";
import {
  INCOME_TAX_BRACKETS_SINCE,
  taxEstimate,
  taxRateLabel,
  incomeTaxInstallment,
  interimPrepayment,
  vatPrepaymentNotice,
} from "@/lib/tax";
import {
  estimateOwnerInsurance,
  estimatedRatesNote,
  insuranceRatesFor,
  ownerHealthSettlement,
} from "@/lib/ownerSocialInsurance";
import { fixedCostNote, loadProfitOutlook, ProfitCalculationDetail } from "@/components/sections/ProfitOutlook";
import { loadFixedCostRows } from "@/lib/fixedExpenseLoad";
import type { FixedCostRow } from "@/lib/fixedExpense";
import { HalfYearSettlementInput } from "@/components/sections/HalfYearSettlementInput";
import { VatNoticeInput } from "@/components/sections/VatNoticeInput";
import { PageMemo } from "@/components/PageMemo";
import { updateDashboardPageMemo } from "@/lib/actions/dashboardPageMemo";
import { DetailToggle } from "@/components/DetailToggle";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { VatQuarterTable } from "@/components/VatQuarterTable";
import { YearFilter } from "@/components/YearFilter";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { cx } from "@/lib/cx";
import { fetchAllRows, fetchAllCreditPayments } from "@/lib/supabaseFetchAll";
import {
  expectedReceivableByStatus as receivableByStatus,
  receivedSalesByProject,
  RECEIVABLE_STATUSES,
} from "@/lib/expectedReceivable";
import { nowKst, kstDateTime } from "@/lib/kstDate";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";
import { getCurrentRole } from "@/lib/currentRole";
import { backupStatus, type BackupRecord } from "@/lib/backupStatus";
import { receivableAging } from "@/lib/receivableAging";
import { tasksForMonth, tasksSummary } from "@/lib/annualTasks";
import { one } from "@/lib/relations";
import { ReceivableAgingTable } from "@/components/ReceivableAgingTable";
import { findDuplicateCandidates, uncategorizedPurchases } from "@/lib/ledgerCheck";
import { unbilledRemainingByGroup } from "@/lib/projectProfit";
import { businessMonthsIn, firstBusinessYear } from "@/lib/businessYear";

// 수금 예정액 상태 칸 — 상태 목록은 프로젝트 목록 미수 금액·보고서 남은 금액과 같은 RECEIVABLE_STATUSES.
// 외상 거래 — 잔액(remainingBalance)·오래된 미수금(거래일·거래처)에 쓰는 칸만.
const DASHBOARD_CREDIT_COLUMNS =
  "id, type, payment_type, trans_date, client_id, client_name_raw, project_id, item_name, sales_amount, sales_vat, purchase_amount, purchase_vat, clients(name)";
type DashboardCreditTx = Pick<
  Transaction,
  | "id"
  | "type"
  | "payment_type"
  | "trans_date"
  | "client_id"
  | "client_name_raw"
  | "project_id"
  | "item_name"
  | "sales_amount"
  | "sales_vat"
  | "purchase_amount"
  | "purchase_vat"
> & { clients: { name: string } | { name: string }[] | null };

const RECEIVABLE_STATUS_LABEL: Record<string, string> = {
  ongoing: "진행중",
  done: "공사 완료",
  [PROJECT_STATUS_AWAITING_PAYMENT]: "수금 대기",
};
const EXPECTED_RECEIVABLE_STATUSES = RECEIVABLE_STATUSES.map((value) => ({ value, label: RECEIVABLE_STATUS_LABEL[value] }));

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("tabular-nums", moneyClass(value), className)}>{formatWon(value)}</span>;
}

// 스크롤을 줄이려고 칸·글씨를 작게 — 설명은 칸 안이 아니라 칸 아래 Footnote로.
const CARD_PAD = "p-3 sm:p-4";

// 접힘 목록 한 줄 — 제목 오른쪽에 핵심 숫자 한 줄(휴대폰에선 줄마다 들쭉날쭉하지 않게 항상 제목 아래, 제목 글자에 맞춰),
// 누르면 자세한 내용이 펼쳐짐. 기본은 모두 접힘.
function FoldRow({ title, summary, children }: { title: ReactNode; summary: ReactNode; children: ReactNode }) {
  return (
    <CollapsibleSection
      bare
      className="px-3 py-2.5 sm:px-4"
      title={<span className="text-sm font-bold text-slate-900">{title}</span>}
      headerExtra={
        <p className="tabular-nums text-[11px] text-slate-500 max-md:-mt-1.5 max-md:basis-full max-md:pl-[17px]">{summary}</p>
      }
    >
      <div className="pt-2">{children}</div>
    </CollapsibleSection>
  );
}

function Footnote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mt-1.5 space-y-0.5 text-[11px] leading-snug text-slate-400", className)}>{children}</div>;
}

// emphasis: 중요한 숫자 — 로고 포인트 녹색을 옅게 채운 칸.
function Stat({
  label,
  children,
  sub,
  emphasis,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "h-full rounded-lg px-3 py-2",
        emphasis ? "bg-brand-green/10 ring-1 ring-inset ring-brand-green/25" : "bg-slate-50",
        className
      )}
    >
      <p className={cx("text-[11px] leading-tight", emphasis ? "font-medium text-emerald-800" : "text-slate-500")}>{label}</p>
      <p className={cx("mt-0.5 whitespace-nowrap text-sm font-bold sm:text-base", emphasis ? "text-emerald-900" : "text-slate-900")}>
        {children}
      </p>
      {sub && <div className={cx("mt-0.5 text-[11px] leading-tight", emphasis ? "text-emerald-700" : "text-slate-500")}>{sub}</div>}
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
  const todayKey = `${today.year}-${mm}-${String(today.day).padStart(2, "0")}`;

  // 예상 세전이익의 남은 달 고정지출(지정 줄·이익 기준 달 평균, lib/fixedExpenseLoad.ts) — 다른 조회와 같이 시작. 지난 해는
  // 반영하지 않아 조회도 안 함. 못 불러오면 반영 없이 안내만(대시보드는 그대로 열림).
  const fixedCostPromise: Promise<{ rows: FixedCostRow[]; failed: boolean }> =
    selectedYear >= currentYear
      ? loadFixedCostRows(supabase, todayKey).then(
          (rows) => ({ rows, failed: false }),
          (err) => {
            console.error(err);
            return { rows: [], failed: true };
          }
        )
      : Promise.resolve({ rows: [], failed: false });

  // 외상 정산 이력 — 장부 표시(정산 전 외상 숨김)·외상 잔액·수금 예정액(이미 받은 매출)이 같이 쓴다.
  const creditPaymentsPromise = fetchAllCreditPayments(supabase);
  // 백업 상태 — 백업 기록은 관리자·직원만 읽을 수 있어서(조회 전용 계정은 빈 목록) 그 두 역할에만 보여 줌. 가장 최근 백업과
  // 가장 최근 자동 백업만(줄 수 칸은 095 SQL 실행 전이면 없어서 select("*")).
  const backupRecordsPromise = getCurrentRole().then(async (role) => {
    if (role !== "admin" && role !== "staff") return null;
    const [{ data: latest }, { data: latestAuto }] = await Promise.all([
      supabase.from("backups").select("*").order("created_at", { ascending: false }).limit(1),
      supabase.from("backups").select("*").eq("backup_type", "auto").order("created_at", { ascending: false }).limit(1),
    ]);
    return [...(latest ?? []), ...(latestAuto ?? [])] as BackupRecord[];
  });

  const [
    { data: monthTxRaw },
    creditTx,
    payments,
    { data: recentTxRaw },
    yearTxRaw,
    { data: firstTx },
    { data: yearProjectRows },
    { data: categoryRows },
    { data: employeeRows },
    { data: pageMemo },
    { data: vatNoticeRows, error: vatNoticeError },
    backupRecords,
    { data: firstSale },
    groupedRows,
  ] = await Promise.all([
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("trans_date", monthStart)
        .lte("trans_date", monthEnd)
        .order("id", { ascending: true })
        .range(from, to)
    ).then((data) => ({ data })),
    // 외상 잔액·오래된 미수금에 쓰는 칸만(영수증 인식 원문 등은 빼고) — 외상 거래는 정산이 끝나도 계속 쌓여서.
    fetchAllRows<DashboardCreditTx>((from, to) =>
      supabase
        .from("transactions")
        .select(DASHBOARD_CREDIT_COLUMNS)
        .eq("payment_type", "credit")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    creditPaymentsPromise,
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
      project_id: string | null;
      client_id: string | null;
      client_name_raw: string | null;
      item_name: string | null;
      note1: string | null;
      category_id: string | null;
      sales_amount: number;
      sales_vat: number;
      purchase_amount: number;
      purchase_vat: number;
      clients: { name: string } | { name: string }[] | null;
    }>((from, to) =>
      supabase
        .from("transactions")
        // 거래처·품목·메모1은 장부 점검 알림(중복 의심·카테고리 빈 세금·금융 매입)용
        .select(
          "id, type, payment_type, trans_date, project_id, client_id, client_name_raw, item_name, note1, category_id, sales_amount, sales_vat, purchase_amount, purchase_vat, clients(name)"
        )
        .gte("trans_date", `${selectedYear}-01-01`)
        .lte("trans_date", `${selectedYear}-12-31`)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
    // 선택 연도 프로젝트 — 예상 미수액·총 예상 매출·이익 예상(loadProfitOutlook)이 같이 쓴다.
    supabase.from("projects").select("id, name, status, quote_amount, parent_project_id").eq("year", selectedYear),
    // select("*") — 불공제·비과세 칸(082·083 마이그레이션) 실행 전에도 조회가 깨지지 않게.
    supabase.from("expense_categories").select("*"),
    // 대표자 건강보험·국민연금(사업 첫해) = 최고 급여 직원 기준 — 직원 공제액(본인 절반)의 2배. 조회 전용 계정은
    // 직원 정보를 못 읽어서 null → 정산 추정 칸에 안내만 표시.
    supabase.from("employees").select("health_insurance, long_term_care_insurance, national_pension, resigned_date"),
    // 맨 위 메모칸 — 087 SQL 실행 전이라 표가 없어도 에러 없이 빈 메모로 보이게 data만 쓴다.
    supabase.from("dashboard_page_memo").select("content").maybeSingle(),
    // 부가가치세 예정고지서 금액(093 SQL) — 실행 전이면 표가 없어 오류 → 입력칸을 숨기고 장부 기준 추정만.
    supabase.from("vat_prepayment_notices").select("month, amount").eq("year", selectedYear),
    backupRecordsPromise,
    // 사업 첫해 = 첫 매출이 있는 해(lib/businessYear.ts) — 준비기간 매입이 지난 해 날짜로 있어도 첫해 칸이 사라지지 않게.
    supabase.from("transactions").select("trans_date").eq("type", "매출").order("trans_date", { ascending: true }).limit(1),
    // 장부 점검 알림의 중복 의심 — 한 결제로 묶은 줄끼리는 빼야 해서 묶음 번호(092 SQL). 실행 전이라 칸이 없거나 못 읽으면 묶음 없이 셈
    // (알림용이라 화면은 그대로 — 그 해 거래 조회에 칸을 넣으면 실행 전엔 대시보드 전체가 안 열림).
    fetchAllRows<{ id: string; payment_group_id: string }>((from, to) =>
      supabase
        .from("transactions")
        .select("id, payment_group_id")
        .gte("trans_date", `${selectedYear}-01-01`)
        .lte("trans_date", `${selectedYear}-12-31`)
        .not("payment_group_id", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    ).catch(() => [] as { id: string; payment_group_id: string }[]),
  ]);
  const yearProjects = yearProjectRows ?? [];
  const categoryById = new Map(((categoryRows ?? []) as ExpenseCategory[]).map((c) => [c.id, c]));
  const categoryRel = (categoryId: string | null) => (categoryId ? categoryById.get(categoryId) ?? null : null);

  // 이익 예상은 세금계산서 기준 — 외상 미정산도 포함한 그 해 거래 전부를 넘긴다. 이번 달부터 12월까지는 고정지출 달 평균을 매입으로.
  const fixedCostLoad = await fixedCostPromise;
  const o = await loadProfitOutlook(selectedYear, {
    yearProjects,
    yearTx: yearTxRaw.map((t) => ({ ...t, expense_categories: categoryRel(t.category_id) })),
    today: todayKey,
    fixedCostRows: fixedCostLoad.rows,
    fixedCostFailed: fixedCostLoad.failed,
  });
  // 기성금 등 이미 받은 매출 — 연도와 상관없이 그 해 프로젝트로 등록된 매출 전부(이익 예상이 받아 온 거래를 그대로 씀).
  const receivedByProject = receivedSalesByProject(o.projectTx, payments);

  const monthTx = (monthTxRaw ?? []).filter((t) => isLedgerVisible(t as Transaction, payments));
  const recentTx = (recentTxRaw ?? []).filter((t) => isLedgerVisible(t as Transaction, payments)).slice(0, 8);
  const yearTx = yearTxRaw.filter((t) => isLedgerVisible(t, payments));

  const monthPurchase = monthTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const monthSales = monthTx.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);

  // 받을 돈(외상 매출)과 줄 돈(외상 매입)은 반드시 따로 — 예전엔 둘을 더한 한 숫자로 보여줬음.
  const creditReceivable = creditTx.filter((t) => t.type === "매출").reduce((s, t) => s + remainingBalance(t, payments), 0);
  const creditPayable = creditTx.filter((t) => t.type === "매입").reduce((s, t) => s + remainingBalance(t, payments), 0);
  const creditReceivableCount = creditTx.filter((t) => t.type === "매출" && remainingBalance(t, payments) > 0).length;
  // 오래된 외상매출금 — 세금계산서(거래일)부터 오늘까지 지난 날(lib/receivableAging.ts), 잔액은 외상매출금 합계와 같은 기준.
  const aging = receivableAging(
    creditTx
      .filter((t) => t.type === "매출")
      .map((t) => ({
        id: t.id,
        trans_date: t.trans_date,
        client: one(t.clients)?.name ?? t.client_name_raw ?? "거래처 미지정",
        item: t.item_name,
        amount: remainingBalance(t, payments),
      })),
    todayKey
  );
  const over60Amount = aging.over60.reduce((s, it) => s + it.amount, 0);
  // 이번 달 신고·납부 일정(lib/annualTasks.ts), 1~5월엔 전년도 신고 자료 바로가기.
  const monthTasks = tasksForMonth(today.year, today.month);
  const showPrevYearFiling = today.month <= 5 && selectedYear === today.year;
  const creditPayableCount = creditTx.filter((t) => t.type === "매입" && remainingBalance(t, payments) > 0).length;

  const yearSales = yearTx.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
  const yearPurchase = yearTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const yearProfit = yearSales - yearPurchase;

  // 예상 미수액 — 아직 돈을 다 받지 않은 프로젝트(진행중·공사 완료·완료 수금대기)의 남은 받을 금액.
  // 프로젝트 목록의 "수주예상액"(발주액 − 대행구매액)에서 이미 받은 매출(기성금 등)을 뺀다. 어미 + 귀속 하위는 한 묶음
  // (계산은 lib/expectedReceivable.ts — 자동 검사 있음).
  const expectedReceivableByStatus = receivableByStatus(
    yearProjects,
    EXPECTED_RECEIVABLE_STATUSES.map((st) => st.value),
    o.agencyByProject,
    receivedByProject
  ).map((r, i) => ({ ...r, label: EXPECTED_RECEIVABLE_STATUSES[i].label }));
  const expectedReceivable = expectedReceivableByStatus.reduce((s, r) => s + r.amount, 0);
  const receivableGroupCount = expectedReceivableByStatus.reduce((s, r) => s + r.count, 0);
  const receivedSalesTotal = expectedReceivableByStatus.reduce((s, r) => s + r.received, 0);
  // "공사 완료 · 수금 대기" 칸도 같은 기준 — 두 칸의 수금 대기 금액이 항상 같게.
  const awaitingPayment = expectedReceivableByStatus[EXPECTED_RECEIVABLE_STATUSES.findIndex((st) => st.value === PROJECT_STATUS_AWAITING_PAYMENT)];

  // 부가세는 세금계산서(거래일) 기준이라 외상 미정산 건도 포함한다. 금액은 총액(부가세 포함)에서
  // 계산(lib/vatBasis.ts)하고, 매입세액 불공제 카테고리(승용차 등)는 공제 대상에서 빼서 따로 표시.
  // 참고: 매출−매입(부가세 제외, 불공제 부가세는 비용)만으로 본 연간 예상 세금 — 이익 예상과 같은 세금계산서 기준
  // (외상 미정산 포함), 위에서 받은 연간 거래로 바로 계산해서 같은 거래를 다시 조회하지 않는다.
  const ledgerProfit = yearTxRaw.reduce((s, t) => {
    const row = { ...t, expense_categories: categoryRel(t.category_id) };
    return s + salesSupplyOf(row) - purchaseCostOf(row);
  }, 0);
  const ledgerTax = taxEstimate(ledgerProfit);

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

  // 내년 대표자 국민연금·건강보험 — 연간 합계 예상 이익금(상반기 미입력이면 프로젝트 기준) 기준.
  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  // 사업 첫해 = 첫 매출이 있는 해(lib/businessYear.ts — 예전엔 가장 이른 거래 연도라 지난 해 날짜 매입 하나로 첫해 칸이 사라졌음).
  // 그해 사업 기간은 그 해 첫 거래 달부터 12월까지. 연도 선택 목록(firstYear)은 그대로 가장 이른 거래부터.
  const isFirstBusinessYear = selectedYear === firstBusinessYear(firstSale?.[0]?.trans_date, currentYear);
  const business = isFirstBusinessYear ? businessMonthsIn(yearTxRaw.map((t) => t.trans_date)) : { startMonth: 1, months: 12 };
  const businessStartMonth = business.startMonth;
  const businessMonths = business.months;

  const insuranceBaseProfit = o.combinedProfit ?? o.profitEstimate;
  // 내년 보험료는 내년 요율로, 올해분 건강보험 정산은 올해 요율로(lib/ownerSocialInsurance.ts — 정해지지 않은 요율은 최근 값으로 추정).
  const nextYearRates = insuranceRatesFor(selectedYear + 1);
  const ratesNote = estimatedRatesNote(nextYearRates);
  const ownerInsurance = estimateOwnerInsurance(insuranceBaseProfit, businessMonths, nextYearRates);
  // 이익이 0 이하이면 이익 기준 보험료가 0원으로 계산되지만 실제로는 공단 최저 보험료가 붙음 — 0원 대신 안내만 표시.
  const hasOwnerIncome = insuranceBaseProfit > 0;
  const NO_INCOME_NOTE = "이익 없음 — 공단 최저 보험료 적용";
  const ofProfit = (yearly: number) =>
    insuranceBaseProfit > 0 ? ` · 이익 대비 ${((yearly / insuranceBaseProfit) * 100).toFixed(1)}%` : "";

  // 사업 첫해라 이듬해에 몰리는 돈 (첫해는 중간예납이 없어 올해 소득세 전액이 이듬해 5월, 11월엔 중간예납 시작).
  const nextYearTax = o.combinedTax ?? o.profitTax;
  const activeEmployees = (employeeRows ?? []).filter(
    (e) => !e.resigned_date || e.resigned_date > todayKey
  );
  // 첫해 대표자 보험료는 최고 급여 직원 기준 — 직원 공제액(본인 절반)의 2배로 추정.
  const ownerPaidMonthly = (pick: (e: (typeof activeEmployees)[number]) => number) =>
    activeEmployees.length ? 2 * Math.max(...activeEmployees.map(pick)) : null;
  const ownerHealthPaidMonthly = ownerPaidMonthly((e) => Number(e.health_insurance) + Number(e.long_term_care_insurance));
  const ownerPensionPaidMonthly = ownerPaidMonthly((e) => Number(e.national_pension));
  // 1월 부가세 2기 확정 = 7~12월 부가세 − 10월 예정고지(1~6월 납부세액의 1/2, 50만원 미만이면 고지 없음)
  // + 미발행 계산서 예상분(그 해 귀속 미발행 프로젝트의 남은 발주액 부가세, 12월까지 끊는다고 봄 — 사용자 결정)
  // − 남은 달 고정지출 매입세액(예상 이익과 같은 지정 줄·같은 "모자란 만큼만" 규칙, lib/projectProfit.ts의 fixedCostProjection).
  // 실제 예정고지는 세무사가 매입장 외 공제까지 반영해 신고한 1기 세액 기준이라 이 장부 기준 추정과 다를 수 있음 —
  // 고지서 금액을 입력해 두면(093 SQL) 추정 대신 그 금액.
  const vat1 = vatQuarters[0].net + vatQuarters[1].net;
  const vatNoticeReady = !vatNoticeError;
  const enteredOctoberNotice = (vatNoticeRows ?? []).find((n) => Number(n.month) === 10);
  const octoberNoticeAmount = enteredOctoberNotice ? Number(enteredOctoberNotice.amount) : null;
  const vatOctoberNotice = octoberNoticeAmount ?? vatPrepaymentNotice(vat1);
  const cashOut = {
    vat2: vatQuarters[2].net + vatQuarters[3].net - vatOctoberNotice + o.unbilledVat.vat - o.fixedCost.h2.vatAdded,
    mayTax: nextYearTax.totalTax,
    installment: incomeTaxInstallment(nextYearTax.incomeTax),
    healthSettlement:
      ownerHealthPaidMonthly != null && hasOwnerIncome
        ? ownerHealthSettlement(insuranceBaseProfit, businessMonths, ownerHealthPaidMonthly, insuranceRatesFor(selectedYear))
        : null,
    interim: interimPrepayment(nextYearTax.incomeTax),
  };
  // 환급(음수)은 합계에서 뺌 — 건강보험 정산과 같은 기준.
  const cashOutTotal =
    Math.max(cashOut.vat2, 0) + cashOut.mayTax + Math.max(cashOut.healthSettlement ?? 0, 0) + cashOut.interim;
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);


  // 맨 위 핵심 숫자 — 상반기 확정 이익금을 넣었으면 연간 합계, 아니면 프로젝트 기준(몰리는 돈·보험료 추정과 같은 기준).
  const headlineProfit = o.combinedProfit ?? (o.hasProjectsWithProfit ? o.profitEstimate : null);
  const headlineTax = o.combinedTax ?? (o.hasProjectsWithProfit ? o.profitTax : null);
  // 맨 위 숫자에 반영한 남은 달 고정지출(연간 합계면 하반기 예상 쪽, 아니면 프로젝트 기준 쪽). 칸 아래 설명은 한 줄로 짧게(11/4 사용자
  // "정보가 너무 많은 것도 보기 힘들어요") — 자세한 기준은 손익 및 세액 상세의 산정 기준.
  const headlineFixed = o.combinedProfit != null ? o.fixedCost.h2 : o.fixedCost.project;
  const headlineSub =
    (o.combinedProfit != null ? "상반기 확정 + 하반기 추정" : headlineProfit != null ? "프로젝트 기준 추정" : "상반기 확정치 입력 필요") +
    (headlineProfit == null
      ? ""
      : o.fixedCostFailed
        ? " · 고정지출 미반영(불러오기 실패)"
        : headlineFixed.applied
          ? " · 12월까지 고정지출 반영"
          : "");

  const latestTx = recentTx[0];
  const latestTxLabel = latestTx
    ? `${Number(latestTx.trans_date.slice(5, 7))}월 ${Number(latestTx.trans_date.slice(8, 10))}일 ${
        latestTx.clients?.name ?? latestTx.client_name_raw ?? ""
      } ${latestTx.type} ${formatWon(
        latestTx.type === "매출"
          ? latestTx.sales_amount + latestTx.sales_vat
          : latestTx.purchase_amount + latestTx.purchase_vat
      )}`
    : "거래 내역 없음";

  // 백업 상태(관리자·직원만, lib/backupStatus.ts) — 마지막 자동 백업 후 8일이 넘으면 맨 위 카드에 경고.
  const backup = backupRecords ? backupStatus(backupRecords, new Date().toISOString()) : null;
  const backupTypeLabel = (type: string) => (type === "auto" ? "자동" : "수동");
  const backupTime = (iso: string) => {
    const d = kstDateTime(iso);
    return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 ${d.slice(11)}`;
  };
  const autoBackupLabel =
    backup?.daysSinceAuto == null
      ? "자동 백업 기록 없음"
      : `자동 백업 ${backup.daysSinceAuto === 0 ? "당일" : `${backup.daysSinceAuto}일 전`}`;

  // 일정·확인 사항의 "확인" 줄 — 해당될 때만 한 줄씩(계산은 기존 lib 그대로: 장부 점검 탭·연말 점검·고정지출 표와 같은 기준).
  // 장부 점검: 그 해 등록된 거래 전부(외상 미정산 포함 — 장부 점검 탭과 같게)의 중복 의심 묶음·카테고리 빈 매입.
  const groupIdOf = new Map(groupedRows.map((r) => [r.id, r.payment_group_id]));
  const checkRows = yearTxRaw.map((t) => ({ ...t, clients: one(t.clients), payment_group_id: groupIdOf.get(t.id) ?? null }));
  const duplicateGroupCount = findDuplicateCandidates(checkRows).length;
  const uncategorized = uncategorizedPurchases(checkRows);
  const uncategorizedFlagged = uncategorized.filter((t) => t.kind).length;
  // 연말 점검: 프로젝트 목록과 같은 때(그 해 10월부터, 지난 해는 늘)·같은 계산(unbilledRemainingByGroup).
  const showYearEnd = selectedYear < currentYear || (selectedYear === currentYear && today.month >= 10);
  const yearEndRows = showYearEnd
    ? unbilledRemainingByGroup(yearProjects, o.projectTx, o.agencyByProject).filter((g) => g.remaining > 0)
    : [];
  const yearEndRemaining = yearEndRows.reduce((s, g) => s + g.remaining, 0);
  // 고정지출: 몇 달 나오다 최근 4달·이번 달에 매입이 없는 지정 줄(lib/fixedExpense.ts stoppedFixedRow) — 끝난 계약이면 지정 해제.
  const stoppedFixed = o.fixedCostRows.filter((r) => r.stopped);
  const backupIssue = Boolean(backup && (backup.autoStale || !backup.latest || backup.latestComplete === false));
  const checkCount =
    Number(backupIssue) +
    Number(duplicateGroupCount + uncategorized.length > 0) +
    Number(yearEndRows.length > 0) +
    Number(stoppedFixed.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-slate-900">대시보드</h1>
          <p className="tabular-nums text-xs text-slate-400">
            {today.year}.{mm}.{String(today.day).padStart(2, "0")} 기준
          </p>
        </div>
        <YearFilter basePath="/dashboard" years={years} selectedYear={selectedYear} />
      </div>

      {/* 맨 위 메모칸 — 제목 없이 입력칸만(사용자 요청). 입력칸에서 벗어나면 자동 저장. */}
      <PageMemo
        bare
        rows={3}
        initialContent={pageMemo?.content ?? ""}
        placeholder="메모를 입력하세요"
        save={updateDashboardPageMemo}
      />

      {/* 핵심 숫자 5칸만 늘 보이게 — 나머지는 아래 접힘 목록에 한 줄 요약과 함께(사용자 요청: 정보는 다 두되 간결하게, 11/4 "정보가 너무
          많은 것도 보기 힘들어요" — 칸 아래 설명은 한 줄로 짧게, 자세한 기준은 손익 및 세액 상세의 산정 기준으로).
          휴대폰·태블릿(사이드바가 있어 본문이 좁음): 예상 매출액 한 줄 + 2칸씩 두 줄 / lg~: 예상 매출·이익·세액 3칸 + 수금·지급
          예정액 2칸 / xl~: 5칸 한 줄. 문구는 포멀 톤(사용자 요청) — 회계·세무 용어, 칸 이름·요약은 명사형. */}
      <Card padding="none" className={CARD_PAD}>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6 xl:grid-cols-5">
          <Link
            href="/projects"
            className="col-span-2 rounded-lg transition hover:ring-2 hover:ring-slate-200 xl:col-span-1"
          >
            <Stat label={`${selectedYear}년 예상 매출액`} sub="공급가액 기준">
              <Money value={o.expectedRevenue} />
            </Stat>
          </Link>
          <Stat label={`${selectedYear}년 예상 세전이익`} emphasis className="lg:col-span-2 xl:col-span-1" sub={headlineSub}>
            {headlineProfit != null ? <Money value={headlineProfit} /> : "-"}
          </Stat>
          <Stat
            label="예상 종합소득세"
            emphasis
            className="lg:col-span-2 xl:col-span-1"
            sub={headlineTax ? `지방소득세 포함 · ${taxRateLabel(headlineTax)}` : undefined}
          >
            {headlineTax ? <Money value={headlineTax.totalTax} /> : "-"}
          </Stat>
          <Link href="/projects" className="rounded-lg transition hover:ring-2 hover:ring-slate-200 lg:col-span-3 xl:col-span-1">
            <Stat label="수금 예정액" sub={`대상 프로젝트 ${receivableGroupCount}건`}>
              <Money value={expectedReceivable} />
            </Stat>
          </Link>
          <Link
            href="/transactions?tab=credit"
            className="rounded-lg transition hover:ring-2 hover:ring-slate-200 lg:col-span-3 xl:col-span-1"
          >
            <Stat label="지급 예정액 (외상매입금)" sub={`미정산 ${creditPayableCount}건`}>
              <Money value={creditPayable} className="text-slate-600" />
            </Stat>
          </Link>
        </div>
        {backup?.autoStale && (
          <Link href="/backups" className="mt-1.5 block text-[11px] font-semibold text-red-600 hover:underline">
            {backup.daysSinceAuto == null
              ? "자동 백업 기록이 없습니다(백업 화면 확인 필요)."
              : `자동 백업이 ${backup.daysSinceAuto}일간 실행되지 않았습니다(백업 화면 확인 필요).`}
          </Link>
        )}
      </Card>

      {/* 자세한 내용은 한 카드 안의 접힘 목록(11/4 정돈 — 9줄 → 6줄, 같은 숫자는 한 곳에만) — 접힌 줄 오른쪽에 핵심 숫자 한 줄. */}
      <Card padding="none" className="divide-y divide-slate-100">
        <FoldRow
          title={`이번 달(${today.month}월) 일정·확인 사항`}
          summary={
            <>
              {tasksSummary(monthTasks)}
              {checkCount > 0 && <span className="font-semibold text-amber-600">{` · 확인 ${checkCount}건`}</span>}
            </>
          }
        >
          <ul className="space-y-1 text-xs text-slate-700">
            {monthTasks.map((t) => (
              <li key={`${t.day}-${t.short}`} className="flex gap-2">
                <span className="w-9 shrink-0 tabular-nums text-slate-500">{t.day}일</span>
                <span className="min-w-0">
                  {t.href ? (
                    <Link href={t.href} className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
                      {t.title}
                    </Link>
                  ) : (
                    t.title
                  )}
                  {t.detail && <span className="text-slate-400"> · {t.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {(backup || showPrevYearFiling || checkCount > 0) && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-700">확인 사항</p>
              <ul className="mt-1 space-y-1 text-xs">
                {backup && (
                  <CheckItem
                    href="/backups"
                    label="백업"
                    tone={backup.autoStale || !backup.latest ? "red" : backup.latestComplete === false ? "amber" : undefined}
                  >
                    {backup.latest
                      ? `최근 ${backupTime(backup.latest.created_at)}(${backupTypeLabel(backup.latest.backup_type)}${
                          backup.latestTransactionCount != null ? ` · 거래 ${backup.latestTransactionCount.toLocaleString()}건` : ""
                        }) · ${autoBackupLabel}${backup.latestComplete === false ? " · 예전 방식 백업(새 백업 필요)" : ""}`
                      : "백업 기록 없음"}
                  </CheckItem>
                )}
                {duplicateGroupCount + uncategorized.length > 0 && (
                  <CheckItem href={`/transactions?tab=check&year=${selectedYear}`} label="장부 점검" tone="amber">
                    {[
                      duplicateGroupCount > 0 && `중복 의심 ${duplicateGroupCount}묶음`,
                      uncategorized.length > 0 &&
                        `카테고리 빈 매입 ${uncategorized.length}건${
                          uncategorizedFlagged > 0 ? `(세금·보험·금융으로 보이는 것 ${uncategorizedFlagged}건)` : ""
                        }`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </CheckItem>
                )}
                {yearEndRows.length > 0 && (
                  <CheckItem href={`/projects?year=${selectedYear}`} label="연말 점검" tone="amber">
                    {`세금계산서 미발행 ${yearEndRows.length}건 · 남은 발행 예정액 ${formatWon(yearEndRemaining)} — 연내 발행 또는 귀속 연도 변경 확인`}
                  </CheckItem>
                )}
                {stoppedFixed.length > 0 && (
                  <CheckItem href="/reports" label="고정지출" tone="amber">
                    {`최근 4개월 매입 없는 지정 항목 ${stoppedFixed.length}곳(${stoppedFixed
                      .slice(0, 3)
                      .map((r) => r.name)
                      .join(", ")}${stoppedFixed.length > 3 ? " 외" : ""}) — 거래 종료 시 지정 해제(보고서 → 거래처·카테고리 집계)`}
                  </CheckItem>
                )}
                {showPrevYearFiling && (
                  <CheckItem href={`/dashboard?year=${today.year - 1}`} label="전년도 신고">
                    {`${today.year - 1}년 대시보드 · `}
                    <Link href={`/transactions?year=${today.year - 1}&month=all`} className="underline decoration-slate-300 underline-offset-2">
                      매입매출장
                    </Link>
                    {" · "}
                    <Link href={`/reports?year=${today.year - 1}`} className="underline decoration-slate-300 underline-offset-2">
                      보고서
                    </Link>
                    {" — 5월 31일 종합소득세 신고 기한"}
                  </CheckItem>
                )}
              </ul>
            </div>
          )}
          <Footnote>
            <p>마감일이 주말·공휴일이면 다음 영업일 · 세무사 대리 신고 항목 포함 · 개인사업자(일반과세자) 기준 일정</p>
          </Footnote>
        </FoldRow>

        <FoldRow
          title="손익 및 세액 상세"
          summary={
            <>
              {o.half1Profit == null ? (
                <span className="font-semibold text-amber-600">상반기 확정치 미입력</span>
              ) : (
                `상반기 확정 이익 ${formatWon(o.half1Profit)}`
              )}
              {hasOwnerIncome
                ? ` · ${selectedYear + 1}년 대표자 사회보험료 월 ${formatWon(
                    ownerInsurance.pensionMonthly + ownerInsurance.healthMonthly
                  )}`
                : ` · ${selectedYear + 1}년 대표자 사회보험료 공단 최저액 적용(이익 없음)`}
            </>
          }
        >
          <p className="mb-2 text-[11px] text-slate-400">
            개인사업자 종합소득세 기준 · 지방소득세(10%) 포함 · 종합소득공제는 본인 기본공제만 반영(참고용 추정치)
          </p>
          {/* 상반기 확정치를 넣으면 연간(확정+예상), 아니면 프로젝트 기준을 같은 자리에 — 맨 위 숫자와 같은 기준. 두 기준이 다를 때만
              프로젝트 기준을 아래 한 줄로 비교(예전엔 칸 8개에 같은 숫자가 겹쳐 보였음). */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              label="상반기 확정 이익 (세무사 결산 기준)"
              sub={<HalfYearSettlementInput key={selectedYear} year={selectedYear} initialAmount={o.half1Profit} />}
            >
              {o.half1Profit != null ? <Money value={o.half1Profit} /> : <span className="text-sm text-slate-400">미입력</span>}
            </Stat>
            <Stat label="하반기 예상 이익 (7~12월)" sub={fixedCostNote(o.fixedCost.h2)}>
              <Money value={o.h2EstimatedProfit} />
            </Stat>
            {o.combinedProfit != null || !o.hasProjectsWithProfit ? (
              <>
                <Stat label="연간 예상 이익 (확정+예상)">
                  {o.combinedProfit != null ? (
                    <Money value={o.combinedProfit} />
                  ) : (
                    <span className="text-sm text-slate-400">상반기 확정치 입력 필요</span>
                  )}
                </Stat>
                <Stat
                  label="연간 예상 종합소득세"
                  sub={o.combinedTax ? `지방소득세 포함 · ${taxRateLabel(o.combinedTax)}` : "상반기 확정치 입력 필요"}
                >
                  {o.combinedTax ? <Money value={o.combinedTax.totalTax} /> : "-"}
                </Stat>
              </>
            ) : (
              <>
                <Stat label="프로젝트 기준 예상 이익 (진행 중 포함)" sub={fixedCostNote(o.fixedCost.project)}>
                  <Money value={o.profitEstimate} />
                </Stat>
                <Stat label="프로젝트 기준 예상 종합소득세" sub={`지방소득세 포함 · ${taxRateLabel(o.profitTax)}`}>
                  <Money value={o.profitTax.totalTax} />
                </Stat>
              </>
            )}
            <Stat
              label={`${selectedYear + 1}년 대표자 국민연금 (월)`}
              sub={
                hasOwnerIncome
                  ? `연 ${formatWon(ownerInsurance.pensionYearly)}${ofProfit(ownerInsurance.pensionYearly)}${
                      isFirstBusinessYear && ownerPensionPaidMonthly != null
                        ? ` · 7월부터 현재 대비 월 ${formatWon(Math.max(ownerInsurance.pensionMonthly - ownerPensionPaidMonthly, 0))} 인상`
                        : ""
                    }`
                  : NO_INCOME_NOTE
              }
            >
              {hasOwnerIncome ? <Money value={ownerInsurance.pensionMonthly} /> : "-"}
            </Stat>
            <Stat
              label={`${selectedYear + 1}년 대표자 건강보험료 (월)`}
              sub={
                hasOwnerIncome
                  ? `연 ${formatWon(ownerInsurance.healthYearly)}${ofProfit(ownerInsurance.healthYearly)} · 장기요양보험료 포함`
                  : NO_INCOME_NOTE
              }
            >
              {hasOwnerIncome ? <Money value={ownerInsurance.healthMonthly} /> : "-"}
            </Stat>
          </div>
          {o.combinedProfit != null && o.hasProjectsWithProfit && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {`참고: 프로젝트 기준 예상 이익 ${formatWon(o.profitEstimate)} · 예상 종합소득세 ${formatWon(o.profitTax.totalTax)}`}
              {o.fixedCost.project.applied && ` (${fixedCostNote(o.fixedCost.project)})`}
            </p>
          )}
          <Footnote>
            <DetailToggle label="산정 기준">
              {o.hasIncompleteProjects && <p className="font-semibold text-slate-600">진행 중인 프로젝트 있음 — 추가 매출·매입 발생 시 예상치 변동</p>}
              <p>
                하반기 예상 이익 = 하반기 매출−매입 + 세금계산서 미발행분 예상 이익 − 인건비 − 남은 기간 고정지출 · 연간 예상 이익 =
                상반기 확정 이익 + 하반기 예상 이익
                {o.hasProjectsWithProfit &&
                  " · 프로젝트 기준 예상 이익 = 프로젝트 총이익(발주액 − 대행구매액, 발행 세금계산서가 더 많거나 발주액이 없으면 실제 매출 · 매입은 전부 반영) + 프로젝트 미지정 매출 − 일반경비 − 직원급여·상여·4대보험 − 남은 기간 고정지출 (추가 지출 발생 시 즉시 반영)"}
              </p>
              <p>
                남은 기간 고정지출 = 이번 달부터 12월까지 지정 고정지출(보고서 → 거래처·카테고리 집계)의 달 평균을 매입으로 예상 —
                지난달까지는 장부 금액(마감), 이번 달은 지정 고정지출마다 달 평균과 이미 등록한 금액 중 큰 쪽, 지정하지 않은 거래는
                장부 그대로 · 공급가액 기준(매입세액 불공제 카테고리는 부가세 포함) · 하반기 예상 이익은 7월부터, 지난 연도는 미반영
                {selectedYear >= currentYear && !o.fixedCostFailed && o.fixedCostRows.length === 0 && " · 현재 지정된 고정지출 없음"}
                {o.fixedCostFailed && (
                  <span className="font-semibold text-amber-600"> · 고정지출을 불러오지 못해 이번 계산에는 미반영</span>
                )}
              </p>
              <p>
                매출·매입은 세금계산서(거래일) 기준으로 외상 미정산분 포함 · 검토중 프로젝트의 발주액은 미반영 · 귀속 연도가 해당
                연도인 프로젝트 기준 — 다음 해에 세금계산서를 발행할 프로젝트는 귀속 연도를 다음 해로 변경
              </p>
              <p>
                예상 매출액 = 예상 이익 산정에 쓴 매출(발주액 − 대행구매액, 발행 세금계산서가 더 많거나 발주액이 없으면 실제 매출,
                검토중 제외) + 프로젝트 미지정 매출 · 공급가액 기준
              </p>
              <p>
                예상 종합소득세 = 이익에서 본인 기본공제 150만원을 차감한 과세표준에 종합소득세율({INCOME_TAX_BRACKETS_SINCE}년
                귀속분부터 적용되는 현행 세율) 적용 + 지방소득세 10% · 그 밖의
                공제와 매입장 외 경비는 세무사 신고 시 반영되므로 실제 세액과 차이 발생 가능
              </p>
              <p>
                참고: 매출−매입(공급가액, 세금계산서 기준)만 반영 시 이익 {formatWon(ledgerProfit)}, 기본공제 차감 후 과세표준{" "}
                {formatWon(ledgerTax.taxBase)}, {taxRateLabel(ledgerTax)}, 예상 세액 약 {formatWon(ledgerTax.totalTax)}
              </p>
              <p>
                {selectedYear + 1}년 국민연금·건강보험료 = {o.combinedProfit != null ? "연간" : "프로젝트 기준"} 예상 이익으로 추정한
                대표자 본인 부담분(당해 이익은 이듬해 5월 종합소득세 신고 후 반영) · 국민연금{" "}
                {Number((nextYearRates.pensionRate * 100).toFixed(1))}%(기준소득월액 상한{" "}
                {formatWon(nextYearRates.pensionMonthlyCap)}) · 건강보험 {(nextYearRates.healthRate * 100).toFixed(2)}% +
                장기요양보험료(건강보험료의 {(nextYearRates.longTermCareOfHealth * 100).toFixed(2)}%) · {nextYearRates.year}년 요율
                기준{ratesNote ? `(${ratesNote})` : ""} · 직원 4대보험 제외
              </p>
            </DetailToggle>
            <DetailToggle label="산출 내역">
              <ProfitCalculationDetail year={selectedYear} o={o} />
            </DetailToggle>
          </Footnote>
        </FoldRow>

        {isFirstBusinessYear && (
          <FoldRow
            title={`${selectedYear + 1}년 주요 납부 예정 (사업 첫해)`}
            summary={`납부 예정 합계 약 ${formatWon(cashOutTotal)}${
              cashOut.healthSettlement == null ? " (건강보험료 정산분 제외)" : ""
            }`}
          >
            <p className="text-[11px] text-slate-400">사업 첫해에는 중간예납이 없어 이듬해에 납부가 집중됩니다.</p>
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat
                label="1월 · 부가가치세 제2기 확정신고 (7~12월)"
                sub={[
                  o.unbilledVat.vat > 0 &&
                    `미발행 계산서 ${o.unbilledVat.count}건 예상분 약 ${formatWon(o.unbilledVat.vat)} 포함`,
                  o.fixedCost.h2.vatAdded > 0 && `남은 기간 고정지출 매입세액 약 ${formatWon(o.fixedCost.h2.vatAdded)} 차감`,
                  octoberNoticeAmount != null
                    ? `10월 예정고지액 ${formatWon(octoberNoticeAmount)} 차감(고지서 기준)`
                    : vatOctoberNotice > 0 && `10월 예정고지액 약 ${formatWon(vatOctoberNotice)} 차감`,
                  octoberNoticeAmount == null && vatOctoberNotice === 0 && vat1 > 0 && "10월 예정고지 없음(50만원 미만)",
                  cashOut.vat2 < 0 && "환급 예상",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <Money value={cashOut.vat2} />
              </Stat>
              <Stat
                label={`5월 · ${selectedYear}년 귀속 종합소득세·지방소득세`}
                emphasis
                sub={cashOut.installment > 0 ? `7월 말까지 ${formatWon(cashOut.installment)} 분납 가능` : undefined}
              >
                <Money value={cashOut.mayTax} />
              </Stat>
              <Stat
                label="7월부터 · 대표자 건강보험료 정산"
                sub={
                  !hasOwnerIncome
                    ? NO_INCOME_NOTE
                    : ownerHealthPaidMonthly != null
                      ? `기납부액(월 ${formatWon(ownerHealthPaidMonthly)}) 차감 · 분할납부 가능`
                      : "급여 정보 조회 권한이 있는 계정에서 산출"
                }
              >
                {cashOut.healthSettlement != null ? <Money value={cashOut.healthSettlement} /> : "-"}
              </Stat>
              <Stat
                label={`11월 · ${selectedYear + 1}년 귀속 종합소득세 중간예납`}
                sub={`${selectedYear}년 귀속 소득세의 1/2${cashOut.interim === 0 ? " · 50만원 미만으로 고지 없음" : ""}`}
              >
                <Money value={cashOut.interim} />
              </Stat>
            </div>
            <Footnote>
              <DetailToggle label="산정 기준">
                <p>
                  사업 기간 {businessMonths}개월({businessStartMonth}월 첫 거래 기준) · 건강보험료 정산액 = 당해 이익 기준 보험료 −
                  기납부액(최고 급여 직원 기준, 직원 공제액의 2배) · 국민연금은 연간 정산 없이 7월부터 월 보험료만 조정(소득총액신고
                  누락 시 11월에 7월분부터 소급 부과) · 모든 금액은 세무사 확인 전 추정치
                </p>
                {o.unbilledVat.vat > 0 && (
                  <p>
                    미발행 계산서 예상분 = {selectedYear}년 귀속 진행중·공사 완료·완료 수금대기 프로젝트의 남은 발주액(발주액 −
                    대행구매액 − 발행 매출, 공급가액 {formatWon(o.unbilledVat.supply)})의 10% · 12월까지 발행 가정 · 해당 프로젝트의 추가
                    매입 세금계산서 부가가치세만큼 감소
                  </p>
                )}
                <p>
                  10월 부가가치세 예정고지(제1기 납부세액의 1/2)·11월 중간예납(소득세의 1/2)은 50만원 미만 시 고지 없음 · 실제
                  고지액은 세무사가 매입장 외 공제까지 반영해 신고한 세액 기준으로, 장부 기준 추정액과 차이 발생 가능 · 부가가치세
                  예정고지서 금액은 &quot;부가가치세 (분기별)&quot;에 입력 시 그 금액으로 산출 · 1월 부가가치세는 4분기 실적·추가 매입에 따라
                  변동
                </p>
              </DetailToggle>
            </Footnote>
          </FoldRow>
        )}

        <FoldRow
          title="수금·지급 예정 상세"
          summary={
            <>
              {`수금 대기 ${awaitingPayment.count}건 ${formatWon(awaitingPayment.amount)} · 외상매출금 ${formatWon(creditReceivable)}`}
              {aging.over60.length > 0 && (
                <span className="font-semibold text-amber-600">{` · 60일 경과 ${aging.over60.length}건 ${formatWon(over60Amount)}`}</span>
              )}
            </>
          }
        >
          <p className="text-[11px] text-slate-400">외상 거래는 정산 등록 전까지 매입매출장 합계에서 제외됩니다.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/projects" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
              <Stat label="공사 완료 · 수금 대기" sub={`${awaitingPayment.count}건`}>
                <Money value={awaitingPayment.amount} />
              </Stat>
            </Link>
            <Link href="/transactions?tab=credit" className="rounded-lg transition hover:ring-2 hover:ring-slate-200">
              <Stat label="외상매출금" sub={`입금 대기 ${creditReceivableCount}건`}>
                <Money value={creditReceivable} />
              </Stat>
            </Link>
          </div>
          <Footnote>
            <DetailToggle label="산정 기준">
              <p>
                수금 예정액 = 수주예상액 − 기수령 기성금 ·{" "}
                {expectedReceivableByStatus.map((r) => `${r.label} ${r.count}건 ${formatWon(r.amount)}`).join(" · ")}
                {receivedSalesTotal > 0 && ` · 기수령 기성금(차감 완료, 공급가액 기준) ${formatWon(receivedSalesTotal)}`}
              </p>
              <p>외상매출금 = 세금계산서 발행 후 입금 대기분 · 공사 완료·수금 대기 금액은 기수령 기성금 제외</p>
            </DetailToggle>
          </Footnote>
          {aging.items.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-700">외상매출금 경과 기간(세금계산서 일자 기준)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {aging.buckets.filter((b) => b.count > 0).map((b) => (
                  <Stat key={b.key} label={b.label} sub={`${b.count}건`}>
                    <Money value={b.amount} className={b.key === "over90" && b.amount > 0 ? "text-red-600" : undefined} />
                  </Stat>
                ))}
              </div>
              {aging.over60.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-[11px] text-slate-500">60일 경과 외상매출금(입금 확인 필요)</p>
                  <ReceivableAgingTable items={aging.over60} />
                </div>
              )}
            </div>
          )}
        </FoldRow>

        <FoldRow
          title={`${selectedYear}년 매출·매입 실적 및 부가가치세`}
          summary={`매출 ${formatWon(yearSales)} · 매입 ${formatWon(yearPurchase)} · 부가가치세 예상 ${formatWon(vatTotal.net)}`}
        >
          <p className="text-[11px] text-slate-400">매입매출장 기준 · 부가가치세 포함</p>
          {/* 맨 위와 겹치는 예상 매출액·진행 중 프로젝트 수는 뺌, 당월은 올해를 볼 때만(다른 해를 골라도 올해 이번 달 숫자였음) */}
          <div className={cx("mt-2 grid grid-cols-2 gap-2", selectedYear === currentYear ? "lg:grid-cols-5" : "lg:grid-cols-3")}>
            <Stat label={`${selectedYear}년 매출액`}>
              <Money value={yearSales} />
            </Stat>
            <Stat label={`${selectedYear}년 매입액`}>
              <Money value={yearPurchase} />
            </Stat>
            <Stat label={`${selectedYear}년 매출·매입 차액`} className="col-span-2 lg:col-span-1">
              <Money value={yearProfit} />
            </Stat>
            {selectedYear === currentYear && (
              <>
                <Stat label={`당월(${today.month}월) 매출`}>
                  <Money value={monthSales} />
                </Stat>
                <Stat label={`당월(${today.month}월) 매입`}>
                  <Money value={monthPurchase} />
                </Stat>
              </>
            )}
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-700">부가가치세 (분기별)</p>
          <p className="text-[11px] text-slate-400">
            부가가치세 포함 총액 기준 산출 · 비과세 제외 · 외상 미정산분 포함(세금계산서 기준)
          </p>
          <div className="mt-1.5 [&_table]:text-xs [&_td]:py-1 [&_th]:pb-1">
            <VatQuarterTable rows={vatQuarters} total={vatTotal} />
          </div>
          <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                10월 예정고지액{" "}
                {octoberNoticeAmount != null ? (
                  <span className="whitespace-nowrap font-semibold text-slate-900">{formatWon(octoberNoticeAmount)} (고지서 기준)</span>
                ) : (
                  <span className="whitespace-nowrap font-semibold text-slate-900">
                    약 {formatWon(vatOctoberNotice)} (장부 기준 추정{vatOctoberNotice === 0 && vat1 > 0 ? " · 50만원 미만 고지 없음" : ""})
                  </span>
                )}
              </span>
              {vatNoticeReady && (
                <VatNoticeInput key={`${selectedYear}-${octoberNoticeAmount}`} year={selectedYear} month={10} initialAmount={octoberNoticeAmount} />
              )}
            </div>
            <p>
              제2기 확정신고(1월) 예상 납부세액{" "}
              <span className="whitespace-nowrap font-semibold text-slate-900">{formatWon(cashOut.vat2)}</span> = 7~12월{" "}
              <span className="whitespace-nowrap">{formatWon(vatQuarters[2].net + vatQuarters[3].net)}</span> − 10월 예정고지{" "}
              <span className="whitespace-nowrap">{formatWon(vatOctoberNotice)}</span>
              {o.unbilledVat.vat > 0 && (
                <>
                  {" "}+ 미발행 계산서 예상분 <span className="whitespace-nowrap">{formatWon(o.unbilledVat.vat)}</span>
                </>
              )}
              {o.fixedCost.h2.vatAdded > 0 && (
                <>
                  {" "}− 남은 기간 고정지출 매입세액 <span className="whitespace-nowrap">{formatWon(o.fixedCost.h2.vatAdded)}</span>
                </>
              )}
              {cashOut.vat2 < 0 && " (환급 예상)"}
            </p>
          </div>
          <Footnote>
            <DetailToggle label="산정 기준">
              <p>
                불공제 매입세액(승용차 렌트·유류비 등 &quot;매입세액 불공제&quot; 카테고리)은 예상 납부세액에서 차감하지 않음 · 신고는
                반기(1~6월, 7~12월) 단위 · 4월·10월에 직전 반기 납부세액의 1/2을 예정고지로 선납(50만원 미만 시 고지 없음)하고
                7월·1월 확정신고 시 차감 · 매입장 외 공제는 세무사 신고 시 반영되어 실제 납부액과 차이 발생 가능
              </p>
              {o.unbilledVat.vat > 0 && (
                <p>
                  세금계산서 미발행 프로젝트 {o.unbilledVat.count}건의 남은 발주액 부가가치세 예상 약 {formatWon(o.unbilledVat.vat)}은
                  표에 미포함(12월까지 발행 시 제2기 납부세액에 추가)
                </p>
              )}
              {o.fixedCost.h2.vatAdded > 0 && (
                <p>
                  남은 기간 고정지출 매입세액 = 이번 달부터 12월까지 지정 고정지출의 달 평균 매입세액 중 장부에 아직 없는 금액(예상 이익의
                  남은 기간 고정지출과 같은 기준, 비과세·불공제 제외) · 표에 미포함
                </p>
              )}
            </DetailToggle>
          </Footnote>
        </FoldRow>

        <FoldRow title="최근 거래 내역" summary={latestTxLabel}>
          <div className="[&_table]:text-xs [&_td]:py-1 [&_th]:pb-1">
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
          <div className="mt-1.5 text-right">
            <Link href="/transactions" className="text-xs text-slate-500 transition-colors hover:text-slate-800">
              전체 내역 보기
            </Link>
          </div>
        </FoldRow>

      </Card>
    </div>
  );
}

// 일정·확인 사항의 확인 줄 — 이름(누르면 그 화면) + 내용 한 줄. tone: 빨강 = 바로 확인, 주황 = 확인 권장.
function CheckItem({
  href,
  label,
  tone,
  children,
}: {
  href: string;
  label: string;
  tone?: "red" | "amber";
  children: ReactNode;
}) {
  return (
    <li className="flex gap-2">
      <Link
        href={href}
        className="w-20 shrink-0 font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
      >
        {label}
      </Link>
      <span className={cx("min-w-0", tone === "red" ? "font-semibold text-red-600" : tone === "amber" ? "text-amber-700" : "text-slate-600")}>
        {children}
      </span>
    </li>
  );
}
