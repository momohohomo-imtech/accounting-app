// 공구 마스터 목록/공구명세서 작성 화면이 공유하는 "순번" 그룹핑 로직.
// 순번 0은 아직 순번을 지정 안 한 공구를 뜻함.
const GROUP_LABELS: Record<number, string> = {
  1: "소공구",
  2: "전동공구",
  3: "화기 작업 공구",
  4: "이송 인양 공구",
  5: "고소 공구",
  6: "측정 공구",
  7: "안전 용품",
  8: "기타 용품",
  9: "청소 용품",
};

export function toolGroupLabel(sortOrder: number) {
  if (sortOrder === 0) return "미지정";
  return GROUP_LABELS[sortOrder] ?? `${sortOrder}번`;
}

export function groupToolsBySortOrder<T extends { sort_order: number }>(tools: T[]): [number, T[]][] {
  const map = new Map<number, T[]>();
  for (const t of tools) {
    const list = map.get(t.sort_order) ?? [];
    list.push(t);
    map.set(t.sort_order, list);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
