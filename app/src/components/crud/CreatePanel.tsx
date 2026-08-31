"use client";

import { useState } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";

export function CreatePanel({
  title,
  fields,
  createAction,
}: {
  title: string;
  fields: FieldConfig[];
  createAction: (formData: FormData) => unknown;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>+ {title} 추가하기</Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} 추가</CardTitle>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </CardHeader>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await confirm(`${title}을(를) 추가하시겠습니까?`))) return;
          try {
            const result = await createAction(new FormData(e.currentTarget));
            if (result && typeof result === "object" && "error" in result && result.error) {
              setFormError(String(result.error));
              return;
            }
            setFormError(null);
            setOpen(false);
          } catch {
            setFormError("저장 중 오류가 발생했습니다.");
          }
        }}
        className="space-y-3"
      >
        <EntityForm fields={fields} />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit">추가하기</Button>
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
