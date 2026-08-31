"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 삭제처럼 되돌리기 어려운 작업이면 확인 버튼을 빨간색으로. */
  danger?: boolean;
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** window.confirm() 대신 쓰는 앱 공용 확인 팝업 — await confirm("메시지")로 true/false를 받음. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; options?: ConfirmOptions } | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, options });
    });
  }, []);

  function respond(value: boolean) {
    setState(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }

  useEscapeKey(Boolean(state), () => respond(false));

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => respond(false)}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              {state.options?.title && <h3 className="mb-2 font-semibold text-slate-900">{state.options.title}</h3>}
              <p className="text-sm whitespace-pre-line text-slate-700">{state.message}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => respond(false)}>
                  {state.options?.cancelLabel ?? "취소"}
                </Button>
                <Button
                  type="button"
                  variant={state.options?.danger ? "danger" : "primary"}
                  size="sm"
                  onClick={() => respond(true)}
                >
                  {state.options?.confirmLabel ?? "확인"}
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </ConfirmContext.Provider>
  );
}
