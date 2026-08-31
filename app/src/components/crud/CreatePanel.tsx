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
  createAction: (formData: FormData) => void;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);

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
          createAction(new FormData(e.currentTarget));
          setOpen(false);
        }}
        className="space-y-3"
      >
        <EntityForm fields={fields} />
        <div className="flex items-center gap-2">
          <Button type="submit">추가하기</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            취소
          </Button>
        </div>
      </form>
    </Card>
  );
}
