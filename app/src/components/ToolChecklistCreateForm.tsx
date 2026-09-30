"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createToolChecklist, updateToolChecklist } from "@/lib/actions/toolChecklists";
import { Button } from "@/components/ui/Button";
import { fieldClass, inlineFieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { groupToolsBySortOrder, toolGroupLabel } from "@/lib/tools";
import { cx } from "@/lib/cx";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { todayString } from "@/lib/format";

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
  return todayString();
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
  initialMemo = "",
  initialQuantities = {},
  initialToolNames = {},
  initialAdhocItems = [],
  hasSource = false,
  onSaved,
  onCancel,
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
  initialMemo?: string;
  initialQuantities?: Record<string, string>;
  /** 이 명세서에서만 다르게 저장된 공구 이름(공구 id별) — 수정 화면을 다시 열 때 복원됨. */
  initialToolNames?: Record<string, string>;
  initialAdhocItems?: { name: string; quantity: string; forAccessPass: boolean }[];
  /** 수정 또는 복사(기존 명세서를 원본으로 시작)인 경우 true — 원본에 실제로 담긴 품목이
      없더라도(예: 임의 추가만 있던 명세서) 공구별 기본 수량을 자동으로 채우지 않게 함. */
  hasSource?: boolean;
  /** 팝업 안에서 수정할 때(`ToolChecklistPopup`) — 저장 뒤·취소 때 페이지를 옮기는 대신 불러서 팝업이 보기 화면으로 돌아감. */
  onSaved?: () => void;
  onCancel?: () => void;
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
  const [memo, setMemo] = useState(initialMemo);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [tripDate, setTripDate] = useState(initialTripDate ?? todayIso);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.keys(initialQuantities).length > 0 || isEdit || hasSource ? initialQuantities : toolDefaultQuantities
  );
  const [toolNames, setToolNames] = useState<Record<string, string>>(initialToolNames);
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>(
    initialAdhocItems.map((a) => ({ key: crypto.randomUUID(), ...a }))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = groupToolsBySortOrder(tools);
  const isSelected = (id: string) => (quantities[id] ?? "").trim() !== "";
  // 저장될 품목(수량 적은 공구 + 이름 적은 임의 추가) — 아래 "담긴 품목" 요약·개수에 씀.
  const selectedTools = groups.flatMap(([, groupTools]) => groupTools).filter((t) => isSelected(t.id));
  const namedAdhocItems = adhocItems.filter((a) => a.name.trim() !== "");
  const selectedCount = selectedTools.length + namedAdhocItems.length;

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

  // "담긴 품목" 칩을 누르면 목록의 그 품목 수량칸으로 가서 바로 고칠 수 있게 함.
  function focusQuantity(inputId: string) {
    const el = document.getElementById(inputId);
    if (!(el instanceof HTMLInputElement)) return;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
    el.select();
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
    fd.append("memo", memo.trim());
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
      if (onSaved) onSaved();
      else router.push("/quality-construction?tab=tools", { scroll: false });
      return;
    }
    setTitle("");
    setHelperCount("");
    setMemo("");
    setProjectId("");
    setQuantities(toolDefaultQuantities);
    setToolNames({});
    setAdhocItems([]);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 print:hidden"
    >
      {isEdit && !onCancel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push("/quality-construction?tab=tools", { scroll: false })}
            className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            수정 취소
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="flex w-full flex-col gap-1 sm:w-64">
          <label className={labelClass}>제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: OO현장 출장 준비물"
            className={fieldClass}
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
              className={`${inlineFieldClass} w-20`}
            />
          </div>
        </div>
        <div className="w-full sm:w-72">
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
            className={`${inlineFieldClass} w-40`}
          />
        </div>
      </div>

      {tools.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 공구가 없습니다 — 아래에서 직접 추가해도 됩니다.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(([sortOrder, groupTools]) => {
            const groupSelected = groupTools.filter((t) => isSelected(t.id)).length;
            return (
              <section key={sortOrder} className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-md:p-2">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
                  <h3 className="text-sm font-bold text-slate-900">{toolGroupLabel(sortOrder)}</h3>
                  <span className="text-xs text-slate-400">{groupTools.length}개</span>
                  {groupSelected > 0 && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {groupSelected}개 선택
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
                  {groupTools.map((t) => {
                    const selected = isSelected(t.id);
                    return (
                      <div
                        key={t.id}
                        className={cx(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition-colors",
                          selected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-400",
                          !t.background_color && "bg-white"
                        )}
                        style={{ backgroundColor: t.background_color ?? undefined }}
                      >
                        {selected && (
                          <span
                            aria-hidden
                            className="shrink-0 text-xs font-bold text-slate-900"
                            style={{ color: t.text_color ?? undefined }}
                          >
                            ✓
                          </span>
                        )}
                        {/* globals.css가 입력칸 배경·글자색을 흰색·검정으로 고정해서(레이어 밖 규칙이라
                            bg·text 색 클래스가 안 먹음) 입력칸 색은 style로 줌. */}
                        <input
                          value={toolNames[t.id] ?? t.name}
                          onChange={(e) => setToolNames((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          title="이 명세서에서만 표시될 이름 — 공구 마스터의 이름은 바뀌지 않음"
                          aria-label={`${t.name} 이름`}
                          className={cx(
                            "min-w-0 flex-1 truncate border-none p-0 text-sm focus:outline-none",
                            selected && "font-semibold"
                          )}
                          style={{
                            backgroundColor: "transparent",
                            color: t.text_color ?? (selected ? undefined : "var(--color-slate-600)"),
                          }}
                        />
                        <input
                          id={`tool-qty-${t.id}`}
                          type="text"
                          value={quantities[t.id] ?? ""}
                          onChange={(e) => setQuantity(t.id, e.target.value)}
                          aria-label={`${t.name} 수량`}
                          className={cx(
                            "w-16 shrink-0 rounded-md border px-1.5 py-0.5 text-right text-sm focus:outline-none",
                            selected ? "border-slate-900 font-semibold" : "border-slate-200 focus:border-slate-500"
                          )}
                          style={selected ? undefined : { backgroundColor: "var(--color-slate-100)" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="rounded-xl border border-dashed border-slate-300 p-3 max-md:p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-slate-900">임의 추가</span>
            <span className="text-xs text-slate-400">목록에 없는 공구 직접 입력</span>
          </p>
          <Button type="button" variant="secondary" size="xs" onClick={addAdhocItem}>
            + 항목 추가
          </Button>
        </div>
        {adhocItems.length > 0 && (
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-1.5">
            {adhocItems.map((a) => {
              const named = a.name.trim() !== "";
              return (
                <div
                  key={a.key}
                  className={cx(
                    "flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-sm",
                    named ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                  )}
                >
                  <input
                    value={a.name}
                    onChange={(e) => updateAdhocItem(a.key, { name: e.target.value })}
                    placeholder="품명/메모"
                    aria-label="임의 추가 품명"
                    className={cx(
                      "min-w-0 flex-1 border-none p-0 text-sm focus:outline-none",
                      named && "font-semibold"
                    )}
                  />
                  <input
                    id={`adhoc-qty-${a.key}`}
                    type="text"
                    value={a.quantity}
                    onChange={(e) => updateAdhocItem(a.key, { quantity: e.target.value })}
                    placeholder="1"
                    aria-label="임의 추가 수량"
                    className="w-14 shrink-0 rounded-md border border-slate-300 px-1.5 py-0.5 text-right text-sm focus:border-slate-500 focus:outline-none"
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
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>메모 (선택, 인쇄 시 표시됨)</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 오전 7시 집합, 현장 도착 후 사무실에 연락"
          rows={2}
          className={`${fieldClass} resize-y`}
        />
      </div>

      {selectedCount > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 max-md:p-2">
          <p className="mb-2 px-0.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">담긴 품목 {selectedCount}개</span> · 누르면 그 품목 수량칸으로 이동
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => focusQuantity(`tool-qty-${t.id}`)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-slate-400"
              >
                {(toolNames[t.id] ?? t.name).trim() || t.name}{" "}
                <span className="font-semibold text-slate-900">{quantities[t.id].trim()}</span>
              </button>
            ))}
            {namedAdhocItems.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => focusQuantity(`adhoc-qty-${a.key}`)}
                className="rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-slate-400"
              >
                {a.name.trim()} <span className="font-semibold text-slate-900">{a.quantity.trim() || "1"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || selectedCount === 0}>
          {isEdit ? "수정 저장" : "저장"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            취소
          </Button>
        )}
        <span className="text-sm text-slate-500">{selectedCount}개 품목 선택됨</span>
      </div>
    </form>
  );
}
