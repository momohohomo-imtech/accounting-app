import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_BACKUP_RUNNING_GRACE_MINUTES,
  describeAutoBackupRun,
  formatKstDateTime,
  nextAutoBackupAt,
  parseAutoBackupRun,
} from "@/lib/autoBackupStatus";

// 가짜 기록만
test("자동 백업 기록 읽기: 모양이 다르거나 깨진 글자는 없는 것으로", () => {
  assert.equal(parseAutoBackupRun(null), null);
  assert.equal(parseAutoBackupRun(""), null);
  assert.equal(parseAutoBackupRun("{깨짐"), null);
  assert.equal(parseAutoBackupRun('"글자"'), null);
  assert.equal(parseAutoBackupRun('{"ok":true}'), null); // 시작 시각 없음
  assert.deepEqual(parseAutoBackupRun('{"startedAt":"2026-11-07T21:00:00.000Z","finishedAt":null,"ok":null}'), {
    startedAt: "2026-11-07T21:00:00.000Z",
    finishedAt: null,
    ok: null,
    fileName: null,
    sizeMb: null,
    error: null,
    emailError: null,
    pruned: null,
    pruneError: null,
  });
  const ok = parseAutoBackupRun(
    JSON.stringify({ startedAt: "2026-11-07T21:00:00.000Z", finishedAt: "2026-11-07T21:00:09.000Z", ok: true, fileName: "backup-x.json.gz", sizeMb: 1.234, pruned: 2 })
  );
  assert.equal(ok?.ok, true);
  assert.equal(ok?.sizeMb, 1.234);
  assert.equal(ok?.pruned, 2);
});

test("자동 백업 기록 보여 주기: 성공·성공(메일·정리 문제)·실패·실행 중·끝나지 않음·기록 없음", () => {
  const start = "2026-11-07T21:00:00.000Z"; // 한국 11/8(일) 06:00
  assert.equal(formatKstDateTime(start), "2026-11-08(일) 06:00");
  const ok = describeAutoBackupRun({ startedAt: start, finishedAt: start, ok: true, fileName: "backup-x.json.gz", sizeMb: 1.234 }, start);
  assert.deepEqual(ok, { tone: "ok", title: "2026-11-08(일) 06:00 성공", detail: "파일 backup-x.json.gz(1.23MB)" });
  const mailFail = describeAutoBackupRun({ startedAt: start, finishedAt: start, ok: true, fileName: "f", emailError: "이메일 전송 실패 (403)" }, start);
  assert.equal(mailFail.tone, "warn");
  assert.match(mailFail.detail ?? "", /완료 메일 못 보냄: 이메일 전송 실패 \(403\)/);
  const fail = describeAutoBackupRun({ startedAt: start, finishedAt: start, ok: false, error: "백업 업로드 실패: 가짜" }, start);
  assert.deepEqual(fail, { tone: "fail", title: "2026-11-08(일) 06:00 실패", detail: "백업 업로드 실패: 가짜" });
  const minutesLater = (m: number) => new Date(Date.parse(start) + m * 60_000).toISOString();
  assert.equal(describeAutoBackupRun({ startedAt: start, finishedAt: null, ok: null }, minutesLater(1)).tone, "warn");
  const stuck = describeAutoBackupRun({ startedAt: start, finishedAt: null, ok: null }, minutesLater(AUTO_BACKUP_RUNNING_GRACE_MINUTES + 1));
  assert.equal(stuck.tone, "fail");
  assert.equal(stuck.title, "2026-11-08(일) 06:00 시작했지만 끝나지 않음");
  assert.equal(describeAutoBackupRun(null, start).tone, "none");
});

test("다음 자동 백업 = 지금 이후 첫 일요일 오전 6시(한국) — 토요일 21:00 UTC", () => {
  // 한국 11/3(화) 19:00 → 11/8(일) 06:00
  assert.equal(nextAutoBackupAt("2026-11-03T10:00:00.000Z"), "2026-11-07T21:00:00.000Z");
  // 한국 일요일 05:59(토 20:59 UTC) → 그날 06:00
  assert.equal(nextAutoBackupAt("2026-11-07T20:59:00.000Z"), "2026-11-07T21:00:00.000Z");
  // 정각이 지났으면 다음 주
  assert.equal(nextAutoBackupAt("2026-11-07T21:00:00.000Z"), "2026-11-14T21:00:00.000Z");
  // 한국 일요일 낮(UTC 일요일) → 다음 주 토요일 21:00 UTC
  assert.equal(nextAutoBackupAt("2026-11-08T03:00:00.000Z"), "2026-11-14T21:00:00.000Z");
  // 해·달을 넘겨도
  assert.equal(nextAutoBackupAt("2026-12-30T00:00:00.000Z"), "2027-01-02T21:00:00.000Z");
});
