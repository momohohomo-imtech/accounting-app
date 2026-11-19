"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkLogGroupDetail,
  updateWorkLogMemo,
  renameWorkLogTitle,
  type WorkLogDetailEntry,
} from "@/lib/actions/worklogs";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { ModalPortal } from "@/components/ModalPortal";
import { downloadXlsx } from "@/lib/xlsxExport";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useConfirmLeaveAll, useUnsavedGuard } from "@/components/UnsavedChangesProvider";

function formatMonthDay(dateKey: string) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}월${Number(d)}일`;
}

function MemoRow({ entry, onSaved }: { entry: WorkLogDetailEntry; onSaved: (id: string, content: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(entry.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useGlobalPending();
  const saved = entry.content ?? "";

  // 저장되면 true — 내역 목록(화면·엑셀)에도 바로 반영(예전엔 팝업을 다시 열어야 보였음)
  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", entry.id);
    fd.append("content", memo);
    const result = await pending.run(() => updateWorkLogMemo(fd));
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    // 서버도 앞뒤 빈칸을 빼고 저장함
    const content = memo.trim();
    onSaved(entry.id, content);
    setMemo(content);
    setEditing(false);
    return true;
  }

  function stopEdit() {
    setMemo(saved);
    setError(null);
    setEditing(false);
  }

  // 고치는 중에 취소·팝업 닫기·뒤로가기를 하면 저장할지 물어봄(사용자 요청 11/19)
  const leave = useUnsavedGuard({
    dirty: editing && memo !== saved && !saving,
    value: memo,
    label: `${formatMonthDay(entry.log_date)} 메모`,
    save,
    discard: stopEdit,
  });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{formatMonthDay(entry.log_date)}</span>
        {!editing && (
          <Button type="button" variant="secondary" size="xs" className="print:hidden" onClick={() => setEditing(true)}>
            {entry.content ? "메모 수정" : "메모 추가"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="메모 입력"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <div className="flex shrink-0 flex-col gap-1">
            <Button type="button" size="xs" disabled={saving} onClick={() => void save()}>
              저장
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={saving}
              onClick={async () => {
                if (await leave()) stopEdit();
              }}
            >
              취소
            </Button>
          </div>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        entry.content && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{entry.content}</p>
      )}
    </div>
  );
}

export function WorkLogGroupDetailPopup({
  year,
  siteId,
  siteName,
  siteColor,
  title,
  onClose,
}: {
  year: number;
  siteId: string;
  siteName: string;
  siteColor: string;
  title: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [entries, setEntries] = useState<WorkLogDetailEntry[] | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  // 날짜 메모를 고치는 중이면 닫기 전에 저장할지 물어봄
  const confirmLeaveAll = useConfirmLeaveAll();
  const requestClose = async () => {
    if (await confirmLeaveAll()) onClose();
  };
  useEscapeKey(true, () => (editingTitle ? setEditingTitle(false) : void requestClose()));

  useEffect(() => {
    let cancelled = false;
    getWorkLogGroupDetail(year, siteId, title).then((data) => {
      if (!cancelled) setEntries(data);
    });
    return () => {
      cancelled = true;
    };
  }, [year, siteId, title]);

  async function saveTitle() {
    const newTitle = titleDraft.trim();
    if (!newTitle || newTitle === title) {
      setEditingTitle(false);
      setTitleDraft(title);
      return;
    }
    if (
      !(await confirm(
        `"${title}"을(를) "${newTitle}"(으)로 바꾸면 ${year}년 달력에 있는 이 내용의 모든 날짜에 반영됩니다. 계속할까요?`
      ))
    )
      return;
    setRenaming(true);
    setRenameError(null);
    const fd = new FormData();
    fd.append("site_id", siteId);
    fd.append("old_title", title);
    fd.append("new_title", newTitle);
    fd.append("year", String(year));
    const result = await pending.run(() => renameWorkLogTitle(fd));
    setRenaming(false);
    if (result?.error) {
      setRenameError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleExcel() {
    if (!entries) return;
    await downloadXlsx(
      `${siteName}_${title}_${year}년.xlsx`,
      ["날짜", "메모"],
      entries.map((e) => [formatMonthDay(e.log_date), e.content ?? ""]),
      "작업집계 내역",
      [[`${siteName} — ${title} (${year}년)`], [`총 ${entries.length}일`]]
    );
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: siteColor }} />
              {siteName}
            </p>
            {editingTitle ? (
              <div className="mt-1 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className={`${fieldClass} h-8 w-44 text-sm`}
                    autoFocus
                  />
                  <Button type="button" size="xs" disabled={renaming} onClick={saveTitle}>
                    저장
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    disabled={renaming}
                    onClick={() => {
                      setEditingTitle(false);
                      setTitleDraft(title);
                    }}
                  >
                    취소
                  </Button>
                </div>
                {renameError && <p className="text-xs text-red-600">{renameError}</p>}
              </div>
            ) : (
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                {title}
                {siteId && (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="text-xs font-normal text-slate-400 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 print:hidden"
                  >
                    수정
                  </button>
                )}
              </h2>
            )}
            <p className="mt-0.5 text-xs text-slate-400">
              {year}년 전체 내역{entries !== null && ` · 총 ${entries.length}일`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ModalPrintButton />
            <Button type="button" variant="secondary" size="xs" disabled={!entries} onClick={handleExcel}>
              엑셀
            </Button>
            <button type="button" onClick={requestClose} className="text-sm text-slate-500 hover:text-slate-800 print:hidden">
              닫기
            </button>
          </div>
        </div>

        {entries === null ? (
          <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <MemoRow
                key={e.id}
                entry={e}
                onSaved={(id, content) => setEntries((prev) => prev?.map((x) => (x.id === id ? { ...x, content } : x)) ?? prev)}
              />
            ))}
            {entries.length === 0 && <p className="py-8 text-center text-sm text-slate-400">내역이 없습니다.</p>}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
