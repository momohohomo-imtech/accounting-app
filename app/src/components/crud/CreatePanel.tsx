import type { FieldConfig } from "./types";
import { EntityForm } from "./EntityForm";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">{title} 추가</h2>
      <form action={createAction} className="space-y-3">
        <EntityForm fields={fields} />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          추가하기
        </button>
      </form>
    </div>
  );
}
