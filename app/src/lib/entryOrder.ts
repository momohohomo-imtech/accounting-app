// 같은 날짜 안의 순서 = 등록 순서(사용자 요청 11/7 "목록 순서"·"순번" — 매입매출장·은행 거래·외상관리).
// - 목록: 날짜가 같으면 등록 시각(created_at), 그것도 같으면 id. 날짜 정렬과 같은 방향(최신순이면 나중에 등록한 것이 위).
//   예전엔 같은 날짜 안이 내부 번호(무작위 id) 순이라 방금 넣은 거래가 그 날짜 줄들 가운데에 끼어 보였음.
// - 한 번에 여러 줄 저장(엑셀 일괄 등록·여러 줄 거래 등록·통장 여러 건)은 DB가 한 요청 안의 줄에 같은 시각(now())을 넣어서
//   줄 순서가 남지 않았음 → 저장할 때 줄마다 1/1000초씩 다른 등록 시각을 넣어 순서를 남김(`entryTimestamps`, DB 변경 없음).
// 검사: entryOrder.test.ts

export type EntryOrdered = { id: string; created_at?: string | null };

/** 등록 순서 비교(먼저 등록한 것이 앞). 시각이 같거나 없으면 id로 — 늘 같은 순서가 되게. */
export function compareEntry(a: EntryOrdered, b: EntryOrdered): number {
  const sa = a.created_at ?? "";
  const sb = b.created_at ?? "";
  const ta = Date.parse(sa);
  const tb = Date.parse(sb);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
  // 같은 1/1000초면 그 아래(DB는 마이크로초까지 줌) — 같은 형식이라 글자 비교로 충분
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 날짜(YYYY-MM-DD) 오름차순, 같은 날짜면 등록 순서. 최신순은 결과의 부호를 뒤집어 씀(같은 날 안도 같이 뒤집힘). */
export function compareDateThenEntry<T extends EntryOrdered & { trans_date: string }>(a: T, b: T): number {
  if (a.trans_date !== b.trans_date) return a.trans_date < b.trans_date ? -1 : 1;
  return compareEntry(a, b);
}

/** 날짜 최신순 + 같은 날은 나중에 등록한 것이 위(목록 기본 순서). */
export function newestFirst<T extends EntryOrdered & { trans_date: string }>(a: T, b: T): number {
  return -compareDateThenEntry(a, b);
}

/**
 * 한 번에 저장하는 줄들의 등록 시각 — 줄마다 1/1000초씩 늘려서 순서를 남김. 날짜가 줄어드는 순서(최신이 위)로 적힌 표면
 * 위 줄이 나중 거래라 거꾸로 매김(그래야 같은 날 안에서도 위 줄 = 나중에 등록한 것으로 보여 표 순서 그대로 나옴).
 * 날짜가 늘어나는 표·날짜가 모두 같은 표는 적힌 순서대로(아래 줄이 나중).
 */
export function entryTimestamps(dates: string[], baseMs: number): string[] {
  let up = 0;
  let down = 0;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > dates[i - 1]) up++;
    else if (dates[i] < dates[i - 1]) down++;
  }
  const reverse = down > up;
  const n = dates.length;
  return dates.map((_, i) => new Date(baseMs + (reverse ? n - 1 - i : i)).toISOString());
}

/**
 * 넣은 순서대로 정렬되는 id(UUID v7 모양) — 앞 48비트가 1/1000초 시각, 그다음 12비트가 줄 번호라 id로 정렬하면 넣은 순서.
 * 등록 시각 칸이 없는 표(공구명세서 품목)의 줄 순서를 남길 때 씀 — 예전엔 무작위 id라 저장할 때마다(품목을 다 지우고 다시 넣음)
 * 임의 추가 품목 순서가 섞였음(11/7). 4096줄이 넘으면 시각을 1/1000초씩 올림.
 */
export function orderedIds(
  count: number,
  baseMs: number,
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))
): string[] {
  const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");
  return Array.from({ length: count }, (_, i) => {
    const time = hex(baseMs + Math.floor(i / 4096), 12);
    const seq = hex(i % 4096, 3);
    const rand = Array.from(randomBytes(8), (b) => hex(b, 2)).join("");
    const variant = (0x8 | (parseInt(rand[0], 16) & 0x3)).toString(16);
    return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${seq}-${variant}${rand.slice(1, 4)}-${rand.slice(4, 16)}`;
  });
}
