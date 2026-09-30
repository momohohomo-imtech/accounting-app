"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tripProjectLabel, tripTotals, type TripProjectDoc, type TripTotals } from "@/lib/tripLog";
import { TripLogPopup } from "@/components/TripLogPopup";
import { TripLogBlankFormPopup } from "@/components/TripLogBlankFormPopup";
import { Button } from "@/components/ui/Button";

type Row = { doc: TripProjectDoc; totals: TripTotals };
type SortKey = "project" | "site" | "client" | "period" | "days" | "staff" | "helper" | "people" | "equipment";

function sortValue(r: Row, key: SortKey): string | number {
  switch (key) {
    case "project":
      return tripProjectLabel(r.doc);
    case "site":
      return r.doc.siteName ?? "";
    case "client":
      return r.doc.clientName ?? "";
    case "period":
      return r.totals.from ?? "";
    case "days":
      return r.totals.days;
    case "staff":
      return r.totals.staff;
    case "helper":
      return r.totals.helper;
    case "people":
      return r.totals.people;
    case "equipment":
      return r.totals.equipmentDays;
  }
}

// 출장일지(새 방식) 목록 — 프로젝트 하나에 한 줄(한 장). 작업일지 팝업에서 "출장"을 체크한 날짜로만 채워짐.
export function TripLogList({ docs, openProjectId }: { docs: TripProjectDoc[]; openProjectId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(openProjectId ?? null);
  const [blankForm, setBlankForm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo<Row[]>(() => docs.map((doc) => ({ doc, totals: tripTotals(doc.days) })), [docs]);
  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  function closePopup() {
    setOpenId(null);
    // 작업일지 팝업의 링크(?open=프로젝트)로 열었으면 주소에서 빼서, 새로고침해도 다시 열리지 않게.
    if (searchParams.get("open")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("open");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }

  const openDoc = openId ? docs.find((d) => d.projectId === openId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          작업일지 팝업에서 줄마다 &lsquo;출장&rsquo;을 체크하면 날짜가 프로젝트별로 여기에 모입니다(같은 프로젝트는 한 장).
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setBlankForm(true)}>
          폼인쇄
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">{headerButton("project", "프로젝트")}</th>
              <th className="p-3">{headerButton("site", "현장")}</th>
              <th className="p-3">{headerButton("client", "원청사")}</th>
              <th className="p-3">{headerButton("period", "기간")}</th>
              <th className="p-3 text-right">{headerButton("days", "일수")}</th>
              <th className="p-3 text-right">{headerButton("staff", "사내")}</th>
              <th className="p-3 text-right">{headerButton("helper", "조공")}</th>
              <th className="p-3 text-right">{headerButton("people", "총 투입")}</th>
              <th className="p-3 text-right">{headerButton("equipment", "장비")}</th>
              <th className="p-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ doc, totals }) => (
              <tr key={doc.projectId} className="border-b border-slate-100 last:border-0">
                <td className="p-3 font-medium text-slate-900 max-md:max-w-[10rem] max-md:truncate" title={tripProjectLabel(doc)}>
                  {tripProjectLabel(doc)}
                </td>
                <td className="p-3 text-slate-700">{doc.siteName ?? "-"}</td>
                <td className="p-3 text-slate-700">{doc.clientName ?? "-"}</td>
                <td className="whitespace-nowrap p-3 tabular-nums text-slate-600">
                  {totals.from === totals.to ? totals.from : `${totals.from} ~ ${totals.to}`}
                </td>
                <td className="p-3 text-right tabular-nums text-slate-900">{totals.days}일</td>
                <td className="p-3 text-right tabular-nums text-slate-700">{totals.staff}명</td>
                <td className="p-3 text-right tabular-nums text-slate-700">{totals.helper}명</td>
                <td className="p-3 text-right font-semibold tabular-nums text-slate-900">{totals.people}명</td>
                <td className="p-3 text-right tabular-nums text-slate-700">{totals.equipmentDays ? `${totals.equipmentDays}일` : "-"}</td>
                <td className="p-3 text-right">
                  <Button type="button" variant="secondary" size="xs" onClick={() => setOpenId(doc.projectId)}>
                    보기
                  </Button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">
                  이 기간에 출장으로 체크한 작업일지가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openDoc && <TripLogPopup key={openDoc.projectId} doc={openDoc} onClose={closePopup} />}
      {blankForm && <TripLogBlankFormPopup onClose={() => setBlankForm(false)} />}
    </div>
  );
}
