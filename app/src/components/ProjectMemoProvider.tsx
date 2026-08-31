"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateProjectMemo } from "@/lib/actions/projects";
import { useEscapeKey } from "@/lib/useEscapeKey";

type MemoCtx = {
  memo: string;
  setMemo: (v: string) => void;
  dirty: boolean;
  isPending: boolean;
  save: () => void;
  close: () => void;
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
  const dirty = memo !== initialMemo;

  const persist = async () => {
    const fd = new FormData();
    fd.set("id", projectId);
    fd.set("memo", memo);
    await updateProjectMemo(fd);
  };

  const save = () => {
    if (!dirty) return;
    startTransition(async () => {
      await persist();
      router.refresh();
    });
  };

  const close = () => {
    if (!dirty) {
      router.push(closeHref);
      return;
    }
    startTransition(async () => {
      await persist();
      router.push(closeHref);
    });
  };

  useEscapeKey(true, close);

  return (
    <MemoContext.Provider value={{ memo, setMemo, dirty, isPending, save, close }}>
      {children}
    </MemoContext.Provider>
  );
}
