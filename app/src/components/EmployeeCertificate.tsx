"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/components/ui/field";
import { PrintButton } from "@/components/PrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";

type EmployeeInfo = {
  name: string;
  employee_no: string | null;
  department: string | null;
  role: string | null;
  hired_date: string | null;
  birth_date: string | null;
  address: string | null;
};

export function EmployeeCertificate({ employee, closeHref }: { employee: EmployeeInfo; closeHref: string }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("아이엠테크");
  const [representativeName, setRepresentativeName] = useState("");
  const [purpose, setPurpose] = useState("제출용");
  const [submitTo, setSubmitTo] = useState("");
  useEscapeKey(true, () => router.push(closeHref));

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

      <div className="mx-auto flex min-h-[700px] max-w-xl flex-col py-4 print:min-h-[250mm]">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-lockup.png" alt="" width={30} height={24} className="h-6 w-auto" />
          <span className="ml-auto font-mono text-[11px] tracking-widest text-slate-400">
            EMPLOYMENT CERTIFICATE
          </span>
        </div>
        <div className="mt-3 flex flex-col">
          <div className="h-[3px] bg-brand" />
          <div className="h-[3px] w-1/3 bg-brand-red" />
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold tracking-[0.5em] text-brand">재직증명서</h1>

        <table className="mt-8 w-full border-t-2 border-slate-900 text-sm">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-28 bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">성명</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.name}</td>
              <td className="w-28 bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">사원번호</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.employee_no ?? "-"}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">생년월일</td>
              <td className="py-2.5 pl-3 text-slate-900">{formatDate(employee.birth_date)}</td>
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">입사일</td>
              <td className="py-2.5 pl-3 text-slate-900">{formatDate(employee.hired_date)}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">부서</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.department ?? "-"}</td>
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">직위</td>
              <td className="py-2.5 pl-3 text-slate-900">{employee.role ?? "-"}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">주소</td>
              <td className="py-2.5 pl-3 text-slate-900" colSpan={3}>
                {employee.address ?? "-"}
              </td>
            </tr>
            <tr className="border-b-2 border-slate-900">
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">용도</td>
              <td className="py-2.5 pl-3 text-slate-900" colSpan={3}>
                {purpose}
                {submitTo ? ` (제출처: ${submitTo})` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-8 text-center text-sm leading-relaxed text-slate-700">
          위 사람은 본 사업장에 재직 중임을 증명합니다.
        </p>

        <div className="mt-auto pb-12 text-center">
          <p className="text-sm text-slate-700">{todayLabel}</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-900">
            <Image src="/logo-lockup.png" alt="" width={20} height={16} className="h-4 w-auto" />
            <p className="font-semibold">{companyName || "-"}</p>
          </div>
          {representativeName && <p className="mt-1 text-sm text-slate-700">대표 {representativeName} (인)</p>}
        </div>
      </div>
    </div>
  );
}
