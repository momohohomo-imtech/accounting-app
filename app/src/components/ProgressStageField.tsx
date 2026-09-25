// 진행률 입력 — 숫자 대신 준비중(노랑)·진행중(주황)·공사완료(녹색) 동그라미 3개 중 하나를 고름.
// 저장 값은 기존과 같은 %(0 / 1~99 / 100). 이미 60%처럼 중간 값이 있으면 진행중을 골라도 그 값을 유지.
export function ProgressStageField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const pct = Number(defaultValue) || 0;
  const ongoingValue = pct > 0 && pct < 100 ? String(pct) : "50";
  const current = pct >= 100 ? "100" : pct > 0 ? ongoingValue : "0";
  const stages = [
    { value: "0", label: "준비중", color: "bg-yellow-400" },
    { value: ongoingValue, label: "진행중", color: "bg-orange-500" },
    { value: "100", label: "공사완료", color: "bg-green-600" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => (
        <label
          key={s.label}
          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 has-checked:border-slate-900 has-checked:font-semibold has-checked:text-slate-900 has-focus-visible:ring-2 has-focus-visible:ring-slate-400"
        >
          <input type="radio" name={name} value={s.value} defaultChecked={s.value === current} className="sr-only" />
          <span className={`inline-block h-3.5 w-3.5 rounded-full ${s.color}`} />
          {s.label}
        </label>
      ))}
    </div>
  );
}
