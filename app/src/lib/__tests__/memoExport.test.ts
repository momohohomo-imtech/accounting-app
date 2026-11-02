import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunkForRows,
  constructionMemoFields,
  constructionMemoFileName,
  kstDate,
  knowHowFields,
  knowHowFileName,
  memoFileName,
  safeFileNamePart,
  wrappedLineCount,
} from "@/lib/memoExport";

test("메모 엑셀: 줄 수 — 한글은 2칸, 빈 줄도 한 줄", () => {
  assert.equal(wrappedLineCount("abcd", 4), 1);
  assert.equal(wrappedLineCount("abcde", 4), 2);
  assert.equal(wrappedLineCount("가나", 4), 1);
  assert.equal(wrappedLineCount("가나다", 4), 2);
  assert.equal(wrappedLineCount("첫 줄\n\n셋째 줄", 70), 3);
  assert.equal(wrappedLineCount("", 70), 1);
});

test("메모 엑셀: 긴 내용은 행 여러 개로 — 문단 단위로 모으고, 빠지는 글자 없음", () => {
  const paragraphs = Array.from({ length: 12 }, (_, i) => `가짜 공사 내용 ${i + 1}번째 줄`);
  const text = paragraphs.join("\n");
  const chunks = chunkForRows(text, 70, 5);
  assert.ok(chunks.length >= 3);
  for (const c of chunks) assert.ok(wrappedLineCount(c, 70) <= 5);
  assert.equal(chunks.join("\n"), text);
  assert.deepEqual(chunkForRows("짧은 메모", 70, 25), ["짧은 메모"]);
  assert.deepEqual(chunkForRows("", 70, 25), [""]);
});

test("메모 엑셀: 한 문단이 한 행보다 길면 글자로 자르고 이어 붙이면 그대로", () => {
  const long = "가".repeat(400); // 800칸 = 폭 10 × 80줄
  const chunks = chunkForRows(`${long}\n끝`, 10, 25);
  for (const c of chunks) assert.ok(wrappedLineCount(c, 10) <= 25, c.length.toString());
  const rejoined = chunks.join("\n").replace(/\n(?=가)/g, "");
  assert.equal(rejoined, `${long}\n끝`);
});

test("메모 엑셀: 파일 이름 — 못 쓰는 글자 빼고, 빈 조각은 건너뜀", () => {
  assert.equal(safeFileNamePart(' 가짜/현장:*"A" '), "가짜 현장 A");
  assert.equal(safeFileNamePart("가".repeat(50), 40), "가".repeat(40));
  assert.equal(memoFileName(["공사메모", "2026-10-10", "", null, "가짜 프로젝트"]), "공사메모_2026-10-10_가짜 프로젝트.xlsx");
  assert.equal(memoFileName([]), "메모.xlsx");
});

test("메모 엑셀: 날짜는 한국 시각(오전 9시 전에 쓴 메모가 전날로 안 보이게)", () => {
  assert.equal(kstDate("2026-10-09T16:30:00Z"), "2026-10-10");
  assert.equal(kstDate(null), "");
});

test("메모 엑셀: 공사 메모 항목 — 고쳤을 때만 수정 시각", () => {
  const memo = {
    created_at: "2026-10-09T23:00:00Z",
    updated_at: "2026-10-09T23:00:00Z",
    site_name: "가짜 현장",
    project_name: "가짜 프로젝트",
    content: "가짜 내용\n둘째 줄",
  };
  assert.deepEqual(constructionMemoFields(memo), [
    ["작성", "2026-10-10 08:00"],
    ["현장", "가짜 현장"],
    ["프로젝트", "가짜 프로젝트"],
    ["내용", "가짜 내용\n둘째 줄"],
  ]);
  const edited = constructionMemoFields({ ...memo, updated_at: "2026-10-12T01:00:00Z" });
  assert.deepEqual(edited[1], ["수정", "2026-10-12 10:00"]);
  assert.equal(constructionMemoFileName(memo), "공사메모_2026-10-10_가짜 현장_가짜 프로젝트.xlsx");
});

test("메모 엑셀: 품질관리 노하우 항목·파일 이름", () => {
  const note = { title: "가짜 점검 요령", created_at: "2026-10-01T03:00:00Z", content: null, memo: "가짜 메모" };
  assert.deepEqual(knowHowFields(note), [
    ["제목", "가짜 점검 요령"],
    ["작성", "2026-10-01 12:00"],
    ["내용", ""],
    ["메모", "가짜 메모"],
  ]);
  assert.equal(knowHowFileName("품질관리 노하우", note), "품질관리노하우_2026-10-01_가짜 점검 요령.xlsx");
});
