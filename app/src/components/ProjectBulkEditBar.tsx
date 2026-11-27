"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { bulkUpdateProjectFields } from "@/lib/actions/projects";
import {
  PROJECT_BULK_KEEP,
  PROJECT_BULK_STATUS_OPTIONS,
  projectBulkConfirmText,
  projectBulkFieldCount,
  projectBulkPatchFromForm,
} from "@/lib/projectBulkEdit";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inlineFieldClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { cx } from "@/lib/cx";

// 프로젝트 일괄 변경 칸(11/27 사용자 요청 "프로젝트 일괄 적용할 수 있게 체크해 수정 — 체크 시 상태·진행율도") — 프로젝트 목록·보고서 "발주서
// 발급 현황"에서 체크하면 표 위에 뜸. 발주서 발급(110 SQL 실행 뒤에만 보임)·상태·진행률 중 바꿀 칸만 — 기본 "그대로". 바꾸기 전에 확인창에
// 바꿀 칸을 한 줄씩, 저장은 bulkUpdateProjectFields 한 번. 계산·확인 문구는 lib/projectBulkEdit.ts.
function BulkRow({ label, changed, children }: { label: string; changed: boolean; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-2">
      <span className={cx("text-xs", changed ? "font-semibold text-brand" : "text-slate-500")}>
        {label}
        {changed && " ✓"}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function ProjectBulkEditBar({
  ids,
  poReady,
  onDone,
  onClear,
}: {
  ids: string[];
  /** 110 SQL 실행 뒤면 발주서 칸도 */
  poReady: boolean;
  onDone: () => void;
  onClear: () => void;
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [po, setPo] = useState(PROJECT_BULK_KEEP);
  const [status, setStatus] = useState(PROJECT_BULK_KEEP);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const values: Record<string, string> = { po_issued: poReady ? po : PROJECT_BULK_KEEP, status, progress_pct: progress };
  const { patch, error: invalid } = projectBulkPatchFromForm((k) => values[k] ?? null);
  const count = projectBulkFieldCount(patch);

  function reset() {
    setPo(PROJECT_BULK_KEEP);
    setStatus(PROJECT_BULK_KEEP);
    setProgress("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalid) {
      setError(invalid);
      return;
    }
    if (count === 0) return;
    if (!(await confirm(projectBulkConfirmText(ids.length, patch), { confirmLabel: "바꾸기" }))) return;
    const fd = new FormData();
    for (const id of ids) fd.append("ids", id);
    for (const [k, v] of Object.entries(values)) fd.append(k, v);
    const result = await pending.run(() => bulkUpdateProjectFields(fd));
    if (result?.error) {
      setError(result.error);
      return;
    }
    reset();
    onDone();
  }

  return (
    <div className="space-y-1 print:hidden">
      <Card padding="none" className="border-slate-300 bg-slate-50 p-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{ids.length.toLocaleString("ko-KR")}개 프로젝트 선택됨</span>
            <span className="text-xs text-slate-500">바꿀 칸만 고르세요 — 고르지 않은 칸은 그대로(발주액·이름·날짜는 안 바뀜)</span>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button type="submit" size="sm" disabled={count === 0 && !invalid}>
                {count > 1 ? `${count}칸 변경` : "변경"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  onClear();
                }}
              >
                선택 해제
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-3">
            {poReady && (
              <BulkRow label="발주서" changed={patch.po_issued !== undefined}>
                <select value={po} onChange={(e) => setPo(e.target.value)} aria-label="발주서 발급" className={inlineFieldClass}>
                  <option value={PROJECT_BULK_KEEP}>— 그대로 —</option>
                  <option value="1">발급</option>
                  <option value="0">미발급</option>
                </select>
              </BulkRow>
            )}
            <BulkRow label="상태" changed={patch.status !== undefined}>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="상태" className={inlineFieldClass}>
                <option value={PROJECT_BULK_KEEP}>— 그대로 —</option>
                {PROJECT_BULK_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </BulkRow>
            <BulkRow label="진행률" changed={patch.progress_pct !== undefined}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={progress}
                onChange={(e) => {
                  setProgress(e.target.value);
                  setError(null);
                }}
                placeholder="그대로"
                aria-label="진행률(%)"
                className={`${inlineFieldClass} w-24`}
              />
              <span className="text-xs text-slate-500">%</span>
            </BulkRow>
          </div>
          {(error || invalid) && <p className="text-sm text-red-600">{error ?? invalid}</p>}
          <p className="text-xs text-slate-400">&quot;타 프로젝트 귀속&quot; 상태는 귀속할 프로젝트를 같이 골라야 해서 프로젝트 수정 화면에서 바꿔 주세요.</p>
        </form>
      </Card>
    </div>
  );
}
