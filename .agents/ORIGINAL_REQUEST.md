# Original User Request

## Initial Request — 2026-08-10T10:57:32Z

Execute an exhaustive multi-role and end-to-end business flow verification across the SMARTOS Point of Sale & Inventory application, validating all actions for Owner, Manager, and Cashier roles across all branches.

Working directory: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`
Integrity mode: development

## Requirements

### R1. Role & Permission Access Boundaries (Owner, Manager, Cashier)
- Validate that **Owner** has 100% full access across all branches, pages, reports, setup, and staff permission settings.
- Validate that **Manager** is strictly branch-isolated to their assigned branch, and blocked with HTTP 403 Forbidden from editing staff permissions for staff outside their branch.
- Validate that **Cashier** is strictly restricted to POS, Delivery, and Outstanding, and blocked with HTTP 403 Forbidden from accessing staff administration, reports, inventory adjustments, purchase orders, expenses, branch settings, and dashboard stats.

### R2. Complete Business Lifecycle Verification
- Validate end-to-end POS checkout, split payment calculations, minimum selling price protection against cost prices, exchange rate conversions, and immediate stock deductions.
- Validate Sales Orders lifecycle: Draft pre-orders, confirmation, partial payments, initial advance deposit tracking, cancellation refund prompts, and delivery link.
- Validate Delivery Management: Marking orders as DELIVERED in `/delivery` updates status to COMPLETED and triggers immediate physical stock deduction with `InventoryLog` audit entries.
- Validate Debt Collection: Capping repayment input to remaining balance and updating customer balance ledgers.
- Validate Inventory & Financial Zero-Drift Audit across all StockLevels vs InventoryLog ledgers.

## Acceptance Criteria

### Role & Access Control Criteria
- [ ] Logged-in OWNER accesses all 18 routes, manages all branches, and updates staff permissions without error.
- [ ] Logged-in MANAGER attempting cross-branch mutations or unassigned staff permission edits receives HTTP 403 Forbidden.
- [ ] Logged-in CASHIER attempting to load `/staff`, `/reports`, `/inventory`, `/purchase-orders`, `/expenses`, or `/setup` is blocked with HTTP 403 Forbidden.

### Business & Inventory Flow Criteria
- [ ] Completing a POS checkout immediately decrements variant stock levels and logs a `SALE` entry.
- [ ] Confirming a Sales Order with delivery attaches customer details and lists the order under `/delivery`.
- [ ] Marking a Sales Order as `DELIVERED` transitions status to `COMPLETED` and decrements physical stock levels with `SALES_ORDER_DELIVERED` inventory log.
- [ ] Repayment amount in `/outstanding` cannot exceed `remainingDebt`.
- [ ] Zero-Drift Audit verifies 100% mathematical balance between StockLevels and InventoryLogs.

## Follow-up — 2026-08-12T14:13:00Z

Fix cashier branch assignment, sales voucher product card details, and clean up English/Burmese language toggle across all major tables and reports.

Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Integrity mode: development

## Requirements

### R1. Cashier Assigned Branch Display
When a user logs in as a cashier, the branch filter/display must reflect the specific branch assigned to that cashier user profile rather than hardcoding or defaulting to "Hledin branch".

### R2. Sales Voucher Product Card Details
In the sales voucher view, enrich the product cards to display essential product details directly on the card (e.g., current stock level, price, and relevant variants), matching the visual presentation used in the product catalog.

### R3. Strict Language Toggle (English vs. Burmese i18n)
Remove dual slash text (e.g. "English / Burmese" or "Name (မြန်မာ)") and strictly render ONLY English OR Burmese based on the active language toggle state across:
- Sales Voucher
- Branches Table
- Supplier Table
- Sales Order Table
- Purchases & Purchase Orders Tables
- Expenses Table
- Staff Table
- Reports

## Acceptance Criteria

### Cashier Branch Routing & Filtering
- Logging in as a cashier assigned to Branch X displays Branch X in the UI header/dashboard context instead of "Hledin branch".
- Sales transactions recorded by the cashier are strictly scoped to their assigned branch.

### Sales Voucher Product UI
- Product cards in the Sales Voucher grid visually display price and current available stock count.
- Product details update dynamically when stock or price changes.

### i18n Language Toggle Behavior
- Toggling language switch to "English" displays 100% English text across Sales Voucher, Branches, Suppliers, Sales Orders, Purchases, Expenses, Staff, and Reports.
- Toggling language switch to "Burmese" (Myanmar) displays 100% Burmese text across all specified modules without un-translated combined strings.

## Follow-up — 2026-08-29T02:47:09Z

Generate comprehensive, production-grade project documentation and a complete technical report for the **SMARTOS Enterprise Multi-Branch Point of Sale (POS), Inventory Management & Financial Ledger System**, matching the structure, depth, and academic/industry standards of the provided reference report while incorporating editable Draw.io diagrams for all system architectures and workflows.

Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Integrity mode: development

## Requirements

### R1. Comprehensive Project Technical Report (`PROJECT_REPORT.md`)
Author an exhaustive, multi-chapter technical report document structured as follows:
1. **Preliminary Pages**: Title Page, Acknowledgements, Executive Summary / Abstract, Table of Contents, List of Figures, List of Tables, Acronyms & Terminology.
2. **Chapter 1: Introduction & Project Overview**: Background & retail landscape in Myanmar, Problem Statement & Motivation, System Objectives, Business Benefits (Owner, Branch Manager, Cashier, Customer), Project Scope & Boundaries.
3. **Chapter 2: System Analysis & Requirements Specification**: User Personas & Role-Based Access Control (RBAC) Matrix, Functional Requirements (FR-01 to FR-11 covering POS Checkout, Cost Floor Protection, Sales Orders, Delivery, Debt Capping, PO & MAC Costing, Stock Tracking, Expenses, Staff Permission Matrix, Reports, i18n Localization), Non-Functional Requirements (Atomic Transactional Consistency, Sub-100ms Redis Caching, SSR Hydration Safety), Development Environment & Technology Stack (Next.js 15 App Router, React 19, Prisma ORM 6.19, MySQL/SQLite, Upstash Redis, Tailwind CSS 4, Zustand, TypeScript).
4. **Chapter 3: System Architecture & Workflow Design**: 3-Tier Multi-Layer Architecture, Core Business Workflow Descriptions & Decision Logic (POS Voucher Split Checkout, Sales Orders Pre-orders & Fulfillment, Delivery Status Transitions & Store Fee Allocation, Outstanding Debt Collection & Capping, Purchase Order Receiving & Moving Average Cost Recalculation), RBAC Security Boundaries & Permission Interlocking Logic (`write: true => read: true`).
5. **Chapter 4: Database Design & Schema Specifications**: Full Data Dictionary covering all 19 Prisma database tables (`Branch`, `Staff`, `Product`, `ProductVariant`, `StockLevel`, `InventoryLog`, `Transaction`, `TransactionItem`, `Customer`, `SalesOrder`, `SalesOrderItem`, `OrderPayment`, `Supplier`, `PurchaseOrder`, `PurchaseItem`, `Expense`, `AuditLog`, `ExchangeRate`), Data Types, Relational Constraints, Foreign Keys, and Compound Unique Indexes (`@@unique([branchId, variantId])`). *(Note: Database ERD diagram itself is skipped as requested by user)*.
6. **Chapter 5: System Implementation & UI Subsystems**: Detailed UI layout descriptions, components, user flows, and technical breakdown for all 11 subsystems (Authentication/Session, Sales Voucher POS, Sales Orders & Pre-orders, Delivery Dispatch, Outstanding Debt, Inventory & Transfer, Purchase Orders, Expense Ledger, Staff Admin & Permission Editor, Reports & Analytics, i18n Dual-Language Engine), plus API endpoint specifications for all 39 Next.js route handlers.
7. **Chapter 6: System Verification, Testing & Security Audit**: Complete analysis of the 13-suite test regression harness, Unit isolation tests, Multi-Branch RBAC boundary verification, 50-way concurrency zero-drift audit results, and zero-leak financial ledger proofs.
8. **Chapter 7: Technical Challenges, Limitations & Future Enhancements**: Engineering hurdles resolved (high-concurrency race condition prevention, multi-branch data isolation, i18n SSR hydration), system limitations, future roadmap (Offline PWA Sync with IndexedDB, Direct ESC/POS Thermal Receipt Printing, Barcode Scanner WebUSB/WebHID Integration).
9. **Chapter 8: Conclusion & References**: Summary of outcomes, formal bibliography/references, and appendices.

### R2. Complete Set of Draw.io Architecture & Flowchart Diagrams (`drawio/*.drawio`)
Create well-structured, valid XML Draw.io diagram files inside the `drawio/` directory for all system diagrams:
- `drawio/system_architecture.drawio`: 3-Tier / Multi-Layer System Architecture (Presentation, Business Logic / API, Caching & Data Management Tier).
- `drawio/pos_checkout_flow.drawio`: POS Voucher Checkout, Cost Floor Check, Split Payment & Atomic Stock Deduction Flowchart.
- `drawio/sales_order_lifecycle.drawio`: Sales Order State Machine (Draft -> Confirmed -> Delivering -> Completed / Cancelled) & 10% Deposit Flow.
- `drawio/delivery_state_machine.drawio`: Delivery Transition (`PENDING` -> `DELIVERED`), Zero Double-Deduction & Fee Expense Allocation Flow.
- `drawio/debt_collection_flow.drawio`: Outstanding Debt Repayment, Remaining Debt Capping & Customer Ledger Flow.
- `drawio/purchase_order_mac_flow.drawio`: Purchase Order Receiving & Moving Average Cost (MAC) Recalculation Flowchart.
- `drawio/rbac_security_model.drawio`: Multi-Role (Owner, Manager, Cashier) Access Boundary & Permission Interlocking Matrix.

### R3. Exact Technical Accuracy & Zero Placeholders
All formulas (Moving Average Cost formula, Remaining Debt formula, Discount validations), schema tables, route handler signatures, and test metrics must 100% reflect the actual codebase in `kind-shannon`.

## Acceptance Criteria

### Documentation Quality & Completeness
- [ ] `PROJECT_REPORT.md` is fully written with all 8 core chapters and zero placeholder text.
- [ ] Complete data dictionary for all 19 Prisma database tables with fields, types, and constraints.
- [ ] Detailed technical breakdown for all 39 Next.js API route handlers.
- [ ] Complete documentation of all 13 automated test suites with assertion counts and mathematical proofs.

### Diagram Specifications
- [ ] 7 distinct `.drawio` diagram files are created in `drawio/` with valid draw.io XML structure, ready to open in Draw.io / diagrams.net.
- [ ] Mermaid diagrams matching each Draw.io diagram are embedded in `PROJECT_REPORT.md` for instant markdown viewing.

