"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateProjectMemo } from "@/lib/actions/projects";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useUnsavedGuard } from "@/components/UnsavedChangesProvider";
import { closePopup } from "@/lib/popupNavigation";

type MemoCtx = {
  memo: string;
  setMemo: (v: string) => void;
  dirty: boolean;
  isPending: boolean;
  save: () => void;
  close: () => void;
  error: string | null;
};

const MemoContext = createContext<MemoCtx | null>(null);

export function useMemoEditor() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("useMemoEditor must be used within ProjectMemoProvider");
  return ctx;
}

export function ProjectMemoProvider({
  projectId,
  initialMemo,
  closeHref,
  label,
  children,
}: {
  projectId: string;
  initialMemo: string;
  closeHref: string;
  /** 저장 확인창에 보일 이름(프로젝트 번호·이름) */
  label: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [memo, setMemo] = useState(initialMemo);
  const [savedMemo, setSavedMemo] = useState(initialMemo);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();
  const dirty = memo !== savedMemo;

  // 저장됐으면 true — 실패하면 오류를 보여 주고 창을 닫지 않음
  const persist = async () => {
    const fd = new FormData();
    fd.set("id", projectId);
    fd.set("memo", memo);
    const result = await globalPending.run(() => updateProjectMemo(fd));
    if (result?.error) {
      setError(`메모를 저장하지 못했습니다: ${result.error}`);
      return false;
    }
    setError(null);
    setSavedMemo(memo);
    return true;
  };

  const save = () => {
    if (!dirty) return;
    startTransition(async () => {
      if (await persist()) router.refresh();
    });
  };

  // 메모를 고친 채 닫기·ESC·뒤로가기·다른 링크를 누르면 저장할지 물어봄(사용자 요청 11/19 — 예전엔 닫을 때 묻지 않고 저장했음)
  const leave = useUnsavedGuard({
    dirty,
    value: memo,
    label,
    save: async () => {
      if (!(await persist())) return false;
      router.refresh();
      return true;
    },
    discard: () => setMemo(savedMemo),
  });

  // 닫을 때 뒤로가기 기록을 쌓지 않음(lib/popupNavigation.ts)
  const close = async () => {
    if (await leave()) closePopup(router, closeHref);
  };

  useEscapeKey(true, () => void close());

  return (
    <MemoContext.Provider value={{ memo, setMemo, dirty, isPending, save, close: () => void close(), error }}>
      {children}
    </MemoContext.Provider>
  );
}
