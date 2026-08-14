# Handoff Report: Technical Investigation for Requirement R3 (Strict Language Toggle)

## 1. Observation
Across the 8 target modules/tables, investigation revealed exact file paths and line numbers containing dual-slash text (`"English / Burmese"`, `"Name (မြန်မာ)"`, `"Label / မြန်မာ"`), corrupted `t()` calls, or missing i18n hook usage:
1. **Sales Voucher (POS)**:
   - `src/components/pos/receipt-view.tsx`: Lines 103, 107, 111, 120, 148, 153, 158, 167, 173, 181 contain dual slash strings (e.g., `<span>Date / အချိန်:</span>`, `<th className="font-bold py-1">Item / ပစ္စည်း</th>`). Lines 194, 201 missing `useLanguage()` and `t()` for action buttons.
   - `src/components/pos/addon-variant-selector.tsx`: Lines 65, 78, 111, 140, 150 contain dual slash strings (e.g., `<span>Customize Item / အော်ဒါပြင်ဆင်ရန်</span>`).
   - `src/components/pos/cart-panel.tsx`: Lines 103, 138, 260, 265, 271, 277, 281, 296, 305, 315, 323, 341, 352, 371, 381, 384, 397 contain dual slash strings (e.g., `Subtotal / စုစုပေါင်း:`, `Grand Total / ကျသင့်ငွေ:`).
   - `src/components/pos/payment-dialog.tsx`: Lines 229, 247, 259, 268, 288, 301, 310, 338, 376, 389, 415, 421, 431, 437, 441, 445, 450, 464, 487, 496, 511, 526, 551, 561 contain dual slash strings or un-translated Burmese strings.
   - `src/components/pos/hold-list-dialog.tsx`: Lines 30, 37, 85.
   - `src/components/pos/pin-switch-dialog.tsx`: Line 130.
   - `src/components/pos/pos-container.tsx`: Lines 175, 185, 281, 309.
   - `src/components/pos/product-card.tsx`: Line 106.
   - `src/components/pos/product-grid.tsx`: Lines 141, 152.
2. **Branches Table**:
   - `src/app/(dashboard)/branches/page.tsx`: Lines 220–224 contain raw table header dual slashes (`<th className="px-4 py-3.5">Branch Name / ဆိုင်ခွဲအမည်</th>`, etc.). Lines 248, 252 contain status badge dual slashes. Lines 316, 329 pass dual slash strings as the English parameter to `t()` (e.g., `t("Branch Name * / ဆိုင်ခွဲအမည်", "Branch Name *")`).
3. **Supplier Table**:
   - `src/app/(dashboard)/suppliers/page.tsx`: Lines 154, 159, 167, 174, 182, 218, 239, 243, 247, 251, 255, 264, 265 contain hardcoded English strings lacking `t()` translation wrappers.
4. **Sales Order Table**:
   - `src/app/(dashboard)/sales-orders/page.tsx`: Line 663 (`t("Drafts / Pre-Orders", "ယာယီ/ကြိုတင်မှာယူမှုများ")`), Lines 676–683 (un-translated table headers), Line 706 (`t("Walk-in / Unknown", "လာရောက်ဝယ်ယူသူ")`), Line 872 (`t("Date / Time", "ရက်စွဲ / အချိန်")`), Line 920, Line 1056.
5. **Purchases & Purchase Orders Tables**:
   - `src/app/(dashboard)/purchases/page.tsx` & `src/app/(dashboard)/purchase-orders/page.tsx`: Lines 313, 320, 326, 330, 334, 339, 363, 387, 586 contain un-translated English headers and action buttons.
6. **Expenses Table**:
   - `src/app/(dashboard)/expenses/page.tsx`: Lines 381–385 contain un-translated table headers. Lines 554–556 pass hardcoded dual slash strings to `<ConfirmModal>` props (`title="Delete Expense / စရိတ် ပယ်ဖျက်ရန်"`, etc.).
7. **Staff Table**:
   - `src/app/(dashboard)/staff/page.tsx`: Lines 73–75 (`ROLE_LABELS` containing `"Owner / ပိုင်ရှင်"`), Line 337 (`permsSuccess` containing dual text), Lines 469–476 (un-translated table headers), Line 596 (`Login Password / စကားဝှက် *`), Lines 618–620, Line 701, Line 731.
8. **Reports**:
   - `src/app/(dashboard)/reports/page.tsx`: Does not import or use `useLanguage()`. Lines 339–340, 371–387, 415–433, 443, 457, 480, 486–490, 583, 588, 634, 680 contain hardcoded English titles, tabs, card descriptions, and export buttons without `t()`.

## 2. Logic Chain
1. Requirement R3 specifies that toggling the language switch must strictly render 100% English or 100% Burmese across all 8 target components/tables without any dual slash text like `"English / Burmese"` or `"Name (မြန်မာ)"`.
2. Observations confirm that four anti-patterns cause dual text or incomplete translation:
   - Direct dual-slash string literals in JSX.
   - Accidental inclusion of Burmese text inside the English parameter of `t(en, my)`.
   - Hardcoded dual slash strings inside object dictionaries (`ROLE_LABELS`) or modal prop strings (`ConfirmModal`).
   - Omission of `useLanguage()` and `t()` in entire component pages like `reports/page.tsx` and `receipt-view.tsx`.
3. Therefore, resolving R3 requires:
   - Importing `useLanguage()` in all target components.
   - Replacing hardcoded dual-slash strings with `t("English", "Burmese")`.
   - Fixing corrupted `t()` parameters.
   - Refactoring dictionaries to separate English and Burmese keys.
   - Wrapping all table headers, form labels, and action buttons in `t()`.

## 3. Caveats
- No source files were edited during this investigation phase (read-only audit).
- Dynamic data fields created by users (e.g. custom product names, customer names, branch names in DB) will display as stored by the user.

## 4. Conclusion
The technical investigation for Requirement R3 is complete. The exact file paths, line numbers, root causes, and step-by-step remediation plan have been detailed in `analysis.md`. Following this remediation plan will ensure that switching between English and Burmese strictly renders 100% single-language UI across all 8 target modules without dual text anywhere.

## 5. Verification Method
1. Inspect `.agents/explorer_m6_3/analysis.md` to confirm all 8 target modules and line numbers are listed with exact remediation steps.
2. After implementer applies changes:
   - Set language toggle to English (`localStorage.getItem('app-language') === 'en'`) and verify 0 Burmese characters or raw dual slashes appear across all 8 target pages/dialogs.
   - Set language toggle to Burmese (`localStorage.getItem('app-language') === 'my'`) and verify 100% Burmese text displays across all 8 target pages/dialogs.
   - Run `npm run build` to verify exit code 0.
