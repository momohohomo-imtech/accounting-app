import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";
import { Card, CardTitle } from "@/components/ui/Card";
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
  return (
    <Card>
      <CardTitle className="mb-3">{title} 추가</CardTitle>
      <form action={createAction} className="space-y-3">
        <EntityForm fields={fields} />
        <Button type="submit">추가하기</Button>
      </form>
    </Card>
  );
}
