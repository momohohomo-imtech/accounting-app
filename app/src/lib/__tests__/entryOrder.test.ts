import { test } from "node:test";
import assert from "node:assert/strict";
import { compareEntry, compareDateThenEntry, newestFirst, entryTimestamps, orderedIds } from "@/lib/entryOrder";

// 가짜 자료만
const row = (id: string, trans_date: string, created_at: string | null) => ({ id, trans_date, created_at });

test("같은 날짜면 등록 시각 순, 시각이 같으면 id 순(늘 같은 순서)", () => {
  const a = row("b-id", "2026-11-05", "2026-11-05T01:00:00.000+00:00");
  const b = row("a-id", "2026-11-05", "2026-11-05T02:00:00.000+00:00");
  assert.ok(compareEntry(a, b) < 0, "먼저 등록한 것이 앞");
  const same1 = row("a-id", "2026-11-05", "2026-11-05T01:00:00+00:00");
  const same2 = row("b-id", "2026-11-05", "2026-11-05T01:00:00+00:00");
  assert.ok(compareEntry(same1, same2) < 0 && compareEntry(same2, same1) > 0);
  assert.equal(compareEntry(same1, same1), 0);
});

test("DB가 주는 마이크로초까지 비교(1/1000초가 같아도)", () => {
  const a = row("z", "2026-11-05", "2026-11-05T01:00:00.123+00:00");
  const b = row("a", "2026-11-05", "2026-11-05T01:00:00.123456+00:00");
  assert.ok(compareEntry(a, b) < 0);
  // 끝자리 0을 빼고 주는 형식(…:00+00:00 < …:00.5+00:00)
  assert.ok(compareEntry(row("z", "d", "2026-11-05T01:00:00+00:00"), row("a", "d", "2026-11-05T01:00:00.5+00:00")) < 0);
});

test("최신순: 날짜 최신이 위, 같은 날은 나중에 등록한 것이 위 — 오름차순은 같은 날 안도 거꾸로", () => {
  const rows = [
    row("1", "2026-11-04", "2026-11-04T00:00:00.000Z"),
    row("2", "2026-11-05", "2026-11-05T00:00:00.000Z"),
    row("3", "2026-11-05", "2026-11-05T03:00:00.000Z"),
    row("4", "2026-11-05", "2026-11-05T01:00:00.000Z"),
  ];
  assert.deepEqual([...rows].sort(newestFirst).map((r) => r.id), ["3", "4", "2", "1"]);
  assert.deepEqual([...rows].sort(compareDateThenEntry).map((r) => r.id), ["1", "2", "4", "3"]);
});

test("한 번에 저장하는 줄의 등록 시각: 1/1000초씩, 날짜가 줄어드는 표(최신이 위)는 거꾸로", () => {
  const base = Date.parse("2026-11-07T00:00:00.000Z");
  // 날짜가 늘어나는 표 → 적힌 순서대로
  assert.deepEqual(entryTimestamps(["2026-11-01", "2026-11-01", "2026-11-02"], base), [
    "2026-11-07T00:00:00.000Z",
    "2026-11-07T00:00:00.001Z",
    "2026-11-07T00:00:00.002Z",
  ]);
  // 날짜가 모두 같은 표(통장 여러 건·여러 줄 거래 등록) → 적힌 순서대로
  assert.deepEqual(entryTimestamps(["2026-11-03", "2026-11-03"], base), ["2026-11-07T00:00:00.000Z", "2026-11-07T00:00:00.001Z"]);
  // 날짜가 줄어드는 표 → 위 줄이 나중
  assert.deepEqual(entryTimestamps(["2026-11-02", "2026-11-02", "2026-11-01"], base), [
    "2026-11-07T00:00:00.002Z",
    "2026-11-07T00:00:00.001Z",
    "2026-11-07T00:00:00.000Z",
  ]);
  assert.deepEqual(entryTimestamps([], base), []);
});

test("저장한 시각으로 최신순을 보면: 날짜가 줄어드는 표는 표 순서 그대로, 늘어나는 표는 같은 날 안이 아래 줄부터", () => {
  const base = Date.parse("2026-11-07T00:00:00.000Z");
  const desc = [
    { id: "x1", trans_date: "2026-11-02" },
    { id: "x2", trans_date: "2026-11-02" },
    { id: "x3", trans_date: "2026-11-01" },
  ];
  const stampsDesc = entryTimestamps(desc.map((r) => r.trans_date), base);
  const savedDesc = desc.map((r, i) => ({ ...r, created_at: stampsDesc[i] }));
  assert.deepEqual([...savedDesc].reverse().sort(newestFirst).map((r) => r.id), ["x1", "x2", "x3"]);

  const asc = [
    { id: "y1", trans_date: "2026-11-01" },
    { id: "y2", trans_date: "2026-11-02" },
    { id: "y3", trans_date: "2026-11-02" },
  ];
  const stampsAsc = entryTimestamps(asc.map((r) => r.trans_date), base);
  const savedAsc = asc.map((r, i) => ({ ...r, created_at: stampsAsc[i] }));
  assert.deepEqual([...savedAsc].sort(newestFirst).map((r) => r.id), ["y3", "y2", "y1"]);
  // 오름차순으로 보면 표 순서 그대로
  assert.deepEqual([...savedAsc].reverse().sort(compareDateThenEntry).map((r) => r.id), ["y1", "y2", "y3"]);
});

test("넣은 순서대로 정렬되는 id: UUID 모양(v7), id로 정렬하면 넣은 순서", () => {
  let seed = 250;
  const fakeRandom = (n: number) => Uint8Array.from({ length: n }, () => (seed = (seed * 37 + 11) % 256));
  const base = Date.parse("2026-11-07T00:00:00.000Z");
  const ids = orderedIds(5, base, fakeRandom);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual([...ids].sort(), ids, "글자(=DB uuid 바이트) 순서 = 넣은 순서");
  assert.equal(new Set(ids).size, 5);
  // 4096줄이 넘어도 순서 유지(시각 칸이 1/1000초 올라감)
  const many = orderedIds(4100, base, fakeRandom);
  assert.deepEqual([...many].sort(), many);
  assert.equal(orderedIds(0, base).length, 0);
  // 기본 난수(crypto)로도 모양이 맞음
  assert.match(orderedIds(1, base)[0], /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
