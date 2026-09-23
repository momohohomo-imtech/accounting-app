"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";

// 로그인 후 화면에서 오류가 나면 사이드바는 그대로 두고 본문 자리에 이 안내를 띄운다.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg pt-10">
      <Card padding="lg">
        <h1 className="text-lg font-bold text-slate-900">화면을 불러오지 못했어요</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요. 입력 중이던 내용이 저장됐는지는 해당 화면에서 한 번
          확인해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => retry()}>다시 시도</Button>
          <LinkButton href="/dashboard" variant="secondary">
            대시보드로 가기
          </LinkButton>
        </div>
        {error.digest && <p className="mt-6 text-xs text-slate-400">오류 코드: {error.digest}</p>}
      </Card>
    </div>
  );
}
