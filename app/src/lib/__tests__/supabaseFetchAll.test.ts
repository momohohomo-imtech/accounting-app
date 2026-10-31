import { test } from "node:test";
import assert from "node:assert/strict";
import { IN_CHUNK, fetchAllRowsIn, rawClientNameSince } from "@/lib/supabaseFetchAll";

// 가짜 조회(실제 자료 아님) — 목록 조각마다 그 값의 줄을 돌려주고, 1,000줄씩 나눠 줌
test("ID 목록 나눠 조회: 100개씩 나눠 합치고, 같은 값은 한 번만, 조각마다 1,000줄 넘어도 끝까지", async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `p${i}`);
  const chunks: string[][] = [];
  const rows = await fetchAllRowsIn<{ project_id: string; n: number }>([...ids, "p0", "p1"], (chunk, from, to) => {
    if (from === 0) chunks.push(chunk);
    // 첫 조각의 p0에는 줄이 1,500개 — 1,000줄 제한을 넘어도 다음 쪽까지
    const all = chunk.flatMap((id) => Array.from({ length: id === "p0" ? 1500 : 1 }, (_, n) => ({ project_id: id, n })));
    return Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + 1000)), error: null });
  });
  assert.deepEqual(chunks.map((c) => c.length), [IN_CHUNK, IN_CHUNK, 50]);
  assert.equal(new Set(chunks.flat()).size, 250);
  assert.equal(rows.length, 1500 + 249);
  assert.deepEqual(await fetchAllRowsIn([], () => Promise.resolve({ data: [], error: null })), []);
});

test("ID 목록 나눠 조회: 한 조각이라도 오류면 오류로", async () => {
  await assert.rejects(
    () => fetchAllRowsIn(["a", "b"], () => Promise.resolve({ data: null, error: { message: "가짜 오류" } })),
    /가짜 오류/
  );
});

test("ID 목록 나눠 조회: 한글 이름처럼 긴 값은 조각 크기를 줄여서", async () => {
  const names = Array.from({ length: 70 }, (_, i) => `가짜 거래처 ${i}`);
  const sizes: number[] = [];
  await fetchAllRowsIn(
    names,
    (chunk) => {
      sizes.push(chunk.length);
      return Promise.resolve({ data: [], error: null });
    },
    30
  );
  assert.deepEqual(sizes, [30, 30, 10]);
});

test("직접 입력 거래처명 자동완성: 최근 3년(3년 전 그 달 1일부터), 2월 29일에도 있는 날짜", () => {
  assert.equal(rawClientNameSince({ year: 2026, month: 10 }), "2023-10-01");
  assert.equal(rawClientNameSince({ year: 2028, month: 2 }), "2025-02-01");
  assert.equal(rawClientNameSince({ year: 2027, month: 1 }), "2024-01-01");
});
