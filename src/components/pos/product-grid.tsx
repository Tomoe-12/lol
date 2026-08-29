"use client"

import * as React from "react"
import { ProductCard } from "./product-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store/useCartStore"
import { useLanguage } from "@/providers/language-provider"
import { Search, Barcode, Grid3X3 } from "lucide-react"
import type { Category, Product, Variant } from "@/types/pos"

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  onProductClick: (product: Product) => void;
}

export function ProductGrid({ products, categories, onProductClick }: ProductGridProps) {
  const { t } = useLanguage()
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [barcodeQuery, setBarcodeQuery] = React.useState<string>("")

  const addItem = useCartStore((state) => state.addItem)
  const activeBranchId = useCartStore((state) => state.activeBranchId)
  const cartItems = useCartStore((state) => state.items)

  // Filter products by category and search query
  const filteredProducts = React.useMemo(() => {
    return products.filter((product) => {
      const cartQuantity = cartItems
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      const branchStock = product.variants.reduce((sum, variant) => {
        if (activeBranchId) return sum + (variant.stockLevels?.find((stock) => stock.branchId === activeBranchId)?.quantity || 0)
        return sum + (variant.stockLevels || []).reduce((variantSum, stock) => variantSum + (stock.quantity || 0), 0)
      }, 0)
      if (Math.max(0, branchStock - cartQuantity) <= 0) return false
      const matchesCategory =
        selectedCategoryId === "all" || product.categoryId === selectedCategoryId
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.variants.some(v => v.barcode && v.barcode.includes(searchQuery)))
      return matchesCategory && matchesSearch
    })
  }, [activeBranchId, cartItems, products, selectedCategoryId, searchQuery])

  // Handle barcode search submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery.trim()) return

    const matchedProduct = products.find(
      (p) => p.variants.some(v => v.barcode === barcodeQuery.trim())
    )

    if (matchedProduct) {
      const matchedVariant = matchedProduct.variants.find(v => v.barcode === barcodeQuery.trim()) || null
      // If product has variants, open customization dialog
      if (matchedProduct.variants.length > 1) {
        onProductClick(matchedProduct)
      } else {
        // Otherwise, add directly to cart (using the only variant)
        const branchStock = matchedVariant?.stockLevels?.find((s) => s.branchId === useCartStore.getState().activeBranchId)
        const stockQuantity = branchStock ? branchStock.quantity : 0

        if (stockQuantity > 0) {
          addItem({
            product: {
              id: matchedProduct.id,
              name: matchedProduct.name,
              imageUrl: matchedProduct.imageUrl,
              categoryId: matchedProduct.categoryId,
              price: matchedProduct.price,
            },
            selectedVariant: matchedVariant,
            quantity: 1,
            discount: 0,
            discountType: "fixed",
          })
        }
      }
    }

    setBarcodeQuery("")
  }

  // Keyboard barcode listener (simulates hardware scanner)
  React.useEffect(() => {
    let buffer = ""
    let lastKeyTime = Date.now()

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now()
      
      // Barcode scanners typically type very fast (interval < 30ms between keypresses)
      if (currentTime - lastKeyTime > 50) {
        buffer = "" // reset buffer if typing is slow (manual keyboard input)
      }

      lastKeyTime = currentTime

      if (e.key === "Enter") {
        if (buffer.length >= 8) { // barcodes are usually 8, 12, or 13 digits
          const matchedProduct = products.find((p) => p.variants.some(v => v.barcode === buffer))
          if (matchedProduct) {
            const matchedVariant = matchedProduct.variants.find(v => v.barcode === buffer) || null
            if (matchedProduct.variants.length > 1) {
              onProductClick(matchedProduct)
            } else {
              const branchStock = matchedVariant?.stockLevels?.find((s) => s.branchId === useCartStore.getState().activeBranchId)
              const stockQuantity = branchStock ? branchStock.quantity : 0
              
              if (stockQuantity > 0) {
                addItem({
                  product: {
                    id: matchedProduct.id,
                    name: matchedProduct.name,
                    imageUrl: matchedProduct.imageUrl,
                    categoryId: matchedProduct.categoryId,
                    price: matchedProduct.price,
                  },
                  selectedVariant: matchedVariant,
                  quantity: 1,
                  discount: 0,
                  discountType: "fixed",
                })
              }
            }
          }
          buffer = ""
          e.preventDefault()
        }
      } else if (e.key !== "Shift") {
        buffer += e.key
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [products, addItem, onProductClick])

  return (
    <div className="flex flex-col h-full space-y-4 select-none">
      {/* Search control */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("Search products by name...", "ပစ္စည်းရှာရန်...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 text-sm bg-card border-border text-foreground rounded-lg w-full"
        />
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        <Button
          variant={selectedCategoryId === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategoryId("all")}
          className="text-xs font-semibold shrink-0 rounded-lg flex items-center gap-1.5"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          <span>{t("All", "အားလုံး")}</span>
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategoryId === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategoryId(cat.id)}
            className="text-xs font-semibold shrink-0 rounded-lg"
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            {t("No products found", "ရှာဖွေမှုမတွေ့ရှိပါ။")}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => onProductClick(product)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
