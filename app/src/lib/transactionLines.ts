// 매입매출 등록의 품목 줄 — 거래처·프로젝트·카테고리·결제수단은 품목이 1줄이면 위쪽 공통 칸, 2줄 이상이면 줄마다(11/27 사용자 요청
// "여러 항목 추가 시 카테고리·결제수단 각기 선택 — 프로젝트처럼" → 같은 날 "거래처 이름도"). 줄 수가 바뀔 때 공통 칸 ↔ 줄 값을 옮기는 규칙,
// 저장할 때 줄마다 쓸 값, 비과세 카테고리 줄의 VAT·세금계산서, 줄 거래처 칸 글자 ↔ 등록 거래처는 여기로만(TransactionForm).
// 검사: transactionLines.test.ts
export type LineCommons = {
  project_id: string;
  category_id: string;
  payment_method_id: string;
  /** 거래처 — 등록 거래처(client_id)와 직접 입력 이름(client_name_raw)은 한 묶음으로 옮김(한쪽만 섞여 다른 거래처가 되지 않게) */
  client_id: string;
  client_name_raw: string;
};

export const EMPTY_LINE_COMMONS: LineCommons = {
  project_id: "",
  category_id: "",
  payment_method_id: "",
  client_id: "",
  client_name_raw: "",
};

type ClientPair = { client_id: string; client_name_raw: string };
const hasClient = (x: ClientPair) => Boolean(x.client_id || x.client_name_raw);
const pairOf = (x: ClientPair): ClientPair => ({ client_id: x.client_id, client_name_raw: x.client_name_raw });

/**
 * 줄이 2개 이상이 되면 공통 칸 값을 빈 줄에 옮겨 적고 공통 칸은 비움(그때부터 줄의 빈 값 = 프로젝트는 일반경비, 거래처·카테고리·결제수단은
 * 선택 안 함), 1줄로 돌아오면 그 줄 값을 다시 공통 칸으로. 줄을 추가한 뒤 위쪽 칸을 바꾸면 "(공통)" 줄까지 같이 바뀌어 원래 프로젝트에서
 * 거래가 빠졌던 것(사용자 문의) — 그래서 2줄부터는 위쪽 칸을 숨기고 줄마다 고름.
 */
export function splitLineCommons<L extends LineCommons>(lines: L[], common: LineCommons): { lines: L[]; common: LineCommons } {
  if (lines.length > 1) {
    return {
      lines: lines.map((li) => ({
        ...li,
        project_id: li.project_id || common.project_id,
        category_id: li.category_id || common.category_id,
        payment_method_id: li.payment_method_id || common.payment_method_id,
        ...(hasClient(li) ? pairOf(li) : pairOf(common)),
      })),
      common: { ...EMPTY_LINE_COMMONS },
    };
  }
  if (lines.length === 1) {
    const only = lines[0];
    return {
      lines: [{ ...only, ...EMPTY_LINE_COMMONS }],
      common: {
        project_id: only.project_id || common.project_id,
        category_id: only.category_id || common.category_id,
        payment_method_id: only.payment_method_id || common.payment_method_id,
        ...(hasClient(only) ? pairOf(only) : pairOf(common)),
      },
    };
  }
  return { lines, common };
}

/**
 * 저장할 때 줄의 거래처·프로젝트·카테고리·결제수단. 프로젝트는 줄 값, 없으면 공통(1줄일 때도 줄 칸에서 따로 고른 프로젝트가 우선 — 예전
 * 그대로). 거래처·카테고리·결제수단은 2줄 이상이면 줄 값만(위쪽 칸은 숨겨져 있어 화면에 안 보이는 값을 쓰지 않게), 1줄이면 공통 칸.
 */
export function resolveLineCommons(li: LineCommons, common: LineCommons, perLine: boolean): LineCommons {
  return {
    project_id: li.project_id || common.project_id,
    category_id: perLine ? li.category_id : li.category_id || common.category_id,
    payment_method_id: perLine ? li.payment_method_id : li.payment_method_id || common.payment_method_id,
    ...(perLine || hasClient(li) ? pairOf(li) : pairOf(common)),
  };
}

/** 줄의 VAT 추가·세금계산서 — 비과세 카테고리 줄은 위쪽 체크와 상관없이 둘 다 끔(1줄일 때·일괄 변경과 같은 규칙: 비과세는 세금계산서 없음) */
export function lineTaxFlags(exempt: boolean, form: { vat_included: boolean; tax_invoice_issued: boolean }) {
  return { vat_included: !exempt && form.vat_included, tax_invoice_issued: !exempt && form.tax_invoice_issued };
}

/**
 * 한 결제로 묶인 줄을 한꺼번에 수정할 때 위쪽 VAT 추가·세금계산서 체크 = 비과세가 아닌 줄의 값(묶음 전체 수정은 그 줄들끼리 같을 때만 열림 —
 * lib/paymentGroup.ts의 sameCommonFields), 모두 비과세면 끔. 누른 줄이 비과세 줄이면 그 줄 값(늘 꺼짐)으로 열려, 저장할 때 다른 줄의
 * 부가세가 빠졌을 것.
 */
export function groupTaxFlags<T extends { vat_included: boolean; tax_invoice_issued: boolean }>(lines: T[], isExempt: (line: T) => boolean) {
  const taxed = lines.find((l) => !isExempt(l));
  return { vat_included: taxed?.vat_included ?? false, tax_invoice_issued: taxed?.tax_invoice_issued ?? false };
}

type ClientInfo = { id: string; name: string; default_item_name?: string | null; default_category_id?: string | null };

/** 줄 거래처 칸에 보일 글자 — 등록 거래처면 그 이름(목록에 없으면 직접 입력 이름), 아니면 직접 입력 이름 */
export function lineClientText(pair: ClientPair, clients: ClientInfo[]): string {
  if (pair.client_id) return clients.find((c) => c.id === pair.client_id)?.name ?? pair.client_name_raw;
  return pair.client_name_raw;
}

/**
 * 줄 거래처 칸에 친 글자 → 등록 거래처 이름과 똑같으면 등록 거래처, 아니면 직접 입력 이름. 치는 중엔 앞뒤 빈칸도 그대로 둠("○○ 지점"을 치다가
 * "○○ "에서 등록 거래처로 바뀌어 빈칸이 지워지지 않게) — 빈칸 정리는 칸에서 벗어날 때(settleClientPair).
 */
export function clientPairFromText(text: string, clients: ClientInfo[]): ClientPair {
  const match = clients.find((c) => c.name === text);
  return match ? { client_id: match.id, client_name_raw: "" } : { client_id: "", client_name_raw: text };
}

/** 줄 거래처 칸에서 벗어날 때 — 앞뒤 빈칸을 빼고, 등록 거래처 이름과 같으면 등록 거래처로(이미 등록 거래처면 그대로) */
export function settleClientPair(pair: ClientPair, clients: ClientInfo[]): ClientPair {
  if (pair.client_id) return pairOf(pair);
  const name = pair.client_name_raw.trim();
  const match = name ? clients.find((c) => c.name === name) : undefined;
  return match ? { client_id: match.id, client_name_raw: "" } : { client_id: "", client_name_raw: name };
}

/** 거래처 기본 품목·카테고리를 그 줄의 빈칸에만(이미 적거나 고른 줄은 그대로) */
export function fillClientDefaults<L extends { item_name: string; category_id: string }>(line: L, client: ClientInfo | undefined): L {
  if (!client) return line;
  return {
    ...line,
    item_name: line.item_name || client.default_item_name || "",
    category_id: line.category_id || client.default_category_id || "",
  };
}

/**
 * 거래처 열쇠 — 예전 품목 불러오기(등록 거래처는 id, 직접 입력은 앞뒤 빈칸 뺀 이름 — 두 글자부터, 예전과 같은 기준). 없으면 null.
 */
export function clientHistoryKey(pair: ClientPair): string | null {
  if (pair.client_id) return `id:${pair.client_id}`;
  const name = pair.client_name_raw.trim();
  return name.length >= 2 ? `name:${name}` : null;
}

/** 열쇠 → 예전 품목 불러오기 인자 */
export function clientHistoryQuery(key: string): { clientId: string } | { clientName: string } {
  return key.startsWith("id:") ? { clientId: key.slice(3) } : { clientName: key.slice(5) };
}

/** 줄들에 고른 거래처 종류 수(빈 칸 빼고, 직접 입력은 앞뒤 빈칸 뺀 이름) — 둘 이상인데 "한 결제로 묶기"면 알림 */
export function distinctClientCount(lines: ClientPair[]) {
  return new Set(lines.map((l) => (l.client_id ? `id:${l.client_id}` : l.client_name_raw.trim() ? `name:${l.client_name_raw.trim()}` : "")).filter(Boolean)).size;
}

/** 줄들에 고른 결제수단 종류 수(빈 칸 빼고) — 둘 이상인데 "한 결제로 묶기"면 따로 결제한 것일 수 있어 알림 */
export function distinctPaymentMethodCount(lines: { payment_method_id: string }[]) {
  return new Set(lines.map((l) => l.payment_method_id).filter(Boolean)).size;
}
