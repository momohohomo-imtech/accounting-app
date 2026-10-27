"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategory, PaymentMethod, Transaction } from "@/lib/types";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { bulkImportTransactions, saveTransactionGroup, type BulkTransactionInput } from "@/lib/actions/transactions";
import { formatWon, todayString } from "@/lib/format";
import { isVatExemptCategory } from "@/lib/vatBasis";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { paymentMethodColorStyle } from "@/lib/paymentMethodColors";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { formatThousands, parseNumericInput } from "@/lib/numberInput";

type Option = { id: string; name: string };
type ClientOption = Option & { default_item_name?: string | null; default_category_id?: string | null };
// id: 묶음 전체 수정 때 원래 거래(줄) — 없으면 저장할 때 새 거래로 추가.
type LineItem = { item_name: string; quantity: string; unit_price: string; subtotal: string; project_id: string; id?: string };

function emptyLineItem(): LineItem {
  return { item_name: "", quantity: "", unit_price: "", subtotal: "", project_id: "" };
}

// 품목이 2줄 이상이면 프로젝트는 줄마다 정하고 위쪽 공통 칸은 숨김 — 줄을 추가한 뒤 위쪽 칸을 바꾸면 "(공통)" 줄까지 같이
// 바뀌어 원래 프로젝트에서 거래가 빠졌음(사용자 문의). 2줄 이상이 되면 공통값을 줄마다 옮겨 적고(그때부터 줄의 빈 값은
// 일반경비), 1줄로 돌아오면 그 줄 값을 다시 공통 칸으로.
function splitLineProjects(lines: LineItem[], common: string): { lines: LineItem[]; common: string } {
  if (lines.length > 1) return { lines: lines.map((li) => ({ ...li, project_id: li.project_id || common })), common: "" };
  if (lines.length === 1 && lines[0].project_id) {
    return { lines: [{ ...lines[0], project_id: "" }], common: lines[0].project_id };
  }
  return { lines, common };
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
    // 0원 줄도 "0"으로 — 빈칸이면 묶음 전체 수정에서 빈 줄로 보고 저장할 때 그 줄을 지웠음.
    subtotal: amount != null ? String(amount) : "",
    // 비워두면 위쪽 공통 "프로젝트" 선택값을 그대로 씀 — 계산서 1건이 여러 프로젝트에 걸칠 때만 줄별로 덮어씀.
    project_id: "",
  };
}



export function TransactionForm({
  clients,
  rawClientNames = [],
  sites,
  projects,
  paymentMethods,
  expenseCategories,
  initial,
  initialGroup,
  partOfGroup = false,
  groupingReady = false,
  action,
  redirectTo = "/transactions",
}: {
  clients: ClientOption[];
  rawClientNames?: string[];
  sites: SiteOption[];
  projects: ProjectOption[];
  paymentMethods: PaymentMethod[];
  expenseCategories: ExpenseCategory[];
  initial?: Transaction;
  // 한 결제로 묶인 거래를 수정할 때 묶음의 모든 줄(공통 칸이 같을 때만 — 수정 팝업이 확인해서 넘김).
  initialGroup?: Transaction[];
  // 묶음에 속하지만 줄마다 공통 칸이 달라서 이 줄만 수정하는 경우.
  partOfGroup?: boolean;
  // 092 SQL 실행 후에만 "한 결제로 묶기"를 보여 줌.
  groupingReady?: boolean;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  redirectTo?: string;
}) {
  const isGroupEdit = Boolean(initial && initialGroup && initialGroup.length > 1);
  const router = useRouter();
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const clientNameSuggestions = Array.from(new Set([...clients.map((c) => c.name), ...rawClientNames])).sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  const [values, setValues] = useState({
    trans_date: initial?.trans_date ?? todayString(),
    type: initial?.type ?? "매입",
    client_id: initial?.client_id ?? "",
    client_name_raw: initial?.client_name_raw ?? "",
    // 묶음 수정은 줄마다 자기 프로젝트를 들고 있어서 공통 프로젝트는 비워 둠.
    project_id: isGroupEdit ? "" : initial?.project_id ?? "",
    category_id: initial?.category_id ?? "",
    payment_method_id: initial?.payment_method_id ?? "",
    tax_invoice_issued: initial?.tax_invoice_issued ?? false,
    vat_included: initial?.vat_included ?? false,
    needs_classification: initial?.needs_classification ?? false,
    payment_type: initial?.payment_type ?? "immediate",
    note1: initial?.note1 ?? "",
    note2: initial?.note2 ?? "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>(
    isGroupEdit
      ? initialGroup!.map((t) => ({ ...lineItemFromInitial(t), project_id: t.project_id ?? "", id: t.id }))
      : initial
        ? [lineItemFromInitial(initial)]
        : [emptyLineItem()]
  );
  // 한 결제로 묶기 — 품목이 2줄 이상일 때. 사진을 여러 장 올리면 영수증이 따로라서 끔.
  const [groupPayment, setGroupPayment] = useState(true);
  const [ocrExtracted, setOcrExtracted] = useState<Record<string, unknown> | null>(
    (initial?.ocr_extracted_raw as Record<string, unknown>) ?? null
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectPopupIndex, setProjectPopupIndex] = useState<number | null>(null);
  useEscapeKey(projectPopupIndex !== null, () => setProjectPopupIndex(null));
  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const vatExempt = isVatExemptCategory(expenseCategories.find((c) => c.id === values.category_id));
  const vatAppliesNow = !vatExempt && values.vat_included;
  // 실제 저장 시 각 줄마다 VAT를 반올림해서 더하는 computeAmounts와 동일한 방식으로 미리보기 합계를 계산.
  const grandTotal = lineItems.reduce((s, li) => {
    const base = Number(li.subtotal) || 0;
    const vat = vatAppliesNow ? Math.round(base * 0.1) : 0;
    return s + base + vat;
  }, 0);

  function set<K extends keyof typeof values>(key: K, v: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleCategorySelect(categoryId: string) {
    const exempt = isVatExemptCategory(expenseCategories.find((c) => c.id === categoryId));
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

  // 줄 수가 바뀌는 곳(추가·삭제·OCR·엑셀)은 모두 이걸로 — 줄마다 프로젝트/공통 프로젝트를 splitLineProjects 규칙대로.
  // common: 지금 공통 프로젝트(OCR·엑셀처럼 기다렸다가 바꾸는 곳은 latest에서 읽은 값).
  function applyLines(next: LineItem[], common = values.project_id) {
    const r = splitLineProjects(next, common);
    setLineItems(r.lines);
    if (r.common !== common) set("project_id", r.common);
  }

  // OCR·엑셀 인식을 기다리는 몇 초 사이에 품목 줄·프로젝트를 고쳐도 인식 결과가 그 내용을 덮어쓰지 않게, 기다린 뒤에는
  // 화면을 연 때의 값이 아니라 지금 값을 읽는다.
  const latest = useRef({ lineItems, projectId: values.project_id });
  useEffect(() => {
    latest.current = { lineItems, projectId: values.project_id };
  });

  function addLineItem() {
    // 새 줄은 바로 윗줄 프로젝트로 시작 — 묶음 수정에서 새 줄이 일반경비로 들어가던 것.
    const last = lineItems[lineItems.length - 1];
    applyLines([...lineItems, { ...emptyLineItem(), project_id: last ? last.project_id || values.project_id : "" }]);
  }

  function removeLineItem(i: number) {
    applyLines(lineItems.filter((_, idx) => idx !== i));
  }

  function handleClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    set("client_id", clientId);
    if (client?.default_item_name) {
      setLineItems((prev) =>
        prev.map((li, idx) => (idx === 0 ? { ...li, item_name: client.default_item_name as string } : li))
      );
    }
    if (client?.default_category_id) {
      handleCategorySelect(client.default_category_id);
    }
  }

  async function ocrOneFile(file: File): Promise<Record<string, unknown> | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    const json = await res.json();
    return json.extracted ?? null;
  }

  async function handleImageOrPdfFiles(files: File[]) {
    if (files.length > 1) setGroupPayment(false);
    const firstImage = files.find((f) => f.type.startsWith("image/"));
    setPreview(firstImage ? URL.createObjectURL(firstImage) : null);
    setOcrLoading(true);
    setError(null);
    try {
      const results = await Promise.all(files.map((f) => ocrOneFile(f)));
      const valid = results.filter((r): r is NonNullable<typeof r> => r !== null);
      if (valid.length === 0) {
        setError("인식된 항목이 없습니다.");
        return;
      }
      setOcrExtracted(valid[0]);
      const updated = [...latest.current.lineItems];
      valid.forEach((ex, idx) => {
        const patch = {
          item_name: (ex.item_name as string) ?? "",
          quantity: ex.quantity != null ? String(ex.quantity) : "",
          unit_price: ex.unit_price != null ? String(ex.unit_price) : "",
          subtotal: ex.amount != null ? String(ex.amount) : "",
        };
        if (idx < updated.length) updated[idx] = { ...updated[idx], ...patch };
        else updated.push({ ...emptyLineItem(), ...patch });
      });
      applyLines(updated, latest.current.projectId);
      const ex = valid[0];
      const matchedCategory = expenseCategories.find((c) => c.name === ex.category);
      const ocrExempt = isVatExemptCategory(matchedCategory);
      setValues((prev) => ({
        ...prev,
        trans_date: (ex.trans_date as string) ?? prev.trans_date,
        // AI가 영수증에서 추정한 VAT 여부는 신뢰하지 않고, 항상 사용자가 직접 체크하게 둠.
        vat_included: ocrExempt ? false : prev.vat_included,
        category_id: matchedCategory?.id ?? prev.category_id,
        tax_invoice_issued: ocrExempt ? false : prev.tax_invoice_issued,
        client_name_raw: (ex.client_name as string) ?? prev.client_name_raw,
      }));
    } catch {
      setError("OCR 인식 중 오류가 발생했습니다.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleExcelFile(file: File) {
    setPreview(null);
    setOcrLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/transactions-excel", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      type ExcelRow = {
        trans_date?: string;
        type?: string;
        client_name?: string;
        project_name?: string;
        item_name?: string;
        category_name?: string;
        quantity?: number | null;
        unit_price?: number | null;
        amount?: number;
        payment_method_name?: string;
        payment_type?: string;
        tax_invoice_issued?: boolean;
        note1?: string;
        note2?: string;
      };
      const rows = (json.rows ?? []) as ExcelRow[];
      if (rows.length === 0) {
        setError("엑셀에서 항목을 인식하지 못했습니다.");
        return;
      }

      applyLines(
        rows.map((r) => ({
          item_name: r.item_name ?? "",
          quantity: r.quantity != null ? String(r.quantity) : "",
          unit_price: r.unit_price != null ? String(r.unit_price) : "",
          subtotal: r.amount != null ? String(r.amount) : "",
          project_id: (r.project_name && projects.find((p) => p.name === r.project_name)?.id) || "",
        })),
        latest.current.projectId
      );

      const first = rows[0];
      const matchedClient = first.client_name ? clients.find((c) => c.name === first.client_name) : undefined;
      const matchedCategory = first.category_name
        ? expenseCategories.find((c) => c.name === first.category_name)
        : undefined;
      const matchedPaymentMethod = first.payment_method_name
        ? paymentMethods.find((pm) => pm.name === first.payment_method_name)
        : undefined;
      const catExempt = isVatExemptCategory(matchedCategory);
      setValues((prev) => ({
        ...prev,
        trans_date: first.trans_date ?? prev.trans_date,
        type: first.type === "매출" || first.type === "매입" ? first.type : prev.type,
        client_id: matchedClient?.id ?? "",
        client_name_raw: matchedClient ? "" : (first.client_name ?? prev.client_name_raw),
        category_id: matchedCategory?.id ?? prev.category_id,
        payment_method_id: matchedPaymentMethod?.id ?? prev.payment_method_id,
        payment_type: first.payment_type === "credit" ? "credit" : "immediate",
        tax_invoice_issued: catExempt ? false : Boolean(first.tax_invoice_issued),
        note1: first.note1 ?? prev.note1,
        note2: first.note2 ?? prev.note2,
      }));
    } catch {
      setError("엑셀 인식 중 오류가 발생했습니다.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (files.length === 1 && /\.(xlsx|xls)$/i.test(files[0].name)) {
      await handleExcelFile(files[0]);
    } else {
      await handleImageOrPdfFiles(files);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validItems = lineItems.filter((li) => li.subtotal);
    if (validItems.length === 0) {
      setError("최소 한 개 항목의 소계(금액)를 입력해주세요.");
      return;
    }

    // 묶음 수정에서 지운 줄(금액을 비운 줄 포함)은 저장할 때 그 거래를 삭제.
    const removedIds = isGroupEdit
      ? initialGroup!.map((t) => t.id).filter((id) => !validItems.some((li) => li.id === id))
      : [];
    const willGroup = groupingReady && groupPayment && validItems.length > 1;
    const confirmMessage = isGroupEdit
      ? `수정 내용을 저장하시겠습니까?${removedIds.length > 0 ? ` (줄 ${removedIds.length}개 삭제)` : ""}`
      : initial
        ? "수정 내용을 저장하시겠습니까?"
        : `이 거래를 등록하시겠습니까? (${validItems.length}건${willGroup ? " · 한 결제로 묶음" : ""})`;
    if (!(await confirm(confirmMessage))) return;
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
        needs_classification: effectiveValues.needs_classification,
        amount: Number(li.subtotal) || 0,
        note1: effectiveValues.note1 || null,
        note2: effectiveValues.note2 || null,
      };
    }

    async function saveSingle(li: LineItem, id?: string) {
      const fd = new FormData();
      if (id) fd.append("id", id);
      Object.entries(effectiveValues).forEach(([k, v]) => {
        if (k === "vat_included" || k === "tax_invoice_issued" || k === "needs_classification") {
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
      return pending.run(() => action(fd));
    }

    if (isGroupEdit) {
      // 한 결제로 묶인 줄 전체 수정 — 원래 줄은 수정, 새 줄은 같은 묶음으로 추가, 지운 줄은 삭제.
      const result = await pending.run(() =>
        saveTransactionGroup({
          groupId: initial!.payment_group_id!,
          lines: validItems.map((li) => ({ ...buildRow(li), id: li.id })),
          removedIds,
          keepGroup: groupPayment,
        })
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
    } else if (validItems.length === 1) {
      const result = await saveSingle(validItems[0], initial?.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
    } else if (!initial) {
      // 신규 등록, 여러 줄 → 전부 새 거래로 일괄 등록(한 결제로 묶기를 켜면 같은 묶음 번호).
      const result = await pending.run(() => bulkImportTransactions(validItems.map(buildRow), { group: willGroup }));
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
        const bulkResult = await pending.run(() =>
          bulkImportTransactions(rest.map(buildRow), willGroup ? { joinGroupOf: initial.id } : {})
        );
        if (bulkResult?.error) {
          setError(bulkResult.error);
          return;
        }
      }
    }

    router.push(redirectTo, { scroll: false });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">영수증 업로드 (선택, AI 자동 인식)</h2>
        <p className="mb-2 text-xs text-slate-400">
          사진(여러 장 선택 시 장당 한 줄씩 등록)·PDF는 AI가 읽고, 엑셀(여러 품목 정리본)은 첫 줄 머리글(품목·수량·단가·
          총금액 등)로 읽어서 자동으로 항목을 채워줘요. 사진/PDF 원본은 저장되지 않으니 직접 보관해주세요.
        </p>
        <input
          type="file"
          accept="image/*,application/pdf,.xlsx,.xls"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="text-sm"
        />
        {ocrLoading && <p className="mt-2 text-sm text-slate-500">영수증을 인식하는 중입니다...</p>}
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
            list="client-name-suggestions"
            value={values.client_name_raw}
            onChange={(e) => set("client_name_raw", e.target.value)}
            placeholder="예: 온라인, 화성"
            className={inputClass}
          />
          <datalist id="client-name-suggestions">
            {clientNameSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
        <div className="flex flex-col gap-1">
          {lineItems.length > 1 ? (
            <>
              <span className="text-xs font-medium text-slate-500">프로젝트</span>
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                품목이 여러 줄이라 아래 품목 줄마다 선택해요.
              </p>
            </>
          ) : (
            <ProjectPicker
              sites={sites}
              projects={projects}
              value={values.project_id}
              onChange={(v) => set("project_id", v)}
            />
          )}
          {values.type === "매출" && (
            <p className="text-xs text-slate-400">
              기성금·잔금 매출은 프로젝트를 꼭 선택하세요 — 받은 만큼 대시보드 예상 미수액에서 빠져요.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">분류 상태</label>
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              values.needs_classification
                ? "bg-green-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={values.needs_classification}
              onChange={(e) => set("needs_classification", e.target.checked)}
              className="h-4 w-4"
            />
            분류 대기 중
          </label>
        </div>
        <Field label="카테고리">
          <select value={values.category_id} onChange={(e) => handleCategorySelect(e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id} style={{ color: resolveCategoryColor(c) }}>
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
            className={`${inputClass} bg-red-600 text-white`}
            disabled={values.payment_type === "credit"}
          >
            <option value="">{values.payment_type === "credit" ? "정산 시 지정" : "선택 안함"}</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id} style={paymentMethodColorStyle(pm)}>
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
          {vatExempt && <span className="text-xs text-slate-400">(비과세 카테고리라 선택 불가)</span>}
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
        {isGroupEdit ? (
          <p className="mb-2 text-xs text-slate-400">
            한 결제로 묶인 {initialGroup!.length}줄을 함께 수정해요. 줄을 지우거나 소계를 비우면 저장할 때 그 거래가 삭제돼요.
          </p>
        ) : (
          initial && (
            <p className="mb-2 text-xs text-slate-400">
              줄을 추가하면 저장 시 첫 줄은 이 거래를 수정하고, 나머지 줄은 새 거래로 분리돼요 (계산서 1건이 여러
              프로젝트에 걸칠 때).
              {partOfGroup && " 이 거래는 한 결제로 묶여 있지만 줄마다 날짜·카테고리 등이 달라 이 줄만 수정해요."}
            </p>
          )
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
                    className={`${inputClass} min-w-0 flex-1`}
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
                      {!isOverride && lineItems.length === 1 && <span className="text-slate-400"> (공통)</span>}
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

        <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
          {groupingReady && (lineItems.length > 1 || isGroupEdit) ? (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={groupPayment}
                onChange={(e) => setGroupPayment(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                한 결제로 묶기
                <span className="block text-xs text-slate-400">매입장에 한 줄로 표시 · 프로젝트별 금액은 줄마다 따로 저장</span>
              </span>
            </label>
          ) : groupingReady ? (
            // 한 줄일 때는 묶을 게 없어서 체크 대신 안내만 — 체크가 안 보여 기능을 못 찾았음(사용자 문의).
            <p className="text-xs text-slate-400">
              한 결제를 여러 프로젝트로 나눌 땐 &quot;+ 물품 종류 추가&quot;로 줄을 더하면 &quot;한 결제로 묶기&quot;가 나와요.
            </p>
          ) : (
            <span />
          )}
          <p className="ml-auto whitespace-nowrap text-right text-sm font-semibold text-slate-900">
            합계{vatAppliesNow && <span className="ml-1 text-xs font-normal text-slate-400">(VAT 포함)</span>}
            <span className="ml-1 tabular-nums text-base">{formatWon(grandTotal)}</span>
          </p>
        </div>
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
            {/* ProjectPicker는 "완료 프로젝트 보기" 체크·연도/현장 변경 시에도 값 초기화를
                위해 onChange("")를 호출함 — 여기서 그때마다 팝업을 닫아버리면 실제 프로젝트를
                고르기 전에 체크박스만 눌러도 팝업이 꺼지는 버그가 됨. 그래서 선택해도 자동으로
                안 닫히게 하고, 위 "닫기" 버튼이나 바깥 클릭으로만 닫히게 함. */}
            <ProjectPicker
              sites={sites}
              projects={projects}
              value={lineItems[projectPopupIndex].project_id}
              onChange={(v) => updateLineItem(projectPopupIndex, { project_id: v })}
              label={lineItems.length > 1 ? "프로젝트 (비워두면 일반경비)" : "프로젝트 (비워두면 상단 공통값 사용)"}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {initial ? "수정 저장" : "거래 등록"}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo, { scroll: false })}
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
