// "@/lib/credit" 같은 경로 별칭(tsconfig paths)과 확장자 없는 import를 실제 .ts 파일로 연결.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  let url = null;
  if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), SRC);
  else if (specifier.startsWith("./") || specifier.startsWith("../")) url = new URL(specifier, context.parentURL);
  if (url && !/\.[cm]?[jt]sx?$/.test(url.pathname)) {
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const candidate = new URL(url.href + ext);
      if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
    }
  }
  return next(url ? url.href : specifier, context);
}
