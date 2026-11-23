// 연결이 끊겨도 같은 등록이 두 번 들어가지 않게(11/23 사용자 "여러 날짜 등록·고정지출 등록 때 저장을 두 번 누르거나, 인터넷 연결이
// 끊겼다는 안내가 나와요") — 휴대폰에서 입력을 오래 한 뒤 저장하면 저장 요청이 끊긴 연결로 나가 실패하거나, 서버는 저장했는데 응답만
// 못 받아 화면이 실패로 아는 일이 있음. 그때 다시 누르면 같은 거래가 또 들어갔음.
// 화면이 새 줄의 id를 정해 보내고(같은 내용이면 다시 눌러도 같은 id — createNewIdKeeper), 서버는 그 id로 넣되 이미 있으면 앞서 보낸
// 같은 요청이 저장한 것으로 보고 다시 넣지 않음(insertOnce). 그래서 GlobalPendingProvider의 run(fn, { retry: true })로 연결 끊김을
// 자동으로 다시 시도해도 안전함(공사 작업 순서표가 쓰던 "화면에서 미리 만든 id"와 같은 생각). DB 구조는 그대로 — id 칸은 원래 uuid라
// DB가 정하던 것을 화면이 정해 보낼 뿐. 화면 쪽·서버 쪽이 같이 쓰므로 서버 전용 모듈은 부르지 않음. 검사: idempotentSave.test.ts

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 폼으로 보내는 새 id 칸 이름(거래처 칸 client_id·수정할 거래 id와 헷갈리지 않게 따로). */
export const NEW_ID_FIELD = "new_id";

export const PARTLY_SAVED_MESSAGE =
  "앞서 누른 저장으로 이미 들어간 줄이 있어 다시 넣지 않았습니다. 목록에서 확인해 주세요.";

/** 새 UUID — crypto.randomUUID가 없는 오래된 브라우저는 같은 모양(v4)으로 직접. */
export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 화면이 보낸 새 id — 모두 UUID 모양이고 서로 다를 때만 그대로, 하나라도 아니면 null(그때는 예전처럼 DB가 id를 정함). */
export function validNewIds(ids: readonly unknown[]): string[] | null {
  if (ids.length === 0) return null;
  const strings: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !UUID_RE.test(id)) return null;
    strings.push(id);
  }
  return new Set(strings).size === strings.length ? strings : null;
}

/** 폼 내용 비교용 글자 — 파일은 이름·크기만, 새 id 칸은 뺌. */
export function formDataKey(fd: FormData): string {
  const entries: [string, string][] = [];
  fd.forEach((value, key) => {
    if (key === NEW_ID_FIELD) return;
    entries.push([key, typeof value === "string" ? value : `file:${value.name}:${value.size}`]);
  });
  return JSON.stringify(entries);
}

/**
 * 화면 쪽: 같은 내용이면 같은 id 목록(다시 눌러도·자동으로 다시 보내도 같은 줄로 저장), 내용이나 줄 수가 바뀌면 새 id 목록.
 * 저장이 끝나면 reset — 같은 내용을 일부러 한 번 더 등록할 땐 새 id로 들어가게.
 */
export function createNewIdKeeper(makeId: () => string = newUuid) {
  let last: { key: string; ids: string[] } | null = null;
  return {
    idsFor(content: unknown, count: number): string[] {
      const key = typeof content === "string" ? content : JSON.stringify(content);
      if (!last || last.key !== key || last.ids.length !== count) {
        last = { key, ids: Array.from({ length: count }, () => makeId()) };
      }
      return last.ids;
    },
    reset() {
      last = null;
    },
  };
}

type DbError = { message: string; code?: string } | null;

/**
 * 서버 쪽: 화면이 정한 id로 넣기(insert는 그 id를 넣은 줄로 부를 것). 고유 키 겹침(23505)으로 실패하면 보낸 id가 이미 있는지 세어 —
 * 모두 있으면 앞서 보낸 같은 요청이 저장한 것이라 성공(alreadySaved), 일부만 있으면 안내, 하나도 없으면(다른 이유) 원래 오류.
 * ids가 없으면(예전 화면·엑셀 일괄 등록) 넣기 결과 그대로. 여러 줄 넣기는 한 번에(하나라도 실패하면 전부 안 들어감)라 보통 모두
 * 있거나 하나도 없음 — 일부만 있는 건 저장된 뒤 누가 몇 줄을 지운 경우.
 */
export async function insertOnce(
  ids: string[] | null,
  insert: () => PromiseLike<{ error: DbError }>,
  countSaved: (ids: string[]) => PromiseLike<number>
): Promise<{ error?: string; alreadySaved?: true }> {
  const { error } = await insert();
  if (!error) return {};
  if (!ids || error.code !== "23505") return { error: error.message };
  let saved: number;
  try {
    saved = await countSaved(ids);
  } catch {
    return { error: error.message };
  }
  if (saved >= ids.length) return { alreadySaved: true };
  if (saved > 0) return { error: PARTLY_SAVED_MESSAGE };
  return { error: error.message };
}
