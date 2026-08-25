import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const anyV = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (anyV.richText) return anyV.richText.map((r) => r.text).join("");
    if (anyV.text) return anyV.text;
    if (anyV.result != null) return String(anyV.result);
    return "";
  }
  return String(v);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  let csv: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // exceljs bundles an old @types/node (via fast-csv) whose non-generic Buffer type
    // doesn't structurally match this project's Buffer<ArrayBufferLike> — types-only mismatch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buf as any);
    const worksheet = workbook.worksheets[0];
    const lines: string[] = [];
    worksheet.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1).map(cellToString);
      lines.push(values.join(","));
    });
    csv = lines.join("\n");
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽지 못했습니다." }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });

  const prompt = `다음은 매입매출 거래를 여러 건 등록하기 위한 엑셀 표를 CSV로 변환한 거야. 각 행을 아래 JSON 형식으로 변환해서 배열로만 답해줘, 다른 설명 없이 JSON 배열만 출력해.

컬럼은 보통 이 순서: 날짜, 구분(매입/매출), 거래처명, 프로젝트명, 품목, 종류구분, 수량, 단가, 총금액(VAT포함), VAT포함여부(Y/N), 결제수단, 결제시점(즉시/외상), 세금계산서발행(Y/N), 메모1, 메모2.
헤더 이름이 정확히 안 맞거나 순서가 달라도 의미로 알아서 매칭해줘. 헤더 행, 안내/예시 행, 완전히 빈 행은 결과에서 제외해.
날짜는 YYYY-MM-DD로 변환. 금액에 쉼표나 "원"이 붙어있으면 숫자만 추출.

[
  {
    "trans_date": "YYYY-MM-DD",
    "type": "매입 또는 매출",
    "client_name": "거래처명 (없으면 빈 문자열)",
    "project_name": "프로젝트명 (없으면 빈 문자열)",
    "item_name": "품목 (없으면 빈 문자열)",
    "category_name": "종류구분 (없으면 빈 문자열)",
    "quantity": 숫자 또는 null,
    "unit_price": 숫자 또는 null,
    "amount": 숫자 (필수),
    "vat_included": true 또는 false (기본 true),
    "payment_method_name": "결제수단 (없으면 빈 문자열)",
    "payment_type": "immediate 또는 credit",
    "tax_invoice_issued": true 또는 false,
    "note1": "메모1 (없으면 빈 문자열)",
    "note2": "메모2 (없으면 빈 문자열)"
  }
]

CSV:
${csv}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    return NextResponse.json({ rows: parsed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "인식 실패" }, { status: 500 });
  }
}
