"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createToolChecklist, updateToolChecklist } from "@/lib/actions/toolChecklists";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { groupToolsBySortOrder, toolGroupLabel } from "@/lib/tools";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";

type Tool = {
  id: string;
  name: string;
  sort_order: number;
  linked_tool_ids: string[];
  text_color: string | null;
  background_color: string | null;
  default_quantity: string | null;
  for_access_pass: boolean;
};
type AdhocItem = { key: string; name: string; quantity: string; forAccessPass: boolean };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ToolChecklistCreateForm({
  tools,
  sites,
  projects,
  checklistId,
  initialTitle = "",
  initialProjectId = "",
  initialTripDate,
  initialHelperCount = "",
  initialQuantities = {},
  initialAdhocItems = [],
}: {
  tools: Tool[];
  sites: SiteOption[];
  projects: ProjectOption[];
  /** 지정하면 새로 만드는 대신 이 id의 체크리스트를 수정(항목 전체 교체)함. */
  checklistId?: string;
  initialTitle?: string;
  initialProjectId?: string;
  initialTripDate?: string;
  initialHelperCount?: string;
  initialQuantities?: Record<string, string>;
  initialAdhocItems?: { name: string; quantity: string; forAccessPass: boolean }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const isEdit = Boolean(checklistId);
  const toolDefaultQuantities = useMemo(
    () => Object.fromEntries(tools.filter((t) => t.default_quantity).map((t) => [t.id, t.default_quantity as string])),
    [tools]
  );
  const [title, setTitle] = useState(initialTitle);
  const [helperCount, setHelperCount] = useState(initialHelperCount);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [tripDate, setTripDate] = useState(initialTripDate ?? todayIso);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.keys(initialQuantities).length > 0 || isEdit ? initialQuantities : toolDefaultQuantities
  );
  const [toolNames, setToolNames] = useState<Record<string, string>>({});
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>(
    initialAdhocItems.map((a) => ({ key: crypto.randomUUID(), ...a }))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = groupToolsBySortOrder(tools);
  const selectedCount =
    Object.values(quantities).filter((v) => v.trim() !== "").length +
    adhocItems.filter((a) => a.name.trim() !== "").length;

  function setQuantity(id: string, value: string) {
    setQuantities((prev) => {
      const wasEmpty = !(prev[id] ?? "").trim();
      const next = { ...prev, [id]: value };
      // 비어있다가 처음 선택된 순간에만, 연결된 공구들을 비어있는 경우에 한해 자동으로 같이 채움
      // (이미 값이 있는 연결 공구는 덮어쓰지 않음).
      if (wasEmpty && value.trim()) {
        const tool = tools.find((t) => t.id === id);
        for (const linkedId of tool?.linked_tool_ids ?? []) {
          if (!(next[linkedId] ?? "").trim()) next[linkedId] = "1";
        }
      }
      return next;
    });
  }

  function addAdhocItem() {
    setAdhocItems((prev) => [...prev, { key: crypto.randomUUID(), name: "", quantity: "", forAccessPass: false }]);
  }
  function updateAdhocItem(key: string, patch: Partial<AdhocItem>) {
    setAdhocItems((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  function removeAdhocItem(key: string) {
    setAdhocItems((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await confirm(isEdit ? "수정 내용을 저장하시겠습니까?" : "체크리스트를 저장하시겠습니까?"))) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    if (checklistId) fd.append("id", checklistId);
    fd.append("title", title);
    fd.append("helper_count", helperCount.trim());
    fd.append("project_id", projectId);
    fd.append("trip_date", tripDate);
    for (const t of tools) {
      const qty = (quantities[t.id] ?? "").trim();
      if (qty) {
        fd.append("tool_id", t.id);
        fd.append("tool_name", (toolNames[t.id] ?? t.name).trim() || t.name);
        fd.append("quantity", qty);
        fd.append("for_access_pass", String(t.for_access_pass));
      }
    }
    for (const a of adhocItems) {
      const name = a.name.trim();
      if (name) {
        fd.append("tool_id", "");
        fd.append("tool_name", name);
        fd.append("quantity", a.quantity.trim() || "1");
        fd.append("for_access_pass", String(a.forAccessPass));
      }
    }
    const result = await globalPending.run(() => (isEdit ? updateToolChecklist(fd) : createToolChecklist(fd)));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (isEdit) {
      router.push("/quality-construction?tab=tools");
      return;
    }
    setTitle("");
    setHelperCount("");
    setProjectId("");
    setQuantities(toolDefaultQuantities);
    setToolNames({});
    setAdhocItems([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{isEdit ? "공구명세서 수정" : "새 공구명세서 만들기"}</h3>
        {isEdit && (
          <button
            type="button"
            onClick={() => router.push("/quality-construction?tab=tools")}
            className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            수정 취소
          </button>
        )}
      </div>
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
          <label className={labelClass}>조공 (선택)</label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-900">조공</span>
            <input
              type="number"
              min={0}
              value={helperCount}
              onChange={(e) => setHelperCount(e.target.value)}
              placeholder="0"
              className={`${fieldClass} w-16`}
            />
          </div>
        </div>
        <div className="w-72">
          <ProjectPicker
            sites={sites}
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            label="프로젝트 (선택)"
            emptyLabel="선택 안 함"
          />
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
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                    style={{ backgroundColor: t.background_color ?? undefined }}
                  >
                    <input
                      value={toolNames[t.id] ?? t.name}
                      onChange={(e) => setToolNames((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      title="이 명세서에서만 표시될 이름 — 공구 마스터의 이름은 바뀌지 않음"
                      className="min-w-0 flex-1 truncate border-none bg-transparent p-0 text-sm focus:outline-none"
                      style={{ color: t.text_color ?? undefined }}
                    />
                    <input
                      type="text"
                      value={quantities[t.id] ?? ""}
                      onChange={(e) => setQuantity(t.id, e.target.value)}
                      className="w-16 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-right text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
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
                  className="w-14 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-right text-sm focus:border-slate-500 focus:outline-none"
                />
                <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500" title="반입반출증용">
                  <input
                    type="checkbox"
                    checked={a.forAccessPass}
                    onChange={(e) => updateAdhocItem(a.key, { forAccessPass: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  반입반출
                </label>
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
          {isEdit ? "수정 저장" : "저장"}
        </Button>
        <span className="text-xs text-slate-400">{selectedCount}개 품목 선택됨</span>
      </div>
    </form>
  );
}
