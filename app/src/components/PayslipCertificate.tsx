"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/components/ui/field";
import { PrintButton } from "@/components/PrintButton";
import { EscapeCloseLink } from "@/components/EscapeCloseLink";

type PayslipData = {
  payMonth: string;
  employeeName: string;
  employeeNo: string | null;
  department: string | null;
  role: string | null;
  hiredDate: string | null;
  resignedDate: string | null;
  amount: number;
  bonus: number;
  total: number;
  deductionRows: [string, number][];
  deductionTotal: number;
  nonTaxableUnreported: number;
  net: number;
  memo: string | null;
};

// 재직증명서(EmployeeCertificate.tsx)와 같은 정식 문서 포맷 — 로고·브랜드 컬러바·제목·
// 표 스타일·하단 회사 서명란까지 그대로 맞춰서 이 회사에서 나가는 증빙 문서 느낌을 통일.
export function PayslipCertificate({ data, closeHref }: { data: PayslipData; closeHref: string }) {
  const [companyName, setCompanyName] = useState("아이엠테크");
  const [representativeName, setRepresentativeName] = useState("");

  const today = new Date();
  const todayLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const payMonthLabel = formatDate(data.payMonth).slice(0, 7).replace("-", "년 ") + "월";

  return (
    <div className="space-y-6">
      <EscapeCloseLink href={closeHref} />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h2 className="text-lg font-semibold text-slate-900">
          {data.employeeName} 급여명세서{" "}
          <span className="tabular-nums text-sm font-normal text-slate-400">{payMonthLabel}</span>
        </h2>
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
      </div>

      <div className="mx-auto flex min-h-[700px] max-w-xl flex-col py-4 print:min-h-[250mm]">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-lockup.png" alt="" width={30} height={24} className="h-6 w-auto" />
          <span className="ml-auto tabular-nums text-[11px] tracking-widest text-slate-400">PAYSLIP</span>
        </div>
        <div className="mt-3 flex flex-col">
          <div className="h-[3px] bg-brand" />
          <div className="h-[3px] w-1/3 bg-brand-red" />
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold tracking-[0.5em] text-brand">급여명세서</h1>
        <p className="mt-1 text-center tabular-nums text-sm text-slate-500">{payMonthLabel} 귀속</p>

        <table className="mt-8 w-full border-t-2 border-slate-900 text-sm">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-28 bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">성명</td>
              <td className="py-2.5 pl-3 text-slate-900">{data.employeeName}</td>
              <td className="w-28 bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">사원번호</td>
              <td className="py-2.5 pl-3 text-slate-900">{data.employeeNo ?? "-"}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">부서</td>
              <td className="py-2.5 pl-3 text-slate-900">{data.department ?? "-"}</td>
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">직위</td>
              <td className="py-2.5 pl-3 text-slate-900">{data.role ?? "-"}</td>
            </tr>
            <tr className="border-b-2 border-slate-900">
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">입사일</td>
              <td className="py-2.5 pl-3 text-slate-900">{formatDate(data.hiredDate)}</td>
              <td className="bg-brand-soft py-2.5 pl-3 font-medium text-slate-600">퇴사일</td>
              <td className="py-2.5 pl-3 text-slate-900">{data.resignedDate ? formatDate(data.resignedDate) : "-"}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">지급내역</h3>
            <table className="w-full border-t-2 border-slate-900 text-sm">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="bg-brand-soft py-2 pl-3 text-slate-600">기본급</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{formatWon(data.amount)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-brand-soft py-2 pl-3 text-slate-600">상여</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{formatWon(data.bonus)}</td>
                </tr>
                <tr className="border-b-2 border-slate-900">
                  <td className="bg-brand-soft py-2 pl-3 font-semibold text-slate-900">지급합계</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-900">
                    {formatWon(data.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">공제내역</h3>
            <table className="w-full border-t-2 border-slate-900 text-sm">
              <tbody>
                {data.deductionRows.map(([label, value]) => (
                  <tr key={label} className="border-b border-slate-300">
                    <td className="bg-brand-soft py-2 pl-3 text-slate-600">{label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{formatWon(value)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-slate-900">
                  <td className="bg-brand-soft py-2 pl-3 font-semibold text-slate-900">공제합계</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-900">
                    {formatWon(data.deductionTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-brand-soft px-4 py-3 print:rounded-none print:border-2 print:border-slate-900">
          <span className="text-sm text-slate-600">
            미제출비과세 <span className="tabular-nums font-medium text-slate-700">{formatWon(data.nonTaxableUnreported)}</span>
          </span>
          <span className="text-sm font-semibold text-slate-900">
            차인지급액(실지급액)
            <span className="ml-2 tabular-nums text-xl font-bold text-slate-900">{formatWon(data.net)}</span>
          </span>
        </div>

        {data.memo && (
          <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3 print:rounded-none print:border print:border-slate-400">
            <p className="mb-1 text-xs font-medium text-slate-500">전달사항</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{data.memo}</p>
          </div>
        )}

        <div className="mt-auto pb-12 pt-8 text-center">
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
