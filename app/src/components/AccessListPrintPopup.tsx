"use client";

import { formatDate } from "@/lib/format";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";

type Member = {
  name: string;
  phone: string | null;
  nationality: string | null;
  birthDate: string | null;
  note: string;
};

export function AccessListPrintPopup({
  companyName,
  siteName,
  supervisorName,
  accessPeriod,
  members,
  onClose,
}: {
  companyName: string;
  siteName: string | null;
  supervisorName: string | null;
  accessPeriod: string | null;
  members: Member[];
  onClose: () => void;
}) {
  useEscapeKey(true, onClose);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">공사자 출입자 명부</h2>
            <div className="flex shrink-0 items-center gap-2 print:hidden">
              <ModalPrintButton />
              <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
            <p>
              <span className="text-slate-500">업체명:</span> {companyName}
            </p>
            <p>
              <span className="text-slate-500">현장:</span> {siteName ?? "-"}
            </p>
            <p>
              <span className="text-slate-500">감독자:</span> {supervisorName ?? "-"}
            </p>
            <p>
              <span className="text-slate-500">출입일자:</span> {accessPeriod ?? "-"}
            </p>
            <p>
              <span className="text-slate-500">인원수:</span> {members.length}명
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500">
                <th className="py-1.5 pr-2">구분</th>
                <th className="py-1.5 pr-2">성 명</th>
                <th className="py-1.5 pr-2">생년월일</th>
                <th className="py-1.5 pr-2">연락처</th>
                <th className="py-1.5 pr-2">국적</th>
                <th className="py-1.5">비고</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i} className="border-b border-slate-200 text-slate-700">
                  <td className="py-1.5 pr-2 text-center">{i + 1}</td>
                  <td className="py-1.5 pr-2 text-center">{m.name}</td>
                  <td className="py-1.5 pr-2 text-center">{m.birthDate ? formatDate(m.birthDate) : "-"}</td>
                  <td className="py-1.5 pr-2 text-center">{m.phone ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-center">{m.nationality ?? "-"}</td>
                  <td className="py-1.5 text-center">{m.note || "-"}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    등록된 인원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="mt-4 text-center text-xs text-slate-500">
            인원수 대로 신분증 제출 요망
            <br />
            (명단 제출 → 선 출입 후 명단으로 출입보안승인 / 출입보안 미등록시 공사 진행 불가
          </p>
        </div>
      </div>
    </ModalPortal>
  );
}
