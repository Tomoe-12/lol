## 2026-08-01T04:43:41Z
You are Worker 1. Your task is to implement the Language Switcher pill toggle component, update the Language Provider with the `t(en, my)` translation helper, refactor all dual-language slash strings across all pages and sidebar to single language rendering, and verify build and tests.

Your working directory is: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\implementer_1`
Workspace root: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Tasks:
1. Core i18n & Context (`src/providers/language-provider.tsx`):
   - Update `LanguageContextType` to provide: `language` ('en' | 'my'), `setLanguage`, `toggleLanguage`, `isMounted`, and `t(en: string, my: string): string`.
   - `t(en, my)` returns `en` string when `language === 'en'` and `my` string when `language === 'my'`.
   - Persist language preference in `localStorage` under key `"app-language"`.
   - Read from `localStorage` on client mount inside `useEffect` to avoid SSR hydration mismatch.
   - Memoize context value with `useMemo`.

2. Pill-Shaped Toggle Switch Component (`src/components/language-switcher.tsx`):
   - Replace Radix `DropdownMenu` with a sleek, pill-shaped toggle switch button `[ EN | မြန်မာ ]`.
   - A single click on the switch immediately toggles between `en` and `my` using `toggleLanguage()`.
   - Apply clean Tailwind styling (rounded pill shape, active badge highlight for selected language, responsive typography, `shrink-0`).

3. Responsive Header Top Bar Layout (`src/app/(dashboard)/layout.tsx`):
   - Position `LanguageSwitcher` cleanly next to `ThemeToggle` and `NotificationBell`.
   - Ensure header control bar items fit responsively on desktop, tablet, and mobile viewports (320px+).

4. Refactor All Dual-Language Slash Strings across all pages & Sidebar:
   - Perform a thorough search across `src/` for hardcoded dual-language strings with slashes (`/`), e.g. `"Hledan Branch / လှည်းတန်း ဆိုင်ခွဲ"`, `"Dashboard / ဒက်ရှ်ဘုတ်"`, `"POS / အရောင်း"`, `"Sales Voucher / အရောင်း ဘောက်ချာ"`, `"Inventory / ကုန်ပစ္စည်း စာရင်း"`, `"Setup / ဆက်တင်"`, `"Customers / ဝယ်သူများ"`, `"Suppliers / ပေးသွင်းသူများ"`, `"Purchases / အဝယ်များ"`, `"Purchase Orders / အဝယ် အမှာစာများ"`, `"Expenses / စရိတ်များ"`, `"Staff / ဝန်ထမ်းများ"`, `"Reports / အစီရင်ခံစာများ"`, sidebar titles, tab headers, table headers, buttons.
   - Replace with `t("English Text", "Burmese Text")` so that when `en` is active ONLY English displays, and when `my` is active ONLY Burmese displays — NEVER both with slashes (`/`).

5. Build & Test Verification:
   - Ensure `export const dynamic = "force-dynamic";` is present on API route handlers if needed so Next.js build succeeds cleanly.
   - Run build command `npm run build` and test commands (`npm run test:integrity` or unit tests).
   - Write your implementation report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\implementer_1\handoff.md`. Send a message back to parent when completed.
