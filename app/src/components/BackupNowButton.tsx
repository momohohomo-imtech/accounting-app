"use client";

import { useState, useTransition } from "react";
import { createManualBackup } from "@/lib/actions/backups";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export function BackupNowButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const pending = useGlobalPending();

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await pending.run(() => createManualBackup());
      if (result.error) {
        setMessage({ type: "error", text: result.error });
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
        <p className={`text-xs ${message.type === "error" ? "text-red-600" : "text-emerald-600"}`}>{message.text}</p>
      )}
    </div>
  );
}
