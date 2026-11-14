"use client";

import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import {
  ensureFolderPermission,
  forgetBackupFolder,
  isFolderSaveSupported,
  loadBackupFolder,
  onBackupFolderChange,
  pickBackupFolder,
  saveBackupToFolder,
  type BackupFolderHandle,
} from "@/lib/backupFolder";

const noSubscribe = () => () => {};

/** 이 기기 브라우저에 기억해 둔 백업 저장 폴더(lib/backupFolder.ts) — 지원 여부와 폴더. 다른 칸에서 바꾸면 같이 바뀜. */
export function useBackupFolder() {
  // 서버 화면에선 false(지원 여부는 브라우저에서만 앎) — 화면이 서버·브라우저에서 어긋나지 않게
  const supported = useSyncExternalStore(noSubscribe, isFolderSaveSupported, () => false);
  const [folder, setFolder] = useState<BackupFolderHandle | null>(null);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    const load = () => {
      loadBackupFolder().then((h) => {
        if (alive) setFolder(h);
      });
    };
    load();
    const off = onBackupFolderChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [supported]);
  return { supported, folder };
}

/**
 * 백업 파일을 폴더에 저장 — 폴더가 없으면 "none", 권한을 못 받으면 "denied", 저장하면 "saved", 실패하면 오류 문구.
 * 권한은 버튼을 누른 순간에 물어야 해서 askPermission을 먼저 따로 부를 수 있게 나눔(ensureFolderPermission).
 */
export async function saveToBackupFolder(
  folder: BackupFolderHandle | null,
  fileName: string,
  url: string | null | undefined,
  permitted?: boolean
): Promise<{ status: "none" | "denied" | "saved" } | { error: string }> {
  if (!folder) return { status: "none" };
  if (!url) return { error: "백업 파일 주소를 만들지 못해 폴더에 저장하지 못했습니다. 아래 표의 \"다운로드\"를 눌러 주세요." };
  const ok = permitted ?? (await ensureFolderPermission(folder));
  if (!ok) return { status: "denied" };
  try {
    await saveBackupToFolder(folder, fileName, url);
    return { status: "saved" };
  } catch (err) {
    return { error: `폴더에 저장하지 못했습니다: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// 백업 화면 "백업 저장 폴더" — 처음 한 번 폴더(예: E:\문서\…\back up)를 고르면 "지금 백업"·"다운로드"가 그 폴더에 바로 저장됨
// (11/14 사용자 요청). PC 크롬·엣지만 — 휴대폰·사파리 등은 예전처럼 "다운로드" 폴더로 내려받는다고 안내.
export function BackupFolderControls() {
  const { supported, folder } = useBackupFolder();
  const [error, setError] = useState<string | null>(null);

  if (!supported) {
    return (
      <p className="text-xs text-slate-500">
        이 브라우저(휴대폰·사파리 등)는 저장 폴더를 정할 수 없어 백업 파일이 &quot;다운로드&quot; 폴더로 내려받아져요. PC의 크롬·엣지에서는
        백업을 바로 넣을 폴더를 정할 수 있어요.
      </p>
    );
  }

  async function pick() {
    setError(null);
    try {
      await pickBackupFolder();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function forget() {
    setError(null);
    try {
      await forgetBackupFolder();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          백업 저장 폴더:{" "}
          {folder ? (
            <span className="font-semibold text-slate-900">{folder.name}</span>
          ) : (
            <span className="text-slate-400">지정 안 함</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={folder ? "secondary" : "primary"} size="sm" onClick={pick}>
            {folder ? "폴더 바꾸기" : "저장 폴더 지정"}
          </Button>
          {folder && (
            <Button type="button" variant="secondary" size="sm" onClick={forget}>
              지정 해제
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {folder
          ? "\"지금 백업\"과 표의 \"다운로드\"가 이 폴더에 바로 저장돼요. 저장할 때 브라우저가 폴더 사용을 물으면 \"방문할 때마다 허용\"을 고르면 다음부터 묻지 않아요."
          : "처음 한 번 백업을 넣을 폴더(예: E:\\문서\\…\\back up)를 고르면, 그다음부터 \"지금 백업\"과 표의 \"다운로드\"가 그 폴더에 바로 저장돼요. 이 PC의 이 브라우저에만 기억돼요."}
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// 백업 표의 "다운로드" — 백업 저장 폴더를 정해 두었으면 그 폴더에 바로 저장, 아니면(또는 폴더 사용을 허용하지 않으면) 예전처럼
// 브라우저 "다운로드" 폴더로.
export function BackupDownloadLink({ fileName, url }: { fileName: string; url: string }) {
  const { folder } = useBackupFolder();
  const pending = useGlobalPending();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!folder) return;
    e.preventDefault();
    setNote(null);
    const permitted = await ensureFolderPermission(folder).catch(() => false);
    if (!permitted) {
      setNote({ ok: false, text: "폴더 사용을 허용하지 않아 \"다운로드\" 폴더로 받아요" });
      window.location.assign(url);
      return;
    }
    const result = await pending.run(() => saveToBackupFolder(folder, fileName, url, true));
    setNote("error" in result ? { ok: false, text: result.error } : { ok: true, text: `"${folder.name}" 폴더에 저장됨` });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <a
        href={url}
        onClick={handleClick}
        title={folder ? `"${folder.name}" 폴더에 바로 저장` : undefined}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
      >
        다운로드
      </a>
      {note && (
        <span className={`max-w-[12rem] whitespace-normal text-right text-[11px] ${note.ok ? "text-emerald-600" : "text-amber-700"}`}>
          {note.text}
        </span>
      )}
    </span>
  );
}

