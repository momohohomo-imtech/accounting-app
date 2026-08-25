import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const summary = await req.json();
  const year = summary.year ?? new Date().getFullYear();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });

  const prompt = `너는 한국 중소 설비/시공 협력업체의 재무 자문가야. 이 회사는 주로 기아자동차 화성공장에서
협력업체로 일하고 있어 (원청 공장 협력사 특성상 매출·매입이 특정 시기에 몰리거나 특정 거래처에
집중될 수 있다는 점을 참고해).

아래는 ${year}년 매입/매출 실적 요약이야 (원 단위, JSON):

${JSON.stringify(summary, null, 2)}

이 데이터를 바탕으로 한국어로 짧고 실무적인 보고서를 문단 형식으로 작성해줘. 다음 내용을 순서대로 담아:
1. ${year}년 지금까지 실적 간단 평가 (월별 흐름, 특이사항)
2. 지금 추세가 이어진다면 남은 기간 전망
3. ${year + 1}년 전망 및 미리 준비하면 좋을 점
4. 데이터에서 눈에 띄는 점이 있으면 참고 제안 (매입처 편중, 특정 현장/프로젝트 의존도, 이익률 추이 등)

마크다운 기호(#, *, - 등)나 표 없이 자연스러운 문단들로, 전체 600자 내외로 간결하게 작성하고,
마지막 줄에 "※ 참고용 추정치이며 실제와 다를 수 있습니다." 를 짧게 덧붙여줘.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "생성 실패" }, { status: 500 });
  }
}
