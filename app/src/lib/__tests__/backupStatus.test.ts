import { test } from "node:test";
import assert from "node:assert/strict";
import { backupStatus, type BackupRecord } from "@/lib/backupStatus";

// 가짜 백업 기록(실제 자료 아님). 시각은 UTC로 저장됨 — 일요일 오전 6시(한국) = 토요일 21:00 UTC.
const auto = (iso: string, row_counts?: Record<string, number> | null): BackupRecord => ({ backup_type: "auto", created_at: iso, row_counts });
const manual = (iso: string, row_counts?: Record<string, number> | null): BackupRecord => ({ backup_type: "manual", created_at: iso, row_counts });

test("백업 상태: 마지막 자동 백업 후 지난 날은 한국 날짜로 세고, 8일까지는 정상·9일부터 멈춤", () => {
  const sunday = auto("2026-10-17T21:00:00Z"); // 한국 10/18(일) 06:00
  // 한국 10/26(월) 08:59 = UTC 10/25 23:59 — UTC 날짜로 세면 7일이지만 한국 날짜로는 8일
  const mon = backupStatus([sunday], "2026-10-25T23:59:00Z");
  assert.equal(mon.daysSinceAuto, 8);
  assert.equal(mon.autoStale, false);
  const tue = backupStatus([sunday], "2026-10-26T15:00:00Z"); // 한국 10/27(화) 00:00
  assert.equal(tue.daysSinceAuto, 9);
  assert.equal(tue.autoStale, true);
});

test("백업 상태: 수동 백업은 자동 백업 멈춤을 가리지 않고, 가장 최근 백업(수동 포함)으로 거래 수·방식을 봄", () => {
  const s = backupStatus(
    [auto("2026-10-03T21:00:00Z", null), manual("2026-10-27T02:00:00Z", { transactions: 2345, clients: 10 })],
    "2026-10-28T03:00:00Z"
  );
  assert.equal(s.latest?.backup_type, "manual");
  assert.equal(s.lastAutoAt, "2026-10-03T21:00:00Z");
  assert.equal(s.autoStale, true);
  assert.equal(s.latestComplete, true);
  assert.equal(s.latestTransactionCount, 2345);
});

test("백업 상태: 예전 방식(줄 수 없음)·줄 수 칸 없음(SQL 실행 전)·백업 없음", () => {
  const old = backupStatus([auto("2026-10-24T21:00:00Z", null)], "2026-10-28T03:00:00Z");
  assert.equal(old.latestComplete, false);
  assert.equal(old.latestTransactionCount, null);
  assert.equal(old.autoStale, false);

  const noColumn = backupStatus([auto("2026-10-24T21:00:00Z")], "2026-10-28T03:00:00Z");
  assert.equal(noColumn.latestComplete, null);

  const none = backupStatus([], "2026-10-28T03:00:00Z");
  assert.equal(none.latest, null);
  assert.equal(none.daysSinceAuto, null);
  assert.equal(none.autoStale, true);
  assert.equal(none.latestComplete, null);
});
