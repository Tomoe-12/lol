## 2026-08-29T02:48:14Z
You are Explorer 2 (API Routes, RBAC Security, UI Subsystems & i18n).
Your working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_routes_ui_rbac
Master Request: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
Master Project Plan: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md

Task:
Perform a deep, exhaustive technical inspection of all Next.js API routes, authentication/RBAC mechanisms, UI subsystems, and i18n localization in the codebase (`C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`).

Investigate:
1. All Next.js API Route Handlers in `src/app/api/`:
   - Enumerate all 39 route handlers (exact folder paths and HTTP methods: GET, POST, PUT, PATCH, DELETE).
   - For each route, document: Route path, HTTP Method, Purpose, Auth/Role requirement, Request parameters (URL params, query params, body schema), and Response status/JSON payload shape.

2. Authentication, Session & RBAC Model:
   - Inspect `src/lib/auth.ts`, session verification, JWT/cookies, middleware.
   - Document the RBAC model for Owner, Manager, Cashier.
   - Document the Permission Interlocking Logic: `write: true => read: true` across all permission flags.
   - Document multi-branch isolation logic (how Manager/Cashier are constrained vs Owner cross-branch access).

3. 11 UI Subsystems in `src/app/` and `src/components/`:
   - Inspect all 11 subsystems:
     1. Authentication / Session Subsystem
     2. Sales Voucher (POS)
     3. Sales Orders & Pre-orders
     4. Delivery Dispatch
     5. Outstanding Debt Collection
     6. Inventory & Stock Transfer
     7. Purchase Orders & Receiving
     8. Expense Ledger
     9. Staff Administration & Permission Editor
     10. Reports & Analytics
     11. i18n Dual-Language Engine (English vs. Burmese)
   - For each subsystem: UI layout, component hierarchy, state management (Zustand/React hooks), user interactions, and validation rules.
   - Document the i18n localization engine: translation files, language toggle state, SSR hydration safety mechanisms preventing mismatch errors.

Output Requirements:
Write your comprehensive findings to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_routes_ui_rbac\report.md` and write a handoff report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_routes_ui_rbac\handoff.md`.
Send a completion message back to parent when finished with your key findings and file paths.
