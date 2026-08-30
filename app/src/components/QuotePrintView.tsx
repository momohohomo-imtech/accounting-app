import { formatWon, formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type QuoteItemRow = {
  id: string;
  item_name: string | null;
  spec: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
};

export function QuotePrintView({
  quote,
  items,
}: {
  quote: {
    quote_number: string | null;
    title: string;
    clientName: string | null;
    projectLabel: string | null;
    valid_until: string | null;
    memo: string | null;
    created_at: string;
  };
  items: QuoteItemRow[];
}) {
  const total = items.reduce((s, it) => s + it.amount, 0);

  return (
    <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 print:block print:rounded-none print:border-0 print:p-0">
      <div className="mb-2 flex justify-end">
        <PrintButton />
      </div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">견적서</h2>
          <p className="mt-1 font-mono text-sm text-slate-400">{quote.quote_number}</p>
        </div>
        <p className="text-sm text-slate-500">{formatDate(quote.created_at)}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <p>
          <span className="text-slate-500">건명: </span>
          <span className="font-medium text-slate-900">{quote.title}</span>
        </p>
        <p>
          <span className="text-slate-500">거래처: </span>
          <span className="font-medium text-slate-900">{quote.clientName ?? "-"}</span>
        </p>
        {quote.projectLabel && (
          <p>
            <span className="text-slate-500">연결 프로젝트: </span>
            <span className="font-medium text-slate-900">{quote.projectLabel}</span>
          </p>
        )}
        <p>
          <span className="text-slate-500">유효기한: </span>
          <span className="font-medium text-slate-900">{quote.valid_until ? formatDate(quote.valid_until) : "-"}</span>
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-t border-slate-300 text-left text-slate-500">
            <th className="py-2 pr-2">품목</th>
            <th className="py-2 pr-2">규격</th>
            <th className="py-2 pr-2 text-right">수량</th>
            <th className="py-2 pr-2 text-right">단가</th>
            <th className="py-2 text-right">금액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="py-2 pr-2">{it.item_name ?? "-"}</td>
              <td className="py-2 pr-2 text-slate-500">{it.spec ?? "-"}</td>
              <td className="py-2 pr-2 text-right font-mono">{it.quantity ?? "-"}</td>
              <td className="py-2 pr-2 text-right font-mono">{it.unit_price ? formatWon(it.unit_price) : "-"}</td>
              <td className="py-2 text-right font-mono">{formatWon(it.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-400">
                등록된 품목이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300">
            <td colSpan={4} className="py-2 text-right font-semibold text-slate-900">
              합계
            </td>
            <td className="py-2 text-right font-mono text-base font-bold text-slate-900">{formatWon(total)}</td>
          </tr>
        </tfoot>
      </table>

      {quote.memo && (
        <div className="mt-6 text-sm">
          <p className="text-slate-500">메모</p>
          <p className="whitespace-pre-wrap text-slate-700">{quote.memo}</p>
        </div>
      )}
    </div>
  );
}
