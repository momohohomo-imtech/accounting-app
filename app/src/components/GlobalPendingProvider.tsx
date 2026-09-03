"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Pending = {
  /** fn이 끝날 때까지 화면 전체를 클릭 못 하게 막고 "처리 중..." 표시를 띄움. */
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

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setCount((c) => c + 1);
    try {
      return await fn();
    } finally {
      setCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <PendingContext.Provider value={{ run }}>
      {children}
      {count > 0 && (
        <div className="fixed inset-0 z-[200] flex justify-center pt-6 print:hidden" style={{ cursor: "wait" }}>
          <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            처리 중...
          </div>
        </div>
      )}
    </PendingContext.Provider>
  );
}
