"use client";

import { useState, useTransition } from "react";
import { createManualBackup } from "@/lib/actions/backups";
import { ensureFolderPermission } from "@/lib/backupFolder";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { saveToBackupFolder, useBackupFolder } from "@/components/BackupFolderControls";

// "지금 백업" — 저장소에 백업을 만들고, 백업 저장 폴더를 정해 두었으면(PC 크롬·엣지, BackupFolderControls) 그 폴더에도 바로 저장
// (11/14 사용자 요청 "수동 백업 시 E:\문서\…\back up\로 바로 들어가게").
export function BackupNowButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success" | "warning"; text: string } | null>(null);
  const pending = useGlobalPending();
  const { folder } = useBackupFolder();

  async function handleClick() {
    setMessage(null);
    // 폴더 쓰기 권한은 버튼을 누른 순간에 먼저 받음 — 서버 백업(몇 초)을 기다린 뒤엔 브라우저가 묻는 창을 못 띄움
    const permitted = folder ? await ensureFolderPermission(folder).catch(() => false) : false;
    startTransition(async () => {
      const result = await pending.run(async () => {
        const created = await createManualBackup();
        if (created.error || !created.fileName) return { ...created, saved: null };
        const saved = await saveToBackupFolder(folder, created.fileName, created.signedUrl, permitted);
        return { ...created, saved };
      });
      if (result.error || !result.fileName) {
        setMessage({ type: "error", text: result.error ?? "백업 생성에 실패했습니다." });
        return;
      }
      const saved = result.saved;
      if (saved && "error" in saved) {
        setMessage({ type: "warning", text: `백업은 완료(${result.fileName}) — ${saved.error}` });
      } else if (saved?.status === "saved" && folder) {
        setMessage({ type: "success", text: `백업 완료 — "${folder.name}" 폴더에 저장: ${result.fileName}` });
      } else if (saved?.status === "denied") {
        setMessage({
          type: "warning",
          text: `백업은 완료(${result.fileName}) — 폴더 사용을 허용하지 않아 폴더에는 저장하지 않았습니다. 아래 표의 "다운로드"로 받을 수 있어요.`,
        });
      } else {
        setMessage({ type: "success", text: `백업 완료: ${result.fileName}` });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={handleClick} disabled={isPending}>
        {isPending ? "백업 생성 중..." : "지금 백업"}
      </Button>
      {message && (
        <p
          className={`max-w-xs text-right text-xs ${
            message.type === "error" ? "text-red-600" : message.type === "warning" ? "text-amber-700" : "text-emerald-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
