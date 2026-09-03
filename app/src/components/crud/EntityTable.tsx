"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Table, THead, Tr, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type Row = Record<string, unknown> & { id: string };

function displayValue(row: Row, f: FieldConfig) {
  const raw = row[f.name];
  if (f.type === "select") return f.options?.find((o) => o.value === raw)?.label ?? String(raw ?? "-");
  if (f.type === "project-search") {
    if (!raw) return "-";
    return f.projectSearchOptions?.find((o) => o.value === raw)?.label ?? String(raw);
  }
  if (f.type === "checkbox") return raw ? "O" : "";
  if (raw === null || raw === undefined || raw === "") return "-";
  if (f.format === "currency") return formatNumber(raw as number | string);
  return String(raw);
}

function cellColorClass(row: Row, f: FieldConfig): string | undefined {
  if (f.colorField && row[f.colorField]) return "text-red-600";
  if (f.secondaryColorField && row[f.secondaryColorField]) return "text-green-600";
  if (f.tertiaryColorField && row[f.tertiaryColorField]) return "text-amber-600";
  if (f.redValue !== undefined) return row[f.name] === f.redValue ? "text-red-600" : undefined;
  if (f.type === "select") {
    const color = f.options?.find((o) => o.value === row[f.name])?.color;
    if (color === "red") return "text-red-600";
    if (color === "blue") return "text-blue-600";
    if (color === "green") return "text-green-600";
  }
  return undefined;
}

function rowBgClass(row: Row, fields: FieldConfig[]): string | undefined {
  const f = fields.find((f) => f.rowBackgroundUnless !== undefined);
  if (f && row[f.name] !== f.rowBackgroundUnless) return "bg-red-50";
  return undefined;
}

function tableStorageKey(fields: FieldConfig[]) {
  return `entityTableColWidths:${fields.map((f) => f.name).join(",")}`;
}

function ProgressCell({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-blue-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EntityTable({
  fields,
  rows,
  updateAction,
  deleteAction,
  extraActions,
  editPopup,
}: {
  fields: FieldConfig[];
  rows: Row[];
  updateAction: (formData: FormData) => unknown;
  deleteAction: (formData: FormData) => void;
  extraActions?: Record<string, ReactNode>;
  /** Show the edit form in a modal instead of expanding the row inline. */
  editPopup?: boolean;
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const visibleFields = useMemo(() => fields.filter((f) => !f.hideInTable), [fields]);
  const hasWidths = visibleFields.some((f) => f.width);
  const sortField = fields.find((f) => f.name === sortKey);

  // 폭이 지정된(hasWidths) 표에 한해 헤더 오른쪽 끝을 드래그해서 열 너비를 직접
  // 조절할 수 있게 함 — 조절한 값은 표 구성(필드명 목록)별로 로컬에 저장해서
  // 다음 방문에도 유지됨.
  const storageKey = useMemo(() => tableStorageKey(visibleFields), [visibleFields]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const resizingRef = useRef<{ name: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!hasWidths) return;
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 localStorage에서 저장된 폭을 1회 불러옴(SSR 시엔 값이 없어 하이드레이션 불일치 없음)
      if (raw) setColWidths(JSON.parse(raw));
    } catch {
      // 저장된 값이 없거나 손상된 경우 기본 폭을 그대로 씀.
    }
  }, [storageKey, hasWidths]);

  function startResize(e: React.MouseEvent, name: string) {
    e.preventDefault();
    const startWidth = thRefs.current[name]?.offsetWidth ?? 100;
    resizingRef.current = { name, startX: e.clientX, startWidth };

    function onMove(ev: MouseEvent) {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(48, r.startWidth + (ev.clientX - r.startX));
      setColWidths((prev) => ({ ...prev, [r.name]: next }));
    }
    function onUp() {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setColWidths((prev) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(prev));
        } catch {
          // 로컬 저장에 실패해도 화면상의 조절 결과는 그대로 유지됨.
        }
        return prev;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function colStyle(f: FieldConfig) {
    const px = colWidths[f.name];
    return px ? { width: `${px}px` } : f.width ? { width: f.width } : undefined;
  }

  function handleSort(name: string) {
    if (name === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(name);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = displayValue(a, sortField);
      const vb = displayValue(b, sortField);
      const na = Number(a[sortField.name]);
      const nb = Number(b[sortField.name]);
      const cmp =
        !Number.isNaN(na) && !Number.isNaN(nb) && a[sortField.name] !== null && b[sortField.name] !== null
          ? na - nb
          : va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortField, sortDir]);

  const editingRow = editPopup ? sortedRows.find((r) => r.id === editingId) : undefined;
  useEscapeKey(Boolean(editingRow), () => setEditingId(null));

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">등록된 항목이 없습니다.</p>;
  }

  return (
    <>
    <Table className={hasWidths ? "min-w-[700px] table-fixed" : "min-w-[700px]"}>
      <THead>
        {visibleFields.map((f) => (
          <th
            key={f.name}
            ref={(el) => {
              thRefs.current[f.name] = el;
            }}
            style={colStyle(f)}
            className="relative whitespace-nowrap pb-2 pr-4 font-medium"
          >
            <button
              type="button"
              onClick={() => handleSort(f.name)}
              className="inline-flex items-center gap-1 transition-colors hover:text-slate-800"
            >
              {f.tableLabel ?? f.label}
              {sortKey === f.name && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
            {hasWidths && f.width && (
              <span
                onMouseDown={(e) => startResize(e, f.name)}
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-slate-300 print:hidden"
                title="드래그하여 폭 조절"
              />
            )}
          </th>
        ))}
        <th className="pb-2 text-right font-medium print:hidden" style={hasWidths ? { width: "8%" } : undefined}>
          관리
        </th>
      </THead>
      <tbody>
        {sortedRows.map((row) =>
          editingId === row.id && !editPopup ? (
            <Tr key={row.id} className="bg-slate-50">
              <td colSpan={visibleFields.length + 1} className="py-3 pr-4">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
                    try {
                      const result = await pending.run(() => Promise.resolve(updateAction(new FormData(form))));
                      if (result && typeof result === "object" && "error" in result && result.error) {
                        setFormError(String(result.error));
                        return;
                      }
                      setFormError(null);
                      setEditingId(null);
                    } catch (err) {
                      setFormError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
                    }
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="id" value={row.id} />
                  <EntityForm fields={fields} defaultValues={row} />
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      저장
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFormError(null);
                        setEditingId(null);
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </form>
              </td>
            </Tr>
          ) : (
            <Tr key={row.id} className={rowBgClass(row, fields)}>
              {visibleFields.map((f) => (
                <Td
                  key={f.name}
                  style={colStyle(f)}
                  title={f.display === "progress" ? undefined : displayValue(row, f)}
                  className="max-w-[220px] truncate pr-4 print:whitespace-normal print:overflow-visible"
                >
                  {f.display === "progress" ? (
                    <ProgressCell value={Number(row[f.name]) || 0} />
                  ) : cellColorClass(row, f) ? (
                    <span className={cellColorClass(row, f)}>{displayValue(row, f)}</span>
                  ) : (
                    displayValue(row, f)
                  )}
                </Td>
              ))}
              <Td className="text-right print:hidden">
                <div className="flex justify-end gap-2">
                  {extraActions?.[row.id]}
                  <Button variant="secondary" size="xs" onClick={() => setEditingId(row.id)}>
                    수정
                  </Button>
                  {confirmDeleteId === row.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                      <Button
                        variant="danger"
                        size="xs"
                        type="button"
                        onClick={async () => {
                          const fd = new FormData();
                          fd.append("id", row.id);
                          await pending.run(() => Promise.resolve(deleteAction(fd)));
                          setConfirmDeleteId(null);
                        }}
                      >
                        확인
                      </Button>
                      <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </div>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(row.id)}>
                      삭제
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          )
        )}
      </tbody>
    </Table>

    {editingRow && (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:hidden">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">수정</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
              try {
                const result = await updateAction(new FormData(form));
                if (result && typeof result === "object" && "error" in result && result.error) {
                  setFormError(String(result.error));
                  return;
                }
                setFormError(null);
                setEditingId(null);
              } catch (err) {
                setFormError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
              }
            }}
            className="space-y-3"
          >
            <input type="hidden" name="id" value={editingRow.id} />
            <EntityForm fields={fields} defaultValues={editingRow} />
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                저장
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFormError(null);
                  setEditingId(null);
                }}
              >
                취소
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
