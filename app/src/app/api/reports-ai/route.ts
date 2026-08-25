import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type ChatMessage = { role: "user" | "model"; text: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = await req.json();
  const summary = (body.summary ?? {}) as Record<string, unknown> & { year?: number };
  const messages = (body.messages ?? []) as ChatMessage[];
  const year = summary.year ?? new Date().getFullYear();

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "질문이 없습니다." }, { status: 400 });
  }

  const contextPrompt = `너는 한국 중소 설비/시공 협력업체의 재무 자문가야. 이 회사는 주로 기아자동차 화성공장에서
협력업체로 일하고 있어 (원청 공장 협력사 특성상 매출·매입이 특정 시기에 몰리거나 특정 거래처에
집중될 수 있다는 점을 참고해).

아래는 ${year}년 매입/매출 실적 요약이야 (원 단위, JSON):

${JSON.stringify(summary, null, 2)}

이 데이터를 바탕으로 사용자의 질문에 한국어로 짧고 실무적으로 답해줘. 마크다운 기호(#, *, - 등)나 표 없이
자연스러운 문장으로 답하고, 데이터에서 확인할 수 없는 내용을 말할 땐 추정이라고 밝혀줘.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });

  const history = messages.slice(0, -1);
  const latest = messages[messages.length - 1].text;

  const chatHistory = [
    { role: "user", parts: [{ text: contextPrompt }] },
    { role: "model", parts: [{ text: "네, 데이터를 확인했습니다. 질문해주세요." }] },
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
  ];

  try {
    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(latest);
    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "생성 실패" }, { status: 500 });
  }
}
