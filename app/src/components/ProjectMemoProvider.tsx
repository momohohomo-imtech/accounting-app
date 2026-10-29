"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateProjectMemo } from "@/lib/actions/projects";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

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
  children,
}: {
  projectId: string;
  initialMemo: string;
  closeHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [memo, setMemo] = useState(initialMemo);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();
  const dirty = memo !== initialMemo;

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
    return true;
  };

  const save = () => {
    if (!dirty) return;
    startTransition(async () => {
      if (await persist()) router.refresh();
    });
  };

  const close = () => {
    if (!dirty) {
      router.push(closeHref, { scroll: false });
      return;
    }
    startTransition(async () => {
      if (await persist()) router.push(closeHref, { scroll: false });
    });
  };

  useEscapeKey(true, close);

  return (
    <MemoContext.Provider value={{ memo, setMemo, dirty, isPending, save, close, error }}>
      {children}
    </MemoContext.Provider>
  );
}
