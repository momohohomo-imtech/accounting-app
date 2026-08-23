import type { FieldConfig } from "./types";

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
        const raw = defaultValues?.[f.name];
        const value = raw === null || raw === undefined ? "" : String(raw);

        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex items-center gap-2 pt-5 text-sm text-slate-700">
              <input type="checkbox" name={f.name} defaultChecked={Boolean(raw)} className="h-4 w-4" />
              {f.label}
            </label>
          );
        }

        return (
          <div key={f.name} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                name={f.name}
                defaultValue={value}
                required={f.required}
                placeholder={f.placeholder}
                rows={2}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            ) : f.type === "select" ? (
              <select
                name={f.name}
                defaultValue={value}
                required={f.required}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
