// supabase-js는 임베디드 관계를 쿼리 형태에 따라 배열로도, 단일 객체로도 반환한다.
// 실제 런타임 형태가 타입 추론과 다를 수 있어 항상 이 헬퍼로 안전하게 꺼낸다.
export function one<T>(v: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}
