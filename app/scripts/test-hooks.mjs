// `npm test`용 — Node 내장 테스트(node:test)가 TypeScript 소스를 그대로 읽도록 경로만 맞춰 준다.
// 별도 테스트 라이브러리 없이 Node 22의 타입 제거(type stripping)로 .ts를 실행.
import { register } from "node:module";

register("./test-resolve.mjs", import.meta.url);
