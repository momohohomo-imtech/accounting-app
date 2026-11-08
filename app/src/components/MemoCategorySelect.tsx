import { fieldClass, labelClass } from "@/components/ui/field";
import { MEMO_UNCATEGORIZED } from "@/lib/memoCategories";

// 메모 작성·수정의 구분 고르기 — 구분 목록 순서대로(104 SQL부터 "구분 관리"에서 바꾼 목록). 고치는 메모의 구분이 목록에 없으면
// (예전 백업 복원 등) 그 이름도 넣어 둠 — 저장할 때 모르게 미분류로 바뀌지 않게.
export function MemoCategorySelect({ defaultValue, categoryNames }: { defaultValue?: string | null; categoryNames: string[] }) {
  const names = defaultValue && !categoryNames.includes(defaultValue) ? [...categoryNames, defaultValue] : categoryNames;
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>구분</label>
      <select name="category" defaultValue={defaultValue ?? ""} className={`${fieldClass} sm:w-40`}>
        <option value="">{MEMO_UNCATEGORIZED}</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
