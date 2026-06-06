// Canonical phone normaliser for the client. MUST stay in lock-step with the
// SQL normalize_phone() function and the edge normalizePhone() helper so an
// identity attached in the browser keys the same row a webhook resolves.
// Uzbek-first: bare 9-digit local numbers get the +998 country code.
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let n = phone.replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('998')) {
    n = '+' + n;
  } else if (n.startsWith('9') && n.length === 9) {
    n = '+998' + n;
  }
  return n;
}
