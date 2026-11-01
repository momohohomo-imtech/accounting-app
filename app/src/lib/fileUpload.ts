// 파일 올리기 공용 규칙(브라우저·서버 양쪽에서 씀 — 화면 요소 없이 계산만, 검사: fileUpload.test.ts).
//
// Vercel 서버 함수는 요청 본문이 4.5MB를 넘으면 앱 코드에 닿기도 전에 거절함(413 — next.config의 bodySizeLimit과
// 상관없음). 휴대폰 사진 한 장이 3~10MB라 예전엔 영수증 인식·첨부가 "오류가 발생했습니다"로만 실패했음. 그래서
//  - 인식(영수증·급여대장·엑셀)은 큰 사진을 브라우저에서 줄여서 보내고(lib/imageDownscale.ts), 그래도 크면 보내기 전에 안내
//  - 첨부파일은 서버를 거치지 않고 브라우저에서 저장소로 바로 올림(서명된 올리기 주소 — actions/attachments.ts)

/** 서버로 보내는 파일 한도 — 4.5MB에서 양식 머리글 몫을 빼고 여유를 둔 값. */
export const SERVER_FILE_LIMIT_BYTES = 4_200_000;

/** 인식용 사진의 긴 변(px) — 휴대폰 원본(4000~8000px)을 이 크기로 줄여도 영수증 작은 글씨가 읽힘. */
export const RECOGNITION_IMAGE_MAX_SIDE = 3000;
/** 이보다 작은 사진은 그대로 보냄(이미 작은 사진을 다시 압축해서 화질만 떨어뜨리지 않게). */
export const DOWNSCALE_ABOVE_BYTES = 1_500_000;

export function formatMb(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

/** 긴 변을 maxSide 이하로 — 가로세로 비율 유지, 이미 작으면 그대로. */
export function scaledSize(width: number, height: number, maxSide: number) {
  const longSide = Math.max(width, height);
  if (!(longSide > maxSide)) return { width, height };
  const ratio = maxSide / longSide;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** 브라우저에서 다시 그려 줄여 볼 사진인지(움직이는 GIF·SVG는 그대로). 열지 못하는 형식(크롬의 HEIC 등)은 줄이기에서 실패하면 원본. */
export function isDownscalableImage(type: string) {
  return /^image\//i.test(type) && !/^image\/(gif|svg\+xml)$/i.test(type);
}

function fileKind(file: { name: string; type: string }) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) return "excel";
  if (/^image\//i.test(file.type)) return "image";
  return "other";
}

function sizeHint(file: { name: string; type: string }) {
  switch (fileKind(file)) {
    case "pdf":
      return " 필요한 쪽만 따로 PDF로 저장하거나, 화면을 사진으로 찍어 올려 주세요.";
    case "excel":
      return " 필요한 시트·행만 남겨 다시 저장해서 올려 주세요.";
    case "image":
      return " 사진을 줄이지 못했습니다 — JPG로 저장하거나 휴대폰 카메라의 사진 크기를 줄여서 올려 주세요.";
    default:
      return "";
  }
}

type FileLike = { name: string; size: number; type: string };

/** 서버로 보내기엔 너무 큰 파일이면 안내 문구, 아니면 null. File은 펼치면({...file}) 이름·형식이 빠지므로 칸을 직접 넘길 것. */
export function serverFileSizeError(file: FileLike): string | null {
  if (file.size <= SERVER_FILE_LIMIT_BYTES) return null;
  return `「${file.name}」(${formatMb(file.size)})은 너무 커서 보낼 수 없습니다(최대 ${formatMb(SERVER_FILE_LIMIT_BYTES)}).${sizeHint(file)}`;
}

/** 서버가 413(본문 너무 큼)으로 거절했을 때 — 보내기 전 확인을 통과했는데도 거절된 경우. */
export function serverRejectedSizeMessage(file: FileLike) {
  return `「${file.name}」(${formatMb(file.size)})은 서버가 너무 크다고 거절했습니다(최대 약 ${formatMb(SERVER_FILE_LIMIT_BYTES)}).${sizeHint(file)}`;
}

// ── 첨부파일 저장소 경로 ──────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

/** 저장소 파일 이름의 확장자 — 영문·숫자만(저장소는 한글 등이 든 이름을 거절함. 원래 파일 이름은 표의 file_name에 그대로). */
export function attachmentExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = fileName.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? `.${ext}` : "";
}

/** "<프로젝트 ID 또는 unassigned>/<시각>-<무작위 ID><확장자>" — 예전 서버 업로드와 같은 모양. */
export function attachmentStoragePath(projectId: string | null, fileName: string, now: number, randomId: string) {
  return `${projectId ?? "unassigned"}/${now}-${randomId}${attachmentExtension(fileName)}`;
}

const ATTACHMENT_PATH_RE = /^([0-9a-f-]{36}|unassigned)\/\d{1,16}-[0-9a-f-]{36}(\.[a-z0-9]{1,10})?$/i;

/** 올리기를 마친 뒤 기록할 경로가 이 앱이 만든 모양이고 그 프로젝트 폴더인지(다른 폴더·다른 파일을 가리키지 못하게). */
export function isAttachmentStoragePath(path: string, projectId: string | null) {
  return ATTACHMENT_PATH_RE.test(path) && path.startsWith(`${projectId ?? "unassigned"}/`);
}

/** 저장소 올리기 실패 문구 — 한 파일 크기 한도를 넘으면 알아볼 수 있게. */
export function storageUploadErrorMessage(message: string, size: number) {
  if (/maximum allowed size|payload too large|entity too large|\b413\b/i.test(message)) {
    return `파일(${formatMb(size)})이 저장소의 한 파일 크기 한도를 넘었습니다(Supabase 무료 요금제 기준 50MB). 파일을 나누거나 줄여서 올려 주세요.`;
  }
  return `파일을 올리지 못했습니다: ${message}`;
}
