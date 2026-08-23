import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteTransactionRecord } from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { PageTabs } from "@/components/PageTabs";
import { CreditSection } from "@/components/sections/CreditSection";
import { ClientsSection } from "@/components/sections/ClientsSection";

const TABS = [
  { key: "list", label: "매입매출" },
  { key: "credit", label: "외상관리" },
  { key: "clients", label: "거래처" },
];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; type?: string; project_id?: string }>;
}) {
  const { tab, year, type, project_id } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">매입매출·외상</h1>
        {active === "list" && (
          <Link
            href="/transactions/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + 거래 등록
          </Link>
        )}
      </div>

      <PageTabs basePath="/transactions" tabs={TABS} active={active} />

      {active === "credit" && <CreditSection />}
      {active === "clients" && <ClientsSection />}
      {active === "list" && <TransactionListSection year={year} type={type} project_id={project_id} />}
    </div>
  );
}

async function TransactionListSection({
  year,
  type,
  project_id,
}: {
  year?: string;
  type?: string;
  project_id?: string;
}) {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;

  let query = supabase
    .from("transactions")
    .select("*, clients(name), projects(name)")
    .gte("trans_date", `${selectedYear}-01-01`)
    .lte("trans_date", `${selectedYear}-12-31`)
    .order("trans_date", { ascending: false });

  if (type) query = query.eq("type", type);
  if (project_id) query = query.eq("project_id", project_id);

  const [{ data: transactions }, { data: projects }] = await Promise.all([
    query,
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

  function withParam(key: string, value: string) {
    const p = new URLSearchParams({ year: String(selectedYear), type: type ?? "", project_id: project_id ?? "" });
    if (value) p.set(key, value);
    else p.delete(key);
    return `/transactions?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/transactions?year=${y}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                y === selectedYear ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {[
            { v: "", label: "전체" },
            { v: "매입", label: "매입" },
            { v: "매출", label: "매출" },
          ].map((t) => (
            <Link
              key={t.v}
              href={withParam("type", t.v)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                (type ?? "") === t.v ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">날짜</th>
                <th className="pb-2 pr-4">구분</th>
                <th className="pb-2 pr-4">거래처</th>
                <th className="pb-2 pr-4">프로젝트</th>
                <th className="pb-2 pr-4">품목</th>
                <th className="pb-2 pr-4">결제방식</th>
                <th className="pb-2 pr-4 text-right">금액</th>
                <th className="pb-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-600">{formatDate(t.trans_date)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.type === "매출" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{t.clients?.name ?? t.client_name_raw ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.projects?.name ?? "일반경비"}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.item_name ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.payment_type === "credit" ? "외상" : "즉시"}</td>
                  <td className="py-2 pr-4 text-right font-medium text-slate-900">
                    {formatWon(t.type === "매출" ? t.sales_amount + t.sales_vat : t.purchase_amount + t.purchase_vat)}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/transactions/${t.id}/edit`}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        수정
                      </Link>
                      <form action={deleteTransactionRecord}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {(transactions ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    거래 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {projects && projects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Link
            href={withParam("project_id", "")}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              !project_id ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            전체 프로젝트
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={withParam("project_id", p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                project_id === p.id ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
