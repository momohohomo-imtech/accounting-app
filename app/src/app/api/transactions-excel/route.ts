import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { nowKst } from "@/lib/kstDate";
import { parseTransactionSheet } from "@/lib/transactionExcel";

// 엑셀 거래 일괄 등록 — 표를 첫 줄 머리글 이름으로 읽음(lib/transactionExcel.ts). 예전엔 제미나이가 읽었지만
// 사용자 요청으로 제미나이는 영수증·급여대장 인식에만 남기고 여기서는 외부로 아무것도 보내지 않는다.

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const anyV = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (anyV.richText) return anyV.richText.map((r) => r.text).join("");
    if (anyV.text) return anyV.text;
    if (anyV.result instanceof Date) return anyV.result.toISOString().slice(0, 10);
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

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const table: string[][] = [];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // exceljs bundles an old @types/node (via fast-csv) whose non-generic Buffer type
    // doesn't structurally match this project's Buffer<ArrayBufferLike> — types-only mismatch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buf as any);
    const worksheet = workbook.worksheets[0];
    worksheet.eachRow((row) => {
      // row.values는 1부터 시작하고 빈 칸은 구멍(hole)이라 Array.from으로 빈 글자로 채움.
      table.push(Array.from((row.values as unknown[]).slice(1), cellToString));
    });
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽지 못했습니다." }, { status: 400 });
  }

  const rows = parseTransactionSheet(table, nowKst().year);
  if (rows.length === 0) {
    return NextResponse.json({
      error:
        "표에서 거래를 찾지 못했습니다. 첫 줄에 날짜·구분·거래처명·프로젝트명·품목·종류구분·수량·단가·총금액·결제수단·결제시점·세금계산서발행·메모1·메모2 머리글이 있는지 확인해 주세요.",
    });
  }
  return NextResponse.json({ rows });
}
