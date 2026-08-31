"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addAgencyPurchase, updateAgencyPurchase, deleteAgencyPurchase } from "@/lib/actions/projectAgencyPurchases";
import { formatWon } from "@/lib/format";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";

type Category = { id: string; name: string; project_only: boolean; color: string | null };
type AgencyPurchase = {
  id: string;
  item_name: string | null;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_color?: string;
  memo: string | null;
  client_name: string | null;
};

type SortKey = "client" | "item" | "category" | "amount";

function sortValue(r: AgencyPurchase, key: SortKey): string | number {
  switch (key) {
    case "client":
      return r.client_name ?? "";
    case "item":
      return r.item_name ?? "";
    case "category":
      return r.category_name ?? "";
    case "amount":
      return r.amount;
  }
}

function CategorySelect({
  value,
  onChange,
  categories,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: Category[];
  name?: string;
}) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} w-32`}>
      <option value="">미분류</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id} style={{ color: resolveCategoryColor(c) }}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function AgencyRow({
  item,
  categories,
  clientNames,
  onChanged,
}: {
  item: AgencyPurchase;
  categories: Category[];
  clientNames: string[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemName, setItemName] = useState(item.item_name ?? "");
  const [amount, setAmount] = useState(String(item.amount));
  const [categoryId, setCategoryId] = useState(item.category_id ?? "");
  const [memo, setMemo] = useState(item.memo ?? "");
  const [clientName, setClientName] = useState(item.client_name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", item.id);
    fd.append("item_name", itemName);
    fd.append("amount", amount);
    fd.append("category_id", categoryId);
    fd.append("memo", memo);
    fd.append("client_name", clientName);
    const result = await updateAgencyPurchase(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", item.id);
    const result = await deleteAgencyPurchase(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 last:border-0 align-top">
        <td className="py-2 pr-4">
          <input
            list={`agency-client-names-${item.id}`}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="매입처"
            className={`${fieldClass} w-full`}
          />
          <datalist id={`agency-client-names-${item.id}`}>
            {clientNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </td>
        <td className="py-2 pr-4">
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="품목명" className={`${fieldClass} w-full`} />
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (무슨 물품/사항인지)"
            className={`${fieldClass} mt-1 w-full text-xs`}
          />
        </td>
        <td className="py-2 pr-4">
          <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
        </td>
        <td className="py-2 pr-4 text-right">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="1"
            placeholder="금액"
            className={`${fieldClass} w-full text-right`}
          />
        </td>
        <td className="py-2 pl-2 text-right print:hidden">
          <div className="flex justify-end gap-1">
            <Button size="xs" type="button" disabled={pending} onClick={save}>
              저장
            </Button>
            <Button variant="secondary" size="xs" type="button" disabled={pending} onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 last:border-0 text-sm">
      <td className="py-2 pr-4 text-slate-700 print:py-0.5">{item.client_name ?? "-"}</td>
      <td className="py-2 pr-4 text-slate-700 print:py-0.5">
        <div>{item.item_name ?? "-"}</div>
        {item.memo && <div className="text-xs text-slate-500 print:text-[9px]">{item.memo}</div>}
      </td>
      <td
        className={`py-2 pr-4 print:py-0.5 ${item.category_name ? "" : "text-red-600"}`}
        style={item.category_name ? { color: item.category_color } : undefined}
      >
        {item.category_name ?? "미분류"}
      </td>
      <td className="py-2 pr-4 text-right font-mono text-slate-900 print:py-0.5">{formatWon(item.amount)}</td>
      <td className="py-2 pl-2 text-right print:hidden">
        {confirmDelete ? (
          <div className="flex justify-end gap-1">
            <Button variant="danger" size="xs" type="button" disabled={pending} onClick={remove}>
              확인
            </Button>
            <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            <Button variant="secondary" size="xs" type="button" onClick={() => setEditing(true)}>
              수정
            </Button>
            <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDelete(true)}>
              삭제
            </Button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function ProjectAgencyPurchaseList({
  projectId,
  items,
  categories,
  clientNames,
}: {
  projectId: string;
  items: AgencyPurchase[];
  categories: Category[];
  clientNames: string[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pending, setPending] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.amount, 0);

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  async function handleAdd(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await addAgencyPurchase(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNewCategoryId("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">대행구매액 (원청이 대신 구매해 공제한 품목)</p>
        <span className="font-mono text-sm text-slate-700">합계 {formatWon(total)}</span>
      </div>

      {items.length > 0 ? (
        <div className="mb-2 overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm print:text-[10px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4 print:pb-1">{headerButton("client", "거래처")}</th>
                <th className="pb-2 pr-4 print:pb-1">{headerButton("item", "품목")}</th>
                <th className="pb-2 pr-4 print:pb-1">{headerButton("category", "카테고리")}</th>
                <th className="pb-2 pr-4 text-right print:pb-1">{headerButton("amount", "금액")}</th>
                <th className="pb-2 text-right print:hidden">관리</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((it) => (
                <AgencyRow key={it.id} item={it} categories={categories} clientNames={clientNames} onChanged={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-2 hidden text-sm text-slate-400 print:block">대행구매 내역이 없습니다.</p>
      )}

      <form action={handleAdd} className="flex flex-wrap items-end gap-2 print:hidden">
        <input type="hidden" name="project_id" value={projectId} />
        <input list="agency-client-names-new" name="client_name" placeholder="매입처 (자유 입력)" className={`${fieldClass} w-32`} />
        <datalist id="agency-client-names-new">
          {clientNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <input name="item_name" placeholder="품목명" className={`${fieldClass} w-40`} />
        <CategorySelect name="category_id" value={newCategoryId} onChange={setNewCategoryId} categories={categories} />
        <input name="amount" type="number" step="1" placeholder="금액" required className={`${fieldClass} w-32`} />
        <input name="memo" placeholder="메모 (무슨 물품/사항인지)" className={`${fieldClass} w-full min-w-[12rem] flex-1`} />
        <Button type="submit" size="xs" disabled={pending}>
          + 추가
        </Button>
        {error && <span className="w-full text-xs text-red-600">{error}</span>}
      </form>
    </div>
  );
}
