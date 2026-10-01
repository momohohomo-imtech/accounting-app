// 목록 줄 순서 바꾸기 — 견적서 품목의 순번 숫자를 고쳐서 그 자리로 옮길 때(사용자 요청).

/** from 자리의 항목을 to 자리로 옮긴 새 배열(원본은 그대로). 범위를 벗어난 to는 맨 앞/맨 뒤로. */
export function moveListItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.min(Math.max(to, 0), list.length - 1);
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** moveListItem(from → to) 뒤에 원래 index 자리에 있던 항목의 새 자리(체크 표시 등을 따라 옮길 때). */
export function movedIndex(index: number, from: number, to: number, length: number): number {
  const target = Math.min(Math.max(to, 0), length - 1);
  if (index === from) return target;
  if (from < target && index > from && index <= target) return index - 1;
  if (from > target && index >= target && index < from) return index + 1;
  return index;
}
