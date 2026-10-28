"use client";

import { useMemo, useState } from "react";
import { formatDate, formatWon } from "@/lib/format";
import { bulkUpdateCategoryId } from "@/lib/actions/transactions";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { inlineFieldClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export type UncategorizedRow = {
  id: string;
  date: string;
  client: string;
  item: string;
  projectName: string | null;
  total: number;
  kind: "세금" | "보험" | "금융" | null;
};
type CategoryOption = { id: string; name: string; vat_exempt?: boolean | null; vat_non_deductible?: boolean | null };
type SortKey = "date" | "client" | "item" | "kind" | "total";

const KIND_BADGE = { 세금: "red", 보험: "amber", 금융: "orange" } as const;

// 장부 점검 — 카테고리가 빈 매입(lib/ledgerCheck.ts). 세금·보험·금융으로 보이는 것만 먼저(전체로 바꿀 수 있음), 체크해서
// 카테고리를 한 번에 지정(매입장 일괄 변경과 같은 bulkUpdateCategoryId).
export function UncategorizedPurchasesTable({
  rows,
  categories,
  year,
}: {
  rows: UncategorizedRow[];
  categories: CategoryOption[];
  year: number;
}) {
  const flaggedCount = rows.filter((r) => r.kind).length;
  const [onlyFlagged, setOnlyFlagged] = useState(flaggedCount > 0);
  const [sortKey, setSortKey] = useState<SortKey>("kind");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const pending = useGlobalPending();

  // 다 지정해서 세금·금융으로 보이는 것이 없어지면 전체로(체크가 남아 빈 표가 되지 않게).
  const showOnlyFlagged = onlyFlagged && flaggedCount > 0;
  const visible = useMemo(() => (showOnlyFlagged ? rows.filter((r) => r.kind) : rows), [rows, showOnlyFlagged]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const value = (r: UncategorizedRow) => (sortKey === "kind" ? (r.kind ?? "") : r[sortKey]);
    return [...visible].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return (sortDir === "asc" ? cmp : -cmp) || b.date.localeCompare(a.date);
    });
  }, [visible, sortKey, sortDir]);

  const chosen = visible.filter((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const categoryLabel = (c: CategoryOption) =>
    `${c.name}${c.vat_exempt ? " (비과세)" : c.vat_non_deductible ? " (불공제)" : ""}`;

  async function handleAssign() {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      setError("지정할 카테고리를 골라주세요.");
      return;
    }
    const ok = await confirm(`선택한 ${chosen.length}건의 카테고리를 "${categoryLabel(category)}"(으)로 지정할까요? 금액은 그대로예요.`, {
      confirmLabel: "지정",
    });
    if (!ok) return;
    const fd = new FormData();
    chosen.forEach((r) => fd.append("transaction_ids", r.id));
    fd.append("category_id", category.id);
    const result = await pending.run(() => bulkUpdateCategoryId(fd));
    if (result?.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setSelected(new Set());
    setCategoryId("");
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">카테고리가 빈 매입이 없어요.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        카테고리가 빈 매입은 부가세 포함 금액으로 보고 매입세액 공제를 잡아요. 세금·4대보험·이자·어음할인처럼 부가세가 없는 지출은
        &quot;비과세&quot; 카테고리로 지정해야 부가세·이익 예상이 맞아요(직원 원천세·4대보험은 &quot;직원급여/상여/4대보험&quot;).
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="inline-flex items-center gap-1.5 text-slate-600">
          <input
            type="checkbox"
            checked={showOnlyFlagged}
            disabled={flaggedCount === 0}
            onChange={(e) => {
              setOnlyFlagged(e.target.checked);
              setSelected(new Set());
            }}
            className="h-4 w-4 accent-slate-900"
          />
          세금·보험·금융으로 보이는 것만 ({flaggedCount}건)
        </label>
        <span className="text-xs text-slate-400">카테고리 없는 매입 전체 {rows.length}건</span>
      </div>
      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm print:hidden">
          <span className="text-slate-600">{chosen.length}건 선택</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inlineFieldClass} w-56`}>
            <option value="">카테고리 선택</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={handleAssign}>
            카테고리 지정
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            선택 해제
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="sticky-col-table w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 pb-2 pr-2 print:hidden">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={visible.length > 0 && chosen.length === visible.length}
                  onChange={() => setSelected(chosen.length === visible.length ? new Set() : new Set(visible.map((r) => r.id)))}
                  className="h-4 w-4 accent-slate-900"
                />
              </th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("date", "날짜")}</th>
              <th className="sticky-col whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("client", "거래처")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("item", "품목")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("kind", "보이는 구분")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("total", "금액")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">프로젝트</th>
              <th className="whitespace-nowrap pb-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${selected.has(r.id) ? "bg-brand-soft" : ""}`}>
                <td className="py-2 pr-2 print:hidden">
                  <input
                    type="checkbox"
                    aria-label={`${r.item || r.client} 선택`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 accent-slate-900"
                  />
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-700">{formatDate(r.date)}</td>
                <td className="sticky-col py-2 pr-4 text-slate-800 max-md:max-w-[10rem] max-md:truncate" title={r.client || undefined}>
                  {r.client || <span className="text-slate-400">거래처 없음</span>}
                </td>
                <td className="py-2 pr-4 text-slate-700 max-md:max-w-[10rem] max-md:truncate" title={r.item || undefined}>
                  {r.item || "-"}
                </td>
                <td className="whitespace-nowrap py-2 pr-4">{r.kind ? <Badge variant={KIND_BADGE[r.kind]}>{r.kind}</Badge> : "-"}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(r.total)}</td>
                <td className="py-2 pr-4 text-slate-600 max-md:max-w-[10rem] max-md:truncate">{r.projectName ?? "일반경비"}</td>
                <td className="whitespace-nowrap py-2 text-right">
                  <LinkButton href={`/transactions?tab=check&year=${year}&editTx=${r.id}`} variant="secondary" size="xs">
                    수정
                  </LinkButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
