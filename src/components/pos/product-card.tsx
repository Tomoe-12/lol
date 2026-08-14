"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { useCartStore } from "@/lib/store/useCartStore"
import { useLanguage } from "@/providers/language-provider"

interface Variant {
  id: string;
  name: string;
  barcode?: string | null;
  stockLevels?: {
    branchId: string;
    quantity: number;
  }[];
}

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  categoryId: string;
  price: number;
  variants: Variant[];
}

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const { t } = useLanguage()
  const activeBranchId = useCartStore((state) => state.activeBranchId)
  const cartItems = useCartStore((state) => state.items)

  // Find total cart quantity for this product
  const cartQuantity = React.useMemo(() => {
    return cartItems
      .filter((item) => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0)
  }, [cartItems, product.id])

  // Find total stock level for active branch strictly (no cross-branch fallback)
  const branchStockQuantity = React.useMemo(() => {
    let total = 0
    product.variants?.forEach((v) => {
      if (!v.stockLevels || v.stockLevels.length === 0) return
      const bs = activeBranchId ? v.stockLevels.find((s) => s.branchId === activeBranchId) : null
      if (bs) {
        total += bs.quantity
      }
    })
    return total
  }, [product.variants, activeBranchId])

  // Compute available stock factoring real-time active cart items
  const availableStock = Math.max(0, branchStockQuantity - cartQuantity)
  const basePrice = product.price || 0
  const isOutOfStock = availableStock <= 0
  const firstBarcode = product.variants?.find((v) => v.barcode)?.barcode || null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all duration-200 focus:outline-none min-h-[14.5rem] h-auto select-none w-full active:scale-95 ${
        isOutOfStock
          ? "border-amber-500/30 hover:border-primary/50 cursor-pointer opacity-85"
          : "hover:border-primary/50 hover:shadow-md hover:scale-[1.01] cursor-pointer"
      }`}
    >
      {/* Product Image */}
      <div className="relative w-full h-28 bg-muted/40 overflow-hidden shrink-0">
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider">
            {product.name.substring(0, 2)}
          </div>
        )}

        {/* Stock Badge on top right */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
          <Badge
            variant={isOutOfStock ? "destructive" : availableStock < 10 ? "warning" : "success"}
            className="text-[10px] px-2 py-0.5 font-extrabold shadow-sm backdrop-blur-md"
          >
            {isOutOfStock ? t("Out of Stock", "စတော့မရှိ") : `${availableStock} ${t("in stock", "စတော့")}`}
          </Badge>

          {/* Cart Quantity indicator badge if item in cart */}
          {cartQuantity > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-black shadow-md">
              {cartQuantity} {t("in cart", "ခြင်းထဲတွင်")}
            </Badge>
          )}
        </div>
      </div>

      {/* Product details */}
      <div className="p-3 flex flex-col justify-between flex-grow space-y-2">
        <div>
          <span className="font-bold text-xs text-foreground line-clamp-2 leading-tight group-hover:text-primary transition duration-150">
            {product.name}
          </span>
          
          {/* Barcode & Variant Badges */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {firstBarcode && (
              <span className="text-[9px] text-muted-foreground font-mono bg-muted/70 px-1.5 py-0.5 rounded border border-border/50">
                {firstBarcode}
              </span>
            )}
            {product.variants && product.variants.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.variants.slice(0, 2).map((v) => (
                  <Badge key={v.id} variant="secondary" className="text-[9px] px-1 py-0 font-medium border-border/50">
                    {v.name}
                  </Badge>
                ))}
                {product.variants.length > 2 && (
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    +{product.variants.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Price & Stock footer */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between mt-auto">
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
              {t("Price", "ဈေးနှုန်း")}
            </span>
            <span className="font-extrabold text-sm text-foreground">
              {basePrice.toLocaleString()} <span className="text-[11px] font-bold text-muted-foreground">Ks</span>
            </span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
              {t("Stock", "စတော့")}
            </span>
            <span className={`text-xs font-black ${isOutOfStock ? "text-destructive" : availableStock < 10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {availableStock} pcs
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
