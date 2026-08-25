import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });

  const prompt = `이 파일은 한국 급여대장 또는 상여대장 표야. 직원별 행을 전부 읽어서 아래 JSON 형식으로만 답해줘. 다른 설명 없이 JSON만 출력해.

표는 왼쪽부터 사원번호, 지급내역(급여대장이면 기본급+각종 수당의 합, 상여대장이면 상여액), 오른쪽에 공제내역(국민연금/건강보험/장기요양보험/고용보험/소득세/지방소득세/농특세 등)과 차인지급액 순서로 되어 있어.
"고용보험" 자리에 마이너스(-) 값이 있거나 "조정" 같은 이름의 별도 항목이 있으면 그건 고용보험 환급금이야 — employment_insurance_refund에 그 절대값을 양수로 넣고, employment_insurance는 정상 차감분만 넣어줘 (구분이 안 되면 employment_insurance_refund에 절대값을 넣고 employment_insurance는 0으로).

{
  "pay_month": "YYYY-MM-01 (문서 상단에 적힌 연월 기준, 그 달 1일로)",
  "rows": [
    {
      "employee_no": "사원번호(문자열)",
      "amount": 급여성 지급액 합계(상여대장이면 0),
      "bonus": 상여 지급액(급여대장이면 0),
      "national_pension": 숫자(없으면 0),
      "health_insurance": 숫자(없으면 0),
      "long_term_care_insurance": 숫자(없으면 0),
      "employment_insurance": 숫자(없으면 0),
      "employment_insurance_refund": 숫자(없으면 0),
      "income_tax": 숫자(없으면 0),
      "local_income_tax": 숫자(없으면 0),
      "rural_tax": 숫자(없으면 0),
      "net_pay": 문서에 적힌 차인지급액(검산용, 숫자)
    }
  ]
}`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: bytes, mimeType: file.type || "application/pdf" } },
    ]);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    return NextResponse.json({ extracted: parsed, raw: text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "인식 실패" }, { status: 500 });
  }
}
