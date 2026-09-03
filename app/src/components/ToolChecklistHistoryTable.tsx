"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { deleteToolChecklist } from "@/lib/actions/toolChecklists";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type HistoryRow = {
  id: string;
  title: string;
  project_name: string | null;
  trip_date: string | null;
  item_count: number;
  created_at: string;
};

type SortKey = "title" | "project_name" | "trip_date" | "item_count" | "created_at";

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!(await confirm("이 체크리스트를 삭제하시겠습니까?", { danger: true }))) return;
    setPending(true);
    const fd = new FormData();
    fd.append("id", id);
    await globalPending.run(() => deleteToolChecklist(fd));
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="danger" size="xs" type="button" disabled={pending} onClick={handleDelete}>
      삭제
    </Button>
  );
}

export function ToolChecklistHistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp =
        typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("title", "제목")}</th>
            <th className="pb-2 pr-4">{headerButton("project_name", "프로젝트")}</th>
            <th className="pb-2 pr-4">{headerButton("trip_date", "출장일")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("item_count", "공구 개수")}</th>
            <th className="pb-2 pr-4">{headerButton("created_at", "저장일")}</th>
            <th className="pb-2 text-right print:hidden">관리</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <Link
                  href={`/quality-construction?tab=tools&checklist=${r.id}`}
                  className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  {r.title}
                </Link>
              </td>
              <td className="py-2 pr-4 text-slate-600">{r.project_name ?? "-"}</td>
              <td className="py-2 pr-4 text-slate-600">{r.trip_date ? formatDate(r.trip_date) : "-"}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{r.item_count}개</td>
              <td className="py-2 pr-4 text-slate-500">{formatDate(r.created_at)}</td>
              <td className="py-2 text-right print:hidden">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/quality-construction?tab=tools&editFrom=${r.id}`}
                    className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    수정
                  </Link>
                  <Link
                    href={`/quality-construction?tab=tools&copyFrom=${r.id}`}
                    className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    복사
                  </Link>
                  <DeleteButton id={r.id} />
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-400">
                저장된 체크리스트가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
