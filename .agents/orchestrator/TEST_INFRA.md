# E2E Test Infra: kind-shannon Granular Staff Permission System

## Test Philosophy
- Opaque-box, requirement-driven integration test suite verifying role & granular permission access control.
- Test scenarios derived directly from user requirements (R1, R2, R3) and Acceptance Criteria.

## Feature Inventory & Test Matrix
| # | Feature | Requirement | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---------|-------------|:----------------:|:-----------------:|:---------------------:|:-------------------:|
| F1 | Default Permissions Schema | R1 | 5 | 5 | ✓ | ✓ |
| F2 | Owner Unrestricted Permissions | R1, R2, R3 | 5 | 5 | ✓ | ✓ |
| F3 | Manager Same-Branch Boundary | R1, R2, R3 | 5 | 5 | ✓ | ✓ |
| F4 | Cashier Complete Access Block | R1, R2, R3 | 5 | 5 | ✓ | ✓ |
| F5 | UI Navigation & Route Guards | R3 | 5 | 5 | ✓ | ✓ |
| F6 | Staff Permission Grid Modal | R2 | 5 | 5 | ✓ | ✓ |
| F7 | REST API 403 Enforcements | R3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Suite Script: Programmatic Node.js / Vitest / API test script in `tests/e2e-permissions.test.ts` (or `scripts/test-permissions.js`).
- Evaluates:
  1. Client-side navigation & layout accessibility rules.
  2. Permission modal state transitions & interlocking checkbox rules.
  3. Server REST API status codes (401 Unauthorized, 403 Forbidden, 200 OK) for Owner, Manager (same branch vs cross branch), and Cashier.
  4. Real-world scenario: Owner updates Manager permissions -> Manager logs in -> Sidebar immediately reflects new permissions -> API permits newly granted modules.

## Coverage Thresholds
- Tier 1: ≥35 test cases across 7 features
- Tier 2: ≥35 boundary test cases (cross-branch attempts, cashier direct route hits, invalid permissions payloads, owner demotion attempts)
- Tier 3: Pairwise feature interactions
- Tier 4: Real-world end-to-end lifecycle scenarios
