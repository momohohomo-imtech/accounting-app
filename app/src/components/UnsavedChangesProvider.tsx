"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";
import {
  createTraverseGuard,
  createUnsavedRegistry,
  LEAVE_GUARD_FORM_ATTR,
  leaveDialogLabels,
  leavingHref,
  traverseDelta,
  type GuardState,
} from "@/lib/unsavedChanges";

// 작성 중인 메모를 저장하지 않고 떠날 때 묻는 확인창(사용자 요청 11/19 "모든 메모장에 작성 중에 나가거나 뒤로가기·닫기 할 경우
// 저장할지 물어보기") — 판단은 lib/unsavedChanges.ts. 메모칸은 useUnsavedGuard로 등록하고, 칸의 닫기·취소·ESC는 그 훅이 돌려준
// 함수로 물어봄. 화면을 떠나는 이동은 여기서 한꺼번에 가로챔:
//  ① 링크(메뉴·탭·팝업 링크) — Next.js Link보다 먼저 창에서 받아 막고, 떠나기로 하면 같은 링크를 다시 누름(push·replace·닫기 링크 그대로)
//  ② 브라우저·휴대폰 뒤로가기/앞으로가기 — Next.js가 화면을 바꾸기 전에 원래 기록으로 되돌리고 물어봄
//  ③ 탭 닫기·새로고침·주소창 이동 — 브라우저 기본 확인창(저장 단추 없이 "나가기/취소"만 — 브라우저가 정한 모양)
//  ④ 로그아웃 단추(data-leave-guard 폼) — 30분 자동 로그아웃(IdleLogout)은 묻지 않음(자리를 비운 사이라 답할 사람이 없음)
// router.push만 부르는 단추(선택 칸으로 바로 이동 등)는 가로채지 못함 — 메모칸 화면엔 그런 이동이 없음.

export type UnsavedEntry = GuardState & {
  /** "저장"을 골랐을 때 — 저장됐으면 true. 실패하면 칸에 이유를 보여 주고 false(떠나지 않음) */
  save: () => Promise<boolean>;
  /** "저장 안 함"을 골랐을 때 — 칸을 저장된 내용으로 되돌리거나 닫음(화면을 떠나도 칸이 남는 경우 쓰던 글이 남지 않게) */
  discard?: () => void;
};

type Choice = "save" | "discard" | "stay";

type UnsavedCtx = {
  register: (get: () => UnsavedEntry) => number;
  unregister: (id: number) => void;
  /** ids(없으면 전부) 중 저장 안 한 칸이 있으면 물어봄 — 떠나도 되면 true */
  confirmLeave: (ids?: number[]) => Promise<boolean>;
};

const UnsavedContext = createContext<UnsavedCtx | null>(null);

const DIALOG_ATTR = "data-unsaved-dialog";

/** 포커스가 이 확인창으로 옮겨 갔는지 — 입력칸에서 벗어나면 자동 저장하는 칸은 이때 따로 저장하지 않음(확인창에서 정함). */
export function isLeaveDialogFocus(target: EventTarget | null) {
  return target instanceof Element && target.closest(`[${DIALOG_ATTR}]`) !== null;
}

type NavigationLike = {
  currentEntry: { index: number; url: string | null } | null;
  addEventListener(type: "navigate", listener: (e: NavigateEventLike) => void): void;
  removeEventListener(type: "navigate", listener: (e: NavigateEventLike) => void): void;
};
type NavigateEventLike = { navigationType: string; destination: { index: number } | null };

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [registry] = useState(() => createUnsavedRegistry<UnsavedEntry>());
  const [dialog, setDialog] = useState<{ labels: string[] } | null>(null);
  const resolveRef = useRef<((choice: Choice) => void) | null>(null);
  const focusRef = useRef<Element | null>(null);
  // 묻는 중이거나 "저장"을 골라 저장하는 중 — 그사이 뒤로가기를 또 누르면(저장 중 "처리 중..."에도 뒤로가기는 눌림) 두 칸 가지 않게 막음
  const busyRef = useRef(false);

  const respond = useCallback((choice: Choice) => {
    const resolve = resolveRef.current;
    const focused = focusRef.current;
    resolveRef.current = null;
    focusRef.current = null;
    setDialog(null);
    // 계속 작성 — 쓰던 칸으로 돌아감
    if (choice === "stay" && focused instanceof HTMLElement && focused.isConnected) focused.focus();
    resolve?.(choice);
  }, []);

  useEscapeKey(Boolean(dialog), () => respond("stay"));

  const confirmLeave = useCallback(
    async (ids?: number[]) => {
      // 이미 묻거나 저장하는 중(뒤로가기를 한 번 더 누름 등) — 떠나지 않음
      if (busyRef.current) return false;
      const targets = registry.dirtyIds(ids);
      if (targets.length === 0) return true;
      busyRef.current = true;
      try {
        const choice = await new Promise<Choice>((resolve) => {
          resolveRef.current = resolve;
          focusRef.current = document.activeElement;
          setDialog({ labels: leaveDialogLabels(targets.map((id) => registry.get(id)?.label ?? "")) });
        });
        if (choice === "stay") return false;
        if (choice === "save") {
          for (const id of targets) {
            const entry = registry.get(id);
            if (!entry || registry.dirtyIds([id]).length === 0) continue;
            if (!(await entry.save())) return false;
          }
        } else {
          for (const id of targets) registry.get(id)?.discard?.();
        }
        registry.decide(targets);
        return true;
      } finally {
        busyRef.current = false;
      }
    },
    [registry]
  );

  const confirmRef = useRef(confirmLeave);
  const routerRef = useRef(router);
  useEffect(() => {
    confirmRef.current = confirmLeave;
    routerRef.current = router;
  });

  useEffect(() => {
    const hasDirty = () => busyRef.current || registry.dirtyIds().length > 0;

    // ① 링크 — 창에서 먼저(capture) 받아 Next.js Link(React가 문서에서 받는 click)까지 가지 않게 막음
    let replaying = false;
    const onClick = (e: MouseEvent) => {
      if (replaying || !hasDirty()) return;
      const anchor = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = leavingHref({
        button: e.button,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        defaultPrevented: e.defaultPrevented,
        href: anchor.href,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
        currentHref: window.location.href,
      });
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmRef.current().then((leave) => {
        if (!leave) return;
        if (anchor.isConnected) {
          replaying = true;
          try {
            anchor.click();
          } finally {
            replaying = false;
          }
        } else if (new URL(href).origin === window.location.origin) {
          routerRef.current.push(href);
        } else {
          window.location.assign(href);
        }
      });
    };

    // ② 뒤로가기·앞으로가기 — 창에서 먼저(capture) 받아 Next.js의 popstate 처리를 막음(lib/unsavedChanges.ts)
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    const traverse = createTraverseGuard({
      go: (delta) => window.history.go(delta),
      now: () => Date.now(),
      href: () => window.location.href,
      hasDirty,
      confirmLeave: () => confirmRef.current(),
    });
    const onNavigate = (e: NavigateEventLike) => {
      if (e.navigationType !== "traverse") return;
      traverse.beforeTraverse(traverseDelta(nav?.currentEntry?.index, e.destination?.index), nav?.currentEntry?.url ?? null);
    };
    const onPopState = (e: PopStateEvent) => {
      if (traverse.onPopState()) e.stopImmediatePropagation();
    };

    // ③ 탭 닫기·새로고침 — 브라우저 기본 확인창
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    // ④ 로그아웃 폼
    let resubmitting = false;
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target;
      if (resubmitting || !(form instanceof HTMLFormElement) || !form.hasAttribute(LEAVE_GUARD_FORM_ATTR) || !hasDirty()) return;
      e.preventDefault();
      e.stopPropagation();
      const submitter = e.submitter;
      void confirmRef.current().then((leave) => {
        if (!leave || !form.isConnected) return;
        resubmitting = true;
        try {
          form.requestSubmit(submitter && submitter.isConnected ? submitter : undefined);
        } finally {
          resubmitting = false;
        }
      });
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("submit", onSubmit, true);
    nav?.addEventListener("navigate", onNavigate);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("submit", onSubmit, true);
      nav?.removeEventListener("navigate", onNavigate);
    };
  }, [registry]);

  const ctx = useMemo<UnsavedCtx>(
    () => ({ register: registry.add, unregister: registry.remove, confirmLeave }),
    [registry, confirmLeave]
  );

  return (
    <UnsavedContext.Provider value={ctx}>
      {children}
      {dialog && (
        <ModalPortal>
          <div
            data-unsaved-dialog=""
            className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-ink/50 p-4 print:hidden"
            onClick={() => respond("stay")}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="unsaved-dialog-title"
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="unsaved-dialog-title" className="mb-2 font-semibold text-slate-900">
                저장하지 않은 내용이 있습니다
              </h3>
              <p className="text-sm text-slate-700">작성 중인 내용을 저장하시겠습니까?</p>
              {dialog.labels.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {dialog.labels.map((label) => (
                    <li key={label} className="truncate" title={label}>
                      · {label}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => respond("stay")}>
                  계속 작성
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={() => respond("discard")}>
                  저장 안 함
                </Button>
                <Button type="button" size="sm" autoFocus onClick={() => respond("save")}>
                  저장
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </UnsavedContext.Provider>
  );
}

/**
 * 메모칸 등록 — 저장 안 한 내용(dirty)이 있으면 링크 이동·뒤로가기·탭 닫기 때 확인창(저장·저장 안 함·계속 작성)을 띄움.
 * 돌려준 함수는 이 칸의 닫기·취소·ESC에서 부를 것: 떠나도 되면 true(저장 안 한 내용이 없거나, 저장했거나, "저장 안 함").
 * 새 메모칸을 만들 때도 이 훅으로(CLAUDE.md).
 */
export function useUnsavedGuard(entry: UnsavedEntry): () => Promise<boolean> {
  const ctx = useContext(UnsavedContext);
  const entryRef = useRef(entry);
  useEffect(() => {
    entryRef.current = entry;
  });
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ctx) return;
    const id = ctx.register(() => entryRef.current);
    idRef.current = id;
    return () => {
      ctx.unregister(id);
      if (idRef.current === id) idRef.current = null;
    };
  }, [ctx]);
  return useCallback(async () => {
    const id = idRef.current;
    if (!ctx || id === null) return true;
    return ctx.confirmLeave([id]);
  }, [ctx]);
}

/** 화면의 저장 안 한 칸 전부를 물어봄 — 메모칸이 여럿인 팝업을 닫을 때(작업일지 내역). 떠나도 되면 true */
export function useConfirmLeaveAll(): () => Promise<boolean> {
  const ctx = useContext(UnsavedContext);
  return useCallback(async () => (ctx ? ctx.confirmLeave() : true), [ctx]);
}
