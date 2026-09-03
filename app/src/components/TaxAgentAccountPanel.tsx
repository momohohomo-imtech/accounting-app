"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import {
  setTaxAgentPassword,
  suspendTaxAgentAccount,
  unsuspendTaxAgentAccount,
  type TaxAgentAccount,
} from "@/lib/actions/tax-agent";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function AccountRow({ account }: { account: TaxAgentAccount }) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hours, setHours] = useState("");

  async function handleSetPassword() {
    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (!(await confirm(`${account.name}(${account.email}) 계정의 비밀번호를 변경하시겠습니까?`))) return;
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("user_id", account.id);
    fd.append("new_password", password);
    const result = await globalPending.run(() => setTaxAgentPassword(fd));
    setPending(false);
    if (result?.error) {
      setMessage(result.error);
    } else {
      setMessage("비밀번호가 변경되었습니다.");
      setPassword("");
      setChangingPassword(false);
    }
  }

  async function handleToggleSuspend() {
    const hoursNum = Number(hours);
    const durationLabel = account.suspended && hoursNum > 0 ? ` (${hoursNum}시간 동안만)` : "";
    const verb = account.suspended ? "정지를 해제" : "일시 정지";
    if (!(await confirm(`${account.name}(${account.email}) 계정을 ${verb}${durationLabel}하시겠습니까?`))) return;
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("user_id", account.id);
    if (account.suspended && hoursNum > 0) fd.append("hours", String(hoursNum));
    const result = await globalPending.run(() =>
      account.suspended ? unsuspendTaxAgentAccount(fd) : suspendTaxAgentAccount(fd)
    );
    setPending(false);
    if (result?.error) {
      setMessage(result.error);
    } else {
      setHours("");
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">
            {account.name} <span className="font-normal text-slate-400">({account.email})</span>
          </p>
          <p className={`mt-0.5 text-xs font-medium ${account.suspended ? "text-red-600" : "text-emerald-600"}`}>
            {account.suspended ? "정지됨 — 로그인 불가" : "정상 — 로그인 가능"}
          </p>
          {!account.suspended && account.resuspendAt && (
            <p className="mt-0.5 text-xs text-amber-600">{formatDateTime(account.resuspendAt)}에 자동으로 다시 정지됩니다</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setChangingPassword((v) => !v)}
            disabled={pending}
          >
            비밀번호 변경
          </Button>
          {account.suspended && (
            <input
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="시간(선택)"
              title="입력하면 그 시간 뒤에 자동으로 다시 정지됩니다. 비워두면 무기한 해제됩니다."
              className={`${fieldClass} w-24`}
            />
          )}
          <Button
            type="button"
            variant={account.suspended ? "primary" : "danger"}
            size="sm"
            onClick={handleToggleSuspend}
            disabled={pending}
          >
            {account.suspended ? "정지 해제" : "계정 정지"}
          </Button>
        </div>
      </div>

      {changingPassword && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            className={`${fieldClass} max-w-xs`}
          />
          <Button type="button" size="sm" onClick={handleSetPassword} disabled={pending}>
            저장
          </Button>
        </div>
      )}

      {message && <p className="mt-2 text-xs text-slate-500">{message}</p>}
    </div>
  );
}

export function TaxAgentAccountPanel({
  accounts,
  adminApiConfigured,
}: {
  accounts: TaxAgentAccount[];
  adminApiConfigured: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>세무사(회계사무실) 계정 관리</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-slate-400">
        본 계정(admin)에서만 보이는 영역입니다. 세무사 계정 비밀번호를 바꾸거나, 필요할 때 로그인을 일시적으로
        막을 수 있어요.
      </p>
      {!adminApiConfigured && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          .env.local에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 정지 상태 표시가 정확하지 않고, 아래 버튼도
          동작하지 않아요. Supabase 대시보드 → Settings → API에서 service_role 키를 복사해 .env.local에
          추가한 뒤 서버를 다시 시작해주세요.
        </p>
      )}
      <div className="space-y-3">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} />
        ))}
        {accounts.length === 0 && <p className="text-sm text-slate-400">등록된 세무사 계정이 없습니다.</p>}
      </div>
    </Card>
  );
}
