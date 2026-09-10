"use client";

// "매칭 거래처" 입력 — 수기 입력칸(등록된 거래처 이름 자동완성 제공)과 등록된 거래처 선택을
// 한 줄에 나란히 둔다. 선택 드롭다운에서 실제 거래처를 고르면 그게 우선되고("선택 안함"이면
// 수기 입력칸 값을 씀) — 서버 액션의 parseTransaction()이 이 우선순위로 그대로 처리한다.
// 네이티브 form(FormData) 제출용이라 부모 <form onSubmit>에서 new FormData(form)으로 읽으면 된다.
export function MatchedClientField({
  clients,
  defaultClientId,
  defaultNameRaw,
  selectClassName,
  inputClassName,
  datalistId = "matched-client-name-suggestions",
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string | null;
  defaultNameRaw?: string | null;
  selectClassName?: string;
  inputClassName?: string;
  datalistId?: string;
}) {
  return (
    <div className="contents">
      <input
        name="matched_client_name_raw"
        list={datalistId}
        defaultValue={defaultNameRaw ?? ""}
        placeholder="거래처 수기 작성"
        className={inputClassName}
      />
      <select name="matched_client_id" defaultValue={defaultClientId ?? ""} className={selectClassName}>
        <option value="">선택 안함</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <datalist id={datalistId}>
        {clients.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
    </div>
  );
}
