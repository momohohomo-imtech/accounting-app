"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";

type Item = { id: string; tool_name: string };

export function ToolChecklistDetailReport({
  title,
  projectName,
  tripDate,
  items,
  closeHref,
  copyHref,
}: {
  title: string;
  projectName: string | null;
  tripDate: string | null;
  items: Item[];
  closeHref: string;
  copyHref: string;
}) {
  const router = useRouter();
  useEscapeKey(true, () => router.push(closeHref));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">
            {projectName ? `${projectName} · ` : ""}
            {tripDate ? formatDate(tripDate) : "출장일 미지정"}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <PrintButton />
          <Link href={copyHref} className="text-sm text-slate-500 hover:text-slate-800">
            복사해서 새로 만들기
          </Link>
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </Link>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <li key={it.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            ☑ {it.tool_name}
          </li>
        ))}
        {items.length === 0 && (
          <li className="col-span-full py-6 text-center text-slate-400">체크된 공구가 없습니다.</li>
        )}
      </ul>

      <p className="text-right text-xs text-slate-400">총 {items.length}개</p>
    </div>
  );
}
