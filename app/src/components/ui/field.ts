export const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

// fieldClass에서 폭(w-full)만 뺀 것 — 선택칸 여러 개를 한 줄에 내용 폭대로 나란히 둘 때.
// fieldClass에 w-auto·w-20 등을 덧붙이면 빌드된 CSS에서 .w-full이 뒤에 와서 안 먹고, 한 줄의 칸들이 폭을
// 똑같이 나눠 가지다 긴 값("2026년")이 잘림.
// max-w-full: 내용 폭 선택칸은 가장 긴 항목(긴 프로젝트 이름 등) 폭이 돼서 휴대폰에선 화면 밖으로 나갈 수 있음 —
// 감싼 상자 폭을 넘지 않게.
export const inlineFieldClass = fieldClass.replace("w-full ", "max-w-full ");

export const labelClass = "text-xs font-medium text-slate-500";
