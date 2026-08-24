"use client";

import { useState } from "react";
import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function CreatePanel({
  title,
  fields,
  createAction,
}: {
  title: string;
  fields: FieldConfig[];
  createAction: (formData: FormData) => void;
}) {
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
        action={(fd) => {
          createAction(fd);
          setOpen(false);
        }}
        className="space-y-3"
      >
        <EntityForm fields={fields} />
        <Button type="submit">추가하기</Button>
      </form>
    </Card>
  );
}
