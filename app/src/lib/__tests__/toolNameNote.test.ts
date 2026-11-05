import { test } from "node:test";
import assert from "node:assert/strict";
import { printToolName, splitToolNameNote, stripEmptyBrackets, withEmptyBracket } from "@/lib/toolNameNote";

// 가짜 자료만
test("이름칸 [ ]: 인쇄용은 괄호 밖, 화면 메모는 괄호 안", () => {
  assert.deepEqual(splitToolNameNote("스페너 [13·17·19mm]"), { printName: "스페너", notes: ["13·17·19mm"] });
  assert.deepEqual(splitToolNameNote("[예비] 그라인더"), { printName: "그라인더", notes: ["예비"] });
  assert.deepEqual(splitToolNameNote("스페너 [13] 세트 [ 대 ]"), { printName: "스페너 세트", notes: ["13", "대"] });
  assert.equal(printToolName("스페너 [13·17·19mm]"), "스페너");
});

test("괄호가 없거나 짝이 안 맞으면 그대로, 빈 괄호는 빼기만", () => {
  assert.deepEqual(splitToolNameNote("  드릴  "), { printName: "드릴", notes: [] });
  assert.deepEqual(splitToolNameNote("망치 [대"), { printName: "망치 [대", notes: [] });
  assert.deepEqual(splitToolNameNote("스페너 []"), { printName: "스페너", notes: [] });
  assert.deepEqual(splitToolNameNote(""), { printName: "", notes: [] });
  assert.deepEqual(splitToolNameNote(null), { printName: "", notes: [] });
  // 다른 괄호는 이름 그대로
  assert.equal(printToolName("용접기(인버터) 200A"), "용접기(인버터) 200A");
});

test("괄호만 있으면 괄호 기호만 빼서 인쇄(빈 줄 안 생기게), 겹친 괄호도 벗김", () => {
  assert.deepEqual(splitToolNameNote("[13mm]"), { printName: "13mm", notes: ["13mm"] });
  const nested = splitToolNameNote("가짜 공구 [크기 [대] 두 개] 끝");
  assert.equal(nested.printName, "가짜 공구 끝");
  assert.deepEqual([...nested.notes].sort(), ["대", "크기 두 개"].sort());
});

test("작성 화면 기본 [ ]: 괄호 없는 이름 끝에 빈 [ ], 저장 때 빈 [ ]는 지워 예전 이름 그대로", () => {
  assert.equal(withEmptyBracket("가짜 스페너"), "가짜 스페너 [ ]");
  assert.equal(withEmptyBracket("  가짜 드릴 "), "가짜 드릴 [ ]");
  assert.equal(withEmptyBracket("가짜 스페너 [13·17]"), "가짜 스페너 [13·17]");
  assert.equal(withEmptyBracket(""), "");
  assert.equal(withEmptyBracket(null), "");
  assert.equal(stripEmptyBrackets("가짜 스페너 [ ]"), "가짜 스페너");
  assert.equal(stripEmptyBrackets("가짜 스페너 []"), "가짜 스페너");
  assert.equal(stripEmptyBrackets("가짜 스페너[  ]"), "가짜 스페너");
  assert.equal(stripEmptyBrackets("[ ] 가짜 망치"), "가짜 망치");
  assert.equal(stripEmptyBrackets("가짜 스페너 [ ] 세트"), "가짜 스페너 세트");
  assert.equal(stripEmptyBrackets("가짜 스페너 [13·17]"), "가짜 스페너 [13·17]");
  assert.equal(stripEmptyBrackets("  가짜  드릴  "), "가짜  드릴");
  // 손대지 않으면 저장되는 이름은 예전과 같음
  for (const name of ["가짜 스페너", "가짜 망치(대)", "가짜 드릴 18V"]) assert.equal(stripEmptyBrackets(withEmptyBracket(name)), name);
});
