// 공구 마스터 목록/공구명세서 작성 화면이 공유하는 "순번" 그룹핑 로직.
// 순번 0은 아직 순번을 지정 안 한 공구를 뜻함.
export function toolGroupLabel(sortOrder: number) {
  return sortOrder === 0 ? "미지정" : `${sortOrder}번`;
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
