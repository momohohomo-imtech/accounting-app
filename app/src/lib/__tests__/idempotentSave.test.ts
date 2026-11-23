import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEW_ID_FIELD,
  PARTLY_SAVED_MESSAGE,
  createNewIdKeeper,
  formDataKey,
  insertOnce,
  newUuid,
  validNewIds,
} from "@/lib/idempotentSave";

// 가짜 id·가짜 내용만
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("newUuid: UUID(v4) 모양, 부를 때마다 다름", () => {
  const ids = Array.from({ length: 50 }, () => newUuid());
  assert.ok(ids.every((id) => V4.test(id)));
  assert.equal(new Set(ids).size, 50);
});

test("validNewIds: 모두 UUID이고 서로 다를 때만 그대로, 아니면 null(그때는 DB가 id를 정함)", () => {
  assert.deepEqual(validNewIds([U1, U2]), [U1, U2]);
  assert.deepEqual(validNewIds([U1.toUpperCase()]), [U1.toUpperCase()]);
  assert.equal(validNewIds([]), null);
  assert.equal(validNewIds([U1, undefined]), null, "한 줄이라도 없으면(엑셀 일괄 등록 등) 예전처럼");
  assert.equal(validNewIds([null]), null, "폼에 new_id 칸이 없음");
  assert.equal(validNewIds(["가짜"]), null);
  assert.equal(validNewIds([U1, U1]), null, "같은 id 두 번은 안 됨");
  assert.equal(validNewIds([123]), null);
});

test("같은 내용이면 같은 id(다시 눌러도·자동으로 다시 보내도 같은 줄), 내용·줄 수가 바뀌면 새 id", () => {
  let n = 0;
  const keeper = createNewIdKeeper(() => `id-${++n}`);
  const rows = [{ trans_date: "2026-11-03", amount: 12000 }, { trans_date: "2026-11-05", amount: 12000 }];
  const first = keeper.idsFor({ kind: "multiDate", rows }, 2);
  assert.deepEqual(first, ["id-1", "id-2"]);
  assert.deepEqual(keeper.idsFor({ kind: "multiDate", rows: rows.map((r) => ({ ...r })) }, 2), first, "내용이 같으면(새 객체여도) 그대로");

  const changed = keeper.idsFor({ kind: "multiDate", rows: [{ ...rows[0], amount: 13000 }, rows[1]] }, 2);
  assert.deepEqual(changed, ["id-3", "id-4"], "금액을 고치면 새 id");
  assert.deepEqual(keeper.idsFor({ kind: "multiDate", rows: [{ ...rows[0], amount: 13000 }, rows[1]] }, 2), changed);

  assert.deepEqual(keeper.idsFor("같은 글자", 1), ["id-5"]);
  assert.deepEqual(keeper.idsFor("같은 글자", 2), ["id-6", "id-7"], "줄 수가 바뀌면 새 id");

  keeper.reset();
  assert.deepEqual(keeper.idsFor("같은 글자", 2), ["id-8", "id-9"], "저장이 끝난 뒤(reset) 같은 내용을 또 등록하면 새 id");
});

test("formDataKey: 칸 이름·값 순서대로, new_id 칸은 빼고, 파일은 이름·크기만", () => {
  const a = new FormData();
  a.append("name", "가짜 항목");
  a.append("pay_day", "15");
  const b = new FormData();
  b.append("name", "가짜 항목");
  b.append("pay_day", "15");
  b.append(NEW_ID_FIELD, U1);
  assert.equal(formDataKey(a), formDataKey(b));
  assert.equal(formDataKey(a), JSON.stringify([["name", "가짜 항목"], ["pay_day", "15"]]));
  b.set("pay_day", "20");
  assert.notEqual(formDataKey(a), formDataKey(b));

  const f = new FormData();
  f.append("file", new Blob(["가짜"]), "가짜.txt");
  assert.match(formDataKey(f), /file:가짜\.txt:\d+/);
});

test("insertOnce: 넣기가 되면 끝, 다른 오류는 그대로(이미 있는지 세지 않음)", async () => {
  let counted = 0;
  const count = async () => {
    counted += 1;
    return 0;
  };
  assert.deepEqual(await insertOnce([U1], async () => ({ error: null }), count), {});
  assert.deepEqual(
    await insertOnce([U1], async () => ({ error: { message: "2025년은 잠긴 해", code: "P0001" } }), count),
    { error: "2025년은 잠긴 해" }
  );
  assert.deepEqual(
    await insertOnce(null, async () => ({ error: { message: "겹침", code: "23505" } }), count),
    { error: "겹침" },
    "화면이 id를 안 보냈으면(예전 화면) 겹침도 그대로 오류"
  );
  assert.equal(counted, 0);
});

test("insertOnce: id가 겹쳤는데(23505) 보낸 id가 모두 있으면 앞서 보낸 같은 요청이 저장한 것 → 성공", async () => {
  const asked: string[][] = [];
  const result = await insertOnce(
    [U1, U2],
    async () => ({ error: { message: 'duplicate key value violates unique constraint "transactions_pkey"', code: "23505" } }),
    async (ids) => {
      asked.push(ids);
      return 2;
    }
  );
  assert.deepEqual(result, { alreadySaved: true });
  assert.deepEqual(asked, [[U1, U2]]);
});

test("insertOnce: 일부만 있으면 안내, 하나도 없거나 셀 수 없으면 원래 오류", async () => {
  const dup = async () => ({ error: { message: "가짜 겹침", code: "23505" } });
  assert.deepEqual(await insertOnce([U1, U2], dup, async () => 1), { error: PARTLY_SAVED_MESSAGE });
  assert.deepEqual(await insertOnce([U1, U2], dup, async () => 0), { error: "가짜 겹침" });
  assert.deepEqual(
    await insertOnce([U1], dup, async () => {
      throw new Error("조회 실패");
    }),
    { error: "가짜 겹침" }
  );
});
