"use client";

import { useState } from "react";
import { fieldClass } from "@/components/ui/field";
import { formatWon } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { bulkImportTransactions, type BulkTransactionInput } from "@/lib/actions/transactions";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type Option = { id: string; name: string };

type ParsedRow = {
  trans_date: string;
  type: string;
  client_name?: string;
  project_name?: string;
  item_name?: string;
  category_name?: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  payment_method_name?: string;
  payment_type: string;
  tax_invoice_issued: boolean;
  note1?: string;
  note2?: string;
};

type EditableRow = BulkTransactionInput & { client_name_display: string };

function matchId(options: Option[], name?: string) {
  if (!name) return null;
  return options.find((o) => o.name === name.trim())?.id ?? null;
}

export function TransactionBulkImport({
  clients,
  projects,
  paymentMethods,
  expenseCategories,
}: {
  clients: Option[];
  projects: Option[];
  paymentMethods: Option[];
  expenseCategories: Option[];
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setRows(null);
    setSavedCount(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/transactions-excel", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      const parsed = json.rows as ParsedRow[] | null;
      if (!parsed?.length) {
        setError("표를 인식하지 못했습니다.");
        return;
      }
      setRows(
        parsed.map((r) => {
          const clientId = matchId(clients, r.client_name);
          const projectId = matchId(projects, r.project_name);
          return {
            trans_date: r.trans_date || new Date().toISOString().slice(0, 10),
            type: r.type === "매출" ? "매출" : "매입",
            client_id: clientId,
            client_name_raw: clientId ? null : r.client_name?.trim() || null,
            client_name_display: r.client_name?.trim() ?? "",
            project_id: projectId,
            // 엑셀에 프로젝트명은 적혀 있는데 시스템 프로젝트와 매칭이 안 되면(오탈자, 신규
            // 프로젝트 등) 담당자가 나중에 확인하도록 "분류 대기 중"으로 표시.
            needs_classification: Boolean(r.project_name?.trim()) && !projectId,
            item_name: r.item_name?.trim() || null,
            category_id: matchId(expenseCategories, r.category_name),
            quantity: r.quantity ?? null,
            unit_price: r.unit_price ?? null,
            payment_method_id: matchId(paymentMethods, r.payment_method_name),
            payment_type: r.payment_type === "credit" ? "credit" : "immediate",
            tax_invoice_issued: Boolean(r.tax_invoice_issued),
            // 엑셀 금액은 이미 최종 합계로 보고, 자동으로 10% 얹지 않음(항상 미체크로 저장).
            vat_included: false,
            amount: Number(r.amount) || 0,
            note1: r.note1?.trim() || null,
            note2: r.note2?.trim() || null,
          };
        })
      );
    } catch {
      setError("인식 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev?.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) ?? null);
  }

  async function handleSave() {
    if (!rows) return;
    if (!(await confirm(`${rows.length}건을 일괄 등록하시겠습니까?`))) return;
    setSaving(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- client_name_display is UI-only, strip it before sending
      const result = await pending.run(() => bulkImportTransactions(rows.map(({ client_name_display, ...r }) => r)));
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSavedCount(rows.length);
      setRows(null);
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        정해진 엑셀 양식을 올리면 AI가 표를 읽어서 아래에 미리보기로 보여줘요. 거래처/프로젝트/결제수단/카테고리는
        등록된 이름과 일치하면 자동 연결되고, 안 맞으면 직접 선택해서 고치면 돼요.
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="text-sm"
      />
      {loading && <p className="text-sm text-slate-500">AI가 엑셀 표를 인식하는 중입니다...</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {savedCount != null && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedCount}건 등록 완료했습니다.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-2">날짜</th>
                  <th className="pb-2 pr-2">구분</th>
                  <th className="pb-2 pr-2">거래처</th>
                  <th className="pb-2 pr-2">프로젝트</th>
                  <th className="pb-2 pr-2">품목</th>
                  <th className="pb-2 pr-2">카테고리</th>
                  <th className="pb-2 pr-2 text-right">금액</th>
                  <th className="pb-2 pr-2">결제수단</th>
                  <th className="pb-2 pr-2">결제시점</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 pr-2">
                      <input
                        type="date"
                        value={r.trans_date}
                        onChange={(e) => updateRow(i, { trans_date: e.target.value })}
                        className={cx(fieldClass, "w-36")}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.type}
                        onChange={(e) => updateRow(i, { type: e.target.value })}
                        className={cx(fieldClass, "w-20")}
                      >
                        <option value="매입">매입</option>
                        <option value="매출">매출</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.client_id ?? ""}
                        onChange={(e) =>
                          updateRow(i, {
                            client_id: e.target.value || null,
                            client_name_raw: e.target.value ? null : r.client_name_display,
                          })
                        }
                        className={cx(fieldClass, "min-w-[140px]")}
                      >
                        <option value="">{r.client_name_display || "선택 안함"} (자유입력)</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.project_id ?? ""}
                        onChange={(e) =>
                          updateRow(i, { project_id: e.target.value || null, needs_classification: false })
                        }
                        className={cx(fieldClass, "min-w-[140px]")}
                      >
                        <option value="">일반경비</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {r.needs_classification && (
                        <span className="mt-0.5 block rounded bg-green-600 px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
                          분류 대기 중
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={r.item_name ?? ""}
                        onChange={(e) => updateRow(i, { item_name: e.target.value || null })}
                        className={cx(fieldClass, "min-w-[100px]")}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.category_id ?? ""}
                        onChange={(e) => updateRow(i, { category_id: e.target.value || null })}
                        className={cx(fieldClass, "min-w-[100px]")}
                      >
                        <option value="">선택 안함</option>
                        {expenseCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <input
                        type="number"
                        value={r.amount}
                        onChange={(e) => updateRow(i, { amount: Number(e.target.value) })}
                        className={cx(fieldClass, "w-28 text-right")}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.payment_method_id ?? ""}
                        onChange={(e) => updateRow(i, { payment_method_id: e.target.value || null })}
                        className={cx(fieldClass, "min-w-[100px]")}
                      >
                        <option value="">선택 안함</option>
                        {paymentMethods.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.payment_type}
                        onChange={(e) => updateRow(i, { payment_type: e.target.value })}
                        className={cx(fieldClass, "w-24")}
                      >
                        <option value="immediate">즉시결제</option>
                        <option value="credit">외상</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : `${rows.length}건 일괄 등록`}
            </Button>
            <span className="text-xs text-slate-500">합계 {formatWon(rows.reduce((s, r) => s + r.amount, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
