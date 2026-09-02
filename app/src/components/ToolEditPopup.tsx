"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTool, deleteTool } from "@/lib/actions/tools";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useConfirm } from "@/components/ConfirmProvider";
import { TOOL_COLORS } from "@/lib/toolColors";

type Tool = {
  id: string;
  name: string;
  sort_order: number;
  note: string | null;
  linked_tool_ids: string[];
  text_color: string | null;
  background_color: string | null;
};
type ToolOption = { id: string; name: string };

function ColorSwatchPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (hex: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            value === null ? "border-slate-900 font-semibold text-slate-900" : "border-slate-300 text-slate-500"
          }`}
        >
          없음
        </button>
        {TOOL_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            className={`h-6 w-6 rounded-full border ${value === c.hex ? "border-2 border-slate-900" : "border-slate-300"}`}
            style={{ backgroundColor: c.hex }}
            title={c.label}
          />
        ))}
      </div>
    </div>
  );
}

export function ToolEditPopup({
  tool,
  allTools,
  onClose,
}: {
  tool: Tool;
  allTools: ToolOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = useState(tool.name);
  const [sortOrder, setSortOrder] = useState(String(tool.sort_order));
  const [note, setNote] = useState(tool.note ?? "");
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(tool.linked_tool_ids));
  const [textColor, setTextColor] = useState<string | null>(tool.text_color);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(tool.background_color);
  const [linkFilter, setLinkFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(true, onClose);

  function toggleLinked(id: string) {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const linkableTools = allTools.filter(
    (t) => t.id !== tool.id && t.name.toLowerCase().includes(linkFilter.trim().toLowerCase())
  );

  async function handleSave() {
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", tool.id);
    fd.append("name", name);
    fd.append("sort_order", sortOrder);
    fd.append("note", note);
    fd.append("text_color", textColor ?? "");
    fd.append("background_color", backgroundColor ?? "");
    linkedIds.forEach((id) => fd.append("linked_tool_id", id));
    const result = await updateTool(fd);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    setSaving(true);
    const fd = new FormData();
    fd.append("id", tool.id);
    const result = await deleteTool(fd);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">공구 수정</h2>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>공구명</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>순번</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>메모</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldClass} />
            </div>

            <ColorSwatchPicker label="글씨색" value={textColor} onChange={setTextColor} />
            <ColorSwatchPicker label="배경색" value={backgroundColor} onChange={setBackgroundColor} />

            <div className="flex flex-col gap-1">
              <label className={labelClass}>연결 공구 (이 공구를 고르면 같이 자동 선택됨)</label>
              <input
                value={linkFilter}
                onChange={(e) => setLinkFilter(e.target.value)}
                placeholder="공구명 검색"
                className={fieldClass}
              />
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {linkableTools.length === 0 ? (
                  <p className="py-2 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {linkableTools.map((t) => (
                      <label key={t.id} className="flex items-center gap-1.5 truncate text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={linkedIds.has(t.id)}
                          onChange={() => toggleLinked(t.id)}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {linkedIds.size > 0 && (
                <p className="text-xs text-slate-400">{linkedIds.size}개 선택됨</p>
              )}
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex items-center justify-between gap-2">
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                <Button type="button" variant="danger" size="xs" disabled={saving} onClick={handleDelete}>
                  확인
                </Button>
                <Button type="button" variant="secondary" size="xs" onClick={() => setConfirmingDelete(false)}>
                  취소
                </Button>
              </div>
            ) : (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                삭제
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                닫기
              </Button>
              <Button type="button" size="sm" disabled={saving || !name.trim()} onClick={handleSave}>
                저장
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
