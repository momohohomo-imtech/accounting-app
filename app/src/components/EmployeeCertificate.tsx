"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/components/ui/field";
import { PrintButton } from "@/components/PrintButton";

type EmployeeInfo = {
  name: string;
  employee_no: string | null;
  department: string | null;
  role: string | null;
  hired_date: string | null;
};

export function EmployeeCertificate({ employee, closeHref }: { employee: EmployeeInfo; closeHref: string }) {
  const [companyName, setCompanyName] = useState("아이엠테크");
  const [representativeName, setRepresentativeName] = useState("");
  const [purpose, setPurpose] = useState("제출용");
  const [submitTo, setSubmitTo] = useState("");

  const today = new Date();
  const todayLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h2 className="text-lg font-semibold text-slate-900">재직증명서</h2>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 print:hidden">
        <div>
          <label className={labelClass}>회사명</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>대표자명 (선택)</label>
          <input
            value={representativeName}
            onChange={(e) => setRepresentativeName(e.target.value)}
            className={fieldClass}
            placeholder="선택 입력"
          />
        </div>
        <div>
          <label className={labelClass}>용도</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>제출처 (선택)</label>
          <input
            value={submitTo}
            onChange={(e) => setSubmitTo(e.target.value)}
            className={fieldClass}
            placeholder="선택 입력"
          />
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-8 py-4">
        <h1 className="text-center text-3xl font-bold tracking-[0.5em] text-slate-900">재직증명서</h1>

        <table className="w-full border-t-2 border-slate-900 text-sm">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-28 bg-slate-50 py-2.5 pl-3 font-medium text-slate-600">성명</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.name}</td>
              <td className="w-28 bg-slate-50 py-2.5 pl-3 font-medium text-slate-600">사원번호</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.employee_no ?? "-"}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="bg-slate-50 py-2.5 pl-3 font-medium text-slate-600">부서</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.department ?? "-"}</td>
              <td className="bg-slate-50 py-2.5 pl-3 font-medium text-slate-600">직위</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.role ?? "-"}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="bg-slate-50 py-2.5 pl-3 font-medium text-slate-600">입사일</td>
              <td className="py-2.5 pl-3 text-slate-900" colSpan={3}>
                {formatDate(employee.hired_date)}
              </td>
            </tr>
            <tr className="border-b-2 border-slate-900">
              <td className="bg-slate-50 py-2.5 pl-3 font-medium text-slate-600">용도</td>
              <td className="py-2.5 pl-3 text-slate-900" colSpan={3}>
                {purpose}
                {submitTo ? ` (제출처: ${submitTo})` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-center text-sm leading-relaxed text-slate-700">위 사람은 본 사업장에 재직 중임을 증명합니다.</p>

        <p className="text-center text-sm text-slate-700">{todayLabel}</p>

        <div className="pt-8 text-center text-sm text-slate-900">
          <p className="font-semibold">{companyName || "-"}</p>
          {representativeName && <p className="mt-1">대표 {representativeName} (인)</p>}
        </div>
      </div>
    </div>
  );
}
