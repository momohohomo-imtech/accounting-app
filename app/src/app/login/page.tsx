import Image from "next/image";
import { signIn } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import { ClearIdleLogoutMark } from "@/components/ClearIdleLogoutMark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="brand-login flex min-h-screen flex-col items-center justify-center bg-brand-navy px-4 py-10">
      <div className="mb-6 flex items-center gap-3 text-white">
        <Image src="/logo-icon.png" alt="" width={44} height={44} priority className="rounded-xl shadow-lg shadow-black/30 ring-1 ring-white/15" />
        <div className="leading-tight">
          <p className="text-lg font-bold tracking-tight">IM테크</p>
          <p className="text-xs text-white/60">Infinite Moves</p>
        </div>
      </div>
      <Card className="w-full max-w-sm overflow-hidden border-white/40 shadow-2xl shadow-black/30" padding="lg">
        {/* 로고 색(빨강 막대 + 파랑) 띠 */}
        <div className="-mx-8 -mt-8 mb-7 h-1 bg-[linear-gradient(90deg,var(--brand-red)_0_28%,var(--brand)_28%_100%)]" aria-hidden />
        <h1 className="text-xl font-bold text-slate-900">회계 관리 시스템</h1>
        <p className="mt-1 text-sm text-slate-500">로그인</p>

        {params.reason === "idle" && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            30분 이상 사용하지 않아 자동으로 로그아웃됐어요. 다시 로그인해 주세요.
          </p>
        )}
        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{params.error}</p>
        )}

        <form action={signIn} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">이메일</label>
            <input type="email" name="email" required className={`mt-1 ${fieldClass}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
            <input type="password" name="password" required minLength={6} className={`mt-1 ${fieldClass}`} />
          </div>
          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
      </Card>
      <ClearIdleLogoutMark />
    </div>
  );
}
