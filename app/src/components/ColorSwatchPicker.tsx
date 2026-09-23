import { labelClass } from "@/components/ui/field";

export function ColorSwatchPicker({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string | null;
  onChange: (hex: string | null) => void;
  colors: readonly { label: string; hex: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            value === null ? "border-slate-900 font-semibold text-slate-900" : "border-slate-300 text-slate-500"
          }`}
        >
          없음
        </button>
        {colors.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            className={`h-6 w-6 rounded-full border ${value === c.hex ? "border-2 border-slate-900" : "border-slate-300"}`}
            style={{ backgroundColor: c.hex }}
            title={c.label}
          />
        ))}
      </div>
    </div>
  );
}
