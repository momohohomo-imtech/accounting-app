"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatWon } from "@/lib/format";

const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function formatThousands(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

function parseNumericInput(display: string) {
  const cleaned = display.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

function CalcField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        {suffix && <span className="shrink-0 text-sm text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-mono text-base font-bold text-slate-900">
        {Number.isFinite(value) ? formatWon(Math.round(value)) : "-"}
      </span>
    </p>
  );
}

function BillDiscountCalculator() {
  const [amount, setAmount] = useState("10000000");
  const [rate, setRate] = useState("5.45");
  const [days, setDays] = useState("61");

  const principal = Number(amount) || 0;
  const rateNum = Number(rate) || 0;
  const daysNum = Number(days) || 0;
  const interest = (principal * (rateNum / 100) * daysNum) / 365;
  const proceeds = principal - interest;

  return (
    <Card>
      <CardHeader>
        <CardTitle>어음 할인 계산기</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-slate-400">
        어음 액면금액에서 할인일수만큼의 이자를 미리 떼고 받는 실수령액을 계산합니다. (이자 = 원금 × 연이율 × 일수 ÷
        365, 산출액 = 원금 − 이자)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CalcField
          label="액면금액"
          value={formatThousands(amount)}
          onChange={(v) => setAmount(parseNumericInput(v))}
          suffix="원"
        />
        <CalcField label="연이율" value={rate} onChange={(v) => setRate(parseNumericInput(v))} suffix="%" />
        <CalcField label="할인일수" value={days} onChange={(v) => setDays(parseNumericInput(v))} suffix="일" />
      </div>
      <div className="mt-3 space-y-1.5">
        <ResultRow label="할인이자" value={interest} />
        <ResultRow label="실수령액 (산출액)" value={proceeds} />
      </div>
    </Card>
  );
}

function VatAddCalculator() {
  const [amount, setAmount] = useState("");
  const base = Number(amount) || 0;
  const vat = base * 0.1;
  const total = base + vat;

  return (
    <Card>
      <CardHeader>
        <CardTitle>부가세 계산기 (더하기)</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-slate-400">
        공급가액에 10% 부가세를 더해 합계금액을 계산합니다. (부가세 = 금액 × 10%)
      </p>
      <CalcField
        label="공급가액"
        value={formatThousands(amount)}
        onChange={(v) => setAmount(parseNumericInput(v))}
        suffix="원"
      />
      <div className="mt-3 space-y-1.5">
        <ResultRow label="부가세" value={vat} />
        <ResultRow label="합계금액" value={total} />
      </div>
    </Card>
  );
}

function VatExtractCalculator() {
  const [amount, setAmount] = useState("");
  const total = Number(amount) || 0;
  const base = total / 1.1;
  const vat = total - base;

  return (
    <Card>
      <CardHeader>
        <CardTitle>부가세 계산기 (빼기)</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-slate-400">
        부가세가 포함된 합계금액에서 부가세를 역산해 빼고 공급가액을 계산합니다. (공급가액 = 합계 ÷ 1.1)
      </p>
      <CalcField
        label="합계금액 (부가세 포함)"
        value={formatThousands(amount)}
        onChange={(v) => setAmount(parseNumericInput(v))}
        suffix="원"
      />
      <div className="mt-3 space-y-1.5">
        <ResultRow label="부가세" value={vat} />
        <ResultRow label="공급가액" value={base} />
      </div>
    </Card>
  );
}

function PercentSubtractCalculator() {
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const base = Number(amount) || 0;
  const pct = Number(percent) || 0;
  const deducted = (base * pct) / 100;
  const result = base - deducted;

  return (
    <Card>
      <CardHeader>
        <CardTitle>임의 비율 차감 계산기</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-slate-400">
        금액에서 직접 입력한 비율(%)만큼 차감한 금액을 계산합니다. (결과 = 금액 − 금액 × 비율%)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CalcField
          label="금액"
          value={formatThousands(amount)}
          onChange={(v) => setAmount(parseNumericInput(v))}
          suffix="원"
        />
        <CalcField label="차감 비율" value={percent} onChange={(v) => setPercent(parseNumericInput(v))} suffix="%" />
      </div>
      <div className="mt-3 space-y-1.5">
        <ResultRow label="차감액" value={deducted} />
        <ResultRow label="차감 후 금액" value={result} />
      </div>
    </Card>
  );
}

export function CalculatorsSection() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">계산기</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BillDiscountCalculator />
        <VatAddCalculator />
        <VatExtractCalculator />
        <PercentSubtractCalculator />
      </div>
    </div>
  );
}
