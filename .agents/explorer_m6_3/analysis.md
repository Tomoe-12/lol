# Technical Investigation Report: Requirement R3 — Strict Language Toggle (English vs. Burmese i18n)

## Executive Summary
This report provides a comprehensive, read-only technical audit of the internationalization (i18n) mechanism and exact hardcoded dual-slash strings across the 8 required target modules/tables in the codebase:
1. **Sales Voucher** (POS Receipt & Checkout Modal)
2. **Branches Table**
3. **Supplier Table**
4. **Sales Order Table**
5. **Purchases & Purchase Orders Tables**
6. **Expenses Table**
7. **Staff Table**
8. **Reports**

---

## 1. i18n Architecture & Language Toggle Mechanism

### 1.1 Provider & Hook Implementation
The system relies on a React Context-based i18n provider located at `src/providers/language-provider.tsx`:
- **Context Hook**: `useLanguage()` provides state and translation helper `t(en: string, my: string) => string`.
- **Language State**: Supported locales are `"en"` (English) and `"my"` (Burmese / Myanmar). Default state is `"en"`.
- **Storage**: User language preference is persisted in `localStorage` under the key `"app-language"`.
- **Translation Logic**:
  ```typescript
  const t = useCallback(
    (en: string, my: string) => {
      return language === "my" ? my : en
    },
    [language]
  )
  ```

### 1.2 Root Causes of Dual-Text Violations
Investigation reveals three primary anti-patterns causing dual-text displays (`"English / Burmese"`, `"Name (မြန်မာ)"`, `"Label / မြန်မာ"`):
1. **Hardcoded Dual JSX Strings**: UI elements render static strings containing slashes directly in JSX (e.g., `<th className="...">Branch Name / ဆိုင်ခွဲအမည်</th>`).
2. **Corrupted `t()` Invocations**: Slashes were accidentally baked into the English parameter of `t()` calls (e.g., `t("Branch Name * / ဆိုင်ခွဲအမည်", "Branch Name *")`).
3. **Hardcoded Modal & Object Dictionary Strings**: Objects like `ROLE_LABELS` or modal prop strings pass dual slash text directly into props (e.g., `ConfirmModal title="Delete Expense / စရိတ် ပယ်ဖျက်ရန်"`).
4. **Un-translated Components**: Components like `receipt-view.tsx` and `reports/page.tsx` omit `useLanguage()` entirely, leaving text hardcoded in English or dual text.

---

## 2. File-by-File Audit & Exact Line-Number Mapping Across 8 Target Modules

### Module 1: Sales Voucher (POS)
Component paths: `src/components/pos/*`

| File Path | Line Number(s) | Current Dual / Un-translated String | Required Remediation |
|---|---|---|---|
| `src/components/pos/receipt-view.tsx` | 103 | `<span>Date / အချိန်:</span>` | `{t("Date:", "အချိန်:")}` |
| `src/components/pos/receipt-view.tsx` | 107 | `<span>Cashier / ငွေကိုင်:</span>` | `{t("Cashier:", "ငွေကိုင်:")}` |
| `src/components/pos/receipt-view.tsx` | 111 | `<span>Payment / ချေမှု:</span>` | `{t("Payment:", "ချေမှု:")}` |
| `src/components/pos/receipt-view.tsx` | 120 | `<th className="...">Item / ပစ္စည်း</th>` | `{t("Item", "ပစ္စည်း")}` |
| `src/components/pos/receipt-view.tsx` | 148 | `<span>Subtotal / စုစုပေါင်း:</span>` | `{t("Subtotal:", "စုစုပေါင်း:")}` |
| `src/components/pos/receipt-view.tsx` | 153 | `<span>Discount / လျှော့စျေး:</span>` | `{t("Discount:", "လျှော့စျေး:")}` |
| `src/components/pos/receipt-view.tsx` | 158 | `<span>Grand Total / ကျသင့်ငွေ:</span>` | `{t("Grand Total:", "ကျသင့်ငွေ:")}` |
| `src/components/pos/receipt-view.tsx` | 167 | `<span>Cash Paid / ပေးငွေ:</span>` | `{t("Cash Paid:", "ပေးငွေ:")}` |
| `src/components/pos/receipt-view.tsx` | 173 | `<span>Change / ပြန်အမ်းငွေ:</span>` | `{t("Change:", "ပြန်အမ်းငွေ:")}` |
| `src/components/pos/receipt-view.tsx` | 181 | `<p>Thank you! / ကျေးဇူးတင်ပါသည်!</p>` | `{t("Thank you!", "ကျေးဇူးတင်ပါသည်!")}` |
| `src/components/pos/receipt-view.tsx` | 194, 201 | Hardcoded "Print Receipt", "New Order" | Add `useLanguage()`, wrap buttons in `t()` |
| `src/components/pos/addon-variant-selector.tsx` | 65 | `Customize Item / အော်ဒါပြင်ဆင်ရန်` | `{t("Customize Item", "အော်ဒါပြင်ဆင်ရန်")}` |
| `src/components/pos/addon-variant-selector.tsx` | 78 | `Select Option / အရွယ်အစား` | `{t("Select Option", "အရွယ်အစား ရွေးချယ်ရန်")}` |
| `src/components/pos/addon-variant-selector.tsx` | 111 | `Quantity / အရေအတွက်` | `{t("Quantity", "အရေအတွက်")}` |
| `src/components/pos/addon-variant-selector.tsx` | 140 | `Total / စုစုပေါင်း` | `{t("Total", "စုစုပေါင်း")}` |
| `src/components/pos/addon-variant-selector.tsx` | 150 | `Add to Cart / ခြင်းထဲထည့်ရန်` | `{t("Add to Cart", "ခြင်းထဲထည့်ရန်")}` |
| `src/components/pos/cart-panel.tsx` | 103 | `Shopping Cart / ဝယ်ယူမှုစာရင်း` | `{t("Shopping Cart", "ဝယ်ယူမှုစာရင်း")}` |
| `src/components/pos/cart-panel.tsx` | 138 | `Cart is empty / ဝယ်ယူမှုစာရင်းမရှိသေးပါ။` | `{t("Cart is empty", "ဝယ်ယူမှုစာရင်းမရှိသေးပါ။")}` |
| `src/components/pos/cart-panel.tsx` | 260 | `Subtotal / စုစုပေါင်း:` | `{t("Subtotal:", "စုစုပေါင်း:")}` |
| `src/components/pos/cart-panel.tsx` | 265 | `Item Discount / ပစ္စည်းလျှော့စျေး:` | `{t("Item Discount:", "ပစ္စည်းလျှော့စျေး:")}` |
| `src/components/pos/cart-panel.tsx` | 271 | `Order Discount / ခြင်းလျှော့စျေး:` | `{t("Order Discount:", "ခြင်းလျှော့စျေး:")}` |
| `src/components/pos/cart-panel.tsx` | 277 | `Grand Total / ကျသင့်ငွေ:` | `{t("Grand Total:", "ကျသင့်ငွေ:")}` |
| `src/components/pos/cart-panel.tsx` | 281 | `USD equivalent / ဒေါ်လာတန်ဖိုး:` | `{t("USD equivalent:", "ဒေါ်လာတန်ဖိုး:")}` |
| `src/components/pos/cart-panel.tsx` | 296 | `Discount / လျှော့စျေး` | `{t("Discount", "လျှော့စျေး")}` |
| `src/components/pos/cart-panel.tsx` | 305 | `Hold Cart / စောင့်ဆိုင်း` | `{t("Hold Cart", "စောင့်ဆိုင်း")}` |
| `src/components/pos/cart-panel.tsx` | 315 | `Pay Now / ငွေချေမည်` | `{t("Pay Now", "ငွေချေမည်")}` |
| `src/components/pos/cart-panel.tsx` | 323 | `Order Discount / ခြင်းလျှော့စျေး` | `{t("Order Discount", "ခြင်းလျှော့စျေး")}` |
| `src/components/pos/cart-panel.tsx` | 341 | `Flat Ks / ကျပ်` | `{t("Flat Ks", "ကျပ်")}` |
| `src/components/pos/cart-panel.tsx` | 352 | `Percent % / ရာခိုင်နှုန်း` | `{t("Percent %", "ရာခိုင်နှုန်း")}` |
| `src/components/pos/cart-panel.tsx` | 371 | `Apply / သုံးမည်` | `{t("Apply", "သုံးမည်")}` |
| `src/components/pos/cart-panel.tsx` | 381 | `Hold Order / ဆိုင်းငံ့ရန်` | `{t("Hold Order", "ဆိုင်းငံ့ရန်")}` |
| `src/components/pos/cart-panel.tsx` | 384 | `Enter Table No. or Order Name / နာမည်` | `{t("Enter Table No. or Order Name", "စားပွဲအမှတ် သို့မဟုတ် နာမည် ထည့်ပါ")}` |
| `src/components/pos/cart-panel.tsx` | 397 | `Hold / စောင့်မည်` | `{t("Hold", "စောင့်မည်")}` |
| `src/components/pos/payment-dialog.tsx` | 229 | `POS Sales Voucher / အရောင်းဘောက်ချာ` | `{t("POS Sales Voucher", "အရောင်းဘောက်ချာ")}` |
| `src/components/pos/payment-dialog.tsx` | 247 | `Select Payment Method / ပေးချေမည့် နည်းလမ်း` | `{t("Select Payment Method", "ပေးချေမည့် နည်းလမ်း")}` |
| `src/components/pos/payment-dialog.tsx` | 259 | `Cash / ငွေသား` | `{t("Cash", "ငွေသား")}` |
| `src/components/pos/payment-dialog.tsx` | 268 | `Card / ကတ်ဖြင့်` | `{t("Card", "ကတ်ဖြင့်")}` |
| `src/components/pos/payment-dialog.tsx` | 288 | `DEBT / ကြွေးရောင်း` | `{t("DEBT", "ကြွေးရောင်း")}` |
| `src/components/pos/payment-dialog.tsx` | 301 | `Split Payment / ခွဲခြားပေးချေမည်` | `{t("Split Payment", "ခွဲခြားပေးချေမည်")}` |
| `src/components/pos/payment-dialog.tsx` | 310 | `Cash Received (MMK) / လက်ခံရရှိငွေ (ကျပ်)` | `{t("Cash Received (MMK)", "လက်ခံရရှိငွေ (ကျပ်)")}` |
| `src/components/pos/payment-dialog.tsx` | 338 | `Cash Received (USD) / လက်ခံရရှိငွေ (ဒေါ်လာ)` | `{t("Cash Received (USD)", "လက်ခံရရှိငွေ (ဒေါ်လာ)")}` |
| `src/components/pos/payment-dialog.tsx` | 376 | `Cash Amount (MMK) / ငွေသား ပမာဏ` | `{t("Cash Amount (MMK)", "ငွေသား ပမာဏ")}` |
| `src/components/pos/payment-dialog.tsx` | 389 | `Card Amount (MMK) / ကတ် ပမာဏ` | `{t("Card Amount (MMK)", "ကတ် ပမာဏ")}` |
| `src/components/pos/payment-dialog.tsx` | 415 | `ပြင်ပဘဏ်ကတ်စက်တွင် ကတ်ခြစ်ပြီး ငွေလက်ခံပါ` | `{t("Swipe card on external POS terminal", "ပြင်ပဘဏ်ကတ်စက်တွင် ကတ်ခြစ်ပြီး ငွေလက်ခံပါ")}` |
| `src/components/pos/payment-dialog.tsx` | 421 | `ဆိုင်၏ KBZPay, CBPay, WavePay QR စကန်ဖတ်ခိုင်းပါ` | `{t("Scan shop QR code for wallet payment", "ဆိုင်၏ KBZPay, CBPay, WavePay QR စကန်ဖတ်ခိုင်းပါ")}` |
| `src/components/pos/payment-dialog.tsx` | 431 | `Order Summary / အရောင်းအကျဉ်းချုပ်` | `{t("Order Summary", "အရောင်းအကျဉ်းချုပ်")}` |
| `src/components/pos/payment-dialog.tsx` | 437 | `Subtotal / သာမန်တန်ဖိုး:` | `{t("Subtotal:", "စုစုပေါင်း:")}` |
| `src/components/pos/payment-dialog.tsx` | 441 | `Discount / လျှော့စျေး:` | `{t("Discount:", "လျှော့စျေး:")}` |
| `src/components/pos/payment-dialog.tsx` | 445 | `Tax (inclusive) / အခွန်ထည့်ပြီး:` | `{t("Tax (inclusive):", "အခွန်ထည့်ပြီး:")}` |
| `src/components/pos/payment-dialog.tsx` | 450 | `Grand Total / ကျသင့်ငွေ:` | `{t("Grand Total:", "ကျသင့်ငွေ:")}` |
| `src/components/pos/payment-dialog.tsx` | 464 | `Change to Return / ပြန်အမ်းငွေ` | `{t("Change to Return", "ပြန်အမ်းငွေ")}` |
| `src/components/pos/payment-dialog.tsx` | 487 | `Delivery / ပို့ဆောင်ပေးရမည်` | `{t("Delivery", "ပို့ဆောင်ပေးရမည်")}` |
| `src/components/pos/payment-dialog.tsx` | 496 | `Customer Name / ဝယ်သူအမည် *` | `{t("Customer Name *", "ဝယ်သူအမည် *")}` |
| `src/components/pos/payment-dialog.tsx` | 511 | `Phone Number / ဖုန်းနံပါတ် *` | `{t("Phone Number *", "ဖုန်းနံပါတ် *")}` |
| `src/components/pos/payment-dialog.tsx` | 526 | `Delivery Address / ပို့ဆောင်ရမည့် လိပ်စာ *` | `{t("Delivery Address *", "ပို့ဆောင်ရမည့် လိပ်စာ *")}` |
| `src/components/pos/payment-dialog.tsx` | 551 | `Cancel / ပယ်ဖျက်မည်` | `{t("Cancel", "မလုပ်တော့ပါ")}` |
| `src/components/pos/payment-dialog.tsx` | 561 | `Complete Order / ငွေလက်ခံပြီး` | `{t("Complete Order", "ငွေလက်ခံပြီး")}` |
| `src/components/pos/hold-list-dialog.tsx` | 30 | `Held Transactions / ဆိုင်းငံ့ထားသော ခြင်းများ` | `{t("Held Transactions", "ဆိုင်းငံ့ထားသော ခြင်းများ")}` |
| `src/components/pos/hold-list-dialog.tsx` | 37 | `No held transactions found / ဆိုင်းငံ့ထားသော အရောင်းမရှိပါ။` | `{t("No held transactions found", "ဆိုင်းငံ့ထားသော အရောင်းမရှိပါ။")}` |
| `src/components/pos/hold-list-dialog.tsx` | 85 | `Resume / ဆက်လုပ်ရန်` | `{t("Resume", "ဆက်လုပ်ရန်")}` |
| `src/components/pos/pin-switch-dialog.tsx` | 130 | `Cashier PIN / ပင်နံပါတ်ထည့်ပါ` | `{t("Cashier PIN", "ပင်နံပါတ်ထည့်ပါ")}` |
| `src/components/pos/pos-container.tsx` | 175 | `Rate / နှုန်း:` | `{t("Rate:", "နှုန်း:")}` |
| `src/components/pos/pos-container.tsx` | 185 | `Edit / ပြင်ရန်` | `{t("Edit", "ပြင်ရန်")}` |
| `src/components/pos/pos-container.tsx` | 281 | `Select Branch / ဆိုင်ခွဲရွေးပါ` | `{t("Select Branch", "ဆိုင်ခွဲရွေးပါ")}` |
| `src/components/pos/pos-container.tsx` | 309 | `MMK per 1 USD / ဒေါ်လာလဲနှုန်း` | `{t("MMK per 1 USD", "ဒေါ်လာလဲနှုန်း")}` |
| `src/components/pos/product-card.tsx` | 106 | `From / စ၍` | `{t("From", "စ၍")}` |
| `src/components/pos/product-grid.tsx` | 141 | `placeholder="Search products by name / ပစ္စည်းရှာရန်..."` | `placeholder={t("Search products by name...", "ပစ္စည်းရှာရန်...")}` |
| `src/components/pos/product-grid.tsx` | 152 | `placeholder="Scan / Barcode input..."` | `placeholder={t("Scan Barcode...", "ဘားကုဒ် ဖတ်ရန်...")}` |

---

### Module 2: Branches Table
Component path: `src/app/(dashboard)/branches/page.tsx`

| Line Number(s) | Current Dual / Corrupted String | Required Remediation |
|---|---|---|
| 220 | `<th className="...">Branch Name / ဆိုင်ခွဲအမည်</th>` | `<th className="...">{t("Branch Name", "ဆိုင်ခွဲအမည်")}</th>` |
| 221 | `<th className="...">Address / လိပ်စာ</th>` | `<th className="...">{t("Address", "လိပ်စာ")}</th>` |
| 222 | `<th className="...">Date Opened / ဖွင့်လှစ်သည့်ရက်စွဲ</th>` | `<th className="...">{t("Date Opened", "ဖွင့်လှစ်သည့်ရက်စွဲ")}</th>` |
| 223 | `<th className="...">Status / အခြေအနေ</th>` | `<th className="...">{t("Status", "အခြေအနေ")}</th>` |
| 224 | `<th className="...">Actions / လုပ်ဆောင်ချက်များ</th>` | `<th className="...">{t("Actions", "လုပ်ဆောင်ချက်များ")}</th>` |
| 248 | `Active / ဖွင့်လှစ်ထားသည်` | `{t("Active", "ဖွင့်လှစ်ထားသည်")}` |
| 252 | `Archived / ပိတ်သိမ်းထားသည်` | `{t("Archived", "ပိတ်သိမ်းထားသည်")}` |
| 316 | `t("Branch Name * / ဆိုင်ခွဲအမည်", "Branch Name *")` | `t("Branch Name *", "ဆိုင်ခွဲအမည် *")` |
| 329 | `t("Address / ဆိုင်ခွဲလိပ်စာ", "Address")` | `t("Address", "ဆိုင်ခွဲလိပ်စာ")` |

---

### Module 3: Supplier Table
Component path: `src/app/(dashboard)/suppliers/page.tsx`

| Line Number(s) | Current Un-translated String | Required Remediation |
|---|---|---|
| 154 | `"Manage your supplier directory"` | `t("Manage your supplier directory", "ပေးသွင်းသူ စာရင်း စီမံရန်")` |
| 159 | `"Add Supplier"` | `t("Add Supplier", "ပေးသွင်းသူ အသစ်ထည့်မည်")` |
| 167 | `placeholder="Search suppliers..."` | `placeholder={t("Search suppliers...", "ပေးသွင်းသူများ ရှာဖွေရန်...")}` |
| 174 | `Total Suppliers` | `{t("Total Suppliers", "စုစုပေါင်း ပေးသွင်းသူများ")}` |
| 182 | `"No suppliers found..."` | `t("No suppliers found. Add your first supplier to start.", "ပေးသွင်းသူ စာရင်း မရှိသေးပါ။")` |
| 218 | `Purchase Orders` | `{t("Purchase Orders", "အဝယ်အမှာစာများ")}` |
| 239 | `"Edit Supplier"` / `"Add Supplier"` | `t(editingSupplier ? "Edit Supplier" : "Add Supplier", editingSupplier ? "ပေးသွင်းသူ ပြင်ဆင်ရန်" : "ပေးသွင်းသူ အသစ်ထည့်မည်")` |
| 243 | `Supplier Name *` | `{t("Supplier Name *", "ပေးသွင်းသူ အမည် *")}` |
| 247 | `Contact Number` | `{t("Contact Number", "ဆက်သွယ်ရန် ဖုန်း")}` |
| 251 | `Email` | `{t("Email", "အီးမေးလ်")}` |
| 255 | `Address` | `{t("Address", "လိပ်စာ")}` |
| 264 | `Cancel` | `{t("Cancel", "မလုပ်တော့ပါ")}` |
| 265 | `Save` | `{t("Save", "သိမ်းဆည်းမည်")}` |

---

### Module 4: Sales Order Table
Component path: `src/app/(dashboard)/sales-orders/page.tsx`

| Line Number(s) | Current Dual / Combined String | Required Remediation |
|---|---|---|
| 663 | `t("Drafts / Pre-Orders", "ယာယီ/ကြိုတင်မှာယူမှုများ")` | `t("Drafts & Pre-Orders", "ယာယီနှင့် ကြိုတင်မှာယူမှုများ")` |
| 676-683 | Table Headers `ORDER ID`, `CUSTOMER`, `DATE`, `STATUS`, `PAYMENT`, `TOTAL PRICE`, `TOTAL COST`, `ACTIONS` | Wrap each `<TableHead>` content in `t()` |
| 706 | `t("Walk-in / Unknown", "လာရောက်ဝယ်ယူသူ")` | `t("Walk-in", "လာရောက်ဝယ်ယူသူ")` |
| 872 | `t("Date / Time", "ရက်စွဲ / အချိန်")` | `t("Date & Time", "ရက်စွဲ နှင့် အချိန်")` |
| 920 | `t("Edit & Confirm / Price", "ပြင်ဆင်ပြီး ဈေးနှုန်းသတ်မှတ်မည်")` | `t("Edit & Confirm Price", "ပြင်ဆင်ပြီး ဈေးနှုန်းသတ်မှတ်မည်")` |
| 1056 | `t("Save as Draft / Pre-Order", "ယာယီ/ကြိုတင်မှာယူမှုအဖြစ် သိမ်းဆည်းမည်...")` | `t("Save as Draft", "ယာယီအဖြစ် သိမ်းဆည်းမည် (ဈေးနှုန်းနှင့် စတော့ ကန့်သတ်ချက်များ ကျော်လွှားမည်)")` |

---

### Module 5: Purchases & Purchase Orders Tables
Component paths: `src/app/(dashboard)/purchases/page.tsx` & `src/app/(dashboard)/purchase-orders/page.tsx`

| File Path | Line Number(s) | Current String | Required Remediation |
|---|---|---|---|
| `purchases/page.tsx` | 313 | `"New Purchase Order"` | `t("New Purchase Order", "အဝယ်အမှာစာ အသစ်")` |
| `purchases/page.tsx` | 320 | `"Direct Purchases History"` | `t("Direct Purchases History", "ချက်ချင်းအဝယ် မှတ်တမ်း")` |
| `purchases/page.tsx` | 326 | `"All"` | `t("All", "အားလုံး")` |
| `purchases/page.tsx` | 330 | `"Received"` | `t("Received", "လက်ခံရရှိပြီး")` |
| `purchases/page.tsx` | 334 | `"Cancelled"` | `t("Cancelled", "ပယ်ဖျက်ပြီး")` |
| `purchases/page.tsx` | 339 | `placeholder="Search history..."` | `placeholder={t("Search history...", "မှတ်တမ်း ရှာဖွေရန်...")}` |
| `purchases/page.tsx` | 363 | `"Total Cost:"` | `t("Total Cost:", "စုစုပေါင်း ကုန်ကျစရိတ်:")` |
| `purchases/page.tsx` | 387 | `"Create Purchase Order"` | `t("Create Purchase Order", "အဝယ်အမှာစာ ပြုလုပ်ရန်")` |
| `purchases/page.tsx` | 586 | `"Confirm Receipt"` | `t("Confirm Receipt", "လက်ခံမှု အတည်ပြုမည်")` |
| `purchase-orders/page.tsx` | 300-690 | Hardcoded English headers & action buttons | Wrap all UI labels in `t()` matching `purchases/page.tsx` |

---

### Module 6: Expenses Table
Component path: `src/app/(dashboard)/expenses/page.tsx`

| Line Number(s) | Current Dual / Un-translated String | Required Remediation |
|---|---|---|
| 381 | `<th className="...">DATE</th>` | `{t("DATE", "ရက်စွဲ")}` |
| 382 | `<th className="...">BRANCH</th>` | `{t("BRANCH", "ဆိုင်ခွဲ")}` |
| 383 | `<th className="...">CATEGORY</th>` | `{t("CATEGORY", "အမျိုးအစား")}` |
| 384 | `<th className="...">AMOUNT</th>` | `{t("AMOUNT", "ပမာဏ")}` |
| 385 | `<th className="...">NOTE</th>` | `{t("NOTE", "မှတ်ချက်")}` |
| 554 | `title="Delete Expense / စရိတ် ပယ်ဖျက်ရန်"` | `title={t("Delete Expense", "စရိတ် ပယ်ဖျက်ရန်")}` |
| 555 | `description="Are you sure you want to delete this expense record? / ဤစရိတ်မှတ်တမ်းအား ပယ်ဖျက်ရန် သေချာပါသလား။"` | `description={t("Are you sure you want to delete this expense record?", "ဤစရိတ်မှတ်တမ်းအား ပယ်ဖျက်ရန် သေချာပါသလား။")}` |
| 556 | `confirmText="Delete / ပယ်ဖျက်မည်"` | `confirmText={t("Delete", "ပယ်ဖျက်မည်")}` |

---

### Module 7: Staff Table
Component path: `src/app/(dashboard)/staff/page.tsx`

| Line Number(s) | Current Dual / Combined String | Required Remediation |
|---|---|---|
| 73-75 | `ROLE_LABELS = { OWNER: { label: "Owner / ပိုင်ရှင်" }, ... }` | Change structure to `{ labelEn: "Owner", labelMy: "ပိုင်ရှင်" }` |
| 337 | `"Permissions updated successfully! / အခွင့်အရေးများကို ပြင်ဆင်ပြီးပါပြီ။"` | `t("Permissions updated successfully!", "အခွင့်အရေးများကို ပြင်ဆင်ပြီးပါပြီ။")` |
| 469-476 | Table Headers `STAFF MEMBER`, `EMAIL`, `PASSWORD`, `BRANCH`, `ROLE`, `SALES` | Wrap each `<th className="...">` content in `t()` |
| 509-511 | `{ROLE_LABELS[member.role].label}` | `{t(ROLE_LABELS[member.role].labelEn, ROLE_LABELS[member.role].labelMy)}` |
| 596 | `Login Password / စကားဝှက် *` | `t("Login Password *", "စကားဝှက် *")` |
| 618-620 | Option elements `<option value="CASHIER">Cashier / ငွေကိုင်</option>` | Use `t("Cashier", "ငွေကိုင်")`, `t("Manager", "မန်နေဂျာ")`, `t("Owner", "ပိုင်ရှင်")` |
| 701 | `Owner permissions are unrestricted and cannot be modified / ပိုင်ရှင် အခွင့်အရေးကို ပြင်ဆင်၍မရပါ` | `t("Owner permissions are unrestricted and cannot be modified", "ပိုင်ရှင် အခွင့်အရေးကို ပြင်ဆင်၍မရပါ")` |
| 731 | `{modLabel.en} / {modLabel.my}` | `{t(modLabel.en, modLabel.my)}` |

---

### Module 8: Reports
Component path: `src/app/(dashboard)/reports/page.tsx`

| Line Number(s) | Current Un-translated String | Required Remediation |
|---|---|---|
| Top of file | `useLanguage` missing | Import `useLanguage` from `@/providers/language-provider` & destructure `const { t } = useLanguage()` |
| 339 | `Reports & Analytics` | `{t("Reports & Analytics", "အစီရင်ခံစာများနှင့် စာရင်းအင်းများ")}` |
| 340 | `Comprehensive business performance insights` | `{t("Comprehensive business performance insights", "စီးပွားရေးဆိုင်ရာ စွမ်းဆောင်ရည် သုံးသပ်ချက်များ")}` |
| 371 | `"Last 7 Days"` | `{t("Last 7 Days", "လွန်ခဲ့သော ၇ ရက်")}` |
| 379 | `"Last 30 Days"` | `{t("Last 30 Days", "လွန်ခဲ့သော ရက် ၃၀")}` |
| 387 | `"Custom Range"` | `{t("Custom Range", "စိတ်ကြိုက် ရွေးချယ်ရန်")}` |
| 415 | `"Total Revenue"` | `{t("Total Revenue", "စုစုပေါင်း ဝင်ငွေ")}` |
| 421 | `"Total COGS"` | `{t("Total COGS", "စုစုပေါင်း ပစ္စည်းအရင်း")}` |
| 427 | `"Gross Profit"` | `{t("Gross Profit", "အကြမ်းဖျင်း အမြတ်")}` |
| 433 | `"Net Profit"` | `{t("Net Profit", "အသားတင် အမြတ်")}` |
| 443 | Tabs ("Profit & Loss", "Branch Performance", "Product Performance", "Staff Performance", "Expenses") | Wrap each `<TabsTrigger>` text in `t()` |
| 457 | `"Profit & Loss Trend"` | `{t("Profit & Loss Trend", "အမြတ်နှင့် အရှုံး လမ်းကြောင်း")}` |
| 480 | `"Daily Breakdown"` | `{t("Daily Breakdown", "နေ့စဉ် ခွဲခြားမှု")}` |
| 486-490 | Table Headers `Date`, `Revenue`, `COGS`, `Expenses`, `Net Profit` | Wrap each `<TableHead>` in `t()` |
| 583 | `"Top Selling Products"` | `{t("Top Selling Products", "အရောင်းရဆုံး ပစ္စည်းများ")}` |
| 588, 634, 680 | `"Export CSV"` / `"Export PDF"` | `t("Export CSV", "CSV ဒေါင်းလုဒ်")` / `t("Export PDF", "PDF ဒေါင်းလုဒ်")` |

---

## 3. Step-by-Step Remediation Plan for Requirement R3

### Phase 1: Imports & Setup
1. Verify that `useLanguage` is imported in every file within the 8 target modules.
2. In `receipt-view.tsx` and `reports/page.tsx`, add `import { useLanguage } from "@/providers/language-provider"` and `const { t } = useLanguage()`.

### Phase 2: Refactoring Dual Slash JSX Strings
1. Search and replace all hardcoded dual-slash strings (`"Text / မြန်မာ"`) with `t("Text", "မြန်မာ")`.
2. Ensure placeholder props (e.g., `placeholder="Search / ရှာရန်..."`) use JSX expression `placeholder={t("Search...", "ရှာရန်...")}`.

### Phase 3: Fixing Corrupted `t()` Calls & Object Dictionaries
1. Correct `t()` calls where the English argument accidentally contained dual slash text (e.g., `branches/page.tsx` line 316 and `sales-orders/page.tsx` line 663, 1056).
2. Refactor `ROLE_LABELS` in `staff/page.tsx` to hold separate `labelEn` and `labelMy` properties, rendering via `t(ROLE_LABELS[role].labelEn, ROLE_LABELS[role].labelMy)`.

### Phase 4: Table Header & Modal Prop Standardization
1. Wrap all `<th>` and `<TableHead>` text in `t()`.
2. Update modal props (such as `ConfirmModal` in `expenses/page.tsx`) to pass `t()` values instead of hardcoded dual slash strings.

### Phase 5: Verification & Quality Assurance
1. **English Toggle Test**: Toggle language switch to `"en"`. Inspect all 8 target components to ensure 0 Burmese characters and 0 raw slashes appear in headers, labels, or buttons.
2. **Burmese Toggle Test**: Toggle language switch to `"my"`. Inspect all 8 target components to ensure 100% Burmese text is rendered without un-translated English fallbacks.
3. **Build Check**: Execute `npm run build` to confirm clean compilation.
