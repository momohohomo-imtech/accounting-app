import { NextRequest, NextResponse } from "next/server";
import { extractJson, generateGeminiText, geminiErrorMessage, geminiModel } from "@/lib/gemini";

// 제미나이 응답을 기다리는 시간(lib/gemini.ts의 시도 시간·재시도와 맞춤).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  // 보낸 양식이 깨졌거나 중간에 끊기면 formData()가 실패함 — 500 오류 화면 대신 알아볼 수 있는 문구로.
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "보낸 파일을 읽지 못했습니다. 다시 시도해 주세요." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");

  const model = geminiModel();

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
    const text = await generateGeminiText({ apiKey, prompt, model, file: { data: bytes, mimeType: file.type || "image/jpeg" } });
    return NextResponse.json({ extracted: extractJson(text), raw: text });
  } catch (err) {
    return NextResponse.json({ error: geminiErrorMessage(err, model) }, { status: 502 });
  }
}
