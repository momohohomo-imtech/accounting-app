import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WorkLogForm } from "@/components/WorkLogForm";
import { AttachmentList } from "@/components/AttachmentList";
import { EscapeCloseLink } from "@/components/EscapeCloseLink";
import { tripDayToInput, type TripDayRow } from "@/lib/tripLog";

export async function WorkLogDayEditor({ dateKey, closeHref }: { dateKey: string; closeHref: string }) {
  const supabase = await createClient();
  const [year, month] = dateKey.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  const [{ data: logs }, { data: sites }, { data: projects }, { data: monthLogs }, { data: tripDays }, { data: attachmentRows }] =
    await Promise.all([
      supabase.from("work_logs").select("*").eq("log_date", dateKey).order("sort_order", { ascending: true }),
      supabase.from("sites").select("id, name, color").order("name"),
      supabase.from("projects").select("id, name, site_id, year, project_code, status").order("year", { ascending: false }),
      supabase.from("work_logs").select("title").gte("log_date", monthStart).lte("log_date", monthEnd),
      // 이 날짜에 출장으로 체크된 프로젝트(090 실행 전이면 비어 있음).
      supabase
        .from("trip_log_days")
        .select("id, project_id, work_date, staff_count, helper_count, equipment_used, equipment_place, equipment_hours, note")
        .eq("work_date", dateKey)
        .overrideTypes<TripDayRow[], { merge: false }>(),
      supabase
        .from("attachments")
        .select("id, file_name, mime_type, file_size, memo, storage_path")
        .eq("work_date", dateKey)
        .order("created_at", { ascending: false }),
    ]);

  const attachments = await Promise.all(
    (attachmentRows ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("project-files").createSignedUrl(a.storage_path, 3600);
      return {
        id: a.id,
        file_name: a.file_name,
        mime_type: a.mime_type,
        file_size: a.file_size,
        memo: a.memo,
        url: signed?.signedUrl ?? null,
      };
    })
  );

  const initialTrips = Object.fromEntries((tripDays ?? []).map((d) => [d.project_id, tripDayToInput(d)]));
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  const rows = Array.from({ length: 5 }, (_, i) => logs?.[i] ?? null);
  const contentSuggestions = Array.from(
    new Set((monthLogs ?? []).map((l) => l.title?.trim()).filter((t): t is string => Boolean(t)))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  return (
    <div className="space-y-4">
      <EscapeCloseLink href={closeHref} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{dateKey} 작업일지</h2>
        <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
          닫기
        </Link>
      </div>

      {(tripDays ?? []).length > 0 && (
        <div className="space-y-1">
          {(tripDays ?? []).map((d) => {
            const project = projectById.get(d.project_id);
            return (
              <Link
                key={d.id}
                href={`/worklogs?tab=trip&year=${year}&open=${d.project_id}`}
                className="block rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                *출장일지* — {project ? `${project.project_code ? `${project.project_code} ` : ""}${project.name}` : "프로젝트"}
              </Link>
            );
          })}
        </div>
      )}

      <WorkLogForm
        dateKey={dateKey}
        rows={rows}
        sites={sites ?? []}
        projects={projects ?? []}
        contentSuggestions={contentSuggestions}
        initialTrips={initialTrips}
      />

      <AttachmentList workDate={dateKey} items={attachments} title="현장사진·메모 첨부" />
    </div>
  );
}
