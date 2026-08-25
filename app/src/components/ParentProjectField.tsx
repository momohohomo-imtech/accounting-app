"use client";

import { useMemo, useState } from "react";
import type { ProjectSearchOption } from "@/components/crud/types";
import { fieldClass } from "@/components/ui/field";

export function ParentProjectField({
  name,
  options,
  defaultValue,
  required,
}: {
  name: string;
  options: ProjectSearchOption[];
  defaultValue?: string;
  required?: boolean;
}) {
  const initial = options.find((o) => o.value === defaultValue);
  const [year, setYear] = useState(initial ? String(initial.year) : "");
  const [site, setSite] = useState(initial ? initial.siteLabel : "");
  const [value, setValue] = useState(defaultValue ?? "");

  const years = useMemo(
    () => Array.from(new Set(options.map((o) => o.year))).sort((a, b) => b - a),
    [options]
  );
  const sites = useMemo(
    () =>
      Array.from(
        new Set(options.filter((o) => !year || String(o.year) === year).map((o) => o.siteLabel))
      ).sort(),
    [options, year]
  );
  const filtered = useMemo(
    () => options.filter((o) => (!year || String(o.year) === year) && (!site || o.siteLabel === site)),
    [options, year, site]
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setSite("");
            setValue("");
          }}
          className={fieldClass}
        >
          <option value="">연도 전체</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <select
          value={site}
          onChange={(e) => {
            setSite(e.target.value);
            setValue("");
          }}
          className={fieldClass}
        >
          <option value="">현장 전체</option>
          {sites.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <select name={name} value={value} onChange={(e) => setValue(e.target.value)} required={required} className={fieldClass}>
        <option value="">없음</option>
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.year}년 · {o.siteLabel} · {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
