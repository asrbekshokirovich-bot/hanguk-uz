# ADR-009 — PDF blob access policy

- **Status:** Accepted (with safety adjustment)
- **Date:** 2026-05-07
- **Context:** plan §O.9, audit §10.3, ADR-007

## Question

When we crawl an SNU 모집요강 PDF and store the immutable blob, can
users download our cached copy directly from the app, or do we link
out to the original university URL?

## Decision

**Cached PDFs ARE accessible** to users — but **only via signed URLs
to authenticated app users**. The bucket is NOT publicly indexable.
Users get one of:

1. A 15-minute expiring signed URL when they tap "Open original PDF"
   in the app
2. A redirect to the source university URL (link-out) when the
   signed URL fails or the original is reachable

## Why this is safe under ADR-007

- The audience is contracted students of the consulting company —
  not the open internet
- Audit §10.3's "facts vs expression" copyright concern applies
  primarily to public republishing; the surface for an internal
  consulting tool is much smaller
- Students in Uzbekistan sometimes can't reach `.ac.kr` directly due
  to network issues; the cached copy is the only reliable path
- We still link to the original URL as the canonical source (the app
  shows "Source: admission.snu.ac.kr/..." next to the PDF link)

## Implementation

- Bucket: `guideline-blobs` on Supabase Storage (NOT Cloudflare R2 —
  see ADR-007 cost notes)
- Bucket policy: NOT public; authenticated `app_user` role only via
  signed URLs
- Signed URL lifetime: 15 minutes
- Logged: every signed-URL grant writes a row to `crawl_findings`
  (or a new `pdf_access_log` table — Phase 2 design)

## Reversal trigger

If Hanguk opens the system to non-contracted users (reverses ADR-007),
PDF access policy must be re-evaluated. Public republishing has
genuine copyright exposure; a link-out-only model would be safer.
