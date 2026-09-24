"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { formatThousands, parseNumericInput } from "@/lib/numberInput";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "inputMode"> & {
  /** 쉼표 없는 값(제어 모드). 넘기면 onValueChange로 바뀐 값을 받는다. */
  value?: string | number | null;
  /** 쉼표 없는 초깃값(비제어 모드 — 폼 제출용 name과 같이 씀). */
  defaultValue?: string | number | null;
  onValueChange?: (raw: string) => void;
  allowNegative?: boolean;
  allowDecimal?: boolean;
};

/**
 * 금액 입력칸 — 입력하는 동안 천 단위 쉼표("1,234,567")를 보여준다. 폼으로 제출되는 값(name)은
 * 숨은 입력칸에 쉼표 없는 숫자로 들어가서 서버 액션·계산은 예전과 똑같다.
 * (type="number"는 쉼표를 못 보여줘서 text + 숫자 키패드(inputMode)로 대신함)
 */
export function MoneyInput({
  value,
  defaultValue,
  onValueChange,
  name,
  allowNegative = false,
  allowDecimal = false,
  ...rest
}: Props) {
  const initial = defaultValue == null ? "" : String(defaultValue);
  const [inner, setInner] = useState(initial);
  const controlled = value !== undefined;
  const raw = controlled ? (value == null ? "" : String(value)) : inner;

  // 저장 후 폼이 초기화(form.reset — React 폼 action이 끝나면 자동으로도 함)되면 비제어 모드 값도
  // 처음 값으로 되돌린다. 쉼표 표시 때문에 입력칸이 React 상태로 관리돼서 reset만으로는 안 비워짐.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || controlled) return;
    const onReset = () => setInner(initial);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, initial]);

  return (
    <>
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        autoComplete="off"
        value={formatThousands(raw)}
        onChange={(e) => {
          const next = parseNumericInput(e.target.value, { allowNegative, allowDecimal });
          if (!controlled) setInner(next);
          onValueChange?.(next);
        }}
      />
      {name && <input type="hidden" name={name} value={raw} />}
    </>
  );
}
