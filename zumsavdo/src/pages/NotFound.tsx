import { Link } from "react-router-dom";

export function NotFoundPage({ what = "Sahifa" }: { what?: string }) {
  return (
    <div className="page-head">
      <h1>{what} topilmadi</h1>
      <p className="subline">
        Manzil id boʻyicha ochiladi — masalan <code>/sotuvchi/9103</code>. Bunday id kuzatilmayapti
        yoki hali oʻlchov tushmagan.
      </p>
      <p style={{ marginTop: 14 }}>
        <Link to="/">← Bosh sahifaga</Link>
      </p>
    </div>
  );
}
