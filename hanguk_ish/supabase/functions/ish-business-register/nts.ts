// 국세청 사업자등록 상태조회 (data.go.kr «국세청_사업자등록정보 진위확인 및
// 상태조회 서비스», odcloud) and the 사업자등록번호 check digit.

/// The 10-digit number passes the 국세청 check digit: the first nine digits
/// weighted 1 3 7 1 3 7 1 3 5, plus the tens of the ninth digit × 5; the
/// tenth digit brings the sum to a multiple of ten.
export function isValidBizNo(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * weights[i];
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

/// What 국세청 says about a number. `unchecked`: no key or no answer — the
/// business waits for a person to check it (pending).
export type NtsResult =
  | { kind: "active"; code: "01" } // 계속사업자
  | { kind: "suspended"; code: "02" } // 휴업자
  | { kind: "closed"; code: "03" } // 폐업자
  | { kind: "unknown" } // 국세청에 등록되지 않은 사업자등록번호
  | { kind: "unchecked" };

export const NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status";

/// Asks 국세청 for [bizNo]. [serviceKey] is the data.go.kr «Decoding» key.
export async function ntsStatus(
  bizNo: string,
  serviceKey: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<NtsResult> {
  if (!serviceKey) return { kind: "unchecked" };
  try {
    const response = await fetchFn(`${NTS_STATUS_URL}?serviceKey=${encodeURIComponent(serviceKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ b_no: [bizNo] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { kind: "unchecked" };
    const body = await response.json();
    const row = Array.isArray(body?.data) ? body.data[0] : undefined;
    switch (row?.b_stt_cd) {
      case "01":
        return { kind: "active", code: "01" };
      case "02":
        return { kind: "suspended", code: "02" };
      case "03":
        return { kind: "closed", code: "03" };
      case "":
        return { kind: "unknown" };
      default:
        return { kind: "unchecked" };
    }
  } catch {
    return { kind: "unchecked" };
  }
}

/// What a business still waiting (pending) becomes when 국세청 is asked
/// again: 계속사업자 is verified, 폐업자 refused, 휴업자 keeps waiting with
/// its code. Null: no new answer (no key, no answer, or a number 국세청 does
/// not list yet) — it keeps waiting as it is.
export function recheckUpdate(nts: NtsResult): { status?: "verified" | "rejected"; nts_status: string } | null {
  switch (nts.kind) {
    case "active":
      return { status: "verified", nts_status: "01" };
    case "suspended":
      return { nts_status: "02" };
    case "closed":
      return { status: "rejected", nts_status: "03" };
    default:
      return null;
  }
}

/// The name a business has until its owner or an admin sets the real one
/// (BA0 asks only for the number): 사업장 123-45-67891.
export function placeholderName(bizNo: string): string {
  return `사업장 ${bizNo.slice(0, 3)}-${bizNo.slice(3, 5)}-${bizNo.slice(5)}`;
}
