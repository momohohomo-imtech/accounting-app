// 여러 거래를 한 번에 바꾸기(매입매출장·보고서 일괄 변경, 11/11) — 고른 id를 BULK_UPDATE_CHUNK개씩 나눠 바꾸고(.in 목록이 요청
// 주소에 그대로 들어가서 수백 개면 주소가 너무 길어 거절됨 — supabaseFetchAll의 IN_CHUNK와 같은 이유), 실제로 바뀐 줄 수를 세서
// 모자라면 안내. 예전엔 바뀐 줄을 세지 않아서 권한이 없거나(조회 전용 계정) 그새 지워진 거래가 있어도 다 바뀐 것처럼 보였음.
// 금액·날짜는 여기서 바꾸지 않음(부르는 쪽이 넘기는 칸만). 검사: bulkUpdate.test.ts
export const BULK_UPDATE_CHUNK = 100;

/** 같은 id는 한 번만, 고른 순서 그대로 size개씩 */
export function chunkIds(ids: string[], size = BULK_UPDATE_CHUNK): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size));
  return chunks;
}

/** 바꾼 결과 안내 — 다 바뀌었으면 null */
export function bulkUpdateMessage(requested: number, changed: number, error?: string | null): string | null {
  if (error) return changed > 0 ? `${requested}건 중 ${changed}건만 바뀌었습니다 — ${error}` : error;
  if (changed >= requested) return null;
  if (changed === 0) return "바뀐 거래가 없습니다 — 바꿀 권한이 없거나 그새 지워진 거래입니다(화면을 새로 고쳐 확인해 주세요).";
  return `${requested}건 중 ${changed}건만 바뀌었습니다 — 나머지는 바꿀 권한이 없거나 그새 지워진 거래입니다(화면을 새로 고쳐 확인해 주세요).`;
}

type ChunkResult = { data: { id: string }[] | null; error: { message: string } | null };

/**
 * 나눠서 차례로 바꿈 — 한 조각이 실패하면 거기서 멈추고(앞 조각은 이미 바뀜) 몇 건이 바뀌었는지 같이 알림.
 * runChunk는 update(...).in("id", chunk).select("id")처럼 바뀐 줄을 돌려주는 조회.
 */
export async function updateInChunks(
  ids: string[],
  runChunk: (chunk: string[]) => PromiseLike<ChunkResult>,
  size = BULK_UPDATE_CHUNK
): Promise<{ error?: string; changed: number }> {
  const chunks = chunkIds(ids, size);
  const requested = chunks.reduce((s, c) => s + c.length, 0);
  if (requested === 0) return { error: "선택된 거래가 없습니다.", changed: 0 };
  let changed = 0;
  for (const chunk of chunks) {
    let result: ChunkResult;
    try {
      result = await runChunk(chunk);
    } catch (err) {
      result = { data: null, error: { message: err instanceof Error ? err.message : "저장 중 오류가 났습니다." } };
    }
    if (result.error) {
      return { error: bulkUpdateMessage(requested, changed, result.error.message) ?? undefined, changed };
    }
    changed += result.data?.length ?? 0;
  }
  const message = bulkUpdateMessage(requested, changed);
  return message ? { error: message, changed } : { changed };
}
