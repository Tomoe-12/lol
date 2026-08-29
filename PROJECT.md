# Project: SMARTOS Enterprise POS & Inventory Documentation & Architecture Suite

## Architecture & Scope
SMARTOS is a production-grade multi-branch Point of Sale, Inventory Management, and Financial Ledger system built for Myanmar retail enterprises using Next.js 15 App Router, React 19, Prisma ORM 6.19, MySQL/SQLite, Upstash Redis, Tailwind CSS 4, Zustand, and TypeScript.

This project delivers:
1. `PROJECT_REPORT.md` (Workspace root): Complete technical report covering Preliminaries, Chapters 1 through 8, comprehensive Data Dictionary (19 Prisma models), complete Next.js Route Catalog (39 route handlers), RBAC interlocking security model, exact business formulas (MAC, Debt capping, Split Payment, Cost Floor), 13-suite automated test analysis with zero-drift financial proofs, and embedded Mermaid diagrams.
2. `drawio/*.drawio` (7 files): Standalone, valid, editable Draw.io XML files ready for diagrams.net.

## Feature Inventory
| # | Feature / Chapter | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Preliminary Pages & Ch 1 | Title, Acknowledgements, Abstract, TOC, Figures, Tables, Acronyms, Myanmar retail background, Problem statement, Scope | M1 | ORIGINAL_REQUEST |
| 2 | Ch 2 Requirements & Stack | Personas, RBAC matrix, FR-01 to FR-11, NFRs, Tech stack & environment | M1 | ORIGINAL_REQUEST |
| 3 | Ch 3 Architecture & Workflows | 3-tier architecture, Core workflows (POS checkout, Sales order lifecycle, Delivery transitions, Debt capping, PO & MAC, RBAC interlocking logic), Mermaid diagrams | M2 | ORIGINAL_REQUEST |
| 4 | Ch 4 Data Dictionary | 19 Prisma database tables, data types, constraints, FKs, compound unique indexes | M1 | ORIGINAL_REQUEST |
| 5 | Ch 5 Subsystems & APIs | 11 UI subsystems breakdown, 39 Next.js API route handler specifications | M2 | ORIGINAL_REQUEST |
| 6 | Ch 6 Testing & Security | 13 test suites breakdown, assertions, concurrency audits (50-way), zero-drift proof | M3 | ORIGINAL_REQUEST |
| 7 | Ch 7 & 8 Challenges & Conclusion | Concurrency race condition prevention, multi-branch data isolation, i18n SSR hydration, limitations, roadmap, references, appendices | M3 | ORIGINAL_REQUEST |
| 8 | Draw.io Architecture Diagrams | 7 XML Draw.io diagram files matching specifications | M4 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M0 | Survey & Fact Extraction | 3 Explorers inspect Prisma schema, 39 API routes, 11 UI subsystems, 13 test suites, lib/services, business formulas | none | DONE |
| M1 | Core Spec & Data Dictionary | Chapter 1, Chapter 2, Chapter 4 of PROJECT_REPORT.md | M0 | DONE |
| M2 | Architecture, Workflows & APIs | Chapter 3, Chapter 5 of PROJECT_REPORT.md | M0 | DONE |
| M3 | Testing, Challenges & Synthesis | Chapter 6, Chapter 7, Chapter 8, Preliminaries | M0, M1, M2 | DONE |
| M4 | Draw.io Diagram Creation | 7 valid XML Draw.io files in `drawio/` | M0 | DONE |
| M5 | Full Audit & Review Gate | Reviewer, Challenger & Forensic Auditor verification against codebase & criteria | M1, M2, M3, M4 | DONE |

## Code Layout
- `PROJECT_REPORT.md` — Master technical documentation report (Workspace Root)
- `drawio/system_architecture.drawio` — 3-Tier Multi-Layer System Architecture
- `drawio/pos_checkout_flow.drawio` — POS Checkout, Cost Floor Check, Split Payment & Stock Deduction
- `drawio/sales_order_lifecycle.drawio` — Sales Order State Machine & Deposit Flow
- `drawio/delivery_state_machine.drawio` — Delivery Transition & Zero Double-Deduction Flow
- `drawio/debt_collection_flow.drawio` — Outstanding Debt Repayment & Ledger Flow
- `drawio/purchase_order_mac_flow.drawio` — Purchase Order Receiving & MAC Recalculation
- `drawio/rbac_security_model.drawio` — RBAC Security Boundary & Interlocking Matrix
