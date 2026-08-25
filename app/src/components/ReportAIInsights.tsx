"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";

type ChatMessage = { role: "user" | "model"; text: string };

export function ReportAIInsights({ summary }: { summary: Record<string, unknown> & { year: number } }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, messages: nextMessages }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      setMessages((prev) => [...prev, { role: "model", text: json.text ?? "" }]);
    } catch {
      setError("응답 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm print:hidden">
      <h2 className="font-semibold text-slate-900">AI 전망 · 인사이트 (Gemini)</h2>
      <p className="mt-1 text-xs text-slate-500">{summary.year}년 실적 데이터를 바탕으로 자유롭게 물어보세요.</p>

      <div className="mt-3 space-y-3">
        {messages.length === 0 && (
          <button
            type="button"
            onClick={() => send(`${summary.year}년 실적을 바탕으로 올해 남은 전망과 내년 전망을 요약해줘.`)}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-100"
          >
            올해·내년 전망 요약해줘
          </button>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <p
              className={cx(
                "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm leading-relaxed",
                m.role === "user" ? "bg-slate-900 text-white" : "border border-indigo-100 bg-white text-slate-700"
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {loading && <p className="text-sm text-slate-500">Gemini가 답변을 생성하는 중...</p>}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 이익률이 가장 높은 프로젝트는?"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={loading || !input.trim()}>
          보내기
        </Button>
      </form>
    </div>
  );
}
