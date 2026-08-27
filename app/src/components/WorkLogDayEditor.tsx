import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WorkLogForm } from "@/components/WorkLogForm";

export async function WorkLogDayEditor({ dateKey, closeHref }: { dateKey: string; closeHref: string }) {
  const supabase = await createClient();
  const [year, month] = dateKey.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  const [{ data: logs }, { data: sites }, { data: monthLogs }] = await Promise.all([
    supabase.from("work_logs").select("*").eq("log_date", dateKey).order("sort_order", { ascending: true }),
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("work_logs").select("title").gte("log_date", monthStart).lte("log_date", monthEnd),
  ]);

  const rows = Array.from({ length: 5 }, (_, i) => logs?.[i] ?? null);
  const contentSuggestions = Array.from(
    new Set((monthLogs ?? []).map((l) => l.title?.trim()).filter((t): t is string => Boolean(t)))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{dateKey} 작업일지</h2>
        <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
          닫기
        </Link>
      </div>

      <WorkLogForm dateKey={dateKey} rows={rows} sites={sites ?? []} contentSuggestions={contentSuggestions} />
    </div>
  );
}
