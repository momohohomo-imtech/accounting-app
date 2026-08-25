import { signIn } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm" padding="lg">
        <h1 className="text-xl font-bold text-slate-900">현장관리 시스템</h1>
        <p className="mt-1 text-sm text-slate-500">로그인</p>

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
    </div>
  );
}
