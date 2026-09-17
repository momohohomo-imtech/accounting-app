"use client";

import { useState } from "react";
import Image from "next/image";
import { formatWon, formatDate } from "@/lib/format";
import { numberToKoreanAmount } from "@/lib/numberToKorean";
import { computeConfirmedAmount, isVisibleQuoteItem } from "@/lib/quoteCalc";
import { PrintButton } from "@/components/PrintButton";
import { QuoteExportButton } from "@/components/QuoteExportButton";
import { fieldClass, labelClass } from "@/components/ui/field";
import { updateQuoteCompanyInfo, type QuoteCompanyInfo } from "@/lib/actions/quotes";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { Button } from "@/components/ui/Button";

const MIN_PRINT_ROWS = 8;

// 저장된 회사 정보가 없는(company_info가 null인) 견적서 — 새 견적서 포함 — 는 항상 이 기본값으로 보임.
const DEFAULT_COMPANY_INFO: QuoteCompanyInfo = {
  companyName: "아이엠테크",
  representativeName: "",
  bizRegNo: "521-32-01642",
  address: "인천 남동구 호구포로 44번길 77",
  bizType: "제조업",
  bizItem: "컨베이어 장치 제조업",
  phone: "",
  fax: "032-232-0914",
};

type QuoteItemRow = {
  id: string;
  item_name: string | null;
  spec: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  handling_fee_pct: number;
  note: string | null;
  unit: string | null;
  group_label: string | null;
  is_group_summary: boolean;
};

export function QuotePrintView({
  quote,
  items,
  quoteId,
  companyInfo,
}: {
  quote: {
    quote_number: string | null;
    title: string;
    clientName: string | null;
    projectLabel: string | null;
    valid_until: string | null;
    memo: string | null;
    created_at: string;
  };
  items: QuoteItemRow[];
  quoteId: string;
  /** 이 견적서에 저장된 공급자 정보 — null이면(새 견적서 등) 기본값을 씀. */
  companyInfo: QuoteCompanyInfo | null;
}) {
  const pending = useGlobalPending();
  const initial = companyInfo ?? DEFAULT_COMPANY_INFO;
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [representativeName, setRepresentativeName] = useState(initial.representativeName);
  const [bizRegNo, setBizRegNo] = useState(initial.bizRegNo);
  const [address, setAddress] = useState(initial.address);
  const [bizType, setBizType] = useState(initial.bizType);
  const [bizItem, setBizItem] = useState(initial.bizItem);
  const [phone, setPhone] = useState(initial.phone);
  const [fax, setFax] = useState(initial.fax);

  async function handleSaveCompanyInfo() {
    await pending.run(() =>
      updateQuoteCompanyInfo(quoteId, {
        companyName,
        representativeName,
        bizRegNo,
        address,
        bizType,
        bizItem,
        phone,
        fax,
      })
    );
  }

  const rows = items.filter(isVisibleQuoteItem).map((it) => {
    const confirmed = computeConfirmedAmount(it.amount, it.handling_fee_pct);
    const adjustedUnitPrice = it.unit_price != null ? computeConfirmedAmount(it.unit_price, it.handling_fee_pct) : null;
    return { ...it, confirmed, adjustedUnitPrice };
  });
  const total = rows.reduce((s, r) => s + r.confirmed, 0);

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
          <input
            value={bizRegNo}
            onChange={(e) => setBizRegNo(e.target.value)}
            className={fieldClass}
            placeholder="000-00-00000"
          />
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
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <p className="mr-auto text-xs text-slate-400">
          이 견적서에만 저장되며, 새 견적서는 항상 기본값(아이엠테크)으로 시작합니다. PDF로 저장하려면 인쇄
          대화상자의 대상(프린터)에서 &ldquo;PDF로 저장&rdquo;을 선택하세요.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={handleSaveCompanyInfo}>
          공급자 정보 저장
        </Button>
        <QuoteExportButton quote={quote} rows={rows} total={total} />
        <PrintButton />
      </div>

      <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 print:flex print:min-h-[297mm] print:flex-col print:rounded-none print:border-0 print:p-0">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-lockup.png" alt="" width={30} height={24} className="h-6 w-auto" />
          <span className="ml-auto font-mono text-[11px] tracking-widest text-slate-400">QUOTATION</span>
        </div>
        <div className="mt-3 flex flex-col">
          <div className="h-[3px] bg-brand" />
          <div className="h-[3px] w-1/3 bg-brand-red" />
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold tracking-[0.5em] text-brand">견 적 서</h1>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p>
            <span className="text-slate-500">견적번호: </span>
            <span className="font-mono font-medium text-slate-900">{quote.quote_number ?? "-"}</span>
          </p>
          <p>
            <span className="text-slate-500">견적일자: </span>
            <span className="font-medium text-slate-900">{formatDate(quote.created_at)}</span>
          </p>
          <p>
            <span className="text-slate-500">건명: </span>
            <span className="font-medium text-slate-900">{quote.title}</span>
          </p>
          <p>
            <span className="text-slate-500">유효기한: </span>
            <span className="font-medium text-slate-900">{quote.valid_until ? formatDate(quote.valid_until) : "-"}</span>
          </p>
          {quote.projectLabel && (
            <p className="col-span-2">
              <span className="text-slate-500">연결 프로젝트: </span>
              <span className="font-medium text-slate-900">{quote.projectLabel}</span>
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-300">
            <p className="border-b border-slate-300 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-slate-600">
              공급받는자
            </p>
            <p className="px-3 py-3 text-sm font-medium text-slate-900">{quote.clientName ?? "-"} 귀하</p>
          </div>
          <div className="rounded-lg border border-slate-300">
            <p className="border-b border-slate-300 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-slate-600">
              공급자
            </p>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="w-16 px-3 py-1.5 text-slate-500">등록번호</td>
                  <td className="px-3 py-1.5 text-slate-900">{bizRegNo || "-"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-1.5 text-slate-500">상호</td>
                  <td className="px-3 py-1.5 text-slate-900">
                    {companyName || "-"} {representativeName && <span>(대표 {representativeName})</span>}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-1.5 text-slate-500">주소</td>
                  <td className="px-3 py-1.5 text-slate-900">{address || "-"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-1.5 text-slate-500">업태/종목</td>
                  <td className="px-3 py-1.5 text-slate-900">
                    {bizType || "-"} / {bizItem || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 text-slate-500">전화/팩스</td>
                  <td className="px-3 py-1.5 text-slate-900">
                    {phone || "-"} / {fax || "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg border-2 border-brand bg-brand-soft px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">합계금액 (VAT 별도)</span>
          <span className="text-sm font-bold text-slate-900">
            {numberToKoreanAmount(total)} (<span className="font-mono">{formatWon(total)}</span>)
          </span>
        </div>

        <p className="mt-5 text-sm text-slate-700">아래와 같이 견적합니다.</p>

        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-t-2 border-slate-900 text-left text-slate-500">
              <th className="w-10 py-2 pr-2 text-center">No</th>
              <th className="py-2 pr-2">품명</th>
              <th className="py-2 pr-2">규격</th>
              <th className="py-2 pr-2">단위</th>
              <th className="py-2 pr-2 text-right">수량</th>
              <th className="py-2 pr-2 text-right">단가</th>
              <th className="py-2 pr-2 text-right">금액</th>
              <th className="py-2">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 pr-2 text-center text-slate-500">{i + 1}</td>
                <td className="py-2 pr-2">{it.item_name ?? "-"}</td>
                <td className="py-2 pr-2 text-slate-500">{it.spec ?? "-"}</td>
                <td className="py-2 pr-2 text-slate-500">{it.unit ?? "-"}</td>
                <td className="py-2 pr-2 text-right font-mono">{it.quantity ?? "-"}</td>
                <td className="py-2 pr-2 text-right font-mono">
                  {it.adjustedUnitPrice != null ? formatWon(it.adjustedUnitPrice) : "-"}
                </td>
                <td className="py-2 pr-2 text-right font-mono">{formatWon(it.confirmed)}</td>
                <td className="py-2 text-slate-500">{it.note ?? "-"}</td>
              </tr>
            ))}
            {/* 내역이 몇 줄이든 인쇄 서식은 항상 9줄 — 빈 줄은 No 표기 없이 공란으로 채움. */}
            {Array.from({ length: Math.max(0, MIN_PRINT_ROWS - rows.length) }).map((_, i) => (
              <tr key={`blank-${i}`} className="border-b border-slate-100">
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2 pr-2">&nbsp;</td>
                <td className="py-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td colSpan={6} className="py-2 text-right font-semibold text-slate-900">
                합계
              </td>
              <td className="py-2 text-right font-mono font-bold text-slate-900">{formatWon(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 min-h-[70px] rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-slate-500">비고</p>
          <p className="whitespace-pre-wrap text-slate-700">{quote.memo}</p>
        </div>

        <div className="mt-auto flex items-center justify-center gap-2 pt-10 text-sm text-slate-900">
          <Image src="/logo-lockup.png" alt="" width={20} height={16} className="h-4 w-auto" />
          <p className="font-semibold">{companyName || "-"}</p>
        </div>
      </div>
    </div>
  );
}
