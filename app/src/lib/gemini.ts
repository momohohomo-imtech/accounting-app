// 서버 전용 — 제미나이 호출 공용(영수증·급여대장 인식에만 씀, CLAUDE.md "외부 AI는 영수증·급여대장 인식에만").
// 예전 라이브러리(@google/generative-ai)는 구글이 지원을 끝내서 새 라이브러리(@google/genai)로 옮김.
// 모델 이름은 Vercel 환경변수 GEMINI_MODEL(없으면 DEFAULT_GEMINI_MODEL). 구글은 모델을 몇 달~1년 단위로 종료해서, 종료되면
// "모델을 찾지 못함"(404) 오류가 남 — 그때는 화면에 환경변수를 바꾸라는 안내가 나오게(geminiErrorMessage, 검사: gemini.test.ts).
import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

// 한 번 시도에 25초, 바쁨(429·5xx)이면 한 번만 다시 — 둘 다 합쳐도 서버 시간 제한(60초) 안에 끝나게.
const ATTEMPT_TIMEOUT_MS = 25_000;
const RETRY = { attempts: 2, initialDelay: 1, maxDelay: 4 };

export async function generateGeminiText({
  apiKey,
  prompt,
  file,
  model = geminiModel(),
  baseUrl,
}: {
  apiKey: string;
  prompt: string;
  /** base64 내용과 형식(사진·PDF) — 없으면 글만 보냄(엑셀을 글로 바꾼 급여대장 등). */
  file?: { data: string; mimeType: string };
  model?: string;
  /** 검사용 가짜 서버 주소 — 앱에서는 비워 둠(구글 주소). */
  baseUrl?: string;
}): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: ATTEMPT_TIMEOUT_MS, retryOptions: RETRY, ...(baseUrl ? { baseUrl } : {}) },
  });
  const parts = [{ text: prompt }, ...(file ? [{ inlineData: { data: file.data, mimeType: file.mimeType } }] : [])];
  const response = await ai.models.generateContent({ model, contents: [{ role: "user", parts }] });
  return response.text ?? "";
}

/** 제미나이 답에서 JSON 부분만 꺼냄(앞뒤 설명·```json 표시가 붙어 와도). 없거나 깨졌으면 null. */
export function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** 제미나이 오류를 무엇을 하면 되는지 알 수 있는 문구로. */
export function geminiErrorMessage(err: unknown, model: string): string {
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (status === 404 || /not found|is not supported|NOT_FOUND|no longer available|deprecated/i.test(message)) {
    return `제미나이 모델 "${model}"을 쓸 수 없습니다(구글이 모델을 종료했거나 이름이 바뀜). Vercel 환경변수 GEMINI_MODEL을 지금 쓸 수 있는 모델 이름(구글 AI Studio에서 확인)으로 바꾼 뒤 다시 배포해 주세요.`;
  }
  if (status === 401 || status === 403 || /API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
    return "제미나이 API 키가 맞지 않거나 사용 권한이 없습니다. Vercel 환경변수 GEMINI_API_KEY를 확인해 주세요.";
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return "제미나이 사용 한도를 넘었습니다. 잠시 뒤 다시 시도하거나 구글 AI Studio에서 사용량을 확인해 주세요.";
  }
  if ((status !== null && status >= 500) || /UNAVAILABLE|overloaded|timed? ?out|aborted/i.test(message)) {
    return "제미나이 서버가 바빠 응답하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
  }
  return `인식 중 오류가 발생했습니다: ${message.slice(0, 200) || "알 수 없는 오류"}`;
}
