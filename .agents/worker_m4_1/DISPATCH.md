# Dispatch — Worker M4 (1)

Identity: worker_m4_1
Archetype: teamwork_preview_worker
Working Directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m4_1

## Task
Implement line item payload normalization in `src/app/api/pos/checkout/route.ts` to support both flat (`{ variantId, quantity, unitPrice }`) and nested (`{ selectedVariant: { id }, product: { id } }`) item formats, resolving high-concurrency checkout exceptions and guaranteeing zero-drift ledger integrity.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Artifact Paths
- ORIGINAL_REQUEST: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md`
- PROJECT: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md`
- TEST_INFRA: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\TEST_INFRA.md`
- Explorer Handoff: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_m4_1\handoff.md`

## Implementation & Verification Instructions
1. Inspect `src/app/api/pos/checkout/route.ts`.
2. Add robust line item normalization at the start of request processing:
   ```ts
   const variantId = item.variantId || item.selectedVariant?.id;
   const productId = item.productId || item.product?.id;
   ```
3. Ensure all downstream loops, stock deductions, and `InventoryLog` creations use the normalized `variantId` and `productId`.
4. Run verification commands:
   - `npx tsx tests/integration/challenger-2-stress.test.ts`
   - `npx tsx tests/integration/financial-inventory-integrity.test.ts`
   - `npm run build`
5. Write your handoff report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m4_1\handoff.md`.
