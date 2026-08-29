// 지출카테고리 색상 — sites.color처럼 수동 지정이 있으면 그걸, 없으면 기존 규칙(프로젝트 전용은
// 빨간색, 그 외는 기본 텍스트색)을 그대로 따른다. 카테고리마다 자동 해시색을 주지는 않음 —
// 사용자가 강조하고 싶은 카테고리만 직접 색을 지정하는 용도라 지정 안 한 카테고리는 색이 없는 게 맞음.
export function resolveCategoryColor(category?: { color?: string | null; project_only?: boolean } | null): string | undefined {
  if (!category) return undefined;
  if (category.color) return category.color;
  return category.project_only ? "#dc2626" : undefined;
}
