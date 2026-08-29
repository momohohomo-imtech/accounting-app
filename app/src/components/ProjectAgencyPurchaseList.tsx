"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAgencyPurchase, deleteAgencyPurchase } from "@/lib/actions/projectAgencyPurchases";
import { formatWon } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";

type AgencyPurchase = { id: string; item_name: string | null; amount: number };

export function ProjectAgencyPurchaseList({ projectId, items }: { projectId: string; items: AgencyPurchase[] }) {
  const router = useRouter();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = items.reduce((s, i) => s + i.amount, 0);

  async function handleAdd(formData: FormData) {
    setPending(true);
    await addAgencyPurchase(formData);
    setPending(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setPending(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteAgencyPurchase(fd);
    setPending(false);
    setConfirmDeleteId(null);
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
            <li key={it.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="flex-1 truncate text-slate-700">{it.item_name ?? "-"}</span>
              <span className="font-mono text-slate-900">{formatWon(it.amount)}</span>
              {confirmDeleteId === it.id ? (
                <span className="flex items-center gap-1">
                  <Button variant="danger" size="xs" type="button" disabled={pending} onClick={() => handleDelete(it.id)}>
                    확인
                  </Button>
                  <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                    취소
                  </Button>
                </span>
              ) : (
                <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(it.id)}>
                  삭제
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={handleAdd} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <input name="item_name" placeholder="품목명" className={`${fieldClass} w-40`} />
        <input name="amount" type="number" step="1" placeholder="금액" required className={`${fieldClass} w-32`} />
        <Button type="submit" size="xs" disabled={pending}>
          + 추가
        </Button>
      </form>
    </div>
  );
}
