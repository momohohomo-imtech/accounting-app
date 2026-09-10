"use client";

import { useState } from "react";

const MANUAL = "__manual__";

// "매칭 거래처" 선택 — 최상단 "수기 작성"을 고르면 자유 입력칸이 나타나고,
// 등록된 거래처를 고르면 그 거래처로 저장됨. 네이티브 form(FormData) 제출용이라
// 부모 <form onSubmit>에서 new FormData(form)으로 그대로 읽으면 된다.
export function MatchedClientField({
  clients,
  defaultClientId,
  defaultNameRaw,
  selectClassName,
  inputClassName,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string | null;
  defaultNameRaw?: string | null;
  selectClassName?: string;
  inputClassName?: string;
}) {
  const [mode, setMode] = useState<string>(defaultClientId || MANUAL);
  const isManual = mode === MANUAL;

  return (
    <div className="flex flex-col gap-1">
      <select
        name={isManual ? undefined : "matched_client_id"}
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className={selectClassName}
      >
        <option value={MANUAL}>수기 작성</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {isManual && (
        <input
          name="matched_client_name_raw"
          defaultValue={defaultNameRaw ?? ""}
          placeholder="거래처 직접 입력"
          className={inputClassName}
        />
      )}
    </div>
  );
}
