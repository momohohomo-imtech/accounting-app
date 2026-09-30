import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { isVisibleQuoteItem, quoteLineAmounts } from "@/lib/quoteCalc";
import { QuotesTable } from "@/components/QuotesTable";
import { LinkButton } from "@/components/ui/Button";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import type { FieldConfig } from "@/components/crud/types";
import { fetchCompanyProfiles } from "@/lib/companyProfileQuery";
import {
  createCompanyProfile,
  updateCompanyProfile,
  deleteCompanyProfile,
} from "@/lib/actions/companyProfiles";

// 견적서 공급자 목록(company_profiles) — 견적서 작성·인쇄화면에서 골라 쓰는 우리 회사 정보.
const supplierFields: FieldConfig[] = [
  { name: "company_name", label: "상호", required: true },
  { name: "representative_name", label: "대표자" },
  { name: "biz_reg_no", label: "사업자등록번호", tableLabel: "등록번호", placeholder: "000-00-00000" },
  { name: "address", label: "사업장 소재지", tableLabel: "주소" },
  { name: "biz_type", label: "업태" },
  { name: "biz_item", label: "종목" },
  { name: "phone", label: "전화", type: "tel" },
  { name: "fax", label: "팩스", type: "tel" },
  { name: "is_default", label: "기본 공급자 (새 견적서가 처음 고르는 공급자)", tableLabel: "기본", type: "checkbox" },
];

export async function QuotesSection({ suppliersOpen = false }: { suppliersOpen?: boolean }) {
  const supabase = await createClient();
  type QuoteRow = {
    id: string;
    quote_number: string;
    title: string;
    status: string;
    created_at: string;
    client_id: string | null;
    client_name_raw: string | null;
    clients: { name: string } | { name: string }[] | null;
    projects: { name: string; project_code: string | null } | { name: string; project_code: string | null }[] | null;
  };
  type QuoteItemRow = {
    quote_id: string;
    amount: number;
    unit_price: number | null;
    quantity: number | null;
    handling_fee_pct: number | null;
    group_label: string | null;
    is_group_summary: boolean;
  };
  const [quotes, items, { data: profiles, error: profilesError }] = await Promise.all([
    fetchAllRows<QuoteRow>((from, to) =>
      supabase
        .from("quotes")
        .select("id, quote_number, title, status, created_at, client_id, client_name_raw, clients(name), projects(name, project_code)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<QuoteItemRow>((from, to) =>
      supabase
        .from("quote_items")
        .select("quote_id, amount, unit_price, quantity, handling_fee_pct, group_label, is_group_summary")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchCompanyProfiles(supabase),
  ]);

  const totalByQuote = new Map<string, number>();
  for (const it of items.filter(isVisibleQuoteItem)) {
    const { confirmed } = quoteLineAmounts(it);
    totalByQuote.set(it.quote_id, (totalByQuote.get(it.quote_id) ?? 0) + confirmed);
  }

  const rows = quotes.map((q) => {
    const client = one(q.clients) as { name: string } | null;
    const project = one(q.projects) as { name: string; project_code: string | null } | null;
    return {
      id: q.id,
      quote_number: q.quote_number,
      title: q.title,
      clientName: client?.name ?? q.client_name_raw,
      projectLabel: project ? `${project.project_code ?? ""} ${project.name}`.trim() : null,
      status: q.status,
      total: totalByQuote.get(q.id) ?? 0,
      created_at: q.created_at,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">견적서</h2>
        <LinkButton href="/quotes/new">+ 견적서 작성</LinkButton>
      </div>
      <CollapsibleSection
        title={`공급자 목록${profilesError ? "" : ` (${(profiles ?? []).length})`}`}
        defaultOpen={suppliersOpen}
      >
        {profilesError ? (
          <p className="text-sm text-amber-700">
            공급자 목록 표가 아직 없습니다 — Supabase SQL Editor에서 <code>089_company_profiles.sql</code>을 실행하면
            쓸 수 있습니다. 그 전까지 견적서 공급자는 예전처럼 견적서 화면에서 직접 입력합니다.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              견적서에 찍히는 우리 회사(공급자) 정보 — 견적서 작성·수정 화면에서 골라 씁니다. &lsquo;기본&rsquo;은 새
              견적서가 처음 고르는 공급자입니다. 여기서 고치거나 지워도 이미 저장한 견적서는 그대로입니다.
            </p>
            <CreatePanel title="공급자" fields={supplierFields} createAction={createCompanyProfile} />
            <EntityTable
              fields={supplierFields}
              rows={profiles ?? []}
              updateAction={updateCompanyProfile}
              deleteAction={deleteCompanyProfile}
            />
          </div>
        )}
      </CollapsibleSection>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <QuotesTable rows={rows} />
      </div>
    </div>
  );
}
