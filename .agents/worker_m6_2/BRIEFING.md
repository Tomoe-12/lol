# BRIEFING — 2026-08-12T21:05:40Z

## Mission
Execute complete i18n remediation for Milestone M6 (R3 Strict Language Toggle Purity) across SMARTOS POS.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m6_2
- Original parent: 9de01be6-efbd-4600-acea-8c7baab9927e
- Milestone: M6 (R3 Strict Language Toggle Purity)

## 🔒 Key Constraints
- Follow exact file-by-file remediation steps for all specified files.
- Ensure strict language toggle purity (English / Burmese cleanly split with `t(en, my)`).
- Verify with `npm run build` and tests.
- DO NOT hardcode test results or fabricate verification.

## Current Parent
- Conversation ID: 9de01be6-efbd-4600-acea-8c7baab9927e
- Updated: 2026-08-12T21:05:40Z

## Task Summary
- **What to build**: Full i18n remediation across 9 specified page files in SMARTOS POS.
- **Success criteria**: Zero raw dual-slash strings on UI, zero inverted `t(my, en)` calls, clean `t(en, my)` everywhere, passing build and test suites.
- **Interface contracts**: `useLanguage()` from `@/providers/language-provider`, providing `t(en: string, my: string): string`.
- **Code layout**: Next.js App Router inside `src/app/(dashboard)/...` and `src/app/(auth)/...`.

## Key Decisions Made
- Executing exact steps in priority order per prompt instructions.

## Artifact Index
- DISPATCH.md — assignment dispatch
- BRIEFING.md — active working context
- progress.md — liveness heartbeat
- handoff.md — final handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Not run yet
- **Pending issues**: None

## Quality Status
- **Build/test result**: Not run yet
- **Lint status**: Not run yet
- **Tests added/modified**: TBD

## Loaded Skills
- None
