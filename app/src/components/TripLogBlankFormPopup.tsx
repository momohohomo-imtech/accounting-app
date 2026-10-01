"use client";

import { WORK_TYPE_OPTIONS } from "@/lib/tripLog";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";

const cell = "border border-slate-300 px-1 py-1 h-7";
const BLANK_ROWS = 20;

// 출장일지(새 방식) 빈 양식 — 현장에서 손으로 적어 오는 용. 칸 구성은 TripLogPopup과 같음.
export function TripLogBlankFormPopup({ onClose }: { onClose: () => void }) {
  useEscapeKey(true, onClose);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h2 className="text-lg font-semibold text-slate-900">출장 업무 내역서 (빈 양식)</h2>
            <div className="flex items-center gap-2">
              <ModalPrintButton />
              <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <div className="min-w-[680px] text-xs text-slate-900 print:min-w-0">
              <h1 className="mb-2 text-center text-base font-bold tracking-widest">출장 업무 내역서</h1>
              <table className="mb-2 w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={`${cell} w-20 bg-slate-50 font-medium`}>프로젝트</td>
                    <td className={cell} colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className={`${cell} bg-slate-50 font-medium`}>현장</td>
                    <td className={cell}></td>
                    <td className={`${cell} w-20 bg-slate-50 font-medium`}>원청사</td>
                    <td className={cell}></td>
                  </tr>
                  <tr>
                    <td className={`${cell} bg-slate-50 font-medium`}>기간</td>
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
                    <td className={`${cell} bg-slate-50 font-medium`}>출장 일수</td>
                    <td className={cell}>일</td>
                    <td className={`${cell} bg-slate-50 font-medium`}>총 투입 인원</td>
                    <td className={cell}>명 (사내 &nbsp;&nbsp;&nbsp; 명 · 조공 &nbsp;&nbsp;&nbsp; 명)</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className={`${cell} w-20`}>날짜</th>
                    <th className={cell}>작업 내용</th>
                    <th className={`${cell} w-10`}>사내</th>
                    <th className={`${cell} w-10`}>조공</th>
                    <th className={`${cell} w-10`}>계</th>
                    <th className={`${cell} w-10`}>장비</th>
                    <th className={`${cell} w-24`}>사용처</th>
                    <th className={`${cell} w-16`}>시간</th>
                    <th className={`${cell} w-28`}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: BLANK_ROWS }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className={cell} />
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <td className={cell}>합계</td>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className={cell} />
                    ))}
                  </tr>
                </tbody>
              </table>
              <table className="mt-2 w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={`${cell} w-20 bg-slate-50 font-medium`}>비고</td>
                    <td className={`${cell} h-12`}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
