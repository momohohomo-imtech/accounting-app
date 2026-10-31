import { NextRequest, NextResponse } from "next/server";
import { extractJson, generateGeminiText, geminiErrorMessage, geminiModel } from "@/lib/gemini";
import ExcelJS from "exceljs";

// 제미나이 응답을 기다리는 시간(lib/gemini.ts의 시도 시간·재시도와 맞춤).
export const maxDuration = 60;

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

async function excelToCsv(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buf as any);
  const worksheet = workbook.worksheets[0];
  const lines: string[] = [];
  worksheet.eachRow((row) => {
    const values = (row.values as unknown[]).slice(1).map(cellToString);
    lines.push(values.join(","));
  });
  return lines.join("\n");
}

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
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  let csv: string | null = null;
  if (isExcel) {
    try {
      csv = await excelToCsv(file);
    } catch {
      return NextResponse.json({ error: "엑셀 파일을 읽지 못했습니다." }, { status: 400 });
    }
  }

  const bytes = isExcel ? "" : Buffer.from(await file.arrayBuffer()).toString("base64");

  const model = geminiModel();

  const prompt = `이 ${isExcel ? "CSV로 변환한 표" : "파일"}은 한국 급여대장 또는 상여대장 표야. 직원별 행을 전부 읽어서 아래 JSON 형식으로만 답해줘. 다른 설명 없이 JSON만 출력해.

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
    const text = isExcel
      ? await generateGeminiText({ apiKey, model, prompt: `${prompt}\n\nCSV:\n${csv}` })
      : await generateGeminiText({ apiKey, model, prompt, file: { data: bytes, mimeType: file.type || "application/pdf" } });
    return NextResponse.json({ extracted: extractJson(text), raw: text });
  } catch (err) {
    return NextResponse.json({ error: geminiErrorMessage(err, model) }, { status: 502 });
  }
}
