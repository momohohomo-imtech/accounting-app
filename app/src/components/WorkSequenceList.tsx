"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyRow, Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { deleteWorkSequence } from "@/lib/actions/workSequences";
import { kstDate } from "@/lib/memoExport";
import { UNIT_LABEL, type SequenceUnit } from "@/lib/workSequence";

export type WorkSequenceListRow = {
  id: string;
  project_name: string;
  site_name: string;
  title: string;
  unit: SequenceUnit;
  /** 정렬용 시작일(없으면 "") */
  start_date: string;
  rangeLabel: string;
  stepCount: number;
  doneCount: number;
  updated_at: string;
};

type SortKey = "project_name" | "title" | "site_name" | "unit" | "start_date" | "stepCount" | "done" | "updated_at";

// 공사 작업 순서표 목록(사용자 요청 11/2) — 줄을 누르거나 "열기"로 순서표 팝업(주소 ?seq=, 뒤로가기로 닫힘). 머리글로 정렬.
export function WorkSequenceList({ rows, openHref }: { rows: WorkSequenceListRow[]; openHref: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const value = (r: WorkSequenceListRow): string | number =>
      sortKey === "done" ? (r.stepCount ? r.doneCount / r.stepCount : -1) : r[sortKey];
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function header(key: SortKey, label: string, className?: string) {
    return (
      <Th className={className}>
        <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
          {label}
          {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
        </button>
      </Th>
    );
  }

  async function handleDelete(row: WorkSequenceListRow) {
    if (
      !(await confirm(`"${row.title}" 순서표와 단계 ${row.stepCount}개를 삭제할까요? 되돌릴 수 없습니다.`, { danger: true }))
    )
      return;
    setError(null);
    const result = await pending.run(() => deleteWorkSequence(row.id));
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Table className="min-w-[860px]">
        <THead>
          {header("project_name", "프로젝트", "pr-4")}
          {header("title", "제목", "pr-4")}
          {header("site_name", "현장", "pr-4")}
          {header("unit", "단위", "pr-4")}
          {header("start_date", "일정", "pr-4")}
          {header("stepCount", "단계", "pr-4 text-right")}
          {header("done", "완료", "pr-4 text-right")}
          {header("updated_at", "수정일", "pr-4")}
          <Th className="text-right">관리</Th>
        </THead>
        <tbody>
          {sorted.map((r) => (
            <Tr key={r.id} className="cursor-pointer" onClick={() => router.push(`${openHref}${r.id}`, { scroll: false })}>
              <Td className="pr-4 font-medium text-slate-800 max-md:max-w-[9rem] max-md:truncate" title={r.project_name}>
                {r.project_name}
              </Td>
              <Td className="pr-4 max-md:max-w-[10rem] max-md:truncate" title={r.title}>
                {r.title}
              </Td>
              <Td className="pr-4 text-slate-500 max-md:max-w-[8rem] max-md:truncate" title={r.site_name}>
                {r.site_name}
              </Td>
              <Td className="whitespace-nowrap pr-4 text-slate-500">{UNIT_LABEL[r.unit]}</Td>
              <Td className="whitespace-nowrap pr-4 tabular-nums">{r.rangeLabel}</Td>
              <Td className="whitespace-nowrap pr-4 text-right tabular-nums">{r.stepCount}</Td>
              <Td className="whitespace-nowrap pr-4 text-right tabular-nums">
                {r.stepCount ? `${r.doneCount}/${r.stepCount}` : "-"}
              </Td>
              <Td className="whitespace-nowrap pr-4 tabular-nums text-slate-500">{kstDate(r.updated_at)}</Td>
              <Td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1.5">
                  <LinkButton href={`${openHref}${r.id}`} variant="secondary" size="xs" scroll={false}>
                    열기
                  </LinkButton>
                  <Button type="button" variant="danger" size="xs" onClick={() => handleDelete(r)}>
                    삭제
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow colSpan={9}>작성된 작업 순서표가 없습니다.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
