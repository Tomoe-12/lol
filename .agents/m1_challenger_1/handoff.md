# Handoff Report — Challenger 1 (Milestone M1: Schema & Permission Core Data Model)

## 1. Observation

Empirical testing was conducted against `src/lib/permissions.ts`, `src/lib/auth-helper.ts`, `prisma/schema.prisma`, and the production build (`npm run build`).

### Positive Observations:
1. **Production Build**: Executed `npm run build` — succeeded cleanly with exit code 0 and zero TypeScript or linting compilation errors.
2. **Prisma Schema**: `prisma/schema.prisma` contains `permissions Json?` on the `Staff` model (line 103). `npx prisma validate` passed.
3. **Basic Core Permissions Test Suite**: Executed `npx tsx tests/unit/m1-permissions-stress.test.ts` — 18/18 tests passed (Owner bypass, default Cashier/Manager matrices, basic string JSON parsing, path mapping for 14 routes, and `checkStaffPermission` status 403 responses).

### Empirical Defect Observations:
Executed deep adversarial test harness `npx tsx tests/unit/m1-challenger-deep-stress.test.ts`. 3 tests failed, revealing 2 distinct code defects in `src/lib/permissions.ts`:

#### Defect 1: Object Reference State Contamination in `getDefaultPermissionsForRole` and `sanitizePermissions`
- **Location**: `src/lib/permissions.ts` lines 103–105 & 134–136
```ts
103: if (role === "OWNER") {
104:   return { ...DEFAULT_OWNER_PERMISSIONS };
105: }
```
- **Observed Behavior**: `{ ...DEFAULT_OWNER_PERMISSIONS }` performs a top-level shallow copy, but the nested module permission objects (e.g., `{ read: true, write: true }`) are passed by reference.
- **Empirical Proof**:
```ts
const ownerPerms1 = getDefaultPermissionsForRole("OWNER");
ownerPerms1.dashboard.read = false; // Mutates nested object in place
const ownerPerms2 = getDefaultPermissionsForRole("OWNER");
console.log(ownerPerms2.dashboard.read); // Returns false!
```
- **Test Error Output**: `FAIL: Owner mutation contamination test failed: Mutating object returned by getDefaultPermissionsForRole('OWNER') must not contaminate default state! false !== true`.

#### Defect 2: Array Input Sanitization Bypass in `sanitizePermissions`
- **Location**: `src/lib/permissions.ts` line 164
```ts
164: if (rawMod && typeof rawMod === "object") {
```
- **Observed Behavior**: In JavaScript, `typeof [1, 2, 3] === "object"` evaluates to `true`. When a module key in the JSON input is an array (e.g. `{ pos: [1, 2, 3] }`), `rawMod` is treated as a module permission object. Because `[1, 2, 3].write` is `undefined`, `Boolean(undefined)` returns `false`, stripping default read/write access from Cashiers instead of using the fallback role default.
- **Empirical Proof**:
```ts
const res = sanitizePermissions({ pos: [1, 2, 3] }, "CASHIER");
console.log(res.pos.read); // Returns false instead of fallback default true!
```
- **Test Error Output**: `FAIL: Array module input test failed: Array input for pos should fall back to default read: true false !== true`.

---

## 2. Logic Chain

1. **State Contamination Risk**:
   - In Next.js server requests or client state management, objects returned by `getDefaultPermissionsForRole` or `sanitizePermissions` are consumed by route handlers and React context.
   - If any downstream code modifies a property on the returned permissions object (or if state is mutated in memory), the global `DEFAULT_OWNER_PERMISSIONS`, `DEFAULT_MANAGER_PERMISSIONS`, or `DEFAULT_CASHIER_PERMISSIONS` object references are directly mutated.
   - This corrupts security defaults across all subsequent requests in the process lifecycle.
   - **Fix Recommendation**: Return deep copies of default permission matrices:
     `return JSON.parse(JSON.stringify(DEFAULT_OWNER_PERMISSIONS));` or map keys with `{ read: mod.read, write: mod.write }`.

2. **Array Input Handling**:
   - `typeof rawMod === "object"` evaluates to `true` for arrays (`[]`).
   - Checking `typeof rawMod === "object" && rawMod !== null && !Array.isArray(rawMod)` guarantees that arrays do not get treated as valid `ModulePermission` objects.

---

## 3. Caveats

- **Build Status**: The Next.js production build (`npm run build`) compiles without error, confirming that TypeScript types and imports match.
- **Current Runtime Risk**: If permissions objects are never mutated in place, Defect 1 remains latent. However, as an empirical challenger, leaving shared mutable references in security kernel code is an unacceptable vulnerability.

---

## 4. Conclusion

**Verdict: REJECT**

While the core functionality and build succeed under standard happy-path inputs, `src/lib/permissions.ts` contains 2 security and state isolation defects under empirical stress testing:
1. Shared object reference state contamination for default role permission matrices.
2. Unhandled Array type input in `sanitizePermissions`.

Worker 1 must apply the simple recommended fixes to `src/lib/permissions.ts` (deep cloning defaults and guarding `!Array.isArray(rawMod)`).

---

## 5. Verification Method

To independently verify this verdict and test future fixes:

1. **Run Deep Adversarial Test Suite**:
   ```bash
   npx tsx tests/unit/m1-challenger-deep-stress.test.ts
   ```
   *Pass Condition*: 0 failures across all 5 test categories.

2. **Run Standard Permissions Test Suite**:
   ```bash
   npx tsx tests/unit/m1-permissions-stress.test.ts
   ```

3. **Verify Build**:
   ```bash
   npm run build
   ```
