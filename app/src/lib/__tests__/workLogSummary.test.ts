import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSiteAggregate, buildWorkLogSummary, resolveWorkLogTitles } from "@/lib/workLogSummary";
import type { WorkLog } from "@/lib/types";

const SITES = [
  { id: "A", name: "가현장", color: null },
  { id: "B", name: "나현장", color: null },
];
const PROJECT_NAMES: Record<string, string> = { P1: "1번 납품", P2: "2번 설치", P3: "3번 보수" };

let seq = 0;
function log(log_date: string, site_id: string | null, project_id: string | null, title = "", sort_order = 0): WorkLog {
  seq += 1;
  return {
    id: `w${seq}`,
    log_date,
    site_id,
    project_id,
    title,
    workers: null,
    start_time: null,
    end_time: null,
    content: null,
    color: null,
    sort_order,
    created_at: "",
    ...(project_id ? { projects: { name: PROJECT_NAMES[project_id] } as WorkLog["projects"] } : {}),
  };
}

function summary(rows: WorkLog[], range?: { from: string; to: string }) {
  return buildWorkLogSummary(rows, SITES, range)
    .filter((r) => !r.isSpecial)
    .map((r) => `${r.siteName}|${r.title}|${r.days}`);
}

test("내용이 빈 줄은 다른 프로젝트 줄의 내용을 이어받지 않고 자기 프로젝트 이름으로 셈", () => {
  const rows = [
    log("2026-09-14", "A", "P1", "가 / 1번 납품 작업"),
    ...["16", "17", "18", "21", "22", "23", "24", "27", "30"].map((d) => log(`2026-09-${d}`, "A", "P2")),
  ];
  // 예전: "가 / 1번 납품 작업" 10일
  assert.deepEqual(summary(rows), ["가현장|2번 설치|9", "가현장|가 / 1번 납품 작업|1"]);
});

test("같은 현장·같은 프로젝트에서는 앞에서 적은 내용을 이어받음", () => {
  const rows = [log("2026-09-01", "A", "P1", "배관"), log("2026-09-02", "A", "P1"), log("2026-09-03", "A", "P1")];
  assert.deepEqual(summary(rows), ["가현장|배관|3"]);
  assert.deepEqual(
    resolveWorkLogTitles(rows).map((r) => r.source),
    ["explicit", "inherited", "inherited"]
  );
});

test("프로젝트를 안 고른 줄은 예전처럼 그 현장의 마지막 내용을 이어받음", () => {
  const rows = [
    log("2026-09-01", "A", null, "도장"),
    log("2026-09-02", "A", null),
    log("2026-09-03", "A", "P3", "보수"),
    log("2026-09-04", "A", null),
  ];
  assert.deepEqual(summary(rows), ["가현장|도장|2", "가현장|보수|2"]);
});

test("휴무·사내·기타는 따로 세고, 이어받을 내용으로 쓰지 않음", () => {
  const rows = [
    log("2026-09-01", "A", null, "도장"),
    log("2026-09-02", "A", null, "휴무"),
    log("2026-09-03", "A", null),
    log("2026-09-03", null, null, "사내"),
  ];
  const all = buildWorkLogSummary(rows, SITES);
  assert.deepEqual(
    all.map((r) => `${r.title}|${r.days}`),
    ["도장|2", "휴무|1", "사내|1", "기타|0"]
  );
});

test("기간 집계: 앞 달에 적은 내용을 이어받되, 세는 건 기간 안의 날짜만", () => {
  const rows = [
    log("2026-08-28", "A", "P1", "레일 교체"),
    log("2026-08-31", "A", "P1"),
    log("2026-09-01", "A", "P1"),
    log("2026-09-02", "A", "P1"),
    log("2026-09-02", "B", "P2"),
  ];
  assert.deepEqual(summary(rows, { from: "2026-09-01", to: "2026-09-30" }), [
    "가현장|레일 교체|2",
    "나현장|2번 설치|1",
  ]);
  assert.deepEqual(
    buildSiteAggregate(rows, SITES, { from: "2026-09-01", to: "2026-09-30" }).map(
      (r) => `${r.siteName}|${r.jobTypeCount}종|${r.dayCount}일`
    ),
    ["가현장|1종|2일", "나현장|1종|1일"]
  );
});

test("같은 날 여러 줄은 입력 순서대로 — 앞 줄에서 적은 내용을 같은 날 뒷줄이 이어받음", () => {
  const rows = [log("2026-09-05", "A", "P1", "", 1), log("2026-09-05", "A", "P1", "용접", 0)];
  assert.deepEqual(summary(rows), ["가현장|용접|1"]);
  assert.deepEqual(
    resolveWorkLogTitles(rows).map((r) => `${r.row.sort_order}:${r.title}:${r.source}`),
    ["0:용접:explicit", "1:용접:inherited"]
  );
});

test("프로젝트 이름을 모르면(조회 안 됨) 예전처럼 현장 기준으로 이어받음", () => {
  const rows = [log("2026-09-01", "A", null, "도장"), { ...log("2026-09-02", "A", "P9"), projects: undefined }];
  assert.deepEqual(summary(rows), ["가현장|도장|2"]);
});
