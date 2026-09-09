"use client";

import { useState } from "react";
import Image from "next/image";
import { formatWon, formatDate } from "@/lib/format";
import { numberToKoreanAmount } from "@/lib/numberToKorean";
import { PrintButton } from "@/components/PrintButton";
import { fieldClass, labelClass } from "@/components/ui/field";

type PurchaseOrderItemRow = {
  id: string;
  item_name: string | null;
  spec: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
};

const GENERAL_TERMS = [
  "본 발주서는 계약서와 동등한 효력을 갖는다.",
  '공사 도급인(이하 "갑"이라 한다)과 수급인(이하 "을"이라 한다)은 대등한 입장에서 서로 협력하여 신의에 따라 성실히 이 계약을 이행한다.',
  '산업재해보험은 산업재해 보상보험에 의하여 "을"이 가입함을 원칙으로 하고, "을"은 시공에 있어서 재해방지를 위하여 만전을 기한다.',
  "모든 자재는 K.S 규격의 제품을 사용한다.",
  "공사완료시 운전 및 유지보수 MANUAL SHEET를 첨부한다.",
  '(납기지연) "을"은 정당한 사유없이 납기를 지체하였을 경우 지연된 일수에 대하여 발주 금액의 3/1000에 해당하는 지체 배상금을 부담하여야 한다.',
  '(증권) 선급금이행증권 및 하자보증증권을 계약금 및 잔금 수령시 "갑"의 회사에 예치하여야 한다.',
];

export function PurchaseOrderPrintView({
  purchaseOrder,
  items,
}: {
  purchaseOrder: {
    po_number: string | null;
    title: string;
    clientName: string | null;
    projectLabel: string | null;
    expected_date: string | null;
    memo: string | null;
    created_at: string;
  };
  items: PurchaseOrderItemRow[];
}) {
  const [companyName, setCompanyName] = useState("아이엠테크");
  const [representativeName, setRepresentativeName] = useState("");
  const [bizRegNo, setBizRegNo] = useState("521-32-01642");
  const [address, setAddress] = useState("인천 남동구 호구포로 44번길 77");
  const [bizType, setBizType] = useState("제조업");
  const [bizItem, setBizItem] = useState("컨베이어 장치 제조업");
  const [phone, setPhone] = useState("");
  const [fax, setFax] = useState("032-232-0914");
  const [preparedBy, setPreparedBy] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("계약금 (   %), 중도금 (   %), 잔금 (   %)");

  const total = items.reduce((s, it) => s + it.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 print:hidden sm:grid-cols-4">
        <div>
          <label className={labelClass}>상호</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>대표자</label>
          <input
            value={representativeName}
            onChange={(e) => setRepresentativeName(e.target.value)}
            className={fieldClass}
            placeholder="선택 입력"
          />
        </div>
        <div>
          <label className={labelClass}>사업자등록번호</label>
          <input value={bizRegNo} onChange={(e) => setBizRegNo(e.target.value)} className={fieldClass} placeholder="000-00-00000" />
        </div>
        <div>
          <label className={labelClass}>작성자</label>
          <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className={fieldClass} placeholder="선택 입력" />
        </div>
        <div>
          <label className={labelClass}>전화</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} placeholder="선택 입력" />
        </div>
        <div>
          <label className={labelClass}>팩스</label>
          <input value={fax} onChange={(e) => setFax(e.target.value)} className={fieldClass} placeholder="선택 입력" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>사업장 소재지</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={fieldClass} placeholder="선택 입력" />
        </div>
        <div>
          <label className={labelClass}>업태</label>
          <input value={bizType} onChange={(e) => setBizType(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>종목</label>
          <input value={bizItem} onChange={(e) => setBizItem(e.target.value)} className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>대금결제 조건</label>
          <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <p className="mr-auto text-xs text-slate-400">
          PDF로 저장하려면 인쇄 대화상자의 대상(프린터)에서 &ldquo;PDF로 저장&rdquo;을 선택하세요.
        </p>
        <PrintButton />
      </div>

      <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 text-[13px] print:block print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo-lockup.png" alt="" width={26} height={20} className="h-5 w-auto" />
            <span className="font-mono text-[10px] tracking-widest text-slate-400">PURCHASE ORDER</span>
          </div>
          <div className="flex text-center text-[10px]">
            {["담당", "검토", "승인"].map((label) => (
              <div key={label} className="-ml-px flex h-7 w-11 flex-col border border-slate-300 first:ml-0">
                <div className="border-b border-slate-300 bg-brand-soft py-0.5 font-semibold text-slate-600">{label}</div>
                <div className="flex-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1.5 flex flex-col">
          <div className="h-[3px] bg-brand" />
          <div className="h-[3px] w-1/3 bg-brand-red" />
        </div>

        <h1 className="mt-3 text-center text-2xl font-bold tracking-[0.4em] text-brand">발 주 서</h1>

        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[13px]">
          <p>
            <span className="text-slate-500">발주번호: </span>
            <span className="font-mono font-medium text-slate-900">{purchaseOrder.po_number ?? "-"}</span>
          </p>
          <p>
            <span className="text-slate-500">발주일자: </span>
            <span className="font-medium text-slate-900">{formatDate(purchaseOrder.created_at)}</span>
          </p>
          <p>
            <span className="text-slate-500">건명: </span>
            <span className="font-medium text-slate-900">{purchaseOrder.title}</span>
          </p>
          <p>
            <span className="text-slate-500">납기예정일: </span>
            <span className="font-medium text-slate-900">
              {purchaseOrder.expected_date ? formatDate(purchaseOrder.expected_date) : "-"}
            </span>
          </p>
          {purchaseOrder.projectLabel && (
            <p className="col-span-2">
              <span className="text-slate-500">연결 프로젝트: </span>
              <span className="font-medium text-slate-900">{purchaseOrder.projectLabel}</span>
            </p>
          )}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-300">
            <p className="border-b border-slate-300 bg-brand-soft px-3 py-0.5 text-[11px] font-semibold text-slate-600">매입처</p>
            <p className="px-3 py-1 text-[13px] font-medium text-slate-900">{purchaseOrder.clientName ?? "-"} 귀하</p>
          </div>
          <div className="rounded-lg border border-slate-300">
            <p className="border-b border-slate-300 bg-brand-soft px-3 py-0.5 text-[11px] font-semibold text-slate-600">발주자</p>
            <table className="w-full text-[11px]">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="w-16 px-3 py-0.5 text-slate-500">등록번호</td>
                  <td className="px-3 py-0.5 text-slate-900">{bizRegNo || "-"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-0.5 text-slate-500">상호</td>
                  <td className="px-3 py-0.5 text-slate-900">
                    {companyName || "-"} {representativeName && <span>(대표 {representativeName})</span>}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-0.5 text-slate-500">주소</td>
                  <td className="px-3 py-0.5 text-slate-900">{address || "-"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-0.5 text-slate-500">업태/종목</td>
                  <td className="px-3 py-0.5 text-slate-900">
                    {bizType || "-"} / {bizItem || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-0.5 text-slate-500">전화/팩스</td>
                  <td className="px-3 py-0.5 text-slate-900">
                    {phone || "-"} / {fax || "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between rounded-lg border-2 border-brand bg-brand-soft px-3 py-1.5">
          <span className="text-[13px] font-semibold text-slate-700">발주금액</span>
          <span className="text-[13px] font-bold text-slate-900">
            {numberToKoreanAmount(total)} (<span className="font-mono">{formatWon(total)}</span>)
          </span>
        </div>

        <table className="mt-2.5 w-full text-[13px]">
          <thead>
            <tr className="border-b border-t-2 border-slate-900 text-left text-slate-500">
              <th className="w-10 py-0.5 pr-2 text-center">No</th>
              <th className="py-0.5 pr-2">품명</th>
              <th className="py-0.5 pr-2">규격</th>
              <th className="py-0.5 pr-2 text-right">수량</th>
              <th className="py-0.5 pr-2 text-right">단가</th>
              <th className="py-0.5 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-0.5 pr-2 text-center text-slate-500">{i + 1}</td>
                <td className="py-0.5 pr-2">{it.item_name ?? "-"}</td>
                <td className="py-0.5 pr-2 text-slate-500">{it.spec ?? "-"}</td>
                <td className="py-0.5 pr-2 text-right font-mono">{it.quantity ?? "-"}</td>
                <td className="py-0.5 pr-2 text-right font-mono">{it.unit_price ? formatWon(it.unit_price) : "-"}</td>
                <td className="py-0.5 text-right font-mono">{formatWon(it.amount)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  등록된 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300">
                <td colSpan={5} className="py-0.5 text-right font-semibold text-slate-900">
                  합계
                </td>
                <td className="py-0.5 text-right font-mono text-sm font-bold text-slate-900">{formatWon(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        <div className="mt-2.5 rounded-lg border border-slate-300">
          <p className="border-b border-slate-300 bg-brand-soft px-3 py-0.5 text-[11px] font-semibold text-slate-600">계약 조건</p>
          <div className="space-y-0.5 px-3 py-1 text-[10px] leading-snug text-slate-700">
            <p>
              <span className="font-semibold">가. 대금결제</span> — {paymentTerms || "-"}
            </p>
            <p>
              <span className="font-semibold">나. 납기완료</span> —{" "}
              {purchaseOrder.expected_date ? formatDate(purchaseOrder.expected_date) : "-"}
            </p>
            <div>
              <span className="font-semibold">다. 일반사항</span>
              <ol className="mt-0.5 list-none space-y-0.5 pl-1">
                {GENERAL_TERMS.map((term, i) => (
                  <li key={i}>
                    {i + 1}. {term}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {purchaseOrder.memo && (
          <div className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px]">
            <p className="mb-0.5 text-[11px] font-semibold text-slate-500">라. 비고</p>
            <p className="whitespace-pre-wrap text-slate-700">{purchaseOrder.memo}</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-slate-900">
          <Image src="/logo-lockup.png" alt="" width={18} height={14} className="h-3.5 w-auto" />
          <p className="font-semibold">
            {companyName || "-"} {representativeName && <span>대표 {representativeName} (인)</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
