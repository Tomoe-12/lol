## 2026-08-12T14:29:31Z
You are Challenger M6 1 (teamwork_preview_challenger). Your task is to perform empirical stress testing and adversarial verification of Milestone M6 (R1, R2, R3) in SMARTOS POS.

Working Directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\challenger_m6_1
Project Root: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon

MANDATORY READS:
- Original User Request: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\ORIGINAL_REQUEST.md
- Master Specification: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md
- Worker M6 1 Handoff: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m6_1\handoff.md

CHALLENGE FOCUS:
1. R1: Test cashier branch scoping. Confirm cashier cannot checkout items under another branch even if branchId is manipulated in checkout payload.
2. R2: Test variant stock calculation on product cards. Confirm 0 cross-branch stock leaks and real-time cart item stock subtraction.
3. R3: Test strict language toggle. Verify zero raw slash leaks (`/`) or un-translated Burmese strings when English is selected, and vice versa.
4. Execute build (`npm run build`) and integration test suites (`npx tsx tests/...`).
5. Write your complete handoff report to C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\challenger_m6_1\handoff.md with explicit verdict (APPROVE or REQUEST_CHANGES) and send a message back to parent.
