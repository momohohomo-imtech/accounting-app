"use client";

import { BLANK_EQUIPMENT_ROWS, BLANK_EXPENSE_ROWS, BLANK_WORKER_ROWS, WORK_TYPE_OPTIONS } from "@/lib/businessTrip";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";

const cell = "border border-slate-300 px-1 py-1 h-6";

export function BusinessTripBlankFormPopup({ onClose }: { onClose: () => void }) {
  useEscapeKey(true, onClose);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h2 className="text-lg font-semibold text-slate-900">출장 업무 내역서 (빈 양식)</h2>
            <div className="flex items-center gap-2">
              <ModalPrintButton />
              <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-900">
            <h1 className="mb-2 text-center text-base font-bold">출장 업무 내역서</h1>

            <table className="mb-2 w-full border-collapse">
              <tbody>
                <tr>
                  <td className={`${cell} w-20 bg-slate-50 font-medium`}>원청사</td>
                  <td className={cell}></td>
                  <td className={`${cell} w-20 bg-slate-50 font-medium`}>현장명</td>
                  <td className={cell}></td>
                </tr>
                <tr>
                  <td className={`${cell} bg-slate-50 font-medium`}>작성일</td>
                  <td className={cell}></td>
                  <td className={`${cell} bg-slate-50 font-medium`}>작업구분</td>
                  <td className={cell}>
                    {WORK_TYPE_OPTIONS.map((t) => (
                      <span key={t} className="mr-3 inline-flex items-center gap-1">
                        <span className="inline-block h-3 w-3 border border-slate-400" />
                        {t}
                      </span>
                    ))}
                  </td>
                </tr>
                <tr>
                  <td className={`${cell} bg-slate-50 font-medium`}>비고</td>
                  <td className={cell} colSpan={3}></td>
                </tr>
              </tbody>
            </table>
            <p className="mb-2 text-slate-400">
              ※ 하루에 여러 프로젝트(같거나 다른 공사일)를 진행한 경우, 아래 표의 "공사일"과 "프로젝트명" 칸에
              각 줄이 어느 날짜/프로젝트인지 적어주세요.
            </p>

            <p className="mb-1 font-semibold">작업 인원 내역 (근무일은 그 줄의 공사일과 동일)</p>
            <table className="mb-1 w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${cell} w-16 bg-slate-50`}>공사일</th>
                  <th className={`${cell} w-20 bg-slate-50`}>프로젝트명</th>
                  <th className={`${cell} bg-slate-50`}>작업자명</th>
                  <th className={`${cell} w-16 bg-slate-50`}>추가근무</th>
                  <th className={`${cell} bg-slate-50`}>비고</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: BLANK_WORKER_ROWS }, (_, i) => (
                  <tr key={i}>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mb-1">
              비고 <span className="inline-block w-full max-w-xs border-b border-slate-400">&nbsp;</span>
            </p>
            <p className="mb-2 text-right">
              총 공수 <span className="inline-block w-16 border-b border-slate-400">&nbsp;</span> 명
            </p>

            <p className="mb-1 font-semibold">장비 사용 내역</p>
            <table className="mb-2 w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${cell} w-16 bg-slate-50`}>공사일</th>
                  <th className={`${cell} w-20 bg-slate-50`}>프로젝트명</th>
                  <th className={`${cell} bg-slate-50`}>장비명</th>
                  <th className={`${cell} bg-slate-50`}>사용처</th>
                  <th className={`${cell} w-20 bg-slate-50`}>작업시간</th>
                  <th className={`${cell} bg-slate-50`}>비고</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: BLANK_EQUIPMENT_ROWS }, (_, i) => (
                  <tr key={i}>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mb-1 font-semibold">현장 지출 내역</p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${cell} w-16 bg-slate-50`}>공사일</th>
                  <th className={`${cell} w-20 bg-slate-50`}>프로젝트명</th>
                  <th className={`${cell} bg-slate-50`}>사용처</th>
                  <th className={`${cell} w-24 bg-slate-50`}>금액</th>
                  <th className={`${cell} bg-slate-50`}>비고</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: BLANK_EXPENSE_ROWS }, (_, i) => (
                  <tr key={i}>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
