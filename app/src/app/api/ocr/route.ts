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
    return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });

  const prompt = `이 영수증/세금계산서 이미지에서 정보를 추출해서 아래 JSON 형식으로만 답해줘. 다른 설명은 하지마.
{
  "trans_date": "YYYY-MM-DD 또는 null",
  "client_name": "거래처/상호명 또는 null",
  "item_name": "품목 또는 null",
  "quantity": 숫자 또는 null,
  "unit_price": 숫자 또는 null,
  "amount": 총 결제금액(숫자) 또는 null,
  "vat_included": true 또는 false,
  "category": "출장/물품/차량/공구/회식/기타 중 하나 추정"
}`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: bytes, mimeType: file.type || "image/jpeg" } },
    ]);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    return NextResponse.json({ extracted: parsed, raw: text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "OCR 처리 실패" }, { status: 500 });
  }
}
