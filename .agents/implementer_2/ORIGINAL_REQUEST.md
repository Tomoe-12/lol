## 2026-08-01T04:19:09Z
<USER_REQUEST>
You are Worker 2 (teamwork_preview_worker).
Your assigned working directory is `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\implementer_2`.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective: Remediate the unit test suite `tests/unit/language-switcher.test.ts` to test actual exported context methods, and add `title` hover text to `LanguageSwitcher`.

Step-by-step instructions:

1. **Fix Unit Test Suite (`tests/unit/language-switcher.test.ts`)**:
   - The Forensic Auditor reported an INTEGRITY VIOLATION because `tests/unit/language-switcher.test.ts` contained local shadow helper functions (`testSetLocale`, `toggle`) and local variables (`capturedLocale`), asserting on its own local test variables rather than testing `LanguageProvider`'s actual context methods.
   - Refactor `tests/unit/language-switcher.test.ts`:
     - Delete all local fake helper functions (`testSetLocale`, `toggle`, local shadow variables).
     - Test the actual `LanguageProvider` and `useLanguage` hook from `src/providers/language-provider.tsx` directly!
     - Construct a React/DOM test component or context consumer that calls `useLanguage()` inside `<LanguageProvider>`.
     - Test that calling `setLocale('my')` on the context actually updates the context state and writes `'my'` to `localStorage`.
     - Test that calling `toggleLanguage()` on the context actually toggles the locale from `'en'` to `'my'` and back to `'en'`.
     - Test `localStorage.getItem('language')` initial values and fallback values using `LanguageProvider`'s actual implementation logic.
     - **Verification**: Ensure that if `LanguageProvider`'s `setLocale` or `toggleLanguage` method is broken or commented out, `npm run test:language` FAILS.

2. **Add `title` Tooltip to `LanguageSwitcher` (`src/components/language-switcher.tsx`)**:
   - Add `title="Select language / ဘာသာစကား"` attribute to the `<Button>` trigger in `src/components/language-switcher.tsx`.

3. **Build & Test Verification**:
   - Execute `npm run test:language` and verify 100% of assertions pass.
   - Execute `npm run build` and verify Next.js production build succeeds with exit code 0.

Write your changes summary to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\implementer_2\changes.md` and your handoff report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\implementer_2\handoff.md`. Communicate your completed work back using send_message.
</USER_REQUEST>
