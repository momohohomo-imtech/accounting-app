"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDailyWorkerUsageLogRecord } from "@/lib/actions/daily-worker-usage-logs";
import { AccessListWorkerPicker } from "@/components/AccessListWorkerPicker";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { formatDate, todayString } from "@/lib/format";

type OfficeOption = { id: string; name: string };
type WorkerOption = { id: string; name: string; office_id: string; grade?: string | null };

export function DailyWorkerUsageLogForm({ offices, workers }: { offices: OfficeOption[]; workers: WorkerOption[] }) {
  const router = useRouter();
  const pending = useGlobalPending();
  const formRef = useRef<HTMLFormElement>(null);
  const [dateInput, setDateInput] = useState(todayString());
  const [dates, setDates] = useState<string[]>([todayString()]);

  function addDate() {
    if (!dateInput || dates.includes(dateInput)) return;
    setDates((prev) => [...prev, dateInput].sort());
  }
  function removeDate(d: string) {
    setDates((prev) => prev.filter((x) => x !== d));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (dates.length === 0) return;
    await pending.run(() => Promise.resolve(createDailyWorkerUsageLogRecord(new FormData(form))));
    formRef.current?.reset();
    setDates([todayString()]);
    setDateInput(todayString());
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">사용일자 (복수 선택 가능)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addDate}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
          >
            + 날짜 추가
          </button>
        </div>
        {dates.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {dates.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                {formatDate(d)}
                <input type="hidden" name="use_dates" value={d} />
                <button
                  type="button"
                  onClick={() => removeDate(d)}
                  className="text-slate-400 hover:text-red-600"
                  aria-label={`${d} 삭제`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {dates.length === 0 && <p className="text-xs text-red-500">날짜를 하나 이상 추가해 주세요.</p>}
      </div>

      <AccessListWorkerPicker offices={offices} workers={workers} employees={[]} />

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">일급 (선택, 직접 입력)</label>
          <input
            type="number"
            name="daily_wage"
            placeholder="예: 150000"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">비고 (선택)</label>
          <input name="note" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" />
        </div>
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
