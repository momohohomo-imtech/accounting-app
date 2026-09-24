import type { createClient } from "@/lib/supabase/server";
import type { CreditPayment } from "@/lib/types";

// Supabase/PostgREST는 .range()로 명시적으로 페이지를 나누지 않으면 한 번에 최대
// 1000행까지만 돌려준다. 연간 데이터처럼 1000건을 넘길 수 있는 조회는 이 함수로
// 페이지를 나눠 끝까지 가져와야 함 — 안 그러면 정렬 조건 없이는 어떤 행이 잘려나갈지도
// 예측 불가능해서 보고서에서 특정 거래만 이유 없이 빠지는 문제가 생긴다.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// 외상 정산 이력 전체 — 외상 거래의 완납 여부(isLedgerVisible)·잔액 계산에 여러 화면에서 공통으로 씀.
export function fetchAllCreditPayments(supabase: Awaited<ReturnType<typeof createClient>>) {
  return fetchAllRows<CreditPayment>((from, to) =>
    supabase.from("credit_payments").select("*").order("id", { ascending: true }).range(from, to)
  );
}

// 거래 등록·수정 화면의 "직접 입력한 거래처명" 자동완성용 — 거래가 1000건을 넘어도 이름이 빠지지 않게.
// 기존 호출부의 `{ data }` 형태를 그대로 쓰도록 감싸서 돌려준다.
export function fetchAllRawClientNames(supabase: Awaited<ReturnType<typeof createClient>>) {
  return fetchAllRows<{ client_name_raw: string | null }>((from, to) =>
    supabase
      .from("transactions")
      .select("client_name_raw")
      .not("client_name_raw", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  ).then((data) => ({ data }));
}
