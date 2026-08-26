"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategory, PaymentMethod, Transaction } from "@/lib/types";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { bulkImportTransactions, type BulkTransactionInput } from "@/lib/actions/transactions";
import { formatWon } from "@/lib/format";
import { VAT_EXEMPT_CATEGORIES } from "@/lib/vatExempt";

type Option = { id: string; name: string };
type ClientOption = Option & { default_item_name?: string | null };
type LineItem = { item_name: string; quantity: string; unit_price: string; subtotal: string; project_id: string };

function emptyLineItem(): LineItem {
  return { item_name: "", quantity: "", unit_price: "", subtotal: "", project_id: "" };
}

function lineItemFromInitial(t: Transaction): LineItem {
  // 소계는 "VAT 얹기 전 원래 입력 금액"을 나타내는 값이라, 여기서도 purchase_vat/sales_vat를
  // 더한 최종 합계가 아니라 base 금액만 보여줘야 함 — 안 그러면 체크된 채로 다시 저장할 때마다
  // 10%가 중복으로 더 붙어버림(저장할 때마다 금액이 계속 불어나는 버그의 원인이었음).
  const amount = t.type === "매출" ? t.sales_amount : t.purchase_amount;
  return {
    item_name: t.item_name ?? "",
    quantity: t.quantity?.toString() ?? "",
    unit_price: t.unit_price?.toString() ?? "",
    subtotal: amount ? String(amount) : "",
    // 비워두면 위쪽 공통 "프로젝트" 선택값을 그대로 씀 — 계산서 1건이 여러 프로젝트에 걸칠 때만 줄별로 덮어씀.
    project_id: "",
  };
}

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

  const [values, setValues] = useState({
    trans_date: initial?.trans_date ?? new Date().toISOString().slice(0, 10),
    type: initial?.type ?? "매입",
    client_id: initial?.client_id ?? "",
    client_name_raw: initial?.client_name_raw ?? "",
    project_id: initial?.project_id ?? "",
    category_id: initial?.category_id ?? "",
    payment_method_id: initial?.payment_method_id ?? "",
    tax_invoice_issued: initial?.tax_invoice_issued ?? false,
    vat_included: initial?.vat_included ?? false,
    payment_type: initial?.payment_type ?? "immediate",
    note1: initial?.note1 ?? "",
    note2: initial?.note2 ?? "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initial ? [lineItemFromInitial(initial)] : [emptyLineItem()]
  );
  const [ocrExtracted, setOcrExtracted] = useState<Record<string, unknown> | null>(
    (initial?.ocr_extracted_raw as Record<string, unknown>) ?? null
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectPopupIndex, setProjectPopupIndex] = useState<number | null>(null);
  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const grandTotal = lineItems.reduce((s, li) => s + (Number(li.subtotal) || 0), 0);
  const selectedCategoryName = expenseCategories.find((c) => c.id === values.category_id)?.name;
  const vatExempt = selectedCategoryName ? VAT_EXEMPT_CATEGORIES.includes(selectedCategoryName) : false;

  function set<K extends keyof typeof values>(key: K, v: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleCategorySelect(categoryId: string) {
    const name = expenseCategories.find((c) => c.id === categoryId)?.name;
    const exempt = name ? VAT_EXEMPT_CATEGORIES.includes(name) : false;
    setValues((prev) => ({
      ...prev,
      category_id: categoryId,
      vat_included: exempt ? false : prev.vat_included,
      tax_invoice_issued: exempt ? false : prev.tax_invoice_issued,
    }));
  }

  function updateLineItem(i: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  }

  function handleLineQuantity(i: number, v: string) {
    setLineItems((prev) =>
      prev.map((li, idx) => {
        if (idx !== i) return li;
        const next = { ...li, quantity: v };
        if (v && li.unit_price) {
          const total = Number(v) * Number(li.unit_price);
          if (!Number.isNaN(total)) next.subtotal = String(total);
        }
        return next;
      })
    );
  }

  function handleLineUnitPrice(i: number, v: string) {
    setLineItems((prev) =>
      prev.map((li, idx) => {
        if (idx !== i) return li;
        const next = { ...li, unit_price: v };
        if (li.quantity && v) {
          const total = Number(li.quantity) * Number(v);
          if (!Number.isNaN(total)) next.subtotal = String(total);
        }
        return next;
      })
    );
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeLineItem(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    set("client_id", clientId);
    if (client?.default_item_name) {
      setLineItems((prev) =>
        prev.map((li, idx) => (idx === 0 ? { ...li, item_name: client.default_item_name as string } : li))
      );
    }
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
        setLineItems((prev) =>
          prev.map((li, idx) =>
            idx === 0
              ? {
                  ...li,
                  item_name: ex.item_name ?? li.item_name,
                  quantity: ex.quantity != null ? String(ex.quantity) : li.quantity,
                  unit_price: ex.unit_price != null ? String(ex.unit_price) : li.unit_price,
                  subtotal: ex.amount != null ? String(ex.amount) : li.subtotal,
                }
              : li
          )
        );
        const matchedCategory = expenseCategories.find((c) => c.name === ex.category);
        const ocrExempt = matchedCategory ? VAT_EXEMPT_CATEGORIES.includes(matchedCategory.name) : false;
        setValues((prev) => ({
          ...prev,
          trans_date: ex.trans_date ?? prev.trans_date,
          // AI가 영수증에서 추정한 VAT 여부는 신뢰하지 않고, 항상 사용자가 직접 체크하게 둠.
          vat_included: ocrExempt ? false : prev.vat_included,
          category_id: matchedCategory?.id ?? prev.category_id,
          tax_invoice_issued: ocrExempt ? false : prev.tax_invoice_issued,
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

    const validItems = lineItems.filter((li) => li.subtotal);
    if (validItems.length === 0) {
      setError("최소 한 개 항목의 소계(금액)를 입력해주세요.");
      return;
    }

    if (!confirm(initial ? "수정 내용을 저장하시겠습니까?" : `이 거래를 등록하시겠습니까? (${validItems.length}건)`)) return;
    setError(null);

    // 종류구분이 비과세면 체크박스 state가(예전 데이터 등으로) true로 남아있어도 무조건 무시 —
    // 화면에서 비활성화만 하고 state는 안 건드렸던 게 "체크 안 보이는데 10%가 붙는" 원인이었음.
    const effectiveValues = {
      ...values,
      vat_included: vatExempt ? false : values.vat_included,
      tax_invoice_issued: vatExempt ? false : values.tax_invoice_issued,
    };

    function buildRow(li: LineItem): BulkTransactionInput {
      return {
        trans_date: effectiveValues.trans_date,
        type: effectiveValues.type,
        client_id: effectiveValues.client_id || null,
        client_name_raw: effectiveValues.client_name_raw || null,
        project_id: li.project_id || effectiveValues.project_id || null,
        item_name: li.item_name || null,
        category_id: effectiveValues.category_id || null,
        quantity: li.quantity ? Number(li.quantity) : null,
        unit_price: li.unit_price ? Number(li.unit_price) : null,
        payment_method_id: effectiveValues.payment_method_id || null,
        payment_type: effectiveValues.payment_type,
        tax_invoice_issued: effectiveValues.tax_invoice_issued,
        vat_included: effectiveValues.vat_included,
        amount: Number(li.subtotal) || 0,
        note1: effectiveValues.note1 || null,
        note2: effectiveValues.note2 || null,
      };
    }

    async function saveSingle(li: LineItem, id?: string) {
      const fd = new FormData();
      if (id) fd.append("id", id);
      Object.entries(effectiveValues).forEach(([k, v]) => {
        if (k === "vat_included" || k === "tax_invoice_issued") {
          if (v) fd.append(k, "on");
        } else {
          fd.append(k, String(v));
        }
      });
      fd.set("project_id", li.project_id || effectiveValues.project_id);
      fd.append("item_name", li.item_name);
      fd.append("quantity", li.quantity);
      fd.append("unit_price", li.unit_price);
      fd.append("amount", li.subtotal);
      fd.append("is_verified_ai", "on");
      fd.append("ocr_extracted_raw", ocrExtracted ? JSON.stringify(ocrExtracted) : "");
      return action(fd);
    }

    if (validItems.length === 1) {
      const result = await saveSingle(validItems[0], initial?.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
    } else if (!initial) {
      // 신규 등록, 여러 줄 → 전부 새 거래로 일괄 등록.
      const result = await bulkImportTransactions(validItems.map(buildRow));
      if (result?.error) {
        setError(result.error);
        return;
      }
    } else {
      // 기존 거래 수정 중 줄을 추가한 경우 → 첫 줄은 원래 거래를 그대로 업데이트하고,
      // 나머지 줄은 새 거래로 추가해서 "하나였던 거래를 여러 건으로 분할".
      const [first, ...rest] = validItems;
      const firstResult = await saveSingle(first, initial.id);
      if (firstResult?.error) {
        setError(firstResult.error);
        return;
      }
      if (rest.length > 0) {
        const bulkResult = await bulkImportTransactions(rest.map(buildRow));
        if (bulkResult?.error) {
          setError(bulkResult.error);
          return;
        }
      }
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
        <Field label="종류구분">
          <select value={values.category_id} onChange={(e) => handleCategorySelect(e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
        <label className="flex items-start gap-2 pt-5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={vatExempt ? false : values.vat_included}
            disabled={vatExempt}
            onChange={(e) => set("vat_included", e.target.checked)}
            className="mt-0.5 h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span>
            10% VAT 추가
            <span className="block text-xs text-slate-400">(총 합계에 10% 합산 / 체크 해제 시 합산 안함)</span>
          </span>
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={vatExempt ? false : values.tax_invoice_issued}
            disabled={vatExempt}
            onChange={(e) => set("tax_invoice_issued", e.target.checked)}
            className="h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
          />
          세금계산서 발행
          {vatExempt && <span className="text-xs text-slate-400">(비과세 종류구분이라 선택 불가)</span>}
        </label>
        <Field label="메모1">
          <input value={values.note1} onChange={(e) => set("note1", e.target.value)} className={inputClass} />
        </Field>
        <Field label="메모2">
          <input value={values.note2} onChange={(e) => set("note2", e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">품목</h2>
          <button
            type="button"
            onClick={addLineItem}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 물품 종류 추가
          </button>
        </div>
        {initial && (
          <p className="mb-2 text-xs text-slate-400">
            줄을 추가하면 저장 시 첫 줄은 이 거래를 수정하고, 나머지 줄은 새 거래로 분리돼요 (계산서 1건이 여러
            프로젝트에 걸칠 때).
          </p>
        )}

        <div className="space-y-3">
          {lineItems.map((li, i) => {
            const resolvedProjectId = li.project_id || values.project_id;
            const resolvedProject = projects.find((p) => p.id === resolvedProjectId);
            const isOverride = Boolean(li.project_id);
            return (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-slate-400">#{i + 1}</span>
                  <input
                    value={li.item_name}
                    onChange={(e) => updateLineItem(i, { item_name: e.target.value })}
                    placeholder="품목명"
                    className={`${inputClass} flex-1`}
                  />
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="shrink-0 text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">프로젝트</span>
                    <button
                      type="button"
                      onClick={() => setProjectPopupIndex(i)}
                      className={`${inputClass} truncate text-left`}
                    >
                      {resolvedProject ? resolvedProject.name : "일반경비"}
                      {!isOverride && <span className="text-slate-400"> (공통)</span>}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">수량</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatThousands(li.quantity)}
                      onChange={(e) => handleLineQuantity(i, parseNumericInput(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">단가</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatThousands(li.unit_price)}
                      onChange={(e) => handleLineUnitPrice(i, parseNumericInput(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">소계</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatThousands(li.subtotal)}
                      onChange={(e) => updateLineItem(i, { subtotal: parseNumericInput(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-right text-sm font-semibold text-slate-900">
          합계 <span className="ml-1 font-mono text-base">{formatWon(grandTotal)}</span>
        </p>
      </div>

      {projectPopupIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setProjectPopupIndex(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">품목 #{projectPopupIndex + 1} 프로젝트 선택</h3>
              <button
                type="button"
                onClick={() => setProjectPopupIndex(null)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>
            <ProjectPicker
              sites={sites}
              projects={projects}
              value={lineItems[projectPopupIndex].project_id}
              onChange={(v) => {
                updateLineItem(projectPopupIndex, { project_id: v });
                setProjectPopupIndex(null);
              }}
              label="프로젝트 (비워두면 상단 공통값 사용)"
            />
          </div>
        </div>
      )}

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
