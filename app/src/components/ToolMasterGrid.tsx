"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reorderTools } from "@/lib/actions/tools";
import { ToolEditPopup } from "@/components/ToolEditPopup";
import { groupToolsBySortOrder, toolGroupLabel } from "@/lib/tools";

type Tool = {
  id: string;
  name: string;
  sort_order: number;
  note: string | null;
  linked_tool_ids: string[];
  text_color: string | null;
};

export function ToolMasterGrid({ tools }: { tools: Tool[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Tool | null>(null);
  const groups = groupToolsBySortOrder(tools);

  async function move(groupTools: Tool[], id: string, dir: -1 | 1) {
    const idx = groupTools.findIndex((t) => t.id === id);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= groupTools.length) return;
    const reordered = [...groupTools];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const fd = new FormData();
    reordered.forEach((t) => fd.append("id", t.id));
    await reorderTools(fd);
    router.refresh();
  }

  if (tools.length === 0) {
    return <p className="text-sm text-slate-400">등록된 공구가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map(([sortOrder, groupTools]) => (
        <div key={sortOrder}>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">{toolGroupLabel(sortOrder)}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {groupTools.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="truncate text-left text-slate-700 underline decoration-slate-300 underline-offset-2 hover:opacity-70"
                  style={{ color: t.text_color ?? undefined }}
                  title={t.name}
                >
                  {t.name}
                </button>
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(groupTools, t.id, -1)}
                    className="text-[10px] leading-none text-slate-400 hover:text-slate-800 disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === groupTools.length - 1}
                    onClick={() => move(groupTools, t.id, 1)}
                    className="text-[10px] leading-none text-slate-400 hover:text-slate-800 disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <ToolEditPopup
          tool={editing}
          allTools={tools.map((t) => ({ id: t.id, name: t.name }))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
