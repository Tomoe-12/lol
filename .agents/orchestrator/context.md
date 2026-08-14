# Context — Project Orchestrator

## Overview
SMARTOS Point of Sale & Inventory Application Verification.

## Key Files & Paths
- Project Root: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`
- Original Request: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md`
- Working Directory: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\orchestrator`

## Core Requirements Summary
- R1: Role & Permission Access Boundaries (Owner, Manager, Cashier across 18 routes, branch isolation, forbidden checks).
- R2: Complete Business Lifecycle Verification (POS checkout, sales orders, delivery, debt collection, zero-drift stock audit).

## Active Subagents
| Subagent Name | Role | Conv ID | Purpose | Status |
|---------------|------|---------|---------|--------|
| explorer_1 | Codebase & RBAC Explorer | 02ae6526-b7f6-4d2b-a412-047ded13fa4c | Map 18 routes, RBAC middleware, branch isolation | IN_PROGRESS |
| explorer_2 | Business Lifecycle Explorer | f8e023a0-3d0e-4d87-8193-5bc488ea7506 | Map POS, Sales Orders, Delivery, Debt, Stock & InventoryLog | IN_PROGRESS |
| spec_miner_1 | Test Infra & Spec Miner | be626538-e644-4103-a921-37e095b019cc | Map test scripts, DB seed, existing test suites & coverage | IN_PROGRESS |
