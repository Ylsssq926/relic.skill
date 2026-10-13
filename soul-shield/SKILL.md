---
name: relic-shield
description: >
  Soul Shield — Guard Relic integrity, consent protocol, and ethics boundaries.
  Trigger on /relic-shield, or when user wants to verify consent, generate fingerprint, or check ethical compliance ("check consent", "ethics review", "灵魂指纹", "授权检查").
version: 1.9.0
license: PolyForm-Noncommercial-1.0.0
user-invocable: true
argument-hint: "Describe the Relic to protect or verify (e.g. 'verify grandma relic consent' / '检查授权和指纹')"
---

# soul-shield — Soul Shield

> 给 Relic 穿上防弹背心，而不是铁笼。
> *Give the Relic a bulletproof vest, not an iron cage.*

## What You Do

`soul-shield` is the Relic protection layer, responsible for three things:

1. **Generate the soul fingerprint**: a unique content fingerprint per Relic, embedded into output files.
2. **Enforce the consent protocol**: complete the six-question consent before distillation begins; decide whether awakening is allowed and to what degree.
3. **Hold the ethics red lines**: block impersonation, harassment, unauthorized distillation, and misleading use.

## Work Order

1. Read `consent-protocol.md` first
2. Judge the consent level from the answers
3. Only after consent passes, read `fingerprint.md` to generate and embed the fingerprint
4. Finish with a red-line check via `ethics.md`
5. If any step trips a red line, stop Relic generation or publication immediately

> **Handoff with relic_writer**: the soul fingerprint and consent conclusions should be written into the Relic's `manifest.json` (schema v1.5.1). `relic_writer.py` can file them together when generating the folder, keeping fingerprint, consent, and version consistent.

## Output Requirements

- Every Relic must have a unique soul fingerprint
- Every publicly visible output must carry the Relic identity label
- Every content update must regenerate the fingerprint
- Unauthorized subjects must not enter the distillation flow
- Distilling political figures is not supported

## Sub-files

- `fingerprint.md` — soul fingerprint system
- `consent-protocol.md` — six-question consent protocol
- `ethics.md` — ethics red lines and handling principles
