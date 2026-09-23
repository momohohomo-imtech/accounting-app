"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { FieldConfig, RowBgColor } from "./types";
import { EntityForm } from "./EntityForm";
import { Table, THead, Tr, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { formatNumber, formatWon } from "@/lib/format";
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
  if (f.format === "won") return formatWon(raw as number);
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

const ROW_BG_CLASS: Record<RowBgColor, string> = {
  red: "bg-red-50",
  blue: "bg-blue-50",
  green: "bg-green-50",
  gray: "bg-slate-100",
  purple: "bg-purple-50",
  amber: "bg-amber-50",
  teal: "bg-teal-50",
  pink: "bg-pink-50",
  indigo: "bg-indigo-50",
  cyan: "bg-cyan-50",
  orange: "bg-orange-50",
  fuchsia: "bg-fuchsia-50",
};

const STRONG_ROW_BG_CLASS: Record<RowBgColor, string> = {
  red: "bg-red-200",
  blue: "bg-blue-200",
  green: "bg-green-200",
  gray: "bg-slate-300",
  purple: "bg-purple-200",
  amber: "bg-amber-200",
  teal: "bg-teal-200",
  pink: "bg-pink-200",
  indigo: "bg-indigo-200",
  cyan: "bg-cyan-200",
  orange: "bg-orange-200",
  fuchsia: "bg-fuchsia-200",
};

function rowBgClass(row: Row, fields: FieldConfig[]): string | undefined {
  for (const f of fields) {
    const strong = f.strongRowBackgroundByValue?.[row[f.name] as string];
    if (strong) return STRONG_ROW_BG_CLASS[strong];
  }
  for (const f of fields) {
    const color = f.rowBackgroundByValue?.[row[f.name] as string];
    if (color) return ROW_BG_CLASS[color];
  }
  return undefined;
}

const DOT_COLOR_CLASS: Record<RowBgColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  gray: "bg-slate-400",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  fuchsia: "bg-fuchsia-500",
};

function dotColorClass(row: Row, f: FieldConfig): string | undefined {
  if (!f.dotColorField) return undefined;
  const color = row[f.dotColorField] as RowBgColor | undefined;
  return color ? DOT_COLOR_CLASS[color] : undefined;
}

function tableStorageKey(fields: FieldConfig[]) {
  return `entityTableColWidths:${fields.map((f) => f.name).join(",")}`;
}

function visibilityStorageKey(fields: FieldConfig[]) {
  return `entityTableColVisible:${fields.map((f) => f.name).join(",")}`;
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
  groupByField,
}: {
  fields: FieldConfig[];
  rows: Row[];
  updateAction: (formData: FormData) => unknown;
  deleteAction: (formData: FormData) => unknown;
  extraActions?: Record<string, ReactNode>;
  /** Show the edit form in a modal instead of expanding the row inline. */
  editPopup?: boolean;
  /**
   * Row field name holding another row's id (e.g. a "parent" reference). When set, a row whose
   * value at this field matches another visible row's id is always kept directly under that row —
   * sorting reorders these parent+children groups relative to each other (by the parent's value),
   * never splits a group apart.
   */
  groupByField?: string;
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // 체크박스로 켜고 끌 수 있는(toggleable) 열 — 켜짐/꺼짐 상태는 표 구성별로 로컬에
  // 저장해서 다음 방문에도 유지됨.
  const toggleableFields = useMemo(() => fields.filter((f) => f.toggleable), [fields]);
  const visibilityKey = useMemo(() => visibilityStorageKey(fields), [fields]);
  const [colVisible, setColVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(toggleableFields.map((f) => [f.name, f.defaultVisible ?? true]))
  );

  useEffect(() => {
    if (toggleableFields.length === 0) return;
    try {
      const raw = localStorage.getItem(visibilityKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 localStorage에서 저장된 표시 상태를 1회 불러옴(SSR 시엔 값이 없어 하이드레이션 불일치 없음)
      if (raw) setColVisible((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // 저장된 값이 없거나 손상된 경우 기본 표시 상태를 그대로 씀.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleableFields는 fields에서 매 렌더 새로 만들어지므로 의존성에서 뺌(visibilityKey가 사실상 같은 역할)
  }, [visibilityKey]);

  function toggleColumn(name: string) {
    setColVisible((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try {
        localStorage.setItem(visibilityKey, JSON.stringify(next));
      } catch {
        // 로컬 저장에 실패해도 화면상의 표시 상태는 그대로 유지됨.
      }
      return next;
    });
  }

  const visibleFields = useMemo(
    () => fields.filter((f) => !f.hideInTable && (!f.toggleable || colVisible[f.name] !== false)),
    [fields, colVisible]
  );
  const hasWidths = visibleFields.some((f) => f.width);
  // 옆으로 넘겨도 어느 행인지 보이게 고정할 칸 — "name" 칸이 있으면 그것, 없으면 첫 칸.
  const stickyFieldName = (visibleFields.find((f) => f.name === "name") ?? visibleFields[0])?.name;
  const hasExtraActions = Boolean(extraActions && Object.keys(extraActions).length > 0);
  // 관리 칸은 버튼이 한 줄에 들어가는 고정 폭(비율로 주면 휴대폰에서 버튼이 세로로 쌓임).
  const actionsWidth = hasExtraActions ? 180 : 120;
  // 휴대폰에서는 칸 수에 맞춰 표를 넓히고 가로로 넘김(700px에 다 우겨넣으면 칸마다 글자가 잘림).
  const mobileMinWidth = visibleFields.length * 105 + actionsWidth;
  const sortField = fields.find((f) => f.name === sortKey);

  // 폭이 지정된(hasWidths) 표에 한해 헤더 오른쪽 끝을 드래그해서 열 너비를 직접
  // 조절할 수 있게 함 — 조절한 값은 표 구성(전체 필드명 목록, 켜고 끈 열과 무관하게
  // 고정)별로 로컬에 저장해서 다음 방문에도 유지됨. visibleFields로 키를 잡으면 열
  // 표시를 켜고 끌 때마다 키가 바뀌어서 저장해둔 너비를 잃어버리므로 fields를 씀.
  const storageKey = useMemo(() => tableStorageKey(fields), [fields]);
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
    // groupByField가 있으면 그 필드로 다른 행을 가리키는 행(자식)을 항상 그 행(부모) 바로
    // 아래에 묶어두고, 정렬은 그룹(부모+자식들)을 통째로 부모 기준값으로 재배치한다 — 자식이
    // 그룹에서 떨어져 나가 다른 곳에 꽂히는 일이 없게.
    const rowById = new Map(rows.map((r) => [r.id, r]));
    const childrenByParentId = new Map<string, Row[]>();
    const childIds = new Set<string>();
    if (groupByField) {
      for (const r of rows) {
        const parentId = r[groupByField] as string | null | undefined;
        if (parentId && rowById.has(parentId)) {
          childIds.add(r.id);
          const list = childrenByParentId.get(parentId) ?? [];
          list.push(r);
          childrenByParentId.set(parentId, list);
        }
      }
    }

    function compare(a: Row, b: Row) {
      if (!sortField) return 0;
      const va = displayValue(a, sortField);
      const vb = displayValue(b, sortField);
      const na = Number(a[sortField.name]);
      const nb = Number(b[sortField.name]);
      const cmp =
        !Number.isNaN(na) && !Number.isNaN(nb) && a[sortField.name] !== null && b[sortField.name] !== null
          ? na - nb
          : va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    }

    const blocks = rows
      .filter((r) => !childIds.has(r.id))
      .map((anchor) => ({
        anchor,
        children: [...(childrenByParentId.get(anchor.id) ?? [])].sort(compare),
      }));
    if (sortField) blocks.sort((a, b) => compare(a.anchor, b.anchor));

    return blocks.flatMap((b) => [b.anchor, ...b.children]);
  }, [rows, sortField, sortDir, groupByField]);

  const editingRow = editPopup ? sortedRows.find((r) => r.id === editingId) : undefined;
  useEscapeKey(Boolean(editingRow), () => setEditingId(null));

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">등록된 항목이 없습니다.</p>;
  }

  return (
    <>
    {toggleableFields.length > 0 && (
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 print:hidden">
        <span className="font-medium">표시 항목:</span>
        {toggleableFields.map((f) => (
          <label key={f.name} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={colVisible[f.name] !== false}
              onChange={() => toggleColumn(f.name)}
              className="h-3.5 w-3.5"
            />
            {f.tableLabel ?? f.label}
          </label>
        ))}
      </div>
    )}
    <Table
      className={cx(
        "sticky-col-table min-w-(--entity-min-w) md:min-w-[700px]",
        hasWidths && "table-fixed"
      )}
      style={{ "--entity-min-w": `${mobileMinWidth}px` } as CSSProperties}
    >
      <THead>
        {visibleFields.map((f) => (
          <th
            key={f.name}
            ref={(el) => {
              thRefs.current[f.name] = el;
            }}
            style={colStyle(f)}
            className={cx("relative whitespace-nowrap pb-2 pr-4 font-medium", f.name === stickyFieldName && "sticky-col")}
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
        <th className="whitespace-nowrap pb-2 text-right font-medium print:hidden" style={{ width: `${actionsWidth}px` }}>
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
                  className={cx(
                    "max-w-[220px] truncate pr-4 print:whitespace-normal print:overflow-visible",
                    f.name === stickyFieldName && "sticky-col"
                  )}
                >
                  {f.display === "progress" ? (
                    <ProgressCell value={Number(row[f.name]) || 0} />
                  ) : (
                    <>
                      {cellColorClass(row, f) ? (
                        <span className={cellColorClass(row, f)}>{displayValue(row, f)}</span>
                      ) : (
                        displayValue(row, f)
                      )}
                      {dotColorClass(row, f) && (
                        <span
                          className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${dotColorClass(row, f)}`}
                        />
                      )}
                    </>
                  )}
                </Td>
              ))}
              <Td className="whitespace-nowrap text-right print:hidden">
                <div className="flex justify-end gap-2">
                  {extraActions?.[row.id]}
                  <Button variant="secondary" size="xs" onClick={() => setEditingId(row.id)}>
                    수정
                  </Button>
                  {confirmDeleteId === row.id ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                        <Button
                          variant="danger"
                          size="xs"
                          type="button"
                          onClick={async () => {
                            const fd = new FormData();
                            fd.append("id", row.id);
                            const result = await pending.run(() => Promise.resolve(deleteAction(fd)));
                            if (result && typeof result === "object" && "error" in result && result.error) {
                              setDeleteError(String(result.error));
                              return;
                            }
                            setDeleteError(null);
                            setConfirmDeleteId(null);
                          }}
                        >
                          확인
                        </Button>
                        <Button
                          variant="secondary"
                          size="xs"
                          type="button"
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setDeleteError(null);
                          }}
                        >
                          취소
                        </Button>
                      </div>
                      {deleteError && <span className="max-w-[200px] text-right text-xs text-red-600">{deleteError}</span>}
                    </div>
                  ) : (
                    <Button
                      variant="danger"
                      size="xs"
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(row.id);
                        setDeleteError(null);
                      }}
                    >
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
