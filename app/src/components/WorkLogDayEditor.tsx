import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveDayWorkLogs } from "@/lib/actions/worklogs";
import { WorkLogRowInput } from "@/components/WorkLogRowInput";
import { Button } from "@/components/ui/Button";

export async function WorkLogDayEditor({ dateKey, closeHref }: { dateKey: string; closeHref: string }) {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("work_logs")
    .select("*")
    .eq("log_date", dateKey)
    .order("sort_order", { ascending: true });

  const rows = Array.from({ length: 5 }, (_, i) => logs?.[i] ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{dateKey} 작업일지</h2>
        <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
          닫기
        </Link>
      </div>

      <form action={saveDayWorkLogs} className="space-y-2">
        <input type="hidden" name="log_date" value={dateKey} />
        {rows.map((row, i) => (
          <WorkLogRowInput key={i} index={i} defaultTitle={row?.title ?? ""} defaultColor={row?.color ?? "none"} />
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit">저장</Button>
        </div>
      </form>
    </div>
  );
}
