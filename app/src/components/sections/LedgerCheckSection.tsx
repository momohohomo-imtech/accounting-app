import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { transactionTotal } from "@/lib/credit";
import { clientLabel, findDuplicateCandidates, uncategorizedPurchases, type LedgerCheckRow } from "@/lib/ledgerCheck";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { YearFilter } from "@/components/YearFilter";
import { DuplicateCandidatesTable, type DuplicateGroup } from "@/components/DuplicateCandidatesTable";
import { UncategorizedPurchasesTable, type UncategorizedRow } from "@/components/UncategorizedPurchasesTable";
import { TransactionHistoryTable } from "@/components/TransactionHistoryTable";
import { loadTransactionHistory } from "@/lib/transactionHistoryLoad";

type CheckTx = LedgerCheckRow & {
  payment_type: string;
  created_at: string | null;
  projects?: { name: string } | null;
  expense_categories?: { name: string } | null;
};

// 매입매출 "장부 점검" 탭(사용자 요청) — 그 해 거래 중 중복 의심 거래와 카테고리가 빈 매입. 찾기만 하고 고치는 건 수정·삭제·
// 카테고리 지정으로(계산은 lib/ledgerCheck.ts). 외상 정산 전 거래도 포함(장부 표시와 상관없이 등록된 거래 전부).
export async function LedgerCheckSection({ year, years }: { year: number; years: number[] }) {
  const supabase = await createClient();
  const [rows, { data: categories }, history] = await Promise.all([
    fetchAllRows<CheckTx>((from, to) =>
      supabase
        .from("transactions")
        .select("*, clients(name), projects(name), expense_categories(name)")
        .gte("trans_date", `${year}-01-01`)
        .lte("trans_date", `${year}-12-31`)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    // select("*") — 비과세·불공제 칸(082·083 SQL) 실행 전에도 조회가 깨지지 않게.
    supabase.from("expense_categories").select("*").order("sort_order"),
    // 최근 수정·삭제 이력(094 SQL 실행 전이면 null) — 연도와 상관없이 최근 100건.
    loadTransactionHistory(supabase, { limit: 100 }),
  ]);

  const duplicateGroups: DuplicateGroup[] = findDuplicateCandidates(rows).map((g) => ({
    key: g.key,
    date: g.date,
    type: g.type,
    client: g.client,
    item: g.item,
    total: g.total,
    lines: [...g.rows]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map((t) => ({
        id: t.id,
        projectName: t.projects?.name ?? null,
        categoryName: t.expense_categories?.name ?? null,
        credit: t.payment_type === "credit",
        createdAt: t.created_at,
      })),
  }));
  const uncategorized: UncategorizedRow[] = uncategorizedPurchases(rows).map((t) => ({
    id: t.id,
    date: t.trans_date,
    client: clientLabel(t),
    item: t.item_name ?? "",
    projectName: t.projects?.name ?? null,
    total: transactionTotal(t),
    kind: t.kind,
  }));
  const flagged = uncategorized.filter((r) => r.kind).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {year}년에 등록된 거래 {rows.length.toLocaleString()}건 중 확인이 필요해 보이는 거래예요. 찾기만 하고 바꾸지 않아요.
        </p>
        <YearFilter basePath="/transactions" extraParams={{ tab: "check" }} years={years} selectedYear={year} />
      </div>
      <CollapsibleSection
        defaultOpen
        title={
          <span>
            중복 의심 거래 <span className="text-sm font-normal text-slate-500">{duplicateGroups.length}묶음</span>
          </span>
        }
      >
        <DuplicateCandidatesTable groups={duplicateGroups} year={year} />
      </CollapsibleSection>
      <CollapsibleSection
        defaultOpen
        title={
          <span>
            카테고리가 빈 매입{" "}
            <span className="text-sm font-normal text-slate-500">
              세금·보험·금융으로 보이는 것 {flagged}건 · 전체 {uncategorized.length}건
            </span>
          </span>
        }
      >
        <UncategorizedPurchasesTable rows={uncategorized} categories={categories ?? []} year={year} />
      </CollapsibleSection>
      <CollapsibleSection
        title={
          <span>
            최근 수정·삭제 이력{" "}
            <span className="text-sm font-normal text-slate-500">{history ? `최근 ${history.length}건` : "094 SQL 실행 후 표시"}</span>
          </span>
        }
      >
        {history ? (
          <TransactionHistoryTable rows={history} year={year} />
        ) : (
          <p className="text-sm text-slate-400">
            Supabase에서 094 SQL(거래 수정 이력)을 실행하면 그때부터 거래를 고치거나 지울 때마다 기록이 남아요.
          </p>
        )}
      </CollapsibleSection>
    </div>
  );
}
