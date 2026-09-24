import { fieldClass, labelClass } from "@/components/ui/field";
import { MEMO_CATEGORIES } from "@/lib/memoCategories";

export function MemoCategorySelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>구분</label>
      <select name="category" defaultValue={defaultValue ?? ""} className={`${fieldClass} sm:w-40`}>
        <option value="">미분류</option>
        {MEMO_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.value}
          </option>
        ))}
      </select>
    </div>
  );
}
