## 2026-08-12T21:05:20Z

You are Worker M6 2 (teamwork_preview_worker). Your task is to execute complete i18n remediation for Milestone M6 (R3 Strict Language Toggle Purity) across SMARTOS POS.

Working Directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m6_2
Project Root: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon

MANDATORY READS:
- Original User Request: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\ORIGINAL_REQUEST.md
- Master Specification: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md
- Forensic Auditor Evidence Report: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\auditor_m6_1\handoff.md
- Reviewer M6 1 Handoff: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\reviewer_m6_1\handoff.md
- Reviewer M6 2 Handoff: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\reviewer_m6_2\handoff.md
- Challenger M6 1 Handoff: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\challenger_m6_1\handoff.md
- Challenger M6 2 Handoff: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\challenger_m6_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXACT FILE-BY-FILE REMEDIATION STEPS:

1. `src/app/(dashboard)/branches/page.tsx`:
   - Lines 248 & 252: Replace raw dual-slash strings `<Badge>Active / ဖွင့်လှစ်ထားသည်</Badge>` and `<Badge>Archived / ပိတ်သိမ်းထားသည်</Badge>` with `{t("Active", "ဖွင့်လှစ်ထားသည်")}` and `{t("Archived", "ပိတ်သိမ်းထားသည်")}`.
   - Lines 316 & 329: Fix inverted `t()` parameters!
     - Line 316: Change `t("Branch Name * / ဆိုင်ခွဲအမည်", "Branch Name *")` to `t("Branch Name *", "ဆိုင်ခွဲအမည် *")`.
     - Line 329: Change `t("Address / ဆိုင်ခွဲလိပ်စာ", "Address")` to `t("Address", "ဆိုင်ခွဲလိပ်စာ")`.

2. `src/app/(dashboard)/suppliers/page.tsx`:
   - Import `useLanguage` from `@/providers/language-provider`.
   - Wrap all UI titles, headers, table headers, form input labels, placeholder texts, and action buttons in `t("English", "Burmese")`.

3. `src/app/(dashboard)/purchases/page.tsx` & `src/app/(dashboard)/purchase-orders/page.tsx`:
   - Import `useLanguage` from `@/providers/language-provider`.
   - Wrap all headers, filter buttons, search placeholders, table column titles, status badges, and modal dialog texts in `t("English", "Burmese")`.

4. `src/app/(dashboard)/sales-orders/page.tsx`:
   - Line 852: Replace raw dual-slash string `Remaining Balance / ကျန်ရှိသော ပမာဏ` with `{t("Remaining Balance", "ကျန်ရှိသော ပမာဏ")}`.
   - Lines 1025, 1202, 1303, 1337: Remove dual-slash strings from inside `t()` parameters (use clean `t("English", "Burmese")`).

5. `src/app/(dashboard)/staff/page.tsx`:
   - Line 731: Refactor `{modLabel.en} / {modLabel.my}` to `{t(modLabel.en, modLabel.my)}`.

6. `src/app/(dashboard)/delivery/page.tsx`:
   - Fix lines 315, 317, 318, 319, 320, 388, 428: Correct inverted `t(en, my)` parameters.
   - Fix lines 465, 482, 533, 537: Wrap raw dual-slash strings (`Delivery Waybill`, `Date:`, `Deliverer`, `Receiver`) in `t()`.

7. `src/app/(dashboard)/reports/page.tsx`:
   - Ensure `useLanguage()` is imported and all tab names, card titles, metric descriptions, and table headers are wrapped in `t("English", "Burmese")`.

8. `src/app/(dashboard)/schedule/page.tsx`:
   - Lines 428-430: Wrap modal props (`title`, `description`, `confirmText`) in `t()`.

9. `src/app/(auth)/sign-in/page.tsx`:
   - Lines 72, 84: Wrap form labels in `t()`.

VERIFICATION:
- Run `npm run build` to confirm zero compilation errors.
- Run test commands (e.g. `npx tsx tests/m1-rbac-multibranch-suite.test.ts`, `npx tsx tests/e2e-system-suite.test.ts`, `npx tsx tests/financial-inventory-integrity.test.ts`, `npx tsx tests/integration/m6-challenger-empirical.test.ts`).
- Write your complete handoff report to C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m6_2\handoff.md and report to parent.
