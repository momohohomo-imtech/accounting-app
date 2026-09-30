"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WORK_TYPE_OPTIONS } from "@/lib/businessTrip";
import {
  inputToTripDayFields,
  tripDayToInput,
  tripProjectLabel,
  tripTotals,
  type TripDayInput,
  type TripProjectDoc,
} from "@/lib/tripLog";
import { saveTripLog } from "@/lib/actions/tripLogs";
import { downloadTripLogXlsx } from "@/lib/tripLogXlsx";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { Button } from "@/components/ui/Button";
import { fieldClass, inlineFieldClass } from "@/components/ui/field";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { todayString } from "@/lib/format";
import { cx } from "@/lib/cx";

function SummaryBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-300 px-3 py-2 print:py-1.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="whitespace-nowrap text-lg font-bold tabular-nums text-slate-900 print:text-base">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function dayLink(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `/worklogs?year=${y}&month=${m}&day=${d}`;
}

export function TripLogPopup({ doc, onClose }: { doc: TripProjectDoc; onClose: () => void }) {
  const router = useRouter();
  const pending = useGlobalPending();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [workTypes, setWorkTypes] = useState<Set<string>>(new Set(doc.workTypes));
  const [note, setNote] = useState(doc.note);
  const [inputs, setInputs] = useState<Record<string, TripDayInput>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setWorkTypes(new Set(doc.workTypes));
    setNote(doc.note);
    setInputs(Object.fromEntries(doc.days.map((d) => [d.id, tripDayToInput(d)])));
    setRemoved(new Set());
    setError(null);
    setEditing(true);
  }
  useEscapeKey(true, () => (editing ? setEditing(false) : onClose()));

  const days = doc.days.filter((d) => !removed.has(d.id));
  // 수정 중에는 입력한 값으로 합계를 바로 다시 셈.
  const shown = days.map((d) => (editing && inputs[d.id] ? { ...d, ...inputToTripDayFields(inputs[d.id]) } : d));
  const totals = tripTotals(shown);
  const period = totals.from ? (totals.from === totals.to ? totals.from : `${totals.from} ~ ${totals.to}`) : "-";

  function setInput(id: string, patch: Partial<TripDayInput>) {
    setInputs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save() {
    if (
      removed.size > 0 &&
      !(await confirm(`${removed.size}일을 이 출장일지에서 뺍니다. 그날 작업일지의 "출장" 체크도 함께 풀립니다. 저장하시겠습니까?`))
    ) {
      return;
    }
    const result = await pending.run(() =>
      saveTripLog({
        projectId: doc.projectId,
        workTypes: Array.from(workTypes),
        note,
        days: days.map((d) => ({ id: d.id, input: inputs[d.id] })),
        removedDayIds: Array.from(removed),
      })
    );
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const numberInput = `${inlineFieldClass} w-14 px-1.5 py-1 text-right`;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl max-md:p-4 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2 print:hidden">
            <h2 className="text-lg font-semibold text-slate-900">출장 업무 내역서</h2>
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <Button type="button" size="xs" onClick={save}>
                    저장
                  </Button>
                  <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(false)}>
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <ModalPrintButton />
                  <Button type="button" variant="secondary" size="xs" onClick={() => downloadTripLogXlsx(doc)}>
                    엑셀
                  </Button>
                  <Button type="button" variant="secondary" size="xs" onClick={startEdit}>
                    수정
                  </Button>
                  <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                    닫기
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-sm text-slate-900">
            <h1 className="mb-3 hidden text-center text-xl font-bold tracking-widest print:block">출장 업무 내역서</h1>

            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-b border-slate-200 pb-3 sm:grid-cols-2 print:grid-cols-2">
              <p className="sm:col-span-2 print:col-span-2">
                <span className="text-slate-500">프로젝트 </span>
                <span className="font-semibold">{tripProjectLabel(doc)}</span>
              </p>
              <p>
                <span className="text-slate-500">현장 </span>
                {doc.siteName ?? "-"}
              </p>
              <p>
                <span className="text-slate-500">원청사 </span>
                {doc.clientName ?? "-"}
              </p>
              <p>
                <span className="text-slate-500">기간 </span>
                <span className="tabular-nums">{period}</span>
              </p>
              <p>
                <span className="text-slate-500">작성일 </span>
                <span className="tabular-nums">{todayString()}</span>
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-2 print:col-span-2">
                <span className="text-slate-500">작업구분</span>
                {editing ? (
                  WORK_TYPE_OPTIONS.map((t) => (
                    <label key={t} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={workTypes.has(t)}
                        onChange={(e) =>
                          setWorkTypes((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(t);
                            else next.delete(t);
                            return next;
                          })
                        }
                        className="h-4 w-4"
                      />
                      {t}
                    </label>
                  ))
                ) : (
                  <span>{doc.workTypes.join(", ") || "-"}</span>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4 print:grid-cols-4">
              <SummaryBox label="총 일수" value={`${totals.days}일`} sub={totals.equipmentDays ? `장비 투입 ${totals.equipmentDays}일` : undefined} />
              <SummaryBox label="총 투입 인원" value={`${totals.people}명`} sub="날짜별 사내 + 조공 합" />
              <SummaryBox label="사내" value={`${totals.staff}명`} />
              <SummaryBox label="조공" value={`${totals.helper}명`} />
            </div>

            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table className="sticky-col-table w-full min-w-[760px] text-sm print:min-w-0 print:text-xs">
                <thead>
                  <tr className="border-b border-t-2 border-slate-900 text-left text-slate-500">
                    <th className="py-1.5 pr-2">날짜</th>
                    <th className="sticky-col py-1.5 pr-2">작업 내용</th>
                    <th className="py-1.5 pr-2 text-right">사내</th>
                    <th className="py-1.5 pr-2 text-right">조공</th>
                    <th className="py-1.5 pr-2 text-right">계</th>
                    <th className="py-1.5 pr-2 text-center">장비</th>
                    <th className="py-1.5 pr-2">사용처</th>
                    <th className="py-1.5 pr-2">시간</th>
                    <th className="py-1.5 pr-2">비고</th>
                    {editing && <th className="py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => {
                    const input = inputs[d.id];
                    return (
                      <tr key={d.id} className="border-b border-slate-100 align-middle">
                        <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">
                          {editing ? (
                            d.work_date
                          ) : (
                            <Link href={dayLink(d.work_date)} className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline">
                              {d.work_date}
                            </Link>
                          )}
                        </td>
                        <td className="sticky-col py-1.5 pr-2 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:whitespace-normal" title={d.contents}>
                          {d.contents || "-"}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              aria-label={`${d.work_date} 사내`}
                              value={input.staff}
                              onChange={(e) => setInput(d.id, { staff: e.target.value })}
                              className={numberInput}
                            />
                          ) : (
                            d.staff_count
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              aria-label={`${d.work_date} 조공`}
                              value={input.helper}
                              onChange={(e) => setInput(d.id, { helper: e.target.value })}
                              className={numberInput}
                            />
                          ) : (
                            d.helper_count
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{d.staff_count + d.helper_count}</td>
                        <td className="py-1.5 pr-2 text-center">
                          {editing ? (
                            <input
                              type="checkbox"
                              aria-label={`${d.work_date} 장비 투입`}
                              checked={input.equipmentUsed}
                              onChange={(e) => setInput(d.id, { equipmentUsed: e.target.checked })}
                              className="h-4 w-4"
                            />
                          ) : d.equipment_used ? (
                            "O"
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {editing ? (
                            <input
                              aria-label={`${d.work_date} 사용처`}
                              value={input.place}
                              disabled={!input.equipmentUsed}
                              onChange={(e) => setInput(d.id, { place: e.target.value })}
                              className={cx(fieldClass, "min-w-[7rem] py-1")}
                            />
                          ) : (
                            d.equipment_place ?? ""
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {editing ? (
                            <input
                              aria-label={`${d.work_date} 시간`}
                              value={input.hours}
                              disabled={!input.equipmentUsed}
                              onChange={(e) => setInput(d.id, { hours: e.target.value })}
                              className={cx(fieldClass, "min-w-[5rem] py-1")}
                            />
                          ) : (
                            d.equipment_hours ?? ""
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {editing ? (
                            <input
                              aria-label={`${d.work_date} 비고`}
                              value={input.note}
                              onChange={(e) => setInput(d.id, { note: e.target.value })}
                              className={cx(fieldClass, "min-w-[8rem] py-1")}
                            />
                          ) : (
                            d.note ?? ""
                          )}
                        </td>
                        {editing && (
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => setRemoved((prev) => new Set(prev).add(d.id))}
                              className="whitespace-nowrap text-xs text-red-500 hover:text-red-700"
                            >
                              빼기
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={editing ? 10 : 9} className="py-6 text-center text-slate-400">
                        출장 날짜가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-semibold">
                    <td className="py-1.5 pr-2">합계</td>
                    <td className="sticky-col py-1.5 pr-2 tabular-nums">{totals.days}일</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{totals.staff}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{totals.helper}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{totals.people}</td>
                    <td className="py-1.5 pr-2 text-center tabular-nums">{totals.equipmentDays ? `${totals.equipmentDays}일` : ""}</td>
                    <td colSpan={editing ? 4 : 3} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold text-slate-500">비고</p>
              {editing ? (
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${fieldClass} resize-y`} />
              ) : (
                <p className="min-h-[1.25rem] whitespace-pre-wrap">{doc.note}</p>
              )}
            </div>

            {editing && (
              <p className="mt-2 text-xs text-slate-400 print:hidden">
                날짜는 작업일지 팝업에서 줄마다 &lsquo;출장&rsquo;을 체크해서 넣습니다. 여기서 &lsquo;빼기&rsquo;한 날짜는 그날 작업일지의
                출장 체크도 풀립니다.
              </p>
            )}
            {error && <p className="mt-2 text-sm text-red-600 print:hidden">{error}</p>}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
