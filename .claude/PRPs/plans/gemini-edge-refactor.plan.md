# Plan: Gemini Edge Refactor

## Summary
Migrate all 14 AI-powered Edge Functions away from the deprecated Lovable API Gateway and route them directly to Google's official Gemini OpenAI-compatible API. Resolve all auxiliary audit issues, including disabling the unverified Command Center webhook and scaffolding the deployment of missing 3rd-party secrets.

## User Story
As an administrator, I want my edge functions to natively use Gemini APIs without relying on Lovable's legacy proxy, so that all AI functionalities in the app remain functional after the migration away from the Lovable architecture.

## Problem → Solution
14 edge functions currently rely on `https://ai.gateway.lovable.dev/v1/chat/completions` and `LOVABLE_API_KEY` → Refactor them to use `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` and `GEMINI_API_KEY`.
The Command Center webhook blindly blasts data to a potentially stranded workspace → Safely disable the webhook trigger to prevent data leaks.

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: 15

---

## UX Design

### Before
N/A — internal change. Edge functions drop network packets when Lovable servers inevitably restrict access.

### After
N/A — internal change. Edge functions continue exactly as before using the `GEMINI_API_KEY` directly via Google API.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `supabase/functions/interview-ai/index.ts` | 394-430 | Defines standard string fetching pattern for Lovable proxy that all other functions match directly. |
| P1 (important) | `audit_report.md` | all | Ground truth for the 14 functions and the outstanding third party keys required. |

---

## Patterns to Mirror

### GEMINI_OPENAI_COMPATIBILITY_PATTERN
// SOURCE: Migration Standard
```javascript
// Before:
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${lovableApiKey}`,
    "Content-Type": "application/json",
  },
  ...

// After:
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${geminiApiKey}`,
    "Content-Type": "application/json",
  },
  ...
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| 14 AI Edge Functions | UPDATE | Swap API paths to Google's official Compatibility Layer and shift ENV var keys to `GEMINI_API_KEY` |
| `supabase/functions/sync-to-command-center/index.ts` | UPDATE | Comment out the HTTP `fetch` to `hbgesutkaiakbptfzmky` to freeze the webhook in a neutral state, until URL validity is proven. |

## NOT Building
- Rewriting the SDK logic from `fetch()` to an NPM package. We will strictly swap strings to minimize breaking modifications and ensure standard responses remain indistinguishable from the frontend's perspective.
- Resolving missing 3rd party secrets automatically (client must manually execute CLI injects for things like `ELEVENLABS_API_KEY`).

---

## Step-by-Step Tasks

### Task 1: Refactor 14 Lovable Proxies to Gemini API
- **ACTION**: Modify all 14 identified Edge Functions.
- **IMPLEMENT**: RegEx or precise replace: 
  1. `LOVABLE_API_KEY` -> `GEMINI_API_KEY`
  2. `lovableApiKey` -> `geminiApiKey`
  3. `https://ai.gateway.lovable.dev/v1/chat/completions` -> `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- **MIRROR**: GEMINI_OPENAI_COMPATIBILITY_PATTERN
- **GOTCHA**: Double-check `translate-document/index.ts` and ensure vision payloads are kept identical; standard base64 structures are supported natively by Google OpenAI compat mode!
- **VALIDATE**: Ensure a `grep_search` across `supabase/functions` throws 0 results for "lovable.dev".

### Task 2: Sandbox the Command Center Sync Webhook
- **ACTION**: Mute the webhook outgoing request in `sync-to-command-center/index.ts`.
- **IMPLEMENT**: Comment out the `fetch(WEBHOOK_URL...)` line. Mock a fake fast `200 Success` return so Supabase Database Webhooks aren't clogged up with errors.
- **VALIDATE**: The file contains no active `fetch` actions pushing to `hbgesutkaiakbptfzmky.supabase.co`.

### Task 3: Deploy Modified Edge Functions
- **ACTION**: Update cloud infrastructure safely.
- **IMPLEMENT**: Run `npx supabase functions deploy --project-ref lysjdtyanhdfphqyijsr` to execute the changes into production.
- **VALIDATE**: Deployment passes with exit code 0.

---

## Testing Strategy

### Manual Validation
- [ ] Ensure frontend triggers for translation or document analysis do not throw 500 errors after supplying the `GEMINI_API_KEY` into Supabase Secrets.

## Validation Commands

### Static Analysis
```bash
# Run type checker
deno check supabase/functions/*/index.ts
```
EXPECT: Zero type errors

## Acceptance Criteria
- [ ] All 14 functions point correctly to `generativelanguage.googleapis.com`
- [ ] No `lovable` or `LOVABLE_API_KEY` text strings exist in `index.ts` files
- [ ] Data leak to `hbgesutkaiakbptfzmky.supabase.co` is effectively sandboxed
- [ ] New functions deploy flawlessly

## Completion Checklist
- [ ] Code follows discovered patterns
- [ ] Error handling matches codebase style
- [ ] Logging follows codebase conventions
- [ ] No unnecessary scope additions
- [ ] Self-contained — no questions needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Feature regressions in Edge API | Low | High | We maintain identical payload boundaries and strictly leverage Google's 1:1 OpenAI emulation API without altering logic schema. |
| Missing Secrets Error | High | Medium | Warn the user that they must add `GEMINI_API_KEY` via CLI. |
