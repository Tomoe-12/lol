"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store/useCartStore"
import { useLanguage } from "@/providers/language-provider"
import { Check } from "lucide-react"
import type { Product, Variant } from "@/types/pos"

interface AddonVariantSelectorProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AddonVariantSelector({
  product,
  isOpen,
  onClose,
}: AddonVariantSelectorProps) {
  const { t } = useLanguage()
  const addItem = useCartStore((state) => state.addItem)
  const activeBranchId = useCartStore((state) => state.activeBranchId)

  const [selectedVariant, setSelectedVariant] = React.useState<Variant | null>(null)
  const [quantity, setQuantity] = React.useState(1)

  // Reset local state when product changes
  React.useEffect(() => {
    if (product) {
      setSelectedVariant(product.variants[0] || null)
      setQuantity(1)
    }
  }, [product])

  if (!product) return null

  const handleAddToCart = () => {
    if (!selectedVariant && product.variants.length > 0) return
    if (selectedVariant) {
      const availableStock = selectedVariant.stockLevels?.find((stock) => stock.branchId === activeBranchId)?.quantity || 0
      if (availableStock < quantity) return
    }

    addItem({
      product: {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        categoryId: product.categoryId,
        price: product.price,
      },
      selectedVariant,
      quantity,
      discount: 0,
      discountType: "fixed",
    })
    onClose()
  }

  const basePrice = product.price || 0
  const totalPriceMMK = basePrice * quantity

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between text-foreground">
            <span>{t("Customize Item", "အော်ဒါပြင်ဆင်ရန်")}</span>
          </DialogTitle>
          <div className="text-sm text-muted-foreground font-semibold mt-1 flex justify-between">
            <span>{product.name}</span>
            <span className="text-primary font-bold">{basePrice.toLocaleString()} Ks</span>
          </div>
        </DialogHeader>

        <div className="space-y-6 my-4">
          {/* Variants section (Sizes) */}
          {product.variants.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("Select Option", "အရွယ်အစား ရွေးချယ်ရန်")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id
                  const variantPrice = product.price || 0
                  const availableStock = v.stockLevels?.find((stock) => stock.branchId === activeBranchId)?.quantity || 0
                  const isOutOfStock = availableStock <= 0
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => setSelectedVariant(v)}
                      className={`relative p-3 rounded-lg border-2 text-left transition-all duration-200 focus:outline-none flex flex-col justify-between h-20 disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-muted-foreground/35 bg-muted/40 text-card-foreground"
                      }`}
                    >
                      <span className="font-bold text-sm leading-tight truncate">{v.name}</span>
                      <span className={`text-xs font-extrabold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                        {variantPrice.toLocaleString()} Ks
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {isOutOfStock ? t("Out of stock", "စတော့မရှိ") : `${availableStock} ${t("available", "ရှိ")}`}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quantity selector */}
          <div className="flex items-center justify-between border-t border-b border-border py-4">
            <span className="text-sm font-semibold text-card-foreground">
              {t("Quantity", "အရေအတွက်")}
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-foreground"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                -
              </Button>
              <span className="font-bold text-base text-foreground w-6 text-center">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-foreground"
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-4 mt-6">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase font-semibold">
              {t("Total", "စုစုပေါင်း")}
            </span>
            <span className="text-lg font-extrabold text-foreground">
              {totalPriceMMK.toLocaleString()} Ks
            </span>
          </div>
          <Button onClick={handleAddToCart} size="lg" className="px-8 font-semibold">
            {t("Add to Cart", "ခြင်းထဲထည့်ရန်")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
