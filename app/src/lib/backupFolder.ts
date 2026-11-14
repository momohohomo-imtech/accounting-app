// 수동 백업 파일을 PC의 정한 폴더(예: E:\문서\…\back up)에 바로 저장(11/14 사용자 요청 "수동 백업 시 E:\문서\…\back up\로 바로
// 들어가게"). 웹 앱은 다운로드 폴더를 정할 수 없어서 브라우저의 "폴더에 저장" 기능(File System Access API — PC 크롬·엣지)을 씀:
// 처음 한 번 폴더를 고르면 그 폴더(권한 포함)를 이 기기 브라우저(IndexedDB)에 기억해 두고, 그다음부터 백업 파일을 그 폴더에 바로 씀.
// 휴대폰·사파리·파이어폭스처럼 지원하지 않는 브라우저는 예전처럼 "다운로드" 폴더로 내려받음. 서버·DB는 바꾸지 않음(이 기기에만 기억).

type PermissionMode = "read" | "readwrite";
type PermissionResult = "granted" | "denied" | "prompt";

/** 폴더 핸들 — 권한 확인·요청은 아직 TypeScript 기본 타입에 없어서 직접 적음 */
export type BackupFolderHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: PermissionMode }) => Promise<PermissionResult>;
  requestPermission?: (descriptor: { mode: PermissionMode }) => Promise<PermissionResult>;
};

type DirectoryPicker = (options?: {
  id?: string;
  mode?: PermissionMode;
  startIn?: "documents" | "downloads" | "desktop" | FileSystemHandle;
}) => Promise<BackupFolderHandle>;

const DB_NAME = "accounting-app";
const STORE = "handles";
const KEY = "backup-folder";
const CHANGED = "backup-folder-changed";

/** 이 브라우저가 폴더에 바로 저장을 지원하는지(PC 크롬·엣지) */
export function isFolderSaveSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** 기억해 둔 폴더(없거나 못 읽으면 null — 사생활 보호 창 등) */
export async function loadBackupFolder(): Promise<BackupFolderHandle | null> {
  if (!isFolderSaveSupported()) return null;
  try {
    return ((await withStore("readonly", (s) => s.get(KEY))) as BackupFolderHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

function announce() {
  window.dispatchEvent(new Event(CHANGED));
}

/** 폴더 고르기(처음 한 번) — 고른 폴더를 기억하고 이름을 돌려줌. 취소하면 null. 문서 폴더에서 시작. */
export async function pickBackupFolder(): Promise<BackupFolderHandle | null> {
  const picker = (window as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  if (!picker) return null;
  let handle: BackupFolderHandle;
  try {
    handle = await picker({ id: "accounting-backup-folder", mode: "readwrite", startIn: "documents" });
  } catch {
    return null; // 사용자가 취소
  }
  await withStore("readwrite", (s) => s.put(handle, KEY));
  announce();
  return handle;
}

export async function forgetBackupFolder(): Promise<void> {
  await withStore("readwrite", (s) => s.delete(KEY));
  announce();
}

/** 폴더가 바뀌면(이 화면의 다른 칸에서 고르거나 지움) 알림 — 해제 함수를 돌려줌 */
export function onBackupFolderChange(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

/**
 * 폴더에 쓸 권한 — 이미 있으면 바로 true, 없으면 브라우저가 묻는 창을 띄움(버튼을 누른 순간에 불러야 해서, 서버 백업을 기다리기
 * 전에 먼저 부름). 크롬에서 "방문할 때마다 허용"을 고르면 다음부터는 묻지 않음.
 */
export async function ensureFolderPermission(handle: BackupFolderHandle): Promise<boolean> {
  const mode = { mode: "readwrite" as const };
  if ((await handle.queryPermission?.(mode)) === "granted") return true;
  return (await handle.requestPermission?.(mode)) === "granted";
}

/** 백업 파일을 저장소 주소에서 받아 폴더에 그 이름 그대로 씀(같은 이름이 있으면 덮어씀 — 백업 파일 이름은 만든 시각이라 겹치지 않음) */
export async function saveBackupToFolder(handle: BackupFolderHandle, fileName: string, url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`백업 파일을 받지 못했습니다(${res.status}).`);
  const blob = await res.blob();
  const file = await handle.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(blob);
  } catch (err) {
    // 쓰다 실패하면 반쯤 쓴 파일이 남지 않게 버림
    await writable.abort().catch(() => {});
    throw err;
  }
  await writable.close();
}
