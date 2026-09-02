"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessTripLog } from "@/lib/types";
import { tripDayCount } from "@/lib/businessTrip";
import { updateBusinessTripLog, deleteBusinessTripLog } from "@/lib/actions/businessTripLogs";
import { downloadBusinessTripLogXlsx } from "@/lib/businessTripXlsx";
import { BusinessTripLogForm } from "@/components/BusinessTripLogForm";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-900">{value || "-"}</p>
    </div>
  );
}

export function BusinessTripLogViewPopup({ log, onClose }: { log: BusinessTripLog; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 수정 중이면 ESC로 팝업 전체를 바로 닫지 않고 수정 취소부터 — 실수로 입력 내용을 날리지 않게.
  useEscapeKey(true, () => (editing ? setEditing(false) : onClose()));

  async function handleDelete() {
    const fd = new FormData();
    fd.append("id", log.id);
    await deleteBusinessTripLog(fd);
    router.refresh();
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
          {editing ? (
            <BusinessTripLogForm
              initial={log}
              action={updateBusinessTripLog}
              onSaved={() => {
                router.refresh();
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">출장 업무 내역서</h2>
                <div className="flex shrink-0 items-center gap-2 print:hidden">
                  <ModalPrintButton />
                  <Button type="button" variant="secondary" size="xs" onClick={() => downloadBusinessTripLogXlsx(log)}>
                    엑셀
                  </Button>
                  <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(true)}>
                    수정
                  </Button>
                  {confirmingDelete ? (
                    <>
                      <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                      <Button type="button" variant="danger" size="xs" onClick={handleDelete}>
                        확인
                      </Button>
                      <Button type="button" variant="secondary" size="xs" onClick={() => setConfirmingDelete(false)}>
                        취소
                      </Button>
                    </>
                  ) : (
                    <Button type="button" variant="danger" size="xs" onClick={() => setConfirmingDelete(true)}>
                      삭제
                    </Button>
                  )}
                  <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                    닫기
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-slate-100 pb-4 sm:grid-cols-3">
                <Field label="원청사" value={log.client_name ?? ""} />
                <Field label="현장명" value={log.site_name ?? ""} />
                <Field label="작성일" value={log.created_date} />
                <Field label="공사일수" value={`${tripDayCount(log)}일`} />
                <Field label="작업구분" value={log.work_types.join(", ")} />
                <div className="sm:col-span-3">
                  <Field label="비고" value={log.note ?? ""} />
                </div>
              </div>

              {log.projects.map((p, pi) => (
                <div key={pi} className="mt-4 border-t border-slate-100 pt-4 first:mt-0 first:border-0 first:pt-0">
                  <h3 className="mb-3 flex items-baseline gap-2 font-semibold text-slate-900">
                    <span>{p.project_name || `프로젝트 ${pi + 1}`}</span>
                    <span className="text-xs font-normal text-slate-400">{p.work_date}</span>
                  </h3>

                  <p className="mb-1 text-sm font-medium text-slate-700">작업 인원 내역</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-1 pr-2">공사일</th>
                        <th className="pb-1 pr-2">작업자명</th>
                        <th className="pb-1 pr-2">추가근무</th>
                        <th className="pb-1">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.workers.map((w, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1 pr-2 text-slate-600">{w.work_date}</td>
                          <td className="py-1 pr-2 text-slate-900">{w.name}</td>
                          <td className="py-1 pr-2 text-slate-600">{w.overtime ? "O" : ""}</td>
                          <td className="py-1 text-slate-600">{w.note}</td>
                        </tr>
                      ))}
                      {p.workers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-3 text-center text-slate-400">
                            인원 내역 없음
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {p.personnel_note && (
                    <p className="mt-2 text-sm text-slate-600">비고: {p.personnel_note}</p>
                  )}
                  <p className="mb-3 mt-2 text-right text-sm text-slate-700">
                    총 공수 <span className="font-semibold">{p.total_manpower || "-"}</span>명
                  </p>

                  <p className="mb-1 text-sm font-medium text-slate-700">장비 사용 내역</p>
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-1 pr-2">장비명</th>
                        <th className="pb-1 pr-2">사용처</th>
                        <th className="pb-1 pr-2">작업시간</th>
                        <th className="pb-1">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.equipment.map((e, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1 pr-2 text-slate-900">{e.name}</td>
                          <td className="py-1 pr-2 text-slate-600">{e.location}</td>
                          <td className="py-1 pr-2 text-slate-600">{e.hours}</td>
                          <td className="py-1 text-slate-600">{e.note}</td>
                        </tr>
                      ))}
                      {p.equipment.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-3 text-center text-slate-400">
                            장비 내역 없음
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <p className="mb-1 text-sm font-medium text-slate-700">현장 지출 내역</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-1 pr-2">사용처</th>
                        <th className="pb-1 pr-2">금액</th>
                        <th className="pb-1">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.expenses.map((e, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1 pr-2 text-slate-900">{e.vendor}</td>
                          <td className="py-1 pr-2 text-slate-600">{e.amount}</td>
                          <td className="py-1 text-slate-600">{e.note}</td>
                        </tr>
                      ))}
                      {p.expenses.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-3 text-center text-slate-400">
                            지출 내역 없음
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
              {log.projects.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">프로젝트 내역이 없습니다.</p>
              )}
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
