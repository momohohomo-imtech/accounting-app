"use client";

import { saveDayWorkLogs } from "@/lib/actions/worklogs";
import { WorkLogRowInput } from "@/components/WorkLogRowInput";
import { Button } from "@/components/ui/Button";

type Row = { title: string | null; color: string | null } | null;

export function WorkLogForm({ dateKey, rows }: { dateKey: string; rows: Row[] }) {
  return (
    <form
      action={saveDayWorkLogs}
      onSubmit={(e) => {
        if (!confirm("저장하시겠습니까?")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="log_date" value={dateKey} />
      {rows.map((row, i) => (
        <WorkLogRowInput key={i} index={i} defaultTitle={row?.title ?? ""} defaultColor={row?.color ?? "none"} />
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit">저장</Button>
      </div>
    </form>
  );
}
