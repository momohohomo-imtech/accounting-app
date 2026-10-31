// 브라우저 전용 — 인식용 파일(영수증·급여대장·엑셀)을 /api/... 로 보내는 공용 함수.
// 큰 사진은 줄여서 보내고(downscaleImages), 서버 한도를 넘는 파일은 보내기 전에 안내하고, 서버가 JSON이 아닌 오류
// (413 본문 너무 큼·504 시간 초과 등)를 돌려줘도 무슨 일인지 알 수 있는 문구로 바꿈 — 예전엔 전부 "오류가 발생했습니다"였음.
import { serverFileSizeError, serverRejectedSizeMessage } from "@/lib/fileUpload";
import { downscaleImageForUpload } from "@/lib/imageDownscale";

export type ApiFileResult = { json: Record<string, unknown> | null; error: string | null };

export async function postFileToApi(
  path: string,
  file: File,
  { downscaleImages = false }: { downscaleImages?: boolean } = {}
): Promise<ApiFileResult> {
  const toSend = downscaleImages ? await downscaleImageForUpload(file) : file;
  const sizeError = serverFileSizeError(toSend);
  if (sizeError) return { json: null, error: sizeError };

  const fd = new FormData();
  fd.append("file", toSend);
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", body: fd });
  } catch {
    return { json: null, error: "서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요." };
  }
  if (res.status === 413) return { json: null, error: serverRejectedSizeMessage(toSend) };

  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  if (json && typeof json.error === "string" && json.error) return { json, error: json.error };
  if (!res.ok || !json) {
    const reason = res.status === 504 ? "서버 응답 시간이 초과됐습니다" : `서버 오류(${res.status})`;
    return { json, error: `「${file.name}」을 처리하지 못했습니다: ${reason}. 잠시 뒤 다시 시도해 주세요.` };
  }
  return { json, error: null };
}
