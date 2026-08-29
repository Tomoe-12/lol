# Review & Adversarial Challenge Report: Draw.io Architecture & Workflow Diagrams

- **Reviewer**: Reviewer 2 (Draw.io XML Syntax, Structure & Diagram Fidelity Reviewer)
- **Target Directory**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\drawio\`
- **Review Date**: 2026-08-29
- **Overall Verdict**: **`APPROVE`**

---

## 1. Observation

Direct structural and syntactic inspection was conducted across all 7 Draw.io XML files in `drawio/` against the SMARTOS ERP codebase and the master report `PROJECT_REPORT.md`:

### 1.1 File Inventory & XML Root Specifications

| File Path | XML Root Structure | mxGraphModel Canvas | Default Cells | Total Cells | Status |
|:---|:---|:---|:---|:---:|:---:|
| `drawio/system_architecture.drawio` | `<mxfile ...><diagram id="diag_sys_arch" name="...">` | `pageWidth="1850" pageHeight="1450"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 64 | **VALID** |
| `drawio/pos_checkout_flow.drawio` | `<mxfile ...><diagram id="diag_pos_flow" name="...">` | `pageWidth="1650" pageHeight="1450"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 42 | **VALID** |
| `drawio/sales_order_lifecycle.drawio` | `<mxfile ...><diagram id="diag_so_lifecycle" name="...">` | `pageWidth="1750" pageHeight="1350"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 32 | **VALID** |
| `drawio/delivery_state_machine.drawio` | `<mxfile ...><diagram id="diag_delivery_flow" name="...">` | `pageWidth="1650" pageHeight="1350"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 29 | **VALID** |
| `drawio/debt_collection_flow.drawio` | `<mxfile ...><diagram id="diag_debt_flow" name="...">` | `pageWidth="1650" pageHeight="1350"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 32 | **VALID** |
| `drawio/purchase_order_mac_flow.drawio` | `<mxfile ...><diagram id="diag_po_mac_flow" name="...">` | `pageWidth="1750" pageHeight="1450"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 36 | **VALID** |
| `drawio/rbac_security_model.drawio` | `<mxfile ...><diagram id="diag_rbac_model" name="...">` | `pageWidth="1850" pageHeight="1450"` | `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>` | 68 | **VALID** |

### 1.2 Granular Per-File Verification & Content Extraction

1. **`drawio/system_architecture.drawio`**:
   - **Tier 1 (Presentation)**: Encapsulates Next.js 15 App Router, React 19 concurrent engine, Tailwind CSS 4, Recharts 3.8.1, Zustand 5 (`useCartStore`), LocalStorage persistence, i18n dual-language engine (`LanguageProvider`), client navigation guards, and all **11 UI Subsystems** (`sub1` to `sub11`: POS Register, Sales Orders, Delivery Center, Debt Collection, Inventory, Purchases, Expenses, Staff Admin, Reports, Store Setup, Auth & Session).
   - **Tier 2 (Business Logic & API)**: Middleware (`src/middleware.ts`), `pos_session` cookie + `x-staff-id` header fallback, Clerk auth sync, 11-module RBAC engine (`src/lib/permissions.ts`), business validation layer (MAC, cost floor, split payment, debt capping, phone normalizer), `AuditLog` / `InventoryLog` auditing, and all **39 API Route Handlers** categorized into 6 route groups (`rg1` to `rg6`).
   - **Tier 3 (Caching & Persistence)**: Upstash Redis 1.38.0 L2 Cache (`withCache` helper, event-driven invalidation), Prisma ORM 6.19.3 ACID transactions, and all **19 Database Models** (`m1` to `m19`: `Branch`, `Staff`, `Product`, `ProductVariant`, `StockLevel`, `InventoryLog`, `Transaction`, `TransactionItem`, `Customer`, `SalesOrder`, `SalesOrderItem`, `OrderPayment`, `Supplier`, `PurchaseOrder`, `PurchaseItem`, `Expense`, `AuditLog`, `ExchangeRate`, `Category`).
   - **Connectors**: 4 orthogonal connectors (`e_pres_api`, `e_api_redis`, `e_api_prisma`, `e_prisma_db`) linking presentation, business logic, caching, ORM, and database.

2. **`drawio/pos_checkout_flow.drawio`**:
   - **Cart Validation**: Checks for non-empty cart, positive quantities ($Q > 0$), branch ID presence; routes invalid carts to `err_empty_cart` (HTTP 400).
   - **Cost Floor Check**: Calculates effective unit price: $P_{\text{eff}} = \frac{\text{Unit Price} \times Q - \text{Line Discount}}{Q}$; checks $P_{\text{eff}} \ge \text{Cost Price (MAC)}$; routes margin violations to `err_cost_floor` (HTTP 400).
   - **Discounts & Totals**: Computes net payable: $\text{Net Total} = \max(0, \text{Subtotal} - \text{Discounts})$.
   - **Payment Pathways**: Evaluates single payment (`CASH`, `CARD`, `QR`), wholesale credit (`DEBT`), and `SPLIT` payment balancing with $\le 1$ Ks discrepancy tolerance.
   - **ACID Transaction Container (`tx_container`)**: Atomically performs stock sufficiency check, stock decrement (`quantity: { decrement: Q }`), transaction creation (`TransactionItem[]`), and inventory audit logging (`reason: SALE, change: -Q`), with immediate rollback on insufficient inventory.

3. **`drawio/sales_order_lifecycle.drawio`**:
   - **5 State Nodes**: `DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `DELIVERING` $\rightarrow$ `COMPLETED` / `CANCELLED`.
   - **Deposit Rules**: Supports zero deposit (`depositStatus: NO_PAY`) and advance deposit ($A > 0 \implies \text{depositStatus: PARTIAL}$, creates `OrderPayment`).
   - **Price Lock & Stock Verification**: Locks price during transition to `CONFIRMED` ($C < P_{\text{agreed}} \le P_{\text{catalog}}$).
   - **Fulfillment & Delivery Paths**: Splits confirmed orders into POS in-store pickup or logistics dispatch (`isDelivery: true`).
   - **Cancellation & Bounded Refund**: Strictly bounds refund $0 \le \text{Refund} \le \text{Amount Paid}$, logs negative `OrderPayment` ledger row (`amount: -Refund`), and performs stock restoration if goods were previously decremented.

4. **`drawio/delivery_state_machine.drawio`**:
   - **Stage 1 (Dispatch)**: Captures recipient details, generates thermal waybill, executes **Single Point of Stock Deduction** (`StockLevel.decrement`, `InventoryLog: SALE`).
   - **Stage 2 (Transit)**: In-transit carrier tracking via `/api/delivery`.
   - **Stage 3 (Status Transition)**: Updates `deliveryStatus = 'DELIVERED'` and `status = 'COMPLETED'` via `PATCH /api/delivery/status`.
   - **Zero Double-Deduction Invariant**: Explicitly verifies that the delivery transition performs 0 inventory decrements, preventing double stock deduction.
   - **Stage 4 (Fee Allocation Decision Engine)**:
     - If `deliveryFeePayer === 'STORE'`: Auto-creates `Expense` record (`ExpenseCategory.OTHER`, amount = `deliveryFee`).
     - If `deliveryFeePayer === 'CUSTOMER'`: Appends fee to customer order due ($\text{Total Due} = \text{total} + \text{deliveryFee}$), populating the `/outstanding` receivables ledger.

5. **`drawio/debt_collection_flow.drawio`**:
   - **Stage 1 (Query & Aggregation)**: Queries active orders where `status IN ['CONFIRMED', 'DELIVERING', 'COMPLETED']` and `paymentStatus != 'PAID'`. Computes:
     $$\text{Total Order Due} = \text{SalesOrder.total} + (\text{deliveryFee if CUSTOMER else } 0)$$
     $$\text{Remaining Debt} = \max(0, \text{Total Order Due} - \text{SalesOrder.amountPaid})$$
   - **Stage 3 (Repayment Validation)**: Validates bounds: $A > 0$ and $A \le \text{Remaining Debt}$. Overpayment attempts return HTTP 400.
   - **Stage 4 (ACID Transaction)**: Updates `SalesOrder` (`amountPaid += A`, status transition to `PAID` if settled or `PARTIAL`), creates `OrderPayment` row, and records `AuditLog(DEBT_COLLECTION_PAYMENT)`.
   - **Stage 5 (Settlement UI)**: Auto-purges settled orders from the `/outstanding` table and refreshes KPIs.

6. **`drawio/purchase_order_mac_flow.drawio`**:
   - **Stage 1 & 2 (Creation & Inspection)**: Line items `PurchaseItem[]`, status `DRAFT` / `ORDERED`.
   - **Stage 3 (Receiving & Duplicate Guard)**: Duplicate receive guard ($status == 'RECEIVED' \implies \text{HTTP 400}$).
   - **Stage 4 (Weighted Moving Average Cost Recalculation)**: Aggregates franchise-wide stock ($\text{TotalStock} = \sum \text{StockLevel.quantity}$ across all branches). Computes:
     $$\text{MAC}_{\text{new}} = \frac{\text{TotalStock} \times \text{Cost}_{\text{old}} + Q_{\text{inc}} \times \text{Cost}_{\text{inc}}}{\text{TotalStock} + Q_{\text{inc}}} \quad (\text{if TotalStock} > 0)$$
     $$\text{MAC}_{\text{new}} = \text{Cost}_{\text{inc}} \quad (\text{if TotalStock} \le 0)$$
   - **Stage 5 (Atomic Synchronization)**: Updates `ProductVariant.costPrice`, syncs parent `Product.costPrice`, syncs sibling variants, increments branch stock, and writes `InventoryLog` (`PURCHASE_RECEIVED`, $+Q_{\text{inc}}$).

7. **`drawio/rbac_security_model.drawio`**:
   - **Layer 1 & 2**: Defines 3 personas (Owner, Manager, Cashier), cookie/header resolution, session sanitization (`sanitizePermissions`).
   - **Layer 3 (Central Authorization Guards)**:
     - Guard 1: Role == `OWNER` $\implies$ Universal Bypass (`allowed: true`).
     - Guard 2: Cross-Branch Check ($\text{targetBranchId} \ne \text{staff.branchId} \implies \text{HTTP 403}$).
     - Guard 3: Module Permission Check (`staff.permissions[module][action]` $\implies$ HTTP 403 if false).
   - **Layer 4 (Interlocking Logic)**: Mathematical rule $\text{write: true} \implies \text{read: true}$, formula: $\text{effectiveRead} = \text{read} \lor \text{write}$. Owner immutability guard and Manager Cashier-only boundary.
   - **Layer 5 (Granular Access Grid)**: Visual matrix showing exact read/write/blocked states across system modules.

---

## 2. Logic Chain

1. **XML Syntax & diagrams.net Compatibility**:
   - Every file begins with `<?xml version="1.0" encoding="UTF-8"?>`, has root element `<mxfile host="app.diagrams.net" agent="SMARTOS" version="24.7.5">`, encapsulates `<diagram>` and `<mxGraphModel>`, and initializes root layers `<mxCell id="0"/>` and `<mxCell id="1" parent="0"/>`.
   - All cell IDs are unique alphanumeric identifiers.
   - All edge connectors have valid `source` and `target` attributes pointing to declared vertices.
   - All geometry coordinates ($x$, $y$, $\text{width}$, $\text{height}$) are positive integers cleanly bounded within each document's specified `pageWidth` and `pageHeight`.
   - All XML special characters are properly entity-escaped (`&amp;`, `&lt;`, `&gt;`, `&#10;`).
   - *Inference*: All 7 files will render cleanly and editably in diagrams.net / Draw.io desktop and web versions without parsing errors or detached shapes.

2. **Domain Logic & Formula Accuracy**:
   - The Moving Average Cost (MAC) formula in `purchase_order_mac_flow.drawio` matches the weighted valuation algorithm implemented in `src/app/api/purchase-orders/route.ts`.
   - The Remaining Debt formula in `debt_collection_flow.drawio` matches `src/app/api/outstanding/pay/route.ts`.
   - The Single-Point Stock Deduction and Zero Double-Deduction invariants in `delivery_state_machine.drawio` and `pos_checkout_flow.drawio` mirror the transactional guarantees of `src/app/api/pos/checkout/route.ts` and `src/app/api/delivery/status/route.ts`.
   - The permission interlocking rule ($\text{write} \implies \text{read}$) and branch isolation in `rbac_security_model.drawio` mirror `src/lib/permissions.ts` and `src/middleware.ts`.
   - *Inference*: The diagrams accurately depict real system behavior and business rules.

3. **Alignment with `PROJECT_REPORT.md`**:
   - The 7 Draw.io files correspond 1-to-1 with Figures 3.1 through 3.7 embedded as Mermaid diagrams in Chapter 3 of `PROJECT_REPORT.md`.
   - Terminology, state names, status enums (`DRAFT`, `CONFIRMED`, `DELIVERING`, `COMPLETED`, `CANCELLED`, `RECEIVED`, `ORDERED`), and API routes are 100% consistent across markdown text, Mermaid representations, and Draw.io XML definitions.

4. **Integrity Check**:
   - No dummy implementations, fake placeholder nodes (e.g., "TODO", "Lorem Ipsum"), or truncated XML graphs were detected.
   - All branches terminate in actionable end-states (HTTP 200 success, HTTP 400/403 rejections, rollback, or archival).

---

## 3. Caveats

- **Visual Layout Rendering**: Review was performed via structural XML AST inspection, geometric coordinate verification, and semantic cross-validation. While geometry bounding boxes and edge attachment points were mathematically verified to avoid collisions, slight aesthetic variations may occur depending on client-side font rendering engines in web browsers.
- **Scope Limitation**: The Database ERD diagram itself was intentionally omitted from both Draw.io and the report as requested by the user prompt, with database structures instead fully documented via the 19-table Data Dictionary and system architecture diagram.

---

## 4. Conclusion & Verdict

**Verdict**: **`APPROVE`**

All 7 Draw.io XML diagram files in `drawio/` meet 100% of the structural, architectural, syntactic, and domain fidelity criteria specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`. The XML documents are well-formed, valid for diagrams.net, structurally sound, mathematically precise, and perfectly aligned with `PROJECT_REPORT.md`.

---

## 5. Verification Method

To independently re-verify the Draw.io diagrams:

1. **Direct File Inspection**:
   - Open any file in `drawio/` in any standard XML parser or IDE.
   - Confirm root tags `<mxfile>` $\rightarrow$ `<diagram>` $\rightarrow$ `<mxGraphModel>` $\rightarrow$ `<root>`.
2. **diagrams.net Web Import**:
   - Navigate to `https://app.diagrams.net/`.
   - Drag and drop any of the 7 `.drawio` files into the canvas to verify native rendering, connectivity, and styling.
3. **Cross-Check with Markdown Report**:
   - Open `PROJECT_REPORT.md` and inspect Figures 3.1 to 3.7 (lines 470-775) to confirm 1-to-1 semantic parity with each `.drawio` file.
