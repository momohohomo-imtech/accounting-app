"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import {
  createAccount,
  updateAccount,
  setAccountPassword,
  deleteAccount,
  suspendAccount,
  unsuspendAccount,
  type Account,
  type Role,
} from "@/lib/actions/accounts";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

const ROLE_LABEL: Record<Role, string> = { admin: "관리자", staff: "직원", tax_agent: "세무사" };

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (v: Role) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Role)} className={`${fieldClass} w-28`}>
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

function AccountRow({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [editingInfo, setEditingInfo] = useState(false);
  const [name, setName] = useState(account.name);
  const [role, setRole] = useState<Role>(account.role);
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hours, setHours] = useState("");

  async function handleSaveInfo() {
    if (!name.trim()) {
      setMessage("이름을 입력해주세요.");
      return;
    }
    if (!(await confirm(`${account.name}(${account.email}) 계정 정보를 저장하시겠습니까?`))) return;
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("id", account.id);
    fd.append("name", name);
    fd.append("role", role);
    const result = await globalPending.run(() => updateAccount(fd));
    setPending(false);
    if (result?.error) {
      setMessage(result.error);
    } else {
      setEditingInfo(false);
      router.refresh();
    }
  }

  async function handleSetPassword() {
    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (!(await confirm(`${account.name}(${account.email}) 계정의 비밀번호를 변경하시겠습니까?`))) return;
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("user_id", account.id);
    fd.append("new_password", password);
    const result = await globalPending.run(() => setAccountPassword(fd));
    setPending(false);
    if (result?.error) {
      setMessage(result.error);
    } else {
      setMessage("비밀번호가 변경되었습니다.");
      setPassword("");
      setPasswordConfirm("");
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
    const result = await globalPending.run(() => (account.suspended ? unsuspendAccount(fd) : suspendAccount(fd)));
    setPending(false);
    if (result?.error) {
      setMessage(result.error);
    } else {
      setHours("");
      router.refresh();
    }
  }

  async function handleDelete() {
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("id", account.id);
    const result = await globalPending.run(() => deleteAccount(fd));
    setPending(false);
    setConfirmDelete(false);
    if (result?.error) {
      setMessage(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {editingInfo ? (
            <div className="flex flex-wrap items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} w-40`} />
              <RoleSelect value={role} onChange={setRole} />
            </div>
          ) : (
            <p className="font-medium text-slate-900">
              {account.name} <span className="font-normal text-slate-400">({account.email})</span>{" "}
              <span className="text-xs font-normal text-slate-500">[{ROLE_LABEL[account.role]}]</span>
              {isSelf && <span className="ml-1 text-xs font-normal text-slate-400">(나)</span>}
            </p>
          )}
          {account.role === "tax_agent" && (
            <p className={`mt-0.5 text-xs font-medium ${account.suspended ? "text-red-600" : "text-emerald-600"}`}>
              {account.suspended ? "정지됨 — 로그인 불가" : "정상 — 로그인 가능"}
            </p>
          )}
          {account.role === "tax_agent" && !account.suspended && account.resuspendAt && (
            <p className="mt-0.5 text-xs text-amber-600">{formatDateTime(account.resuspendAt)}에 자동으로 다시 정지됩니다</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editingInfo ? (
            <>
              <Button type="button" size="sm" onClick={handleSaveInfo} disabled={pending}>
                저장
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingInfo(false);
                  setName(account.name);
                  setRole(account.role);
                }}
                disabled={pending}
              >
                취소
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingInfo(true)} disabled={pending}>
              정보 수정
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setChangingPassword((v) => !v);
              setPassword("");
              setPasswordConfirm("");
            }}
            disabled={pending}
          >
            비밀번호 변경
          </Button>
          {account.role === "tax_agent" && (
            <>
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
            </>
          )}
          {confirmDelete ? (
            <>
              <span className="text-xs font-medium text-red-600">정말 삭제?</span>
              <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={pending}>
                확인
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmDelete(false)} disabled={pending}>
                취소
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={pending || isSelf}
              title={isSelf ? "본인 계정은 삭제할 수 없습니다" : undefined}
            >
              삭제
            </Button>
          )}
        </div>
      </div>

      {changingPassword && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)"
              className={`${fieldClass} max-w-xs`}
            />
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="새 비밀번호 확인"
              className={`${fieldClass} max-w-xs`}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSetPassword}
              disabled={pending || !password || password !== passwordConfirm}
            >
              저장
            </Button>
          </div>
          {password && passwordConfirm && password !== passwordConfirm && (
            <p className="mt-1 text-xs text-red-600">비밀번호가 서로 일치하지 않습니다.</p>
          )}
        </div>
      )}

      {message && <p className="mt-2 text-xs text-slate-500">{message}</p>}
    </div>
  );
}

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (!(await confirm(`${email} 계정을 추가하시겠습니까?`))) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("email", email);
    fd.append("password", password);
    fd.append("name", name);
    fd.append("role", role);
    const result = await globalPending.run(() => createAccount(fd));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-2 rounded-xl border border-dashed border-slate-300 p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>이름</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>초기 비밀번호 (6자 이상)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>초기 비밀번호 확인</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>역할</label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
      </div>
      {password && passwordConfirm && password !== passwordConfirm && (
        <p className="text-xs text-red-600">비밀번호가 서로 일치하지 않습니다.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !password || password !== passwordConfirm}>
          추가
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDone} disabled={pending}>
          취소
        </Button>
      </div>
    </form>
  );
}

export function AccountPanel({
  accounts,
  currentUserId,
  adminApiConfigured,
}: {
  accounts: Account[];
  currentUserId: string;
  adminApiConfigured: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>계정 관리</CardTitle>
        {!showAdd && (
          <Button type="button" size="sm" onClick={() => setShowAdd(true)}>
            + 계정 추가
          </Button>
        )}
      </CardHeader>
      <p className="mb-3 text-xs text-slate-400">
        본 계정(admin)에서만 보이는 영역입니다. 계정을 추가·삭제하거나, 이름/역할을 바꾸거나, 비밀번호를 재설정할 수
        있어요. 세무사 계정은 필요할 때 로그인을 일시적으로 막을 수도 있습니다.
      </p>
      {!adminApiConfigured && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          .env.local에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 이 영역의 기능이 동작하지 않아요. Supabase 대시보드
          → Settings → API에서 service_role 키를 복사해 .env.local에 추가한 뒤 서버를 다시 시작해주세요.
        </p>
      )}
      {showAdd && <AddAccountForm onDone={() => setShowAdd(false)} />}
      <div className="space-y-3">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} isSelf={a.id === currentUserId} />
        ))}
        {accounts.length === 0 && <p className="text-sm text-slate-400">등록된 계정이 없습니다.</p>}
      </div>
    </Card>
  );
}
