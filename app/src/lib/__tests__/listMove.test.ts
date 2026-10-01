import { test } from "node:test";
import assert from "node:assert/strict";
import { movedIndex, moveListItem } from "@/lib/listMove";

test("순번 옮기기: 뒤 항목을 앞으로, 앞 항목을 뒤로, 범위 밖은 맨 앞/맨 뒤", () => {
  const list = ["가", "나", "다", "라", "마"];
  assert.deepEqual(moveListItem(list, 3, 0), ["라", "가", "나", "다", "마"]);
  assert.deepEqual(moveListItem(list, 0, 2), ["나", "다", "가", "라", "마"]);
  assert.deepEqual(moveListItem(list, 1, 99), ["가", "다", "라", "마", "나"]);
  assert.deepEqual(moveListItem(list, 4, -3), ["마", "가", "나", "다", "라"]);
  assert.equal(moveListItem(list, 2, 2), list);
  assert.deepEqual(list, ["가", "나", "다", "라", "마"]); // 원본은 그대로
});

test("순번 옮긴 뒤 다른 항목의 새 자리(체크 표시가 따라감)", () => {
  const list = ["가", "나", "다", "라", "마"];
  for (const [from, to] of [
    [3, 0],
    [0, 2],
    [1, 99],
    [4, 1],
  ]) {
    const moved = moveListItem(list, from, to);
    list.forEach((item, i) => assert.equal(moved[movedIndex(i, from, to, list.length)], item, `${from}→${to}: ${item}`));
  }
});
