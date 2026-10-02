"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatWon, formatDate } from "@/lib/format";
import { numberToKoreanAmount } from "@/lib/numberToKorean";
import { isVisibleQuoteItem, quoteLineAmounts } from "@/lib/quoteCalc";
import { PrintButton } from "@/components/PrintButton";
import { QuoteExportButton } from "@/components/QuoteExportButton";
import { fieldClass, inlineFieldClass, labelClass } from "@/components/ui/field";
import { updateQuoteCompanyInfo } from "@/lib/actions/quotes";
import { addCompanyProfileFromQuote } from "@/lib/actions/companyProfiles";
import {
  defaultCompanyInfo,
  findMatchingProfile,
  profileToCompanyInfo,
  toCompanyInfo,
  type CompanyProfileRow,
  type QuoteCompanyInfo,
} from "@/lib/companyProfile";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";

const MIN_PRINT_ROWS = 8;

const PAGE_NUMBER_CSS = `@page { @bottom-center { content: counter(page) " / " counter(pages); font-size: 8pt; color: #64748b; } }`;

// 공급자 입력칸 — 인쇄 문서·엑셀에 찍히는 공급자 정보는 모두 이 칸들의 지금 값.
const COMPANY_FIELDS: { key: keyof QuoteCompanyInfo; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: "companyName", label: "상호" },
  { key: "representativeName", label: "대표자", placeholder: "선택 입력" },
  { key: "bizRegNo", label: "사업자등록번호", placeholder: "000-00-00000" },
  { key: "phone", label: "전화", placeholder: "선택 입력" },
  { key: "fax", label: "팩스", placeholder: "선택 입력" },
  { key: "address", label: "사업장 소재지", placeholder: "선택 입력", wide: true },
  { key: "bizType", label: "업태" },
  { key: "bizItem", label: "종목" },
];

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
  profiles,
  profilesUnavailable = false,
}: {
  quote: {
    quote_number: string | null;
    title: string;
    clientName: string | null;
    valid_until: string | null;
    memo: string | null;
    created_at: string;
  };
  items: QuoteItemRow[];
  quoteId: string;
  /** 이 견적서에 저장된 공급자 정보(quotes.company_info) — 저장한 적 없으면(null) 기본 공급자를 보여줌. */
  companyInfo: unknown;
  /** 공급자 목록(company_profiles) — 기본 공급자가 맨 앞. */
  profiles: CompanyProfileRow[];
  /** 공급자 목록을 못 읽음(SQL 089 실행 전 등) — 예전처럼 칸에 직접 입력해서 이 견적서에만 저장. */
  profilesUnavailable?: boolean;
}) {
  const pending = useGlobalPending();
  const confirm = useConfirm();
  const [info, setInfo] = useState<QuoteCompanyInfo>(() => toCompanyInfo(companyInfo) ?? defaultCompanyInfo(profiles));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  // 지금 칸의 값과 똑같은 목록 공급자 — 없으면 직접 입력한(또는 목록과 달라진) 정보.
  const matched = findMatchingProfile(profiles, info);
  const { companyName, representativeName, bizRegNo, address, bizType, bizItem, phone, fax } = info;

  function setField(key: keyof QuoteCompanyInfo, value: string) {
    setInfo((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function saveToQuote(next: QuoteCompanyInfo, okText: string) {
    const result = await pending.run(() => updateQuoteCompanyInfo(quoteId, next));
    setMessage(result?.error ? { error: true, text: result.error } : { error: false, text: okText });
  }

  // 목록에서 고르면 칸을 그 공급자로 채우고 이 견적서에 바로 저장.
  async function handleSelectProfile(id: string) {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    if (
      !matched &&
      !(await confirm(
        "지금 칸의 공급자 정보는 공급자 목록에 없습니다. 선택한 공급자로 바꾸면 이 견적서에서 지워집니다. 바꾸시겠습니까?"
      ))
    ) {
      return;
    }
    const next = profileToCompanyInfo(profile);
    setInfo(next);
    await saveToQuote(next, `이 견적서의 공급자를 저장했습니다: ${profile.company_name}`);
  }

  async function handleAddToList() {
    const result = await pending.run(() => addCompanyProfileFromQuote(info));
    setMessage(
      result?.error
        ? { error: true, text: result.error }
        : { error: false, text: `공급자 목록에 추가했습니다: ${info.companyName.trim()}` }
    );
  }

  const rows = items.filter(isVisibleQuoteItem).map((it) => {
    const { confirmed, adjustedUnitPrice } = quoteLineAmounts(it);
    return { ...it, confirmed, adjustedUnitPrice };
  });
  const total = rows.reduce((s, r) => s + r.confirmed, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-md:p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <label htmlFor="quote-supplier-select" className={labelClass}>
              공급자 선택
            </label>
            <select
              id="quote-supplier-select"
              value={matched?.id ?? ""}
              onChange={(e) => handleSelectProfile(e.target.value)}
              disabled={profiles.length === 0}
              className={`${inlineFieldClass} max-w-full`}
            >
              {!matched && (
                <option value="">{profiles.length === 0 ? "목록 없음 — 아래 칸에 직접 입력" : "직접 입력한 정보 (목록에 없음)"}</option>
              )}
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                  {p.biz_reg_no ? ` (${p.biz_reg_no})` : ""}
                  {p.is_default ? " · 기본" : ""}
                </option>
              ))}
            </select>
          </div>
          {!matched && !profilesUnavailable && companyName.trim() !== "" && (
            <Button type="button" variant="secondary" size="sm" className="mb-0.5" onClick={handleAddToList}>
              이 정보를 공급자 목록에 추가
            </Button>
          )}
          <Link
            href="/projects?tab=quotes&suppliers=1"
            className="mb-2 text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            공급자 목록 관리
          </Link>
        </div>
        {profilesUnavailable ? (
          <p className="text-xs text-amber-700">
            공급자 목록 표가 아직 없습니다(SQL 089 실행 전) — 지금은 예전처럼 아래 칸에 직접 입력해서 이 견적서에만 저장됩니다.
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            목록에서 고르면 이 견적서에 바로 저장됩니다. 칸을 직접 고쳤으면 아래 &lsquo;공급자 정보 저장&rsquo;을 누르세요 — 이
            견적서에만 저장되고 목록은 그대로입니다.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COMPANY_FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
              <label htmlFor={`quote-company-${f.key}`} className={labelClass}>
                {f.label}
              </label>
              <input
                id={`quote-company-${f.key}`}
                value={info[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                className={fieldClass}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        {message && <p className={cx("text-xs", message.error ? "text-red-600" : "text-emerald-700")}>{message.text}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <p className="mr-auto text-xs text-slate-400">
          PDF로 저장하려면 인쇄 대화상자의 대상(프린터)에서 &ldquo;PDF로 저장&rdquo;을 선택하세요.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => saveToQuote(info, "이 견적서에 공급자 정보를 저장했습니다.")}
        >
          공급자 정보 저장
        </Button>
        <QuoteExportButton quote={quote} companyInfo={info} rows={rows} total={total} />
        <PrintButton />
      </div>

      {/* 인쇄 쪽 번호(아래 가운데 "1 / 2") — 이 화면에 있을 때만 쓰는 @page 규칙. 이름 붙인 페이지(@page quote + page: quote)로
          했더니 크롬이 페이지 이름이 바뀌는 곳마다 장을 끊어서 한 장짜리가 여러 장으로 나옴(사용자 제보 "한장짜리가 4장으로") —
          이름 없는 @page라 장이 끊기지 않음. 크롬 131부터 되는 페이지 여백 상자라 옛 브라우저·사파리는 번호 없이 인쇄됨. */}
      <style>{PAGE_NUMBER_CSS}</style>
      {/* 인쇄 때 문서 높이 270mm 고정 — 회사명을 종이 아래쪽에 두되, 인쇄 칸(277mm)을 꽉 채우면 1px만 넘쳐도 회사명 한 줄이
          둘째 장으로 넘어가서 조금 남겨 둠. */}
      <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 print:flex print:min-h-[270mm] print:flex-col print:rounded-none print:border-0 print:p-0">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-lockup.png" alt="" width={30} height={24} className="h-6 w-auto" />
          <span className="ml-auto tabular-nums text-[11px] tracking-widest text-slate-400">QUOTATION</span>
        </div>
        <div className="mt-3 flex flex-col">
          <div className="h-[3px] bg-brand" />
          <div className="h-[3px] w-1/3 bg-brand-red" />
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold tracking-[0.5em] text-brand">견 적 서</h1>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p>
            <span className="text-slate-500">견적번호: </span>
            <span className="tabular-nums font-medium text-slate-900">{quote.quote_number ?? "-"}</span>
          </p>
          <p>
            <span className="text-slate-500">견적일자: </span>
            <span className="font-medium text-slate-900">{formatDate(quote.created_at)}</span>
          </p>
          <p>
            <span className="text-slate-500">공사명: </span>
            <span className="font-medium text-slate-900">{quote.title}</span>
          </p>
          <p>
            <span className="text-slate-500">유효기한: </span>
            <span className="font-medium text-slate-900">{quote.valid_until ? formatDate(quote.valid_until) : "-"}</span>
          </p>
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
              공급자&nbsp;&nbsp;&nbsp;&nbsp;
            </p>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="w-20 whitespace-nowrap px-3 py-1.5 text-slate-500">등록번호</td>
                  <td className="px-3 py-1.5 text-slate-900 [overflow-wrap:anywhere]">{bizRegNo || "-"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="w-20 whitespace-nowrap px-3 py-1.5 text-slate-500">상호</td>
                  <td className="px-3 py-1.5 text-slate-900 [overflow-wrap:anywhere]">
                    {companyName || "-"} {representativeName && <span>(대표 {representativeName})</span>}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="w-20 whitespace-nowrap px-3 py-1.5 text-slate-500">주소</td>
                  <td className="px-3 py-1.5 text-slate-900 [overflow-wrap:anywhere]">{address || "-"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="w-20 whitespace-nowrap px-3 py-1.5 text-slate-500">업태/종목</td>
                  <td className="px-3 py-1.5 text-slate-900 [overflow-wrap:anywhere]">
                    {bizType || "-"} / {bizItem || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="w-20 whitespace-nowrap px-3 py-1.5 text-slate-500">전화/팩스</td>
                  <td className="px-3 py-1.5 text-slate-900 [overflow-wrap:anywhere]">
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
            {numberToKoreanAmount(total)} (<span className="tabular-nums">{formatWon(total)}</span>)
          </span>
        </div>

        <p className="mt-5 text-sm text-slate-700">아래와 같이 견적합니다.</p>

        {/* 품목 줄 위아래 여백은 py-1(사용자 요청 "품목 간 간격 줄여 주세요"). 숫자 칸은 한 줄로("원"만 떨어지지 않게).
            품명·비고 칸은 띄어쓰기에서만 줄바꿈 — 아무 데서나 끊기게([overflow-wrap:anywhere]) 했더니 칸 폭 나눔이 바뀌어 품명이
            한 줄 더 꺾였고, 한 장에 꽉 차던 견적서가 둘째 장으로 넘어감(공급자 표 줄바꿈은 좌우 여백 때문에 그대로). */}
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-t-2 border-slate-900 text-left text-slate-500">
              <th className="w-10 py-1.5 pr-2 text-center">No</th>
              <th className="py-1.5 pr-2">품명</th>
              <th className="py-1.5 pr-2">규격</th>
              <th className="py-1.5 pr-2">단위</th>
              <th className="py-1.5 pr-2 text-right">수량</th>
              <th className="py-1.5 pr-2 text-right">단가</th>
              <th className="py-1.5 pr-2 text-right">금액</th>
              <th className="py-1.5">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-1 pr-2 text-center text-slate-500">{i + 1}</td>
                <td className="py-1 pr-2">{it.item_name ?? "-"}</td>
                <td className="py-1 pr-2 text-slate-500">{it.spec ?? "-"}</td>
                <td className="py-1 pr-2 text-slate-500">{it.unit ?? "-"}</td>
                <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{it.quantity ?? "-"}</td>
                <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">
                  {it.adjustedUnitPrice != null ? formatWon(it.adjustedUnitPrice) : "-"}
                </td>
                <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{it.confirmed === 0 ? "-" : formatWon(it.confirmed)}</td>
                <td className="py-1 text-slate-500">{it.note ?? "-"}</td>
              </tr>
            ))}
            {/* 내역이 몇 줄이든 인쇄 서식은 항상 9줄 — 빈 줄은 No 표기 없이 공란으로 채움. */}
            {Array.from({ length: Math.max(0, MIN_PRINT_ROWS - rows.length) }).map((_, i) => (
              <tr key={`blank-${i}`} className="border-b border-slate-100">
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1 pr-2">&nbsp;</td>
                <td className="py-1">&nbsp;</td>
              </tr>
            ))}
          </tbody>
          {/* 합계는 표 끝에 한 번만 — tfoot이면 크롬이 장마다 표 아래에 반복해서 첫 장 끝에도 전체 합계가 찍혔음(그 장의
              소계처럼 보임). 머리글(thead)은 장마다 반복되는 게 맞아서 그대로. */}
          <tbody>
            <tr className="border-t-2 border-slate-300">
              <td colSpan={6} className="py-1.5 pr-3 text-right font-semibold text-slate-900">
                합계
              </td>
              <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums font-bold text-slate-900">{formatWon(total)}</td>
              <td />
            </tr>
          </tbody>
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
