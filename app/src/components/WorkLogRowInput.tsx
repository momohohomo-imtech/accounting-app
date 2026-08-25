"use client";

import { useState } from "react";
import { WORK_LOG_COLORS } from "@/lib/workLogColors";
import { fieldClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";

export function WorkLogRowInput({
  index,
  defaultTitle,
  defaultColor,
}: {
  index: number;
  defaultTitle: string;
  defaultColor: string;
}) {
  const [color, setColor] = useState(defaultColor || "none");

  return (
    <div className="flex items-center gap-2">
      <div className="flex shrink-0 gap-1">
        {WORK_LOG_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            title={c.label}
            onClick={() => setColor(c.key)}
            className={cx(
              "h-6 w-6 rounded-full transition",
              c.swatch,
              color === c.key ? "ring-2 ring-offset-1 ring-slate-900" : "ring-1 ring-slate-200 hover:ring-slate-400"
            )}
          />
        ))}
      </div>
      <input type="hidden" name={`color_${index}`} value={color} />
      <input
        name={`title_${index}`}
        defaultValue={defaultTitle}
        placeholder={`${index + 1}번째 내용`}
        className={fieldClass}
      />
    </div>
  );
}
