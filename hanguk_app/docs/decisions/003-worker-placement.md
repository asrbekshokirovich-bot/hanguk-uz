# ADR-003 — Crawler runtime placement

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.3, audit §7.10, plan §E.6

## Question

Where does the Python crawler run? **Hetzner VPS** (€5/mo, traditional
Linux server) or pure **Cloudflare Workers** (serverless,
pay-per-invocation)?

## Decision

**Hetzner VPS.** Long-running Python with PyMuPDF, EasyOCR (per ADR-002),
and Playwright stealth profile is the natural fit. CX22 instance: 2
vCPU, 4 GB RAM, 40 GB disk. Region: Helsinki or Falkenstein.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Cloudflare Workers | 30s execution cap kills multi-page PDF parsing |
| AWS EC2 / GCP / Oracle Free | Comparable but Hetzner is the cheapest with a usable region for KR-traffic |
| Cloudflare Browser Rendering for Playwright only | Possible Phase 4+ split, but Phase 1 keeps it simple |

## Phase 1 deferral

The VPS itself is **NOT provisioned in Phase 1**. The crawler can run on
the developer machine for low-volume testing. VPS provisioning happens
in Phase 2 when the crawler goes 24/7.
