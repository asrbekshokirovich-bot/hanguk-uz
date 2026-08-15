# Xotira — Application Narrative (awards.gov.uz form answers)

> Copy these into the President AI Award form fields. The live form (Appendix 2 of
> decree 288-son) is in **Uzbek** — ask me to produce the Uzbek/Russian version.
> The headings below cover what these applications ask for; adapt to the exact
> field labels on the portal.

---

### Project name
**Xotira** — AI memory wearable for elderly and dementia care.

### Direction
Healthcare (Sog'liqni saqlash).

### One-line pitch
A wrist wearable that remembers the day for people who can't — so elderly and
dementia patients keep their independence and dignity, and families keep their peace of mind.

### The problem (what and how big)
Uzbekistan's aging population means a fast-growing number of families care for
relatives with memory decline and dementia. These patients forget medication,
forget medical instructions, and forget names and conversations — leading to
health risks, hospital visits, anxiety, and heavy caregiver burden. Existing aids
(notes, reminders, a stretched relative) don't *understand* the patient's day.
[Add a local statistic if you have one — e.g., estimated elderly population / dementia prevalence.]

### The solution
Xotira is a lightweight wrist device paired with a phone app. With consent, it
captures the wearer's day, uses AI to transcribe and understand it, and turns it
into a memory the patient and caregiver can query in plain language:
- *"Did I take my morning medication?"*
- *"What did the doctor say about my blood pressure?"*
- *"Who visited me today?"*
It also sends a gentle daily summary to a trusted caregiver and alerts them to
missed medication or unusual patterns.

### How the AI works (the core)
1. **On-device capture & consent** — local voice-activity detection and a visible
   recording indicator; privacy filtering happens before anything is uploaded.
2. **Speech-to-text** — Uzbek + Russian + English recognition, including
   code-switching common in Uzbekistan.
3. **Speaker diarization** — distinguishes the patient, doctor, and family members.
4. **Semantic memory** — each moment is embedded and stored in a vector database,
   structured into events, people, medications, and instructions.
5. **LLM retrieval (RAG)** — natural-language questions are answered by reasoning
   over that memory, citing the source moment.
6. **Summarization & alerts** — daily caregiver summary and medication-adherence signals.

### Target users & beneficiaries
Primary: elderly people with memory decline / early-stage dementia and their family
caregivers. Secondary: doctors and clinics (consultation capture & summaries).
Future: blind / low-vision users.

### Social impact
- Keeps elderly patients independent and safe at home longer.
- Reduces dangerous medication errors and missed follow-ups.
- Relieves caregiver stress and gives families reliable oversight.
- Builds sovereign Uzbek-language health AI and local data infrastructure.

### Innovation / why it's new
The first Uzbek-language **assistive-memory** device combining always-available
capture, speaker-aware understanding, and conversational recall — purpose-built for
elderly/dementia care, with privacy and Uzbek data residency as the foundation
(not a global product retrofitted for local use).

### Current stage & traction
[Choose what's true: idea / prototype / early users. Example:]
Working concept with a functional software demo of the capture → transcribe → recall
flow (see demo link). Reference-hardware design in progress. [List any: prior product
`hanguk-uz`, waitlist, clinic conversations, letters of interest — add specifics.]

### Business model
Consumer: device + monthly family subscription. B2B: paid pilots and licensing with
clinics, geriatric centers, and care homes. Grant + award funding de-risks the pilot
and first hardware run.

### Team
[3–8 members, all 18+, UZ citizens/residents. For each: name, role, one-line credibility.]
- [Name] — Founder / [AI/ML lead]
- [Name] — [Hardware/embedded]
- [Name] — [Mobile/backend — built `hanguk-uz`]
- [Name] — [Clinical/healthcare advisor or partner]
- [Name] — [Product/design]

### Use of funds & milestones
Fund a clinical pilot, a reference wearable + app, and Uzbek-language model tuning.
Milestones and the two-tranche split are detailed in `04-kpi-funding-milestones.md`.

### Privacy, ethics & compliance
Consent-first capture with a visible indicator and one-tap pause; on-device
pre-filtering; encryption in transit and at rest; **data stored in Uzbekistan**;
full user/caregiver control to view, export, and delete; clear third-party consent
signaling. Designed to meet Uzbek data-protection expectations for health data.

### Requested prize / support
President AI Award Healthcare direction funding (target: 1st place, $100,000),
acceleration program participation, and mentor/investor introductions.

### Contact
[Full name] · [phone] · [email] · [Telegram] · [company/entity if any]

---
*Replace every `[bracketed]` item with real information before submitting.*
