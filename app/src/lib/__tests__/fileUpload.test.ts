import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SERVER_FILE_LIMIT_BYTES,
  attachmentExtension,
  attachmentStoragePath,
  isAttachmentStoragePath,
  isDownscalableImage,
  scaledSize,
  serverFileSizeError,
  serverRejectedSizeMessage,
  storageUploadErrorMessage,
} from "@/lib/fileUpload";

// 가짜 값만 씀(실제 파일·프로젝트 아님)
const PROJECT = "11111111-2222-4333-8444-555555555555";
const RANDOM = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("사진 줄이기: 긴 변만 맞추고 비율 유지, 이미 작으면 그대로", () => {
  assert.deepEqual(scaledSize(6000, 4000, 3000), { width: 3000, height: 2000 });
  assert.deepEqual(scaledSize(3024, 4032, 3000), { width: 2250, height: 3000 });
  assert.deepEqual(scaledSize(1200, 900, 3000), { width: 1200, height: 900 });
  assert.deepEqual(scaledSize(3000, 10, 3000), { width: 3000, height: 10 });
  assert.deepEqual(scaledSize(90000, 1, 3000), { width: 3000, height: 1 });
});

test("사진 줄이기 대상: 사진만(GIF·SVG·PDF는 그대로)", () => {
  assert.equal(isDownscalableImage("image/jpeg"), true);
  assert.equal(isDownscalableImage("image/png"), true);
  assert.equal(isDownscalableImage("image/heic"), true);
  assert.equal(isDownscalableImage("image/gif"), false);
  assert.equal(isDownscalableImage("image/svg+xml"), false);
  assert.equal(isDownscalableImage("application/pdf"), false);
  assert.equal(isDownscalableImage(""), false);
});

test("서버 한도: 4.2MB까지는 보내고, 넘으면 파일 종류에 맞는 안내", () => {
  assert.equal(serverFileSizeError({ name: "a.jpg", type: "image/jpeg", size: SERVER_FILE_LIMIT_BYTES }), null);
  const pdf = serverFileSizeError({ name: "가짜.pdf", type: "application/pdf", size: 6_300_000 });
  assert.match(pdf ?? "", /가짜\.pdf.*6\.3MB.*최대 4\.2MB.*필요한 쪽만/);
  const excel = serverFileSizeError({ name: "가짜.xlsx", type: "", size: 5_000_000 });
  assert.match(excel ?? "", /시트·행만/);
  const photo = serverFileSizeError({ name: "가짜.heic", type: "image/heic", size: 9_000_000 });
  assert.match(photo ?? "", /사진을 줄이지 못했습니다/);
  // 413을 받으면(보내기 전 확인을 통과했어도) 이름·크기와 함께 안내
  assert.match(serverRejectedSizeMessage({ name: "b.pdf", type: "application/pdf", size: 4_100_000 }), /「b\.pdf」\(4\.1MB\).*거절.*필요한 쪽만/);
});

test("첨부 저장소 경로: 확장자는 영문·숫자만, 프로젝트 폴더 또는 unassigned", () => {
  assert.equal(attachmentExtension("도면.PDF"), ".pdf");
  assert.equal(attachmentExtension("사진.한글"), "");
  assert.equal(attachmentExtension("확장자없음"), "");
  assert.equal(attachmentExtension("a.tar.gz"), ".gz");
  assert.equal(attachmentExtension("이상한.확장자를길게12345678901"), "");
  assert.equal(attachmentStoragePath(PROJECT, "현장.JPG", 1761900000000, RANDOM), `${PROJECT}/1761900000000-${RANDOM}.jpg`);
  assert.equal(attachmentStoragePath(null, "메모.txt", 1, RANDOM), `unassigned/1-${RANDOM}.txt`);
});

test("첨부 기록 경로 확인: 이 앱이 만든 모양 + 그 프로젝트 폴더만", () => {
  const ok = attachmentStoragePath(PROJECT, "a.png", 1761900000000, RANDOM);
  assert.equal(isAttachmentStoragePath(ok, PROJECT), true);
  assert.equal(isAttachmentStoragePath(ok, null), false); // 다른 폴더
  assert.equal(isAttachmentStoragePath(attachmentStoragePath(null, "a.png", 5, RANDOM), null), true);
  assert.equal(isAttachmentStoragePath(`${PROJECT}/../other/1-${RANDOM}.png`, PROJECT), false);
  assert.equal(isAttachmentStoragePath(`${PROJECT}/1-${RANDOM}.png/extra`, PROJECT), false);
  assert.equal(isAttachmentStoragePath(`${PROJECT}/아무이름.png`, PROJECT), false);
});

test("저장소 올리기 실패 문구: 한 파일 크기 한도는 알아볼 수 있게", () => {
  assert.match(storageUploadErrorMessage("The object exceeded the maximum allowed size", 60_000_000), /60\.0MB.*한 파일 크기 한도/);
  assert.match(storageUploadErrorMessage("Payload too large", 1), /한도/);
  assert.equal(storageUploadErrorMessage("new row violates row-level security policy", 1), "파일을 올리지 못했습니다: new row violates row-level security policy");
});
