"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { actionFailureMessage } from "@/lib/actionError";

const ignoreEscape = () => {};

type Pending = {
  /**
   * fn이 끝날 때까지 화면 전체를 클릭 못 하게 막고 "처리 중..." 표시를 띄움. fn이 예외를 던지면(연결 끊김·새 버전 배포 직후·서버
   * 오류) 예외 대신 `{ error: 안내 문구 }`를 돌려줌 — 그래서 fn은 실패를 `{ error }`로 알리는 서버 액션이어야 하고, 부르는 곳은
   * 결과의 `error`를 먼저 확인할 것(lib/actionError.ts).
   */
  run: <T>(fn: () => Promise<T>) => Promise<T>;
};

const PendingContext = createContext<Pending | null>(null);

export function useGlobalPending() {
  const ctx = useContext(PendingContext);
  if (!ctx) throw new Error("useGlobalPending must be used within GlobalPendingProvider");
  return ctx;
}

// 저장/수정/삭제 등 서버 액션이 끝날 때까지 화면 전체 클릭을 막아서, 처리 중에
// 다른 곳을 눌러 중복 요청을 보내거나 어중간한 상태로 페이지를 이동하는 걸 방지함.
// count로 관리해서 여러 동작이 겹쳐도(드물게) 전부 끝나야 풀림.
export function GlobalPendingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  // 처리 중에는 ESC로 아래 팝업이 닫히지 않게(저장 도중 팝업이 닫히면 실패 안내를 못 봄) — 맨 위에서 ESC를 받고 아무것도 안 함.
  useEscapeKey(count > 0, ignoreEscape);

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setCount((c) => c + 1);
    try {
      return await fn();
    } catch (err) {
      // 예외를 그대로 던지면 부르는 화면의 "처리 중" 표시(setPending(false))가 안 풀려 저장 버튼이 비활성에 갇히고 안내도 없었음
      // (11/4 공구명세서 "수정 저장") — 부르는 곳은 모두 결과의 error로 실패를 보여 주므로 { error }로 바꿔 돌려줌.
      console.error(err);
      return { error: actionFailureMessage(err) } as T;
    } finally {
      setCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <PendingContext.Provider value={{ run }}>
      {children}
      {count > 0 && <PendingOverlay />}
    </PendingContext.Provider>
  );
}

// 화면 전체를 막는 "처리 중..." 표시 — run()을 못 쓰는 서버 렌더링 폼(<form action={서버액션}>)의 제출 버튼은
// useFormStatus의 pending일 때 이걸 직접 띄움(AccessListSubmitButton).
export function PendingOverlay() {
  return (
    <div className="fixed inset-0 z-[200] flex justify-center pt-6 print:hidden" style={{ cursor: "wait" }}>
      <div className="flex items-center gap-2 rounded-full bg-brand-ink/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        처리 중...
      </div>
    </div>
  );
}
