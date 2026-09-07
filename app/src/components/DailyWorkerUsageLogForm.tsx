"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { createDailyWorkerUsageLogRecord } from "@/lib/actions/daily-worker-usage-logs";
import { AccessListWorkerPicker } from "@/components/AccessListWorkerPicker";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { todayString } from "@/lib/format";

type OfficeOption = { id: string; name: string };
type WorkerOption = { id: string; name: string; office_id: string; grade?: string | null };

export function DailyWorkerUsageLogForm({ offices, workers }: { offices: OfficeOption[]; workers: WorkerOption[] }) {
  const router = useRouter();
  const pending = useGlobalPending();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await pending.run(() => Promise.resolve(createDailyWorkerUsageLogRecord(new FormData(form))));
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-1 sm:w-48">
        <label className="text-xs font-medium text-slate-500">사용일자</label>
        <input
          type="date"
          name="use_date"
          required
          defaultValue={todayString()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <AccessListWorkerPicker offices={offices} workers={workers} employees={[]} />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">비고 (선택)</label>
        <input name="note" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        등록
      </button>
    </form>
  );
}
