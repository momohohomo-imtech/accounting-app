import { test } from "node:test";
import assert from "node:assert/strict";
import { backupsToPrune, type RetentionRecord } from "@/lib/backupRetention";

// 가짜 백업 기록(실제 자료 아님) — 매주 일요일 오전 6시(한국) = 토요일 21:00 UTC 자동 백업
const NOW = "2026-10-31T12:00:00Z";
function weeklyAutos(weeks: number): RetentionRecord[] {
  const last = Date.parse("2026-10-24T21:00:00Z");
  return Array.from({ length: weeks }, (_, i) => {
    const iso = new Date(last - i * 7 * 86_400_000).toISOString();
    return { id: `a${i}`, backup_type: "auto", created_at: iso, file_name: `backup-${iso}.json` };
  });
}
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);

test("자동 백업 정리: 8주는 전부, 그 전 1년은 달마다 첫 백업만, 1년 넘은 것은 지움", () => {
  const records = weeklyAutos(80); // 1년 반 치
  const pruned = new Set(backupsToPrune(records, NOW).map((r) => r.id));
  const kept = records.filter((r) => !pruned.has(r.id));
  const ageDays = (r: RetentionRecord) => (Date.parse(NOW) - Date.parse(r.created_at)) / 86_400_000;
  // 최근 8주(56일 안)는 전부
  for (const r of records.filter((r) => ageDays(r) <= 56)) assert.ok(!pruned.has(r.id), `${r.created_at} 남김`);
  // 1년 넘은 것은 전부 지움
  for (const r of records.filter((r) => ageDays(r) > 365)) assert.ok(pruned.has(r.id), `${r.created_at} 지움`);
  // 8주~1년: 한국 날짜로 달마다 정확히 1개, 그 달의 가장 이른 것
  const middle = records.filter((r) => ageDays(r) > 56 && ageDays(r) <= 365);
  const byMonth = new Map<string, RetentionRecord[]>();
  for (const r of middle) byMonth.set(kstDay(r.created_at).slice(0, 7), [...(byMonth.get(kstDay(r.created_at).slice(0, 7)) ?? []), r]);
  for (const [month, list] of byMonth) {
    const keptInMonth = list.filter((r) => !pruned.has(r.id));
    assert.equal(keptInMonth.length, 1, `${month} 1개`);
    const earliest = list.reduce((a, b) => (Date.parse(a.created_at) < Date.parse(b.created_at) ? a : b));
    assert.equal(keptInMonth[0].id, earliest.id, `${month} 첫 백업`);
  }
  assert.ok(kept.length >= 8 + 9 && kept.length <= 8 + 11, `남는 개수 ${kept.length}`);
});

test("자동 백업 정리: 직접 만든 백업(지금 백업·복원 직전)은 오래돼도 안 지움", () => {
  const manual: RetentionRecord = { id: "m1", backup_type: "manual", created_at: "2023-01-01T00:00:00Z", file_name: "backup-old.json" };
  const pruned = backupsToPrune([manual, ...weeklyAutos(70)], NOW);
  assert.ok(!pruned.some((r) => r.id === "m1"));
  assert.ok(pruned.every((r) => r.backup_type === "auto"));
});

test("자동 백업 정리: 크론이 오래 멈췄다 돌아와도 최근 자동 백업 8개는 남김", () => {
  // 마지막 자동 백업이 2년 전에 멈춤 → 날짜로는 전부 1년이 넘었지만 최근 8개는 남김
  const old = weeklyAutos(20).map((r) => ({ ...r, created_at: new Date(Date.parse(r.created_at) - 730 * 86_400_000).toISOString() }));
  const pruned = new Set(backupsToPrune(old, NOW).map((r) => r.id));
  assert.equal(old.length - pruned.size, 8);
  for (let i = 0; i < 8; i++) assert.ok(!pruned.has(`a${i}`));
});

test("자동 백업 정리: 한국 날짜로 달을 나눔(1일 오전 6시 백업은 UTC로는 전달 말일)", () => {
  // 한국 2026-03-01 06:00 = UTC 2026-02-28 21:00 → 3월 첫 백업
  const records: RetentionRecord[] = [
    { id: "feb", backup_type: "auto", created_at: "2026-02-21T21:00:00Z", file_name: "f" },
    { id: "mar1", backup_type: "auto", created_at: "2026-02-28T21:00:00Z", file_name: "m1" },
    { id: "mar2", backup_type: "auto", created_at: "2026-03-07T21:00:00Z", file_name: "m2" },
    ...weeklyAutos(8),
  ];
  const pruned = backupsToPrune(records, NOW).map((r) => r.id);
  assert.deepEqual(pruned, ["mar2"]);
});

test("자동 백업 정리: 지울 것이 없으면 빈 목록, 날짜가 이상한 기록은 건드리지 않음", () => {
  assert.deepEqual(backupsToPrune(weeklyAutos(5), NOW), []);
  const broken: RetentionRecord = { id: "x", backup_type: "auto", created_at: "not-a-date", file_name: "x" };
  assert.deepEqual(backupsToPrune([broken, ...weeklyAutos(3)], NOW), []);
});
