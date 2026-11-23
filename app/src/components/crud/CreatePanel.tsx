"use client";

import { useState } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { NEW_ID_FIELD, createNewIdKeeper, formDataKey } from "@/lib/idempotentSave";

export function CreatePanel({
  title,
  fields,
  createAction,
  idempotent = false,
}: {
  title: string;
  fields: FieldConfig[];
  createAction: (formData: FormData) => unknown;
  /**
   * 추가 동작이 화면에서 정한 새 id(new_id 칸)로 넣고 이미 있으면 다시 넣지 않을 때만 켬(lib/idempotentSave.ts — 고정지출 항목) —
   * 같은 내용이면 다시 눌러도 같은 id, 연결이 끊기면 자동으로 다시 보냄. new_id를 안 받는 동작에 켜면 두 번 들어갈 수 있음.
   */
  idempotent?: boolean;
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newIdKeeper] = useState(() => createNewIdKeeper());

  // 추가 버튼은 화면마다 오른쪽 정렬, 문구는 "+ 대상 추가"(매입매출 "+ 거래 등록"·급여 "+ 급여 지급 등록"처럼 오른쪽).
  // ml-auto·w-full: 버튼 줄(flex-wrap) 안에 둬도 버튼은 오른쪽 끝, 펼친 입력 카드는 한 줄을 다 씀.
  if (!open) {
    return (
      <div className="ml-auto flex justify-end print:hidden">
        <Button onClick={() => setOpen(true)}>+ {title} 추가</Button>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title} 추가</CardTitle>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </CardHeader>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          if (!(await confirm(`${title}을(를) 추가하시겠습니까?`))) return;
          try {
            const formData = new FormData(form);
            if (idempotent) formData.set(NEW_ID_FIELD, newIdKeeper.idsFor(formDataKey(formData), 1)[0]);
            const result = await pending.run(
              () => Promise.resolve(createAction(formData)),
              idempotent ? { retry: true } : undefined
            );
            if (result && typeof result === "object" && "error" in result && result.error) {
              setFormError(String(result.error));
              return;
            }
            newIdKeeper.reset();
            setFormError(null);
            setOpen(false);
          } catch (err) {
            setFormError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
          }
        }}
        className="space-y-3"
      >
        <EntityForm fields={fields.filter((f) => !f.hideInCreate)} />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit">추가</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFormError(null);
              setOpen(false);
            }}
          >
            취소
          </Button>
        </div>
      </form>
    </Card>
  );
}
