"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createToolChecklist } from "@/lib/actions/toolChecklists";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";

type Tool = { id: string; name: string };
type ProjectOption = { value: string; label: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ToolChecklistCreateForm({
  tools,
  projectOptions,
  initialTitle = "",
  initialCheckedIds = [],
}: {
  tools: Tool[];
  projectOptions: ProjectOption[];
  initialTitle?: string;
  initialCheckedIds?: string[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [title, setTitle] = useState(initialTitle);
  const [projectId, setProjectId] = useState("");
  const [tripDate, setTripDate] = useState(todayIso);
  const [checked, setChecked] = useState<Set<string>>(new Set(initialCheckedIds));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      if (checked.has(t.id)) {
        fd.append("tool_id", t.id);
        fd.append("tool_name", t.name);
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
    setChecked(new Set());
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <h3 className="font-semibold text-slate-900">새 체크리스트 만들기</h3>
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {tools.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4" />
              {t.name}
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending || tools.length === 0}>
        저장
      </Button>
    </form>
  );
}
