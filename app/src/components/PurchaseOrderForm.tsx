"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderInput,
  type PurchaseOrderItemInput,
} from "@/lib/actions/purchaseOrders";
import { PURCHASE_ORDER_STATUS_OPTIONS } from "@/lib/purchaseOrderStatus";
import { formatWon } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type ClientOption = { id: string; name: string };

function emptyItem(): PurchaseOrderItemInput {
  return { item_name: "", spec: "", quantity: null, unit_price: null, amount: 0 };
}

export function PurchaseOrderForm({
  clients,
  sites,
  projects,
  initial,
  initialItems,
  purchaseOrderId,
}: {
  clients: ClientOption[];
  sites: SiteOption[];
  projects: ProjectOption[];
  initial?: {
    title: string;
    client_id: string | null;
    client_name_raw: string | null;
    project_id: string | null;
    status: string;
    expected_date: string | null;
    memo: string | null;
  };
  initialItems?: PurchaseOrderItemInput[];
  purchaseOrderId?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    client_id: initial?.client_id ?? "",
    client_name_raw: initial?.client_name_raw ?? "",
    project_id: initial?.project_id ?? "",
    status: initial?.status ?? "draft",
    expected_date: initial?.expected_date ?? "",
    memo: initial?.memo ?? "",
  });
  const [items, setItems] = useState<PurchaseOrderItemInput[]>(initialItems?.length ? initialItems : [emptyItem()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof values>(key: K, v: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function updateItem(i: number, patch: Partial<PurchaseOrderItemInput>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function handleQuantity(i: number, v: string) {
    const quantity = v ? Number(v) : null;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, quantity };
        if (quantity && it.unit_price) next.amount = quantity * it.unit_price;
        return next;
      })
    );
  }

  function handleUnitPrice(i: number, v: string) {
    const unit_price = v ? Number(v) : null;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, unit_price };
        if (it.quantity && unit_price) next.amount = it.quantity * unit_price;
        return next;
      })
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = items.reduce((s, it) => s + (it.amount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!(await confirm(purchaseOrderId ? "수정 내용을 저장하시겠습니까?" : "발주서를 등록하시겠습니까?"))) return;

    setError(null);
    setPending(true);
    const input: PurchaseOrderInput = {
      title: values.title,
      client_id: values.client_id || null,
      client_name_raw: values.client_name_raw || null,
      project_id: values.project_id || null,
      status: values.status,
      expected_date: values.expected_date || null,
      memo: values.memo || null,
      items,
    };
    let targetId = purchaseOrderId;
    if (purchaseOrderId) {
      const result = await globalPending.run(() => updatePurchaseOrder(purchaseOrderId, input));
      setPending(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
    } else {
      const result = await globalPending.run(() => createPurchaseOrder(input));
      setPending(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
      targetId = result?.id;
    }
    router.push(targetId ? `/purchase-orders/${targetId}/edit` : "/projects?tab=purchase_orders");
    router.refresh();
  }

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className={labelClass}>제목 *</label>
          <input
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="예: 컨베이어 구동부 부속 발주"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상태</label>
          <select value={values.status} onChange={(e) => set("status", e.target.value)} className={inputClass}>
            {PURCHASE_ORDER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>매입처 (등록됨)</label>
          <select value={values.client_id} onChange={(e) => set("client_id", e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>매입처 (자유 입력)</label>
          <input
            value={values.client_name_raw}
            onChange={(e) => set("client_name_raw", e.target.value)}
            placeholder="등록 안 된 매입처면 직접 입력"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>입고예정일</label>
          <input
            type="date"
            value={values.expected_date}
            onChange={(e) => set("expected_date", e.target.value)}
            className={inputClass}
          />
        </div>
        <ProjectPicker
          sites={sites}
          projects={projects}
          value={values.project_id}
          onChange={(v) => set("project_id", v)}
          label="연결 프로젝트 (선택)"
          emptyLabel="연결 프로젝트 없음"
        />
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <label className={labelClass}>메모</label>
          <textarea value={values.memo} onChange={(e) => set("memo", e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">품목</h2>
          <button
            type="button"
            onClick={addItem}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 품목 추가
          </button>
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_5rem_7rem_8rem_3rem] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
            <span>품목명</span>
            <span>규격</span>
            <span>수량</span>
            <span>단가</span>
            <span>금액</span>
            <span />
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_1fr_5rem_7rem_8rem_3rem] sm:border-0 sm:p-0">
              <input value={it.item_name} onChange={(e) => updateItem(i, { item_name: e.target.value })} placeholder="품목명" className={inputClass} />
              <input value={it.spec} onChange={(e) => updateItem(i, { spec: e.target.value })} placeholder="규격" className={inputClass} />
              <input
                type="number"
                value={it.quantity ?? ""}
                onChange={(e) => handleQuantity(i, e.target.value)}
                placeholder="수량"
                className={inputClass}
              />
              <input
                type="number"
                value={it.unit_price ?? ""}
                onChange={(e) => handleUnitPrice(i, e.target.value)}
                placeholder="단가"
                className={inputClass}
              />
              <input
                type="number"
                value={it.amount || ""}
                onChange={(e) => updateItem(i, { amount: Number(e.target.value) || 0 })}
                placeholder="금액"
                className={inputClass}
              />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-500 hover:text-red-700">
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-3 text-right text-sm font-semibold text-slate-900">
          합계 <span className="ml-1 font-mono text-base">{formatWon(total)}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {purchaseOrderId ? "수정 저장" : "발주서 등록"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/projects?tab=purchase_orders")}>
          취소
        </Button>
      </div>
    </form>
  );
}
