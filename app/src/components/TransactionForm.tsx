"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategory, PaymentMethod, Transaction } from "@/lib/types";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";

type Option = { id: string; name: string };
type ClientOption = Option & { default_item_name?: string | null };

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

export function TransactionForm({
  clients,
  sites,
  projects,
  paymentMethods,
  expenseCategories,
  initial,
  action,
  redirectTo = "/transactions",
}: {
  clients: ClientOption[];
  sites: SiteOption[];
  projects: ProjectOption[];
  paymentMethods: PaymentMethod[];
  expenseCategories: ExpenseCategory[];
  initial?: Transaction;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const initialAmount = initial
    ? initial.type === "매출"
      ? initial.sales_amount + initial.sales_vat
      : initial.purchase_amount + initial.purchase_vat
    : 0;

  const [values, setValues] = useState({
    trans_date: initial?.trans_date ?? new Date().toISOString().slice(0, 10),
    type: initial?.type ?? "매입",
    client_id: initial?.client_id ?? "",
    client_name_raw: initial?.client_name_raw ?? "",
    project_id: initial?.project_id ?? "",
    item_name: initial?.item_name ?? "",
    category_id: initial?.category_id ?? "",
    quantity: initial?.quantity?.toString() ?? "",
    unit_price: initial?.unit_price?.toString() ?? "",
    payment_method_id: initial?.payment_method_id ?? "",
    tax_invoice_issued: initial?.tax_invoice_issued ?? false,
    vat_included: initial?.vat_included ?? true,
    amount: initialAmount ? String(initialAmount) : "",
    payment_type: initial?.payment_type ?? "immediate",
    note1: initial?.note1 ?? "",
    note2: initial?.note2 ?? "",
  });
  const [ocrExtracted, setOcrExtracted] = useState<Record<string, unknown> | null>(
    (initial?.ocr_extracted_raw as Record<string, unknown>) ?? null
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  function set<K extends keyof typeof values>(key: K, v: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    setValues((prev) => ({
      ...prev,
      client_id: clientId,
      item_name: client?.default_item_name ? client.default_item_name : prev.item_name,
    }));
  }

  function handleQuantity(v: string) {
    setValues((prev) => {
      const next = { ...prev, quantity: v };
      if (v && prev.unit_price) {
        const total = Number(v) * Number(prev.unit_price);
        if (!Number.isNaN(total)) next.amount = String(total);
      }
      return next;
    });
  }

  function handleUnitPrice(v: string) {
    setValues((prev) => {
      const next = { ...prev, unit_price: v };
      if (prev.quantity && v) {
        const total = Number(prev.quantity) * Number(v);
        if (!Number.isNaN(total)) next.amount = String(total);
      }
      return next;
    });
  }

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setOcrLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else if (json.extracted) {
        setOcrExtracted(json.extracted);
        const ex = json.extracted;
        setValues((prev) => ({
          ...prev,
          trans_date: ex.trans_date ?? prev.trans_date,
          item_name: ex.item_name ?? prev.item_name,
          quantity: ex.quantity != null ? String(ex.quantity) : prev.quantity,
          unit_price: ex.unit_price != null ? String(ex.unit_price) : prev.unit_price,
          amount: ex.amount != null ? String(ex.amount) : prev.amount,
          vat_included: ex.vat_included ?? prev.vat_included,
          category_id: expenseCategories.find((c) => c.name === ex.category)?.id ?? prev.category_id,
          client_name_raw: ex.client_name ?? prev.client_name_raw,
        }));
      }
    } catch {
      setError("OCR 인식 중 오류가 발생했습니다.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(initial ? "수정 내용을 저장하시겠습니까?" : "이 거래를 등록하시겠습니까?")) return;
    setError(null);

    const fd = new FormData();
    if (initial) fd.append("id", initial.id);
    Object.entries(values).forEach(([k, v]) => {
      if (k === "vat_included" || k === "tax_invoice_issued") {
        if (v) fd.append(k, "on");
      } else {
        fd.append(k, String(v));
      }
    });
    fd.append("is_verified_ai", "on");
    fd.append("ocr_extracted_raw", ocrExtracted ? JSON.stringify(ocrExtracted) : "");

    const result = await action(fd);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">영수증 업로드 (선택, AI 자동 인식)</h2>
        <p className="mb-2 text-xs text-slate-400">사진은 항목 자동 입력에만 쓰이고 저장되지 않아요. 원본은 직접 보관해주세요.</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="text-sm"
        />
        {ocrLoading && <p className="mt-2 text-sm text-slate-500">AI가 영수증을 인식하는 중입니다...</p>}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="영수증 미리보기" className="mt-3 max-h-64 rounded-lg border border-slate-200" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="날짜" required>
          <input
            type="date"
            required
            value={values.trans_date}
            onChange={(e) => set("trans_date", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="구분">
          <select value={values.type} onChange={(e) => set("type", e.target.value as "매입" | "매출")} className={inputClass}>
            <option value="매입">매입</option>
            <option value="매출">매출</option>
          </select>
        </Field>
        <Field label="거래처 (등록됨)">
          <select value={values.client_id} onChange={(e) => handleClientSelect(e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="거래처 (자유 입력)">
          <input
            value={values.client_name_raw}
            onChange={(e) => set("client_name_raw", e.target.value)}
            placeholder="예: 온라인, 화성"
            className={inputClass}
          />
        </Field>
        <ProjectPicker
          sites={sites}
          projects={projects}
          value={values.project_id}
          onChange={(v) => set("project_id", v)}
        />
        <Field label="품목">
          <input value={values.item_name} onChange={(e) => set("item_name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="종류구분">
          <select value={values.category_id} onChange={(e) => set("category_id", e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="수량">
          <input
            type="text"
            inputMode="decimal"
            value={formatThousands(values.quantity)}
            onChange={(e) => handleQuantity(parseNumericInput(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="단가">
          <input
            type="text"
            inputMode="decimal"
            value={formatThousands(values.unit_price)}
            onChange={(e) => handleUnitPrice(parseNumericInput(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="결제 시점">
          <select
            value={values.payment_type}
            onChange={(e) => set("payment_type", e.target.value as "immediate" | "credit")}
            className={inputClass}
          >
            <option value="immediate">즉시결제</option>
            <option value="credit">외상</option>
          </select>
        </Field>
        <Field label="결제수단">
          <select
            value={values.payment_method_id}
            onChange={(e) => set("payment_method_id", e.target.value)}
            className={inputClass}
            disabled={values.payment_type === "credit"}
          >
            <option value="">{values.payment_type === "credit" ? "정산 시 지정" : "선택 안함"}</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="총 금액" required>
          <input
            type="text"
            inputMode="decimal"
            required
            value={formatThousands(values.amount)}
            onChange={(e) => set("amount", parseNumericInput(e.target.value))}
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2 pt-5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.vat_included}
            onChange={(e) => set("vat_included", e.target.checked)}
            className="h-4 w-4"
          />
          VAT 포함 금액
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.tax_invoice_issued}
            onChange={(e) => set("tax_invoice_issued", e.target.checked)}
            className="h-4 w-4"
          />
          세금계산서 발행
        </label>
        <Field label="메모1">
          <input value={values.note1} onChange={(e) => set("note1", e.target.value)} className={inputClass} />
        </Field>
        <Field label="메모2">
          <input value={values.note2} onChange={(e) => set("note2", e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {initial ? "수정 저장" : "거래 등록"}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          {initial ? "수정 취소" : "취소"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  );
}
