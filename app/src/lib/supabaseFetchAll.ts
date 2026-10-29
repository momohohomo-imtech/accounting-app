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

// .in("칸", 목록)은 목록이 요청 주소(URL)에 그대로 들어가서, 프로젝트·외상 거래가 수백 개면 주소가 너무 길어 요청이 거절될 수
// 있음(화면이 안 열림) — 목록을 IN_CHUNK개씩 나눠 조회해 합침(같은 값은 한 번만). 나눈 조회마다 fetchAllRows로 끝까지 —
// 합친 순서는 조각 순서라, 순서가 필요하면 받은 뒤 정렬할 것.
export const IN_CHUNK = 100;

export async function fetchAllRowsIn<T>(
  values: string[],
  buildQuery: (
    chunk: string[],
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const unique = Array.from(new Set(values));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) chunks.push(unique.slice(i, i + IN_CHUNK));
  const parts = await Promise.all(chunks.map((chunk) => fetchAllRows<T>((from, to) => buildQuery(chunk, from, to))));
  return parts.flat();
}

// 해마다 늘어나는 목록(거래처·프로젝트·현장·메모)을 끝까지 — 선택칸·보고서가 1,000줄에서 조용히 잘리지 않게. 기존
// 호출부의 `{ data }` 모양 그대로 돌려줌. 이름순처럼 겹칠 수 있는 정렬이면 마지막에 id 정렬을 붙여 페이지가 겹치거나
// 빠지지 않게 할 것.
export function fetchAllData<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
) {
  return fetchAllRows<T>(buildQuery).then((data) => ({ data }));
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
