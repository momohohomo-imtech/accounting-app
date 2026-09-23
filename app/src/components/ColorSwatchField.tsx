"use client";

import { useState } from "react";

const SWATCH_CLASS: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  gray: "bg-slate-400",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  fuchsia: "bg-fuchsia-500",
};

export function ColorSwatchField({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setValue("")}
        title="없음"
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-[10px] text-slate-400 ${
          value === "" ? "border-slate-900" : "border-slate-200"
        }`}
      >
        ✕
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setValue(o.value)}
          title={o.label}
          className={`h-6 w-6 rounded-full ${SWATCH_CLASS[o.value] ?? "bg-slate-300"} ${
            value === o.value ? "ring-2 ring-offset-1 ring-slate-900" : ""
          }`}
        />
      ))}
    </div>
  );
}
