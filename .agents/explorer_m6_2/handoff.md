# Handoff Report — Requirement R2: Sales Voucher Product Card Details

**Agent**: `explorer_m6_2`  
**Date**: 2026-08-12  
**Task**: Technical investigation and remediation plan for Requirement R2 — Sales Voucher Product Card Details.

---

## 1. Observation

Direct observations from codebase inspection:

1. **POS Product Cards Rendering**:
   - `src/app/(dashboard)/pos/page.tsx`: Lines 35–53 fetch initial products via `prisma.product.findMany({ where: { isActive: true, price: { gt: 0 } }, include: { variants: { include: { stockLevels: { select: { branchId: true, quantity: true } } } } } })`.
   - `src/components/pos/pos-container.tsx`: Lines 215–242 render `<ProductGrid products={initialProducts} ... />`.
   - `src/components/pos/product-grid.tsx`: Lines 191–200 map over `filteredProducts` and render `<ProductCard key={product.id} product={product} onClick={...} />`.
   - `src/components/pos/product-card.tsx`: Lines 35–55 calculate `stockQuantity` for `activeBranchId`.
     - Lines 47–53: `if (!foundBranchRecord && product.variants?.length > 0)` sums stock across **all branches** as a fallback when no branch stock record exists for the selected branch.
     - Lines 73–97: Renders image thumbnail and stock badge (`{isOutOfStock ? "OOS" : `${stockQuantity} In Stock`}`).
     - Lines 99–111: Renders product name and price (`From / စ၍ ${basePrice.toLocaleString()} Ks`).
     - **Missing**: Variants display is absent on the product card (no variant badges or labels rendered).

2. **Product Catalog Presentation**:
   - `src/app/(dashboard)/inventory/page.tsx`: Lines 575–577 render `<Badge variant="secondary">{s.variant.name}</Badge>` alongside product name, cost price, selling price, and stock levels.
   - `src/app/(dashboard)/setup/page.tsx`: Lines 493–504 render "Sizes & Variants:" header with badges `<Badge key={i} variant="secondary">{v.name}</Badge>`.

3. **Reactivity & State Management**:
   - `src/lib/store/useCartStore.ts`: Manages `items` (cart items), `activeBranchId`, `activeBranchName`.
   - `ProductCard` (`product-card.tsx`) currently does NOT subscribe to `useCartStore`'s `items`, meaning items added to the cart do not reduce the available stock count shown on the card in real time.
   - `POSContainer` (`pos-container.tsx`) receives static `initialProducts` props and does not refetch products after `payment-dialog.tsx` completes checkout.

---

## 2. Logic Chain

1. **Catalog Parity Gap**:
   - Observation: Product catalog views (`/inventory` line 575 and `/setup` line 497) present variant tags (`<Badge>`) on product items. POS product cards (`product-card.tsx`) fetch variant data but omit variant tags.
   - Deduction: To match product catalog presentation (R2 requirement), `product-card.tsx` must render variant badges (e.g. `Standard`, `Small`, `Medium`, `Large`) directly on the product card.

2. **Stock Accuracy & Branch Leak Gap**:
   - Observation: `product-card.tsx` lines 47–53 fall back to total stock across all branches if no branch stock record exists for `activeBranchId`.
   - Deduction: This causes products to display stock numbers from other branches when stock in the current branch is 0. Removing the cross-branch fallback fixes stock accuracy per branch.

3. **Dynamic Reactivity Gap**:
   - Observation: `product-card.tsx` computes stock solely from static props, ignoring active cart state (`useCartStore.getState().items`). `pos-container.tsx` does not refetch products after checkout.
   - Deduction: Subscribing `product-card.tsx` to `cartItems` and subtracting active cart quantity gives instant cart reactivity. Adding a product refetch call in `handleCheckoutSuccess` ensures post-checkout stock levels remain in sync with database changes.

---

## 3. Caveats

- **No Source Code Modifications Made**: As an explorer subagent, all source code was investigated in read-only mode. No changes were applied to files in `src/`.
- **Card Layout Constraints**: Adding variant badges to POS product cards requires adjusting card vertical spacing (`p-3`, min-height or flex-grow) to prevent layout overflow on smaller screen breakpoints.
- **Product Price Variant Variations**: Base price is stored on `Product` (`price`), while cost price is stored on `ProductVariant` (`costPrice`). If future variants introduce distinct retail prices per variant, card pricing should display price range (e.g. "1,000 - 2,500 Ks").

---

## 4. Conclusion

Requirement R2 requires enriching POS product cards with essential product details (stock level per branch, price, and relevant variants) matching catalog presentation, with dynamic reactivity for price/stock updates.

The investigation identified:
1. Product cards are rendered in `src/components/pos/product-card.tsx` via `product-grid.tsx` and `pos-container.tsx`.
2. Catalog presentation in `src/app/(dashboard)/setup/page.tsx` and `inventory/page.tsx` uses variant badges (`<Badge variant="secondary">`).
3. POS product cards currently lack variant badge rendering, use an erroneous cross-branch stock fallback, and lack cart/checkout stock reactivity.
4. A 4-step remediation plan (`analysis.md`) provides exact code modifications for `product-card.tsx`, `pos-container.tsx`, and `pos/page.tsx`.

---

## 5. Verification Method

1. **File Inspection**:
   - View `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_m6_2\analysis.md` for exact line numbers, component breakdown, and remediation steps.
2. **Build Verification**:
   - Run `npm run build` to confirm zero compilation errors across POS components.
3. **UI Verification**:
   - Navigate to `/pos` in browser. Verify product cards display variant badges (`Standard`, `Small`, `Large`, etc.) matching `/setup`.
   - Switch branches and verify stock badge reflects selected branch without cross-branch fallback.
   - Add items to cart and verify available stock count decreases immediately on the card.
   - Complete checkout and verify stock count updates after transaction completion.
