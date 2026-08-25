import type { FieldConfig } from "./types";
import { fieldClass, labelClass } from "@/components/ui/field";
import { ParentProjectField } from "@/components/ParentProjectField";

export function EntityForm({
  fields,
  defaultValues,
}: {
  fields: FieldConfig[];
  defaultValues?: Record<string, unknown>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => {
        if (f.readOnly) return null;
        const raw = defaultValues?.[f.name];
        const value = raw === null || raw === undefined ? "" : String(raw);

        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex items-center gap-2 pt-5 text-sm text-slate-700">
              <input
                type="checkbox"
                name={f.name}
                defaultChecked={Boolean(raw)}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              {f.label}
            </label>
          );
        }

        return (
          <div key={f.name} className="flex flex-col gap-1">
            <label className={labelClass}>{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                name={f.name}
                defaultValue={value}
                required={f.required}
                placeholder={f.placeholder}
                rows={2}
                className={fieldClass}
              />
            ) : f.type === "project-search" ? (
              <ParentProjectField
                name={f.name}
                options={f.projectSearchOptions ?? []}
                defaultValue={value}
                required={f.required}
              />
            ) : f.type === "select" ? (
              <select name={f.name} defaultValue={value} required={f.required} className={fieldClass}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type ?? "text"}
                step={f.step}
                name={f.name}
                defaultValue={value}
                required={f.required}
                placeholder={f.placeholder}
                className={fieldClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
