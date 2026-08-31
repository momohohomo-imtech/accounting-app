"use client";

import { useState, useTransition } from "react";
import { restoreBackup } from "@/lib/actions/backups";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useEscapeKey } from "@/lib/useEscapeKey";

export function RestoreBackupButton({ fileName }: { fileName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEscapeKey(open, close);

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fileName", fileName);
      fd.set("confirmText", confirmText);
      const result = await restoreBackup(fd);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  function close() {
    setOpen(false);
    setConfirmText("");
    setError(null);
    setDone(false);
  }

  return (
    <>
      <Button variant="danger" size="xs" onClick={() => setOpen(true)}>
        복구
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {done ? (
              <div className="space-y-3 text-center">
                <p className="font-semibold text-emerald-600">복구가 완료됐습니다.</p>
                <p className="text-sm text-slate-500">변경 사항을 보려면 페이지를 새로고침해주세요.</p>
                <Button size="sm" onClick={() => window.location.reload()}>
                  새로고침
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-semibold text-red-600">이 백업으로 복구하시겠습니까?</h3>
                <p className="text-sm text-slate-600">
                  <span className="font-mono text-xs">{fileName}</span> 시점으로 되돌리면, 지금 있는 모든 데이터가
                  이 백업의 데이터로 <b>완전히 대체</b>됩니다. 이후에 입력된 내용은 전부 사라지며 되돌릴 수 없습니다.
                </p>
                <p className="text-xs text-slate-500">
                  (안전을 위해 복구를 시작하기 직전, 지금 상태의 백업을 자동으로 하나 더 만들어둡니다.)
                </p>
                <div>
                  <label className={labelClass}>계속하려면 아래에 &quot;복구&quot;라고 입력하세요</label>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className={fieldClass}
                    placeholder="복구"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={close} disabled={isPending}>
                    취소
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleRestore} disabled={isPending || confirmText !== "복구"}>
                    {isPending ? "복구 중..." : "복구 실행"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
