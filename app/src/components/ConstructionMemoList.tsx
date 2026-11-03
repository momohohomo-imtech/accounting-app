"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyRow, Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { ConstructionMemoFormPopup } from "@/components/ConstructionMemoFormPopup";
import type { ProjectOption, SiteOption } from "@/components/ProjectPicker";
import { constructionMemoFields, constructionMemoFileName, kstDate } from "@/lib/memoExport";
import { downloadMemoXlsx } from "@/lib/xlsxExport";
import { cx } from "@/lib/cx";

type Memo = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  project_name: string;
  site_name: string;
};

type Popup = { mode: "create" } | { mode: "edit"; memo: Memo };
type SortKey = "created_at" | "site_name" | "project_name" | "content";

// 공사 메모 내역 — 메모 하나가 한 줄(사용자 요청 11/2 "한 줄로 보이게"): 작성일·현장·프로젝트·내용(한 줄 말줄임, 누르면 그 줄만
// 전체)·관리. 예전엔 메모마다 카드(머리 줄 + 여러 줄 내용)라 길게 늘어졌음. 줄마다 "엑셀"은 그 메모 하나만 내려받음.
export function ConstructionMemoList({
  memos,
  sites,
  projects,
  createAction,
  updateAction,
  deleteAction,
}: {
  memos: Memo[];
  sites: SiteOption[];
  projects: ProjectOption[];
  createAction: (formData: FormData) => unknown;
  updateAction: (formData: FormData) => unknown;
  deleteAction: (formData: FormData) => unknown;
}) {
  const pending = useGlobalPending();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // 전체 내용을 펼쳐 본 메모(휴대폰은 마우스를 올려 볼 수 없어서 눌러서 펼침)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  // 기본은 최근 작성이 위(예전 카드 순서와 같게)
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...memos];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = sortKey === "created_at" ? va.localeCompare(vb) : va.localeCompare(vb, "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [memos, sortKey, sortDir]);

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

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    // 실패하면 확인 칸을 그대로 두고 이유를 보여 줌 — 예전엔 결과를 버려서 안 지워져도 아무 표시가 없었음
    const result = await pending.run(() => Promise.resolve(deleteAction(fd)));
    if (result && typeof result === "object" && "error" in result && result.error) {
      setDeleteError(`삭제하지 못했습니다: ${String(result.error)}`);
      return;
    }
    setDeleteError(null);
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button type="button" onClick={() => setPopup({ mode: "create" })} disabled={projects.length === 0}>
          + 메모 추가
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {deleteError && <p className="mb-2 text-sm text-red-600 print:hidden">{deleteError}</p>}
        {/* 휴대폰: 옆으로 넘기고 프로젝트 칸을 왼쪽에 고정(첫 칸 날짜만으로는 어느 메모인지 알기 어려움) */}
        <Table className="sticky-col-table min-w-[760px] print:min-w-0">
          <THead>
            {header("created_at", "작성일", "pr-4")}
            {header("site_name", "현장", "pr-4")}
            {header("project_name", "프로젝트", "sticky-col pr-4")}
            {header("content", "내용", "w-full pr-4")}
            <Th className="text-right print:hidden">관리</Th>
          </THead>
          <tbody>
            {sorted.map((m) => {
              const open = openIds.has(m.id);
              const edited = m.updated_at !== m.created_at;
              return (
                <Tr key={m.id} className="align-top">
                  <Td
                    className="whitespace-nowrap pr-4 tabular-nums text-slate-500"
                    title={edited ? `수정 ${kstDate(m.updated_at)}` : undefined}
                  >
                    {kstDate(m.created_at)}
                    {edited && <span className="ml-1 text-[11px] text-slate-400">수정</span>}
                  </Td>
                  <Td className="whitespace-nowrap pr-4 max-md:max-w-[8rem] max-md:truncate print:max-w-none print:whitespace-normal" title={m.site_name}>
                    {m.site_name}
                  </Td>
                  <Td
                    className="sticky-col whitespace-nowrap pr-4 font-medium text-slate-800 max-md:max-w-[9rem] max-md:truncate print:max-w-none print:whitespace-normal"
                    title={m.project_name}
                  >
                    {m.project_name}
                  </Td>
                  {/* max-w-0 + w-full: 남는 폭을 다 쓰고 넘치면 말줄임(표가 상자보다 넓어지지 않게) */}
                  <Td className="w-full max-w-0 pr-4 max-md:min-w-[16rem]" title={open ? undefined : m.content}>
                    <button
                      type="button"
                      onClick={() => toggleOpen(m.id)}
                      aria-expanded={open}
                      className="block w-full text-left text-slate-700 transition-colors hover:text-slate-900"
                    >
                      <span
                        className={cx(
                          "block print:overflow-visible print:whitespace-pre-wrap print:break-words",
                          open ? "whitespace-pre-wrap break-words" : "truncate"
                        )}
                      >
                        {m.content}
                      </span>
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap text-right print:hidden">
                    <div className="flex justify-end gap-1.5">
                      {confirmDeleteId === m.id ? (
                        <>
                          <span className="self-center text-xs font-medium text-red-600">정말 삭제?</span>
                          <Button type="button" variant="danger" size="xs" onClick={() => handleDelete(m.id)}>
                            확인
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              setDeleteError(null);
                            }}
                          >
                            취소
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            title="이 메모만 엑셀로 내려받기"
                            onClick={() => downloadMemoXlsx(constructionMemoFileName(m), "공사 메모", constructionMemoFields(m))}
                          >
                            엑셀
                          </Button>
                          <Button type="button" variant="secondary" size="xs" onClick={() => setPopup({ mode: "edit", memo: m })}>
                            수정
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="xs"
                            onClick={() => {
                              setConfirmDeleteId(m.id);
                              setDeleteError(null);
                            }}
                          >
                            삭제
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {sorted.length === 0 && <EmptyRow colSpan={5}>작성된 메모가 없습니다.</EmptyRow>}
          </tbody>
        </Table>
      </div>

      {popup?.mode === "create" && (
        <ConstructionMemoFormPopup
          mode="create"
          sites={sites}
          projects={projects}
          createAction={createAction}
          updateAction={updateAction}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.mode === "edit" && (
        <ConstructionMemoFormPopup
          mode="edit"
          sites={sites}
          projects={projects}
          initial={{
            id: popup.memo.id,
            content: popup.memo.content,
            projectName: popup.memo.project_name,
            siteName: popup.memo.site_name,
          }}
          createAction={createAction}
          updateAction={updateAction}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
