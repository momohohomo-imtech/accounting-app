import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import {
  fixedCostRows,
  fixedExpenseReport,
  fixedExpenseWindow,
  type FixedCostRow,
  type FixedExpenseReport,
  type FixedExpenseTarget,
} from "@/lib/fixedExpense";
import { purchaseCostOf } from "@/lib/vatBasis";

// 고정지출 조회 — 보고서 고정지출 칸(loadFixedExpense)과 대시보드 예상 세전이익(loadFixedCostRows)이 같은 매입·같은 규칙으로 계산
// (lib/fixedExpense.ts). 선택 연도와 상관없이 최근 12개월(지난달까지) + 이번 달 매입, 거래처·카테고리의 고정지출 표시는 101·102 SQL —
// 실행 전이면 그 표시 없이(지정 안 함).

type Supabase = Awaited<ReturnType<typeof createClient>>;
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);
type Target = { id: string; name: string; is_fixed_expense?: boolean | null };
type Category = Target & { vat_exempt?: boolean | null; vat_non_deductible?: boolean | null };
type PurchaseRow = {
  client_id: string | null;
  category_id: string | null;
  trans_date: string;
  purchase_amount: number;
  purchase_vat: number;
};

const target = (c: Target): FixedExpenseTarget => ({ id: c.id, name: c.name, fixed: Boolean(c.is_fixed_expense) });

function fetchPurchases(supabase: Supabase, today: string) {
  const win = fixedExpenseWindow(today);
  return fetchAllRows<PurchaseRow>((from, to) =>
    supabase
      .from("transactions")
      .select("client_id, category_id, trans_date, purchase_amount, purchase_vat")
      .eq("type", "매입")
      .gte("trans_date", win.from)
      .lte("trans_date", today)
      .order("id", { ascending: true })
      .range(from, to)
  );
}

// 실제로 나간 돈(공급가액 + 부가세) 기준 표 — 보고서 고정지출 칸
function cashReportOf(txs: PurchaseRow[], clients: FixedExpenseTarget[], categories: Category[], today: string) {
  return fixedExpenseReport(
    txs.map((t) => ({
      client_id: t.client_id,
      category_id: t.category_id,
      trans_date: t.trans_date,
      amount: Number(t.purchase_amount) + Number(t.purchase_vat),
    })),
    clients,
    categories.map(target),
    today
  );
}

// 예상 이익용 지정 줄 — 같은 매입으로 고정지출 표를 한 번 더 계산하되 금액을 이익 기준(공급가액, 매입세액 불공제 카테고리는 부가세
// 포함 — 매입장 이익 계산과 같은 purchaseCostOf)으로. 나누는 달(÷12·시작한 달부터·앱 기록 짧으면)은 표와 같게 정해짐. 두 표의 달 평균
// 차이 = 돌려받는 매입세액(1월 부가세 예상용).
function costRowsOf(
  txs: PurchaseRow[],
  clients: FixedExpenseTarget[],
  categories: Category[],
  today: string,
  cashReport: FixedExpenseReport
): FixedCostRow[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const report = fixedExpenseReport(
    txs.map((t) => ({
      client_id: t.client_id,
      category_id: t.category_id,
      trans_date: t.trans_date,
      amount: purchaseCostOf({
        type: "매입",
        sales_amount: 0,
        sales_vat: 0,
        purchase_amount: Number(t.purchase_amount),
        purchase_vat: Number(t.purchase_vat),
        expense_categories: t.category_id ? categoryById.get(t.category_id) ?? null : null,
      }),
    })),
    clients,
    categories.map(target),
    today
  );
  return fixedCostRows(report, cashReport);
}

/** 보고서 고정지출 칸(실제로 나간 돈 기준 표) + 예상 순이익율용 지정 줄(이익 기준). today = 한국 시각 오늘(YYYY-MM-DD) */
export async function loadFixedExpense(supabase: Supabase, today: string) {
  const [clientProbe, categoryProbe] = await Promise.all([
    supabase.from("clients").select("is_fixed_expense").limit(1),
    supabase.from("expense_categories").select("is_fixed_expense").limit(1),
  ]);
  const clientReady = !(clientProbe.error && MISSING_COLUMN.has(clientProbe.error.code ?? ""));
  const categoryReady = !(categoryProbe.error && MISSING_COLUMN.has(categoryProbe.error.code ?? ""));
  const [clients, categories, txs] = await Promise.all([
    clientReady
      ? fetchAllRows<Target>((from, to) => supabase.from("clients").select("id, name, is_fixed_expense").order("id").range(from, to))
      : fetchAllRows<Target>((from, to) => supabase.from("clients").select("id, name").order("id").range(from, to)),
    // select("*") — 비과세·불공제 칸(082·083 SQL)·고정지출 칸(102 SQL)이 없어도 조회가 깨지지 않게
    fetchAllRows<Category>((from, to) => supabase.from("expense_categories").select("*").order("id").range(from, to)),
    fetchPurchases(supabase, today),
  ]);
  const clientTargets = clients.map(target);
  const report = cashReportOf(txs, clientTargets, categories, today);
  return { clientReady, categoryReady, report, costRows: costRowsOf(txs, clientTargets, categories, today, report) };
}

/** 대시보드 예상 세전이익용 지정 줄(이익 기준)만 — 지정한 곳이 없으면 매입은 조회하지 않음. 지정 줄은 보고서와 같음
 * (지정 안 한 거래처는 지정 줄에 영향이 없어서 지정한 거래처만 읽음). */
export async function loadFixedCostRows(supabase: Supabase, today: string): Promise<FixedCostRow[]> {
  const [clientRes, categoryRes] = await Promise.all([
    supabase.from("clients").select("id, name, is_fixed_expense").eq("is_fixed_expense", true),
    supabase.from("expense_categories").select("*"),
  ]);
  if (clientRes.error && !MISSING_COLUMN.has(clientRes.error.code ?? "")) throw new Error(clientRes.error.message);
  if (categoryRes.error) throw new Error(categoryRes.error.message);
  const fixedClients = clientRes.error ? [] : ((clientRes.data ?? []) as Target[]).map(target);
  const categories = (categoryRes.data ?? []) as Category[];
  if (fixedClients.length === 0 && !categories.some((c) => c.is_fixed_expense)) return [];
  const txs = await fetchPurchases(supabase, today);
  return costRowsOf(txs, fixedClients, categories, today, cashReportOf(txs, fixedClients, categories, today));
}
