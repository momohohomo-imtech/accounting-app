import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { extractJson, generateGeminiText, geminiErrorMessage } from "@/lib/gemini";

// 가짜 제미나이 서버(구글로 아무것도 안 보냄, 가짜 내용만) — 새 라이브러리(@google/genai)가 보내는 요청·받는 답을 확인.
type Seen = { url: string; key: string | undefined; body: { contents?: { parts?: Record<string, unknown>[] }[] } };
async function withFakeGemini(fn: (baseUrl: string, seen: Seen[]) => Promise<void>) {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ url: req.url ?? "", key: req.headers["x-goog-api-key"] as string | undefined, body: JSON.parse(raw || "{}") });
      res.setHeader("content-type", "application/json");
      if (req.url?.includes("gone-model")) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: { code: 404, message: "models/gone-model is not found for API version v1beta", status: "NOT_FOUND" } }));
      }
      if (req.url?.includes("busy-model")) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: { code: 503, message: "The model is overloaded.", status: "UNAVAILABLE" } }));
      }
      res.end(
        JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: '```json\n{"amount": 12345, "client_name": "가짜 거래처"}\n```' }] } }],
        })
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, seen);
  } finally {
    server.close();
  }
}

test("제미나이 새 라이브러리: 글 + 사진(base64)을 보내고 답 글을 받음, 키는 머리글로", async () => {
  await withFakeGemini(async (baseUrl, seen) => {
    const text = await generateGeminiText({
      apiKey: "fake-key",
      prompt: "가짜 영수증을 읽어줘",
      file: { data: Buffer.from("가짜 사진").toString("base64"), mimeType: "image/jpeg" },
      model: "fake-model",
      baseUrl,
    });
    assert.deepEqual(extractJson(text), { amount: 12345, client_name: "가짜 거래처" });
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /models\/fake-model:generateContent/);
    assert.equal(seen[0].key, "fake-key");
    const parts = seen[0].body.contents?.[0]?.parts ?? [];
    assert.equal(parts[0].text, "가짜 영수증을 읽어줘");
    assert.deepEqual(parts[1].inlineData, { data: Buffer.from("가짜 사진").toString("base64"), mimeType: "image/jpeg" });
  });
});

test("제미나이: 글만 보낼 수도(엑셀을 글로 바꾼 급여대장)", async () => {
  await withFakeGemini(async (baseUrl, seen) => {
    await generateGeminiText({ apiKey: "k", prompt: "CSV:\n가짜,1", model: "fake-model", baseUrl });
    assert.equal(seen[0].body.contents?.[0]?.parts?.length, 1);
  });
});

test("제미나이: 모델이 종료돼 404면 GEMINI_MODEL을 바꾸라는 안내", async () => {
  await withFakeGemini(async (baseUrl) => {
    const err = await generateGeminiText({ apiKey: "k", prompt: "p", model: "gone-model", baseUrl }).then(
      () => null,
      (e: unknown) => e
    );
    assert.ok(err, "오류가 나야 함");
    const message = geminiErrorMessage(err, "gone-model");
    assert.match(message, /"gone-model"을 쓸 수 없습니다/);
    assert.match(message, /GEMINI_MODEL/);
  });
});

test("제미나이: 바쁨(503)이면 한 번만 다시 시도하고, 그래도 안 되면 잠시 뒤 다시 하라는 안내", async () => {
  await withFakeGemini(async (baseUrl, seen) => {
    const err = await generateGeminiText({ apiKey: "k", prompt: "p", model: "busy-model", baseUrl }).then(
      () => null,
      (e: unknown) => e
    );
    assert.equal(seen.length, 2);
    assert.match(geminiErrorMessage(err, "busy-model"), /바빠/);
  });
});

test("제미나이 오류 문구: 키·한도·그 밖의 오류", () => {
  assert.match(geminiErrorMessage({ status: 403, message: "x" }, "m"), /GEMINI_API_KEY/);
  assert.match(geminiErrorMessage(Object.assign(new Error("API key not valid"), { status: 400 }), "m"), /GEMINI_API_KEY/);
  assert.match(geminiErrorMessage(Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }), "m"), /사용 한도/);
  assert.match(geminiErrorMessage(new Error("가짜 알 수 없는 오류"), "m"), /인식 중 오류가 발생했습니다: 가짜 알 수 없는 오류/);
  assert.equal(extractJson("설명만 있고 JSON 없음"), null);
  assert.equal(extractJson("{깨진 JSON"), null);
});
