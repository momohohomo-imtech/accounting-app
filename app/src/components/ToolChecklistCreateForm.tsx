"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createToolChecklist } from "@/lib/actions/toolChecklists";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { groupToolsBySortOrder, toolGroupLabel } from "@/lib/tools";

type Tool = { id: string; name: string; sort_order: number };
type ProjectOption = { value: string; label: string };
type AdhocItem = { key: string; name: string; quantity: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ToolChecklistCreateForm({
  tools,
  projectOptions,
  initialTitle = "",
  initialQuantities = {},
}: {
  tools: Tool[];
  projectOptions: ProjectOption[];
  initialTitle?: string;
  initialQuantities?: Record<string, string>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [title, setTitle] = useState(initialTitle);
  const [projectId, setProjectId] = useState("");
  const [tripDate, setTripDate] = useState(todayIso);
  const [quantities, setQuantities] = useState<Record<string, string>>(initialQuantities);
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = groupToolsBySortOrder(tools);
  const selectedCount =
    Object.values(quantities).filter((v) => v.trim() !== "").length +
    adhocItems.filter((a) => a.name.trim() !== "").length;

  function setQuantity(id: string, value: string) {
    setQuantities((prev) => ({ ...prev, [id]: value }));
  }

  function addAdhocItem() {
    setAdhocItems((prev) => [...prev, { key: crypto.randomUUID(), name: "", quantity: "" }]);
  }
  function updateAdhocItem(key: string, patch: Partial<AdhocItem>) {
    setAdhocItems((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  function removeAdhocItem(key: string) {
    setAdhocItems((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await confirm("체크리스트를 저장하시겠습니까?"))) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("title", title);
    fd.append("project_id", projectId);
    fd.append("trip_date", tripDate);
    for (const t of tools) {
      const qty = (quantities[t.id] ?? "").trim();
      if (qty) {
        fd.append("tool_id", t.id);
        fd.append("tool_name", t.name);
        fd.append("quantity", qty);
      }
    }
    for (const a of adhocItems) {
      const name = a.name.trim();
      if (name) {
        fd.append("tool_id", "");
        fd.append("tool_name", name);
        fd.append("quantity", a.quantity.trim() || "1");
      }
    }
    const result = await createToolChecklist(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    setProjectId("");
    setQuantities({});
    setAdhocItems([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <h3 className="font-semibold text-slate-900">새 공구명세서 만들기</h3>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: OO현장 출장 준비물"
            className={`${fieldClass} w-64`}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>프로젝트 (선택)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${fieldClass} w-56`}>
            <option value="">선택 안 함</option>
            {projectOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>출장일 (선택)</label>
          <input
            type="date"
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
            className={`${fieldClass} w-40`}
          />
        </div>
      </div>

      {tools.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 공구가 없습니다 — 아래에서 직접 추가해도 됩니다.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([sortOrder, groupTools]) => (
            <div key={sortOrder}>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">{toolGroupLabel(sortOrder)}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {groupTools.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <span className="truncate">{t.name}</span>
                    <input
                      type="text"
                      value={quantities[t.id] ?? ""}
                      onChange={(e) => setQuantity(t.id, e.target.value)}
                      placeholder="수량"
                      className="w-16 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-right text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500">임의 추가 (수동 기입 공구 또는 메모)</p>
          <button
            type="button"
            onClick={addAdhocItem}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 항목 추가
          </button>
        </div>
        {adhocItems.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {adhocItems.map((a) => (
              <div
                key={a.key}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                <input
                  value={a.name}
                  onChange={(e) => updateAdhocItem(a.key, { name: e.target.value })}
                  placeholder="품명/메모"
                  className="min-w-0 flex-1 border-none p-0 text-sm focus:outline-none"
                />
                <input
                  type="text"
                  value={a.quantity}
                  onChange={(e) => updateAdhocItem(a.key, { quantity: e.target.value })}
                  placeholder="수량"
                  className="w-14 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-right text-sm focus:border-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAdhocItem(a.key)}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || selectedCount === 0}>
          저장
        </Button>
        <span className="text-xs text-slate-400">{selectedCount}개 품목 선택됨</span>
      </div>
    </form>
  );
}
