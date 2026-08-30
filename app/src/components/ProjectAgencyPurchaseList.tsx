"use client";

import { useState } from "react";
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
};

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
  onChanged,
}: {
  item: AgencyPurchase;
  categories: Category[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemName, setItemName] = useState(item.item_name ?? "");
  const [amount, setAmount] = useState(String(item.amount));
  const [categoryId, setCategoryId] = useState(item.category_id ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const fd = new FormData();
    fd.append("id", item.id);
    fd.append("item_name", itemName);
    fd.append("amount", amount);
    fd.append("category_id", categoryId);
    await updateAgencyPurchase(fd);
    setPending(false);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setPending(true);
    const fd = new FormData();
    fd.append("id", item.id);
    await deleteAgencyPurchase(fd);
    setPending(false);
    onChanged();
  }

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
        <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="품목명" className={`${fieldClass} w-40`} />
        <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="1"
          placeholder="금액"
          className={`${fieldClass} w-32`}
        />
        <Button size="xs" type="button" disabled={pending} onClick={save}>
          저장
        </Button>
        <Button variant="secondary" size="xs" type="button" disabled={pending} onClick={() => setEditing(false)}>
          취소
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className="flex-1 truncate text-slate-700">{item.item_name ?? "-"}</span>
      <span
        className={item.category_name ? undefined : "text-red-600"}
        style={{ color: item.category_name ? item.category_color : undefined }}
      >
        {item.category_name ?? "미분류"}
      </span>
      <span className="font-mono text-slate-900">{formatWon(item.amount)}</span>
      {confirmDelete ? (
        <span className="flex items-center gap-1">
          <Button variant="danger" size="xs" type="button" disabled={pending} onClick={remove}>
            확인
          </Button>
          <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Button variant="secondary" size="xs" type="button" onClick={() => setEditing(true)}>
            수정
          </Button>
          <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDelete(true)}>
            삭제
          </Button>
        </span>
      )}
    </li>
  );
}

export function ProjectAgencyPurchaseList({
  projectId,
  items,
  categories,
}: {
  projectId: string;
  items: AgencyPurchase[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");

  const total = items.reduce((s, i) => s + i.amount, 0);

  async function handleAdd(formData: FormData) {
    setPending(true);
    await addAgencyPurchase(formData);
    setPending(false);
    setNewCategoryId("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3 print:hidden">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">대행구매액 (원청이 대신 구매해 공제한 품목)</p>
        <span className="font-mono text-sm text-slate-700">합계 {formatWon(total)}</span>
      </div>

      {items.length > 0 && (
        <ul className="mb-2 divide-y divide-slate-100">
          {items.map((it) => (
            <AgencyRow key={it.id} item={it} categories={categories} onChanged={() => router.refresh()} />
          ))}
        </ul>
      )}

      <form action={handleAdd} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <input name="item_name" placeholder="품목명" className={`${fieldClass} w-40`} />
        <CategorySelect name="category_id" value={newCategoryId} onChange={setNewCategoryId} categories={categories} />
        <input name="amount" type="number" step="1" placeholder="금액" required className={`${fieldClass} w-32`} />
        <Button type="submit" size="xs" disabled={pending}>
          + 추가
        </Button>
      </form>
    </div>
  );
}
