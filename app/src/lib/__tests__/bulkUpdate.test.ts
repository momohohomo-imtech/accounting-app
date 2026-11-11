import { test } from "node:test";
import assert from "node:assert/strict";
import { BULK_UPDATE_CHUNK, bulkUpdateMessage, chunkIds, updateInChunks } from "@/lib/bulkUpdate";

// 가짜 id만
const ids = (n: number, prefix = "t") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

test("나누기: 같은 id 한 번·빈 값 빼고·고른 순서 그대로 100개씩", () => {
  assert.equal(BULK_UPDATE_CHUNK, 100);
  assert.deepEqual(chunkIds(["a", "b", "a", "", "c"], 2), [["a", "b"], ["c"]]);
  const chunks = chunkIds(ids(250));
  assert.deepEqual(
    chunks.map((c) => c.length),
    [100, 100, 50]
  );
  assert.equal(chunks[2][0], "t200");
  assert.deepEqual(chunkIds([]), []);
});

test("안내 문구: 다 바뀌면 없음, 오류·일부만·하나도 안 바뀜", () => {
  assert.equal(bulkUpdateMessage(3, 3), null);
  assert.equal(bulkUpdateMessage(3, 0, "잠긴 해"), "잠긴 해");
  assert.equal(bulkUpdateMessage(250, 100, "잠긴 해"), "250건 중 100건만 바뀌었습니다 — 잠긴 해");
  assert.match(bulkUpdateMessage(3, 0) ?? "", /^바뀐 거래가 없습니다/);
  assert.match(bulkUpdateMessage(3, 2) ?? "", /^3건 중 2건만 바뀌었습니다/);
});

test("나눠 바꾸기: 조각마다 한 번씩, 바뀐 줄을 셈", async () => {
  const calls: string[][] = [];
  const result = await updateInChunks(ids(250), async (chunk) => {
    calls.push(chunk);
    return { data: chunk.map((id) => ({ id })), error: null };
  });
  assert.deepEqual(result, { changed: 250 });
  assert.deepEqual(
    calls.map((c) => c.length),
    [100, 100, 50]
  );
});

test("나눠 바꾸기: 둘째 조각 오류면 거기서 멈추고 몇 건 바뀌었는지 같이", async () => {
  let n = 0;
  const result = await updateInChunks(ids(250), async (chunk) => {
    n += 1;
    if (n === 2) return { data: null, error: { message: "2025년은 잠긴 해" } };
    return { data: chunk.map((id) => ({ id })), error: null };
  });
  assert.equal(n, 2, "셋째 조각은 부르지 않음");
  assert.deepEqual(result, { changed: 100, error: "250건 중 100건만 바뀌었습니다 — 2025년은 잠긴 해" });
});

test("나눠 바꾸기: 권한이 없어 0줄·일부만 돌아오면 안내, 던진 오류도 안내", async () => {
  const none = await updateInChunks(ids(3), async () => ({ data: [], error: null }));
  assert.equal(none.changed, 0);
  assert.match(none.error ?? "", /^바뀐 거래가 없습니다/);

  const some = await updateInChunks(ids(3), async (chunk) => ({ data: chunk.slice(0, 2).map((id) => ({ id })), error: null }));
  assert.equal(some.changed, 2);
  assert.match(some.error ?? "", /^3건 중 2건만/);

  const thrown = await updateInChunks(ids(3), async () => {
    throw new Error("연결 끊김");
  });
  assert.deepEqual(thrown, { changed: 0, error: "연결 끊김" });

  const empty = await updateInChunks([], async () => ({ data: [], error: null }));
  assert.deepEqual(empty, { changed: 0, error: "선택된 거래가 없습니다." });
});
