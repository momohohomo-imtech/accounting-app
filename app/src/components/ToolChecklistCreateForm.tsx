"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createToolChecklist } from "@/lib/actions/toolChecklists";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";

type Tool = { id: string; name: string; category: string | null };
type ProjectOption = { value: string; label: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function groupByCategory(tools: Tool[]): [string, Tool[]][] {
  const map = new Map<string, Tool[]>();
  for (const t of tools) {
    const key = t.category ?? "미분류";
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return Array.from(map.entries());
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
  initialQuantities?: Record<string, number>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [title, setTitle] = useState(initialTitle);
  const [projectId, setProjectId] = useState("");
  const [tripDate, setTripDate] = useState(todayIso);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialQuantities).map(([id, q]) => [id, String(q)]))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = groupByCategory(tools);
  const selectedCount = Object.values(quantities).filter((v) => Number(v) > 0).length;

  function setQuantity(id: string, value: string) {
    setQuantities((prev) => ({ ...prev, [id]: value }));
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
      const qty = Number(quantities[t.id]) || 0;
      if (qty > 0) {
        fd.append("tool_id", t.id);
        fd.append("tool_name", t.name);
        fd.append("quantity", String(qty));
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
        <p className="text-sm text-slate-400">먼저 위에서 공구를 등록해주세요.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([category, groupTools]) => (
            <div key={category}>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">{category}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {groupTools.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <span className="truncate">{t.name}</span>
                    <input
                      type="number"
                      min={0}
                      value={quantities[t.id] ?? ""}
                      onChange={(e) => setQuantity(t.id, e.target.value)}
                      placeholder="0"
                      className="w-14 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-right text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || tools.length === 0 || selectedCount === 0}>
          저장
        </Button>
        <span className="text-xs text-slate-400">{selectedCount}개 품목 선택됨</span>
      </div>
    </form>
  );
}
