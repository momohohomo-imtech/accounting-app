"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import type { ReportAiInsight, ReportAiInsightMessage } from "@/lib/types";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type ChatMessage = ReportAiInsightMessage;

export function ReportAIInsights({
  summary,
  savedInsights,
  saveAction,
  deleteAction,
}: {
  summary: Record<string, unknown> & { year: number };
  savedInsights: ReportAiInsight[];
  saveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const pending = useGlobalPending();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function handleSave() {
    if (messages.length === 0 || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("year", String(summary.year));
      fd.append("title", messages[0].text.slice(0, 60));
      fd.append("messages", JSON.stringify(messages));
      await pending.run(() => saveAction(fd));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    await pending.run(() => deleteAction(fd));
    setConfirmDeleteId(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">AI 전망 · 인사이트 (Gemini)</h2>
          <p className="mt-1 text-xs text-slate-500">{summary.year}년 실적 데이터를 바탕으로 자유롭게 물어보세요.</p>
        </div>
        {messages.length > 0 && (
          <Button type="button" variant="secondary" size="xs" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : "대화 저장"}
          </Button>
        )}
      </div>

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

      {savedInsights.length > 0 && (
        <div className="mt-4 border-t border-indigo-100 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">저장된 대화</p>
          <div className="space-y-1.5">
            {savedInsights.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => setMessages(s.messages)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 hover:text-slate-900"
                  title="클릭하면 이 대화를 다시 불러옵니다"
                >
                  {s.title || "(제목 없음)"}
                  <span className="ml-2 text-xs text-slate-400">{formatDate(s.created_at)}</span>
                </button>
                {confirmDeleteId === s.id ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="danger" size="xs" type="button" onClick={() => handleDelete(s.id)}>
                      확인
                    </Button>
                    <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    size="xs"
                    type="button"
                    className="shrink-0"
                    onClick={() => setConfirmDeleteId(s.id)}
                  >
                    삭제
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
