# Technical Investigation Report: Requirement R2 — Sales Voucher Product Card Details

**Investigated by**: `explorer_m6_2`  
**Date**: 2026-08-12  
**Target Requirement**: Enrich Sales Voucher / POS product cards to display essential product details directly on the card (current stock level, price, and relevant variants), matching product catalog presentation, and ensuring dynamic updates on price/stock changes.

---

## 1. Where Sales Voucher View & POS Product Cards Are Rendered

| Component / Layer | Exact File Path | Line Range | Purpose & Responsibilities |
|---|---|---|---|
| **POS Page (Server Component)** | `src/app/(dashboard)/pos/page.tsx` | Lines 35–53 | Fetches `initialProducts` via `prisma.product.findMany` with `isActive: true`, including `variants.stockLevels` (with `branchId` and `quantity`). Passes data to `<POSContainer>`. |
| **POS Container** | `src/components/pos/pos-container.tsx` | Lines 215–242 | Client shell managing POS state (`activeBranchId`, active staff, modals). Renders `<CartPanel>` on left and `<ProductGrid>` on right. Handles 1-click add for single-variant products vs opening `<AddonVariantSelector>` for multi-variant products. |
| **Product Grid** | `src/components/pos/product-grid.tsx` | Lines 25–35, 191–200 | Filters products by category and search/barcode query. Renders product cards inside responsive grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3`). |
| **Product Card** | `src/components/pos/product-card.tsx` | Lines 31–114 | Client component rendering individual product card. Currently displays image thumbnail, stock badge (`OOS` / `N In Stock`), product name, and price footer (`From / စ၍ X Ks`). |
| **Addon/Variant Selector** | `src/components/pos/addon-variant-selector.tsx` | Lines 75–104 | Modal dialog opened when a multi-variant product is clicked to select specific size/variant. |
| **Cart Store (Zustand)** | `src/lib/store/useCartStore.ts` | Lines 1–178 | Manages active cart items, active branch (`activeBranchId`), exchange rate, held carts. |
| **Checkout Dialog** | `src/components/pos/payment-dialog.tsx` | Lines 200–222 | Processes checkout via `POST /api/pos/checkout` and calls `clearCart()`. |

---

## 2. Where Product Catalog Components Render Product Details

| Component / View | Exact File Path | Line Range | Presentation & Layout Details |
|---|---|---|---|
| **Inventory Stock Table** | `src/app/(dashboard)/inventory/page.tsx` | Lines 512–662 | Catalog table displaying Product Image thumbnail, Product Name, Variant Badge (`<Badge variant="secondary">{s.variant.name}</Badge>`), Barcode, Category Name (`s.variant.product.category.name`), Cost Price, Selling Price (`s.variant.product.price`), Stock Qty, Asset Value, and Low Stock Status Badge. |
| **Product Catalogue Grid** | `src/app/(dashboard)/setup/page.tsx` | Lines 437–509 | Catalog cards rendering Image thumbnail, Category badge, Product Name, Barcodes list, and explicit **"Sizes & Variants:"** section displaying all variant tags (`<Badge variant="secondary">{v.name}</Badge>`). |

---

## 3. Data Currently Available in POS Fetch vs Extra Fields Needed

### Currently Available in API / Server Query (`src/app/(dashboard)/pos/page.tsx`, lines 35–53)
- Product: `id`, `name`, `price`, `imageUrl`, `categoryId`, `isActive`
- Product Variants: `id`, `name`, `barcode`, `lowStockThreshold`, `costPrice`, `stockLevels` (array of `{ branchId, quantity }`)

### Identified Gaps & Deficiencies on POS Product Card (`product-card.tsx`)

1. **Missing Relevant Variants Display**:
   - `product.variants` is already available in the product object passed into `ProductCard`, but `ProductCard` completely ignores variant names (`v.name`) and does NOT render variant badges or variant tags on the card.
   - Catalog presentation in `/setup/page.tsx` (lines 493–504) explicitly displays variant badges (e.g. `Standard`, `Small`, `Medium`, `Large`).

2. **Branch Stock Calculation Fallback Bug**:
   - In `product-card.tsx` (lines 47–53), if `activeBranchId` has no explicit `StockLevel` record for a variant, the calculation falls back to summing stock across **all branches**:
     ```ts
     if (!foundBranchRecord && product.variants?.length > 0) {
       product.variants.forEach(v => {
         if (v.stockLevels) {
           total += v.stockLevels.reduce((sum, s) => sum + s.quantity, 0)
         }
       })
     }
     ```
   - **Impact**: Falsely shows stock from other branches when stock in the currently selected branch is 0.

3. **Lack of Cart Awareness for Dynamic Available Stock**:
   - `stockQuantity` on `ProductCard` reads static stock levels from props. When a user adds 2 items to the cart, the card still shows the un-deducted stock count until after checkout.
   - Real-time cart state (`useCartStore((state) => state.items)`) must be factored into available stock calculation (`availableStock = branchStock - cartQtyForProduct`).

4. **Zero-Price Product Exclusion**:
   - `src/app/(dashboard)/pos/page.tsx` line 38 filters products with `price: { gt: 0 }`. If a product or variant has price set to 0 initially or relies on variant prices, it is excluded from POS query.

---

## 4. State & Reactivity Analysis for Dynamic Updates

1. **Branch Switching Reactivity**:
   - `useCartStore` stores `activeBranchId`. `ProductCard` already subscribes to `useCartStore((state) => state.activeBranchId)`.
   - When the user selects a new branch in `<POSContainer>`, `ProductCard` automatically re-computes stock for that branch. (Fixing the cross-branch fallback bug ensures accurate 0-stock reporting per branch).

2. **Cart Reactivity (Real-Time Added Items)**:
   - By subscribing `ProductCard` to `useCartStore((state) => state.items)`, any addition, removal, or quantity adjustment in the cart immediately updates the available stock count on the product card badge in real time.

3. **Checkout & Stock Adjustment Reactivity**:
   - `initialProducts` in `<POSContainer>` is static props from Next.js server page.
   - When checkout completes in `payment-dialog.tsx`, database stock is updated via `POST /api/pos/checkout`, but client state in `pos-container.tsx` does not refetch.
   - Remediation: Add `refreshProducts` handler in `POSContainer` (fetching `/api/products`) and call it in `handleCheckoutSuccess`.

---

## 5. Step-by-Step Remediation Plan for R2

### Step 1: Enrich `src/components/pos/product-card.tsx`
- Import `Badge` and subscribe to `useCartStore((state) => state.items)`.
- Calculate `cartQuantity` for the product across all items currently in cart.
- Fix branch stock calculation by removing cross-branch fallback (if no record for `activeBranchId`, branch stock is `0`).
- Compute `availableStock = Math.max(0, branchStockQuantity - cartQuantity)`.
- Render **Variant Badges** directly on the product card matching `/setup` catalog style:
  ```tsx
  {/* Relevant Variants list */}
  {product.variants && product.variants.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1">
      {product.variants.slice(0, 3).map((v) => (
        <Badge key={v.id} variant="secondary" className="text-[9px] px-1 py-0 font-medium">
          {v.name}
        </Badge>
      ))}
      {product.variants.length > 3 && (
        <span className="text-[9px] text-muted-foreground font-semibold">
          +{product.variants.length - 3} more
        </span>
      )}
    </div>
  )}
  ```
- Ensure card height and padding (`p-3`, flex column layout) cleanly display image, stock badge, name, variants badges, and price.

### Step 2: Implement Refetch / Sync in `src/components/pos/pos-container.tsx`
- Maintain `products` state initialized with `initialProducts`.
- Define `refreshProducts = async () => { const res = await fetch('/api/products'); const data = await res.json(); setProducts(data.products); }`.
- Pass `products` state to `<ProductGrid products={products} ... />`.
- Invoke `refreshProducts()` inside `handleCheckoutSuccess` after transaction completion.

### Step 3: Remove Overly Restrictive Price Filter in `src/app/(dashboard)/pos/page.tsx`
- In `pos/page.tsx` line 38, update `where: { isActive: true }` (remove `price: { gt: 0 }` restriction) to ensure all active products are present in POS.

### Step 4: Verification Protocol
- Run POS page and verify product cards display variant badges matching catalog presentation.
- Switch branches and verify stock level updates accurately per branch (no leak of stock from unassigned branches).
- Add items to cart and verify card stock badge updates in real time.
- Perform cash checkout and verify stock level decreases dynamically after receipt generation.
