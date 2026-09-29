import { Badge } from "@/components/ui/Badge";

// 거래의 세금계산서 체크(tax_invoice_issued) 여부 — 외상 관리 목록·거래처별 이력에서 한눈에 보이게(사용자 요청).
// 휴대폰에선 금액·수정·삭제와 한 줄에 들어가게 "계산서 O/X"로 짧게. 인쇄(A4 폭도 md 미만)는 긴 글자로 되돌림.
export function TaxInvoiceBadge({ issued }: { issued: boolean }) {
  return (
    <Badge variant={issued ? "emerald" : "slate"} className="shrink-0 whitespace-nowrap">
      <span className="md:hidden print:hidden">{issued ? "계산서 O" : "계산서 X"}</span>
      <span className="max-md:hidden print:inline">{issued ? "계산서 발행" : "계산서 미발행"}</span>
    </Badge>
  );
}
