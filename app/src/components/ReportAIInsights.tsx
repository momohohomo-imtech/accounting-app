"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ReportAIInsights({ summary }: { summary: Record<string, unknown> & { year: number } }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      setText(json.text ?? "");
    } catch {
      setError("생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">AI 전망 · 인사이트 (Gemini)</h2>
          <p className="text-xs text-slate-500">{summary.year}년 실적을 바탕으로 올해 남은 전망과 내년 전망을 요약해줘요.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={loading}>
          {loading ? "생성 중..." : text ? "다시 생성" : "생성하기"}
        </Button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
      {text && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{text}</p>}
    </div>
  );
}
