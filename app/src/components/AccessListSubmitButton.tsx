"use client";

import { useFormStatus } from "react-dom";

// 네이티브 <form action={...}> 안에서만 쓸 수 있음 — useFormStatus가 그 폼의 제출 상태를 알려줌.
// 처리 중에 버튼을 잠가서 연달아 눌러도 중복 생성되지 않게 함.
export function AccessListSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
    >
      {pending ? "생성 중..." : "출입명단 생성"}
    </button>
  );
}
