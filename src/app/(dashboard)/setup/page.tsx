/* eslint-disable @next/next/no-img-element */
"use client"

import * as React from "react"
import { useLanguage } from "@/providers/language-provider"
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Search,
  Loader2,
  Image as ImageIcon,
  PlusCircle,
  FolderPlus,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { TablePagination } from "@/components/ui/table-pagination"

interface Variant {
  id?: string;
  name: string;
  barcode?: string;
  lowStockThreshold?: number;
  highStockThreshold?: number;
  costPrice?: number;
  price?: number;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string;
  category: Category;
  variants: Variant[];
}

export default function ProductsPage() {
  const { t } = useLanguage()

  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [products, setProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])

  // Search/Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("ALL")

  // Pagination
  const [prodPage, setProdPage] = React.useState(1)
  const [prodPageSize, setProdPageSize] = React.useState(12)

  // Product Form Dialog State
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  
  // Product Form Fields
  const [prodName, setProdName] = React.useState("")
  const [prodCategoryId, setProdCategoryId] = React.useState("")
  const [prodImageUrl, setProdImageUrl] = React.useState("")
  const [prodCostPrice, setProdCostPrice] = React.useState(0)
  const [prodSellingPrice, setProdSellingPrice] = React.useState(0)
  const [prodVariants, setProdVariants] = React.useState<Variant[]>([])

  // Category Dialog State
  const [isCatOpen, setIsCatOpen] = React.useState(false)
  const [confirmAction, setConfirmAction] = React.useState<"product" | "create-category" | "update-category" | null>(null)
  const [pendingCategoryUpdate, setPendingCategoryUpdate] = React.useState<{ id: string; name: string } | null>(null)
  const [newCatName, setNewCatName] = React.useState("")
  const [editingCatId, setEditingCatId] = React.useState<string | null>(null)
  const [editingCatName, setEditingCatName] = React.useState("")

  const [error, setError] = React.useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null)

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    setPreviewImageUrl(objectUrl)
    setProdImageUrl(objectUrl)
    e.target.value = ""
  }

  const handleRemovePhoto = () => {
    setSelectedImageFile(null)
    setPreviewImageUrl(null)
    setProdImageUrl("")
  }

  React.useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const prodRes = await fetch("/api/products")
      const prodData = await prodRes.json()
      if (prodRes.ok) {
        setProducts(prodData.products)
      }

      const catRes = await fetch("/api/categories")
      const catData = await catRes.json()
      if (catRes.ok) {
        setCategories(catData.categories)
      }

    } catch (err) {
      console.error("Fetch products page data failed:", err)
    } finally {
      setLoading(false)
    }
  }

  // Open Form Dialog (Create / Edit)
  const openForm = (prod: Product | null = null) => {
    setError(null)
    setSelectedImageFile(null)
    setPreviewImageUrl(null)
    setEditingProduct(prod)
    if (prod) {
      setProdName(prod.name)
      setProdCategoryId(prod.categoryId)
      setProdImageUrl(prod.imageUrl || "")
      setProdCostPrice(
        prod.costPrice && prod.costPrice > 0
          ? prod.costPrice
          : prod.variants.find((variant) => (variant.costPrice ?? 0) > 0)?.costPrice ?? 0
      )
      setProdSellingPrice(prod.price || prod.variants.find((variant) => (variant.price ?? 0) > 0)?.price || 0)
      setProdVariants(prod.variants.map((variant) => ({
        ...variant,
        costPrice: variant.costPrice ?? prod.costPrice ?? 0,
        price: variant.price ?? prod.price ?? 0,
        lowStockThreshold: variant.lowStockThreshold ?? 10,
        highStockThreshold: variant.highStockThreshold ?? 100,
      })))
    } else {
      setProdName("")
      setProdCategoryId(categories.length > 0 ? categories[0].id : "")
      setProdImageUrl("")
      setProdCostPrice(0)
      setProdSellingPrice(0)
      setProdVariants([{ name: "Standard", barcode: "", costPrice: 0, price: 0, lowStockThreshold: 10, highStockThreshold: 100 }])
    }
    setIsFormOpen(true)
  }

  // Handle Product Save (POST / PUT)
  const handleProductSubmit = async (e: React.FormEvent | null, confirmed = false) => {
    e?.preventDefault()
    if (!prodName.trim() || !prodCategoryId) {
      setError(t("Please fill out name and category", "အမည်နှင့် အမျိုးအစား ဖြည့်စွက်ပါ။"))
      return
    }

    const namedVariants = prodVariants.filter((v) => v.name.trim() !== "")
    if (namedVariants.length === 0) {
      setError(t("Please add at least one variant.", "အနည်းဆုံး အမျိုးအစားတစ်ခု ထည့်ပါ။"))
      return
    }

    if (namedVariants.some((v) => !v.barcode || v.barcode.trim() === "")) {
      setError(t("Please enter a barcode for every variant.", "အမျိုးအစားတိုင်းအတွက် ဘားကုဒ် ဖြည့်ပါ။"))
      return
    }

    const barcodes = namedVariants.map((v) => v.barcode!.trim())
    if (new Set(barcodes).size !== barcodes.length) {
      setError(t("Each variant must have a unique barcode.", "အမျိုးအစားတိုင်း၏ ဘားကုဒ် မတူရပါ။"))
      return
    }

    if (namedVariants.some((v) => (v.costPrice ?? 0) < 0 || (v.price ?? 0) < 0)) {
      setError(t("Cost price and selling price cannot be negative.", "မူရင်းဈေးနှင့် ရောင်းဈေးသည် အနုတ်မဖြစ်ရပါ။"))
      return
    }

    if (namedVariants.some((v) => (v.lowStockThreshold ?? 0) < 0)) {
      setError(t("Low stock thresholds cannot be negative.", "လက်ကျန်သတိပေး တန်ဖိုးသည် အနုတ်မဖြစ်ရပါ။"))
      return
    }

    if (namedVariants.some((v) => (v.highStockThreshold ?? 0) < 0)) {
      setError(t("Maximum stock thresholds cannot be negative.", "အများဆုံး သတိပေးလက်ကျန်သည် အနုတ်မဖြစ်ရပါ။"))
      return
    }

    if (namedVariants.some((v) => (v.highStockThreshold ?? 0) > 0 && (v.highStockThreshold ?? 0) < (v.lowStockThreshold ?? 0))) {
      setError(t("Maximum stock threshold must be greater than or equal to minimum stock threshold.", "အများဆုံး သတိပေးလက်ကျန်သည် အနည်းဆုံးထက် ကြီးရပါမည်။"))
      return
    }

    if (editingProduct && (prodCostPrice < 0 || prodSellingPrice < 0)) {
      setError(t("Cost price and selling price cannot be negative.", "မူရင်းဈေးနှင့် ရောင်းဈေးသည် အနုတ်မဖြစ်ရပါ။"))
      return
    }

    if (!confirmed) {
      setConfirmAction("product")
      return
    }

    setActionLoading(true)
    setError(null)

    let finalImageUrl = prodImageUrl || null

    // Save image to local computer folder ONLY when confirming product save!
    if (selectedImageFile) {
      try {
        setUploadingImage(true)
        const formData = new FormData()
        formData.append("file", selectedImageFile)

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload product photo")
        }
        finalImageUrl = uploadData.url
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload image")
        setActionLoading(false)
        setUploadingImage(false)
        return
      } finally {
        setUploadingImage(false)
      }
    }

    const payload = {
      id: editingProduct?.id,
      name: prodName,
      categoryId: prodCategoryId,
      imageUrl: finalImageUrl,
      ...(editingProduct ? { costPrice: prodCostPrice, price: prodSellingPrice } : {}),
      isActive: editingProduct ? editingProduct.isActive : true,
      variants: namedVariants.map((v) => ({ ...v, barcode: v.barcode!.trim() })),
    }

    try {
      const method = editingProduct ? "PUT" : "POST"
      const response = await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Save product failed")
      }

      setIsFormOpen(false)
      setSelectedImageFile(null)
      setPreviewImageUrl(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setActionLoading(false)
    }
  }

  const [deleteProductTarget, setDeleteProductTarget] = React.useState<string | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = React.useState<string | null>(null)

  // Soft Delete Product
  const executeDeleteProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/products?id=${id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        fetchData()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to delete product")
      }
    } catch (err) {
      console.error("Delete product failed:", err)
      setError("Failed to delete product")
    } finally {
      setDeleteProductTarget(null)
    }
  }

  // Dynamic row modifiers for variants & add-ons
  const addVariantRow = () => {
    const lastVariant = prodVariants[prodVariants.length - 1]
    setProdVariants([
      ...prodVariants,
      {
        name: "",
        barcode: "",
        costPrice: lastVariant?.costPrice ?? 0,
        price: lastVariant?.price ?? 0,
        lowStockThreshold: 10,
        highStockThreshold: 100,
      },
    ])
  }

  const removeVariantRow = (index: number) => {
    if (prodVariants.length <= 1) {
      setError(t("A product must have at least one variant.", "အနည်းဆုံး အမျိုးအစားတစ်ခု ရှိရပါမည်။"))
      return;
    }
    const next = [...prodVariants]
    next.splice(index, 1)
    setProdVariants(next)
  }

  const updateVariantRow = (index: number, key: keyof Variant, value: string | number) => {
    const next = [...prodVariants]
    next[index] = { ...next[index], [key]: value }
    setProdVariants(next)
  }

  // Categories CRUD Handlers
  const handleCreateCategory = async (e: React.FormEvent | null, confirmed = false) => {
    e?.preventDefault()
    if (!newCatName.trim()) {
      setError(t("Please enter a category name.", "အမျိုးအစားအမည် ဖြည့်ပါ။"))
      return
    }
    if (!confirmed) {
      setConfirmAction("create-category")
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create category")
      }

      setNewCatName("")
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category")
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateCategory = async (id: string, name: string, confirmed = false) => {
    if (!name.trim()) {
      setError(t("Please enter a category name.", "အမျိုးအစားအမည် ဖြည့်ပါ။"))
      return
    }
    if (!confirmed) {
      setPendingCategoryUpdate({ id, name: name.trim() })
      setConfirmAction("update-category")
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update category")
      }

      setEditingCatId(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category")
    } finally {
      setActionLoading(false)
    }
  }

  const executeDeleteCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchData()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to delete category")
      }
    } catch (err) {
      console.error("Delete category failed:", err)
      setError("Failed to delete category")
    } finally {
      setDeleteCategoryTarget(null)
    }
  }

  // Filter products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.variants.some(v => v.barcode && v.barcode.includes(searchQuery)))
    
    const matchesCategory =
      selectedCategoryId === "ALL" || p.categoryId === selectedCategoryId

    return matchesSearch && matchesCategory
  })

  const pagedProducts = filteredProducts.slice((prodPage - 1) * prodPageSize, prodPage * prodPageSize)

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Product Catalogue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure product catalog categories, sizes/variants, add-on toppings, and prices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 text-xs font-bold gap-1 shadow-sm"
            disabled={loading || actionLoading}
            onClick={() => setIsCatOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
            <span>{t("Manage Categories", "အမျိုးအစားများ")}</span>
          </Button>

          <Button
            className="h-10 text-xs font-bold gap-1 shadow-sm"
            disabled={loading || actionLoading}
            onClick={() => openForm(null)}
          >
            <Plus className="h-4 w-4" />
            <span>{t("Add Product", "ပစ္စည်းအသစ်ထည့်မည်")}</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("Search products by name or barcode...", "ပစ္စည်းရှာဖွေရန်...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-border bg-muted/10 text-sm focus-visible:ring-1"
          />
        </div>

        {/* Category Filter selector */}
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:outline-none cursor-pointer w-full sm:w-48"
        >
          <option value="ALL">{t("All Categories", "အားလုံး")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product List Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span className="font-semibold">{t("Loading product catalog details...", "ပစ္စည်းများ ဆွဲနေသည်...")}</span>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {filteredProducts.length === 0 ? (
            <div className="col-span-2 bg-card border border-border rounded-xl p-12 text-center text-muted-foreground italic">
              {t("No products found in catalogue", "ပစ္စည်းမတွေ့ပါ။")}
            </div>
          ) : (
            pagedProducts.map((p) => (
              <Card key={p.id} className={`shadow-sm overflow-hidden border border-border flex ${!p.isActive ? "opacity-60 bg-muted/5" : ""}`}>
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-28 object-cover border-r border-border bg-muted shrink-0"
                  />
                ) : (
                  <div className="w-28 bg-muted flex items-center justify-center border-r border-border shrink-0">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}

                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 border-border mb-1 font-semibold uppercase">
                          {p.category.name}
                        </Badge>
                        <h3 className="font-bold text-base text-foreground leading-snug">{p.name}</h3>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-muted"
                          onClick={() => openForm(p)}
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteProductTarget(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>

                  </div>

                  {/* Variants list display */}
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5 flex justify-between items-center">
                      <span>{t("Variants", "အမျိုးအစားများ")}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.variants.map((v, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] py-0.5 px-2 font-bold">
                          {v.name} · {(v.price ?? p.price ?? 0).toLocaleString()} Ks
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
      {!loading && filteredProducts.length > prodPageSize && (
        <TablePagination
          total={filteredProducts.length}
          page={prodPage}
          pageSize={prodPageSize}
          onPageChange={setProdPage}
          onPageSizeChange={(s) => { setProdPageSize(s); setProdPage(1); }}
          pageSizeOptions={[12, 24, 48]}
          className="rounded-xl border border-border"
        />
      )}

      {/* Product Form Modal (Create / Edit) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl bg-card border-border flex flex-col h-[90vh] md:h-auto overflow-hidden p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">
              {editingProduct ? t("Edit Product", "ပစ္စည်းပြင်ဆင်ရန်") : t("Add New Product", "ပစ္စည်းအသစ်ထည့်ရန်")}
            </DialogTitle>
            <DialogDescription>
              Configure product details, images, sizes, and topping options
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20 my-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 pt-2 max-h-[60vh]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">{t("Product Name", "အမည်")}</label>
                <Input
                  type="text"
                  placeholder="e.g. Americano"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                  className="h-10 bg-muted/10 border-border font-semibold text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">{t("Category", "အမျိုးအစား")}</label>
                <select
                  value={prodCategoryId}
                  onChange={(e) => setProdCategoryId(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm font-semibold focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {editingProduct && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">{t("Cost Price", "မူရင်းဈေး")}</label>
                  <Input
                    type="number"
                    min={0}
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(Number(e.target.value) || 0)}
                    className="h-10 bg-muted/10 border-border font-semibold text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">{t("Selling Price", "ရောင်းဈေး")}</label>
                  <Input
                    type="number"
                    min={0}
                    value={prodSellingPrice}
                    onChange={(e) => setProdSellingPrice(Number(e.target.value) || 0)}
                    className="h-10 bg-muted/10 border-border font-semibold text-sm text-primary"
                  />
                </div>
              </div>
            )}



            {/* Product Image Section: Local Upload & Web Link */}
            <div className="space-y-2.5 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground uppercase flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  {t("Product Photo", "ပစ္စည်းဓာတ်ပုံ")}
                </label>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {t("Stores on local computer", "မိမိကွန်ပျူတာထဲတွင် သိမ်းမည်")}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Preview Thumbnail */}
                <div className="relative w-20 h-20 rounded-lg border border-border bg-card overflow-hidden shrink-0 flex items-center justify-center group shadow-inner">
                  {prodImageUrl ? (
                    <>
                      <img
                        src={prodImageUrl}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-90 hover:opacity-100 transition-opacity shadow-sm"
                        title={t("Remove photo", "ဓာတ်ပုံ ဖြုတ်မည်")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground opacity-50" />
                      <span className="text-[10px] text-muted-foreground block mt-1 font-medium">No Image</span>
                    </div>
                  )}
                </div>

                {/* Upload Controls & Link Input */}
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-colors shadow-sm">
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{t("Saving...", "သိမ်းဆည်းနေသည်...")}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>{t("Choose Photo from Computer", "ကွန်ပျူတာမှ ဓာတ်ပုံရွေးမည်")}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                        className="hidden"
                        onChange={handleImageFileSelect}
                        disabled={uploadingImage}
                      />
                    </label>

                    {prodImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="text-xs text-destructive hover:bg-destructive/10 border-border"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        {t("Remove", "ဖြုတ်မည်")}
                      </Button>
                    )}
                  </div>

                  {/* Optional Image URL Input */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder={t("Or paste image URL (http://...)", "သို့မဟုတ် ပုံ URL လင့်ခ် ထည့်ပါ")}
                      value={prodImageUrl}
                      onChange={(e) => setProdImageUrl(e.target.value)}
                      className="h-8 text-xs bg-card border-border font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Variants Form Section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <label className="text-xs font-bold text-foreground uppercase">
                  {t("Sizes & Barcodes", "ဗေရီရင့်နှင့် ဘားကုဒ်များ")}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-bold gap-1 text-primary hover:bg-primary/5"
                  onClick={addVariantRow}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Variant</span>
                </Button>
              </div>

              <div className="flex gap-2 items-center px-1">
                <label className="flex-1 text-[10px] font-bold text-muted-foreground uppercase">{t("Size / Name", "အမည် / အရွယ်အစား")}</label>
                <label className="w-28 text-[10px] font-bold text-muted-foreground uppercase">{t("Barcode", "ဘားကုဒ်")}</label>
                {/* <label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">{t("Cost (Ks)", "ဝယ်ရင်းဈေး")}</label> */}
                {/* <label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">{t("Sell (Ks)", "ရောင်းဈေး")}</label> */}
                <label className="w-16 text-[10px] font-bold text-muted-foreground uppercase">{t("Min", "အနည်းဆုံး")}</label>
                <label className="w-16 text-[10px] font-bold text-muted-foreground uppercase">{t("Max", "အများဆုံး")}</label>
                <div className="w-8"></div>
              </div>

              {prodVariants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    type="text"
                    placeholder="e.g. Standard, Small"
                    value={v.name}
                    onChange={(e) => updateVariantRow(i, "name", e.target.value)}
                    className="flex-1 h-9 bg-muted/10 border-border text-xs font-semibold"
                  />
                  <Input
                    type="text"
                    placeholder="Barcode"
                    value={v.barcode || ""}
                    onChange={(e) => updateVariantRow(i, "barcode", e.target.value)}
                    className="w-28 h-9 bg-muted/10 border-border text-xs font-semibold"
                  />
                  {/* <Input
                    type="number"
                    min={0}
                    placeholder="Cost"
                    value={v.costPrice ?? 0}
                    onChange={(e) => updateVariantRow(i, "costPrice", Number(e.target.value))}
                    className="w-24 h-9 bg-muted/10 border-border text-xs font-semibold"
                    title={t("Cost Price for this variant", "ဤအမျိုးအစားအတွက် ဝယ်ရင်းဈေး")}
                  /> */}
                  {/* <Input
                    type="number"
                    min={0}
                    placeholder="Sell"
                    value={v.price ?? 0}
                    onChange={(e) => updateVariantRow(i, "price", Number(e.target.value))}
                    className="w-24 h-9 bg-muted/10 border-border text-xs font-bold text-primary"
                    title={t("Selling Price for this variant", "ဤအမျိုးအစားအတွက် ရောင်းဈေး")}
                  /> */}
                  <Input
                    type="number"
                    min={0}
                    value={v.lowStockThreshold ?? 10}
                    onChange={(e) => updateVariantRow(i, "lowStockThreshold", Number(e.target.value))}
                    className="w-16 h-9 bg-muted/10 border-border text-xs font-semibold"
                    title={t("Minimum Stock Alert Threshold", "အနည်းဆုံး သတိပေးလက်ကျန်")}
                  />
                  <Input
                    type="number"
                    min={0}
                    value={v.highStockThreshold ?? 100}
                    onChange={(e) => updateVariantRow(i, "highStockThreshold", Number(e.target.value))}
                    className="w-16 h-9 bg-muted/10 border-border text-xs font-semibold"
                    title={t("Maximum Stock Alert Threshold", "အများဆုံး သတိပေးလက်ကျန်")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={prodVariants.length <= 1}
                    className="h-8 w-8 hover:bg-destructive/10 text-destructive shrink-0"
                    onClick={() => removeVariantRow(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter className="pt-4 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="font-semibold"
              >
                {t("Cancel", "ပယ်ဖျက်မည်")}
              </Button>
              <Button type="submit" disabled={loading || actionLoading} className="font-bold">
                {actionLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                <span>{t("Save Product", "သိမ်းဆည်းမည်")}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction
          setConfirmAction(null)
          if (action === "product") {
            void handleProductSubmit(null, true)
          } else if (action === "create-category") {
            void handleCreateCategory(null, true)
          } else if (action === "update-category" && pendingCategoryUpdate) {
            void handleUpdateCategory(pendingCategoryUpdate.id, pendingCategoryUpdate.name, true)
            setPendingCategoryUpdate(null)
          }
        }}
        title={
          confirmAction === "product"
            ? t("Confirm Product Save", "ပစ္စည်း သိမ်းဆည်းမှု အတည်ပြုရန်")
            : t("Confirm Category Save", "အမျိုးအစား သိမ်းဆည်းမှု အတည်ပြုရန်")
        }
        description={
          confirmAction === "product"
            ? t(
                `${editingProduct ? "Update" : "Create"} product ${prodName.trim()} with ${prodVariants.filter(v => v.name.trim()).length} variant(s)?`,
                `${prodName.trim()} ပစ္စည်းကို အမျိုးအစား ${prodVariants.filter(v => v.name.trim()).length} မျိုးဖြင့် ${editingProduct ? "ပြင်ဆင်" : "ဖန်တီး"} မည်လား။`
              )
            : confirmAction === "update-category"
              ? t(`Rename category to ${pendingCategoryUpdate?.name || "this name"}?`, `အမျိုးအစားအမည်ကို ${pendingCategoryUpdate?.name || "ဤအမည်"} သို့ ပြောင်းမည်လား။`)
              : t(`Create category ${newCatName.trim()}?`, `${newCatName.trim()} အမျိုးအစားကို ဖန်တီးမည်လား။`)
        }
        confirmText={t("Save", "သိမ်းဆည်းမည်")}
        cancelText={t("Review", "ပြန်စစ်မည်")}
        variant="primary"
        loading={actionLoading}
      />

      {/* Categories CRUD Manage Dialog */}
      <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
        <DialogContent className="max-w-md bg-card border-border p-6 rounded-2xl flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">
              {t("Manage Categories", "အမျိုးအစားများ")}
            </DialogTitle>
            <DialogDescription>
              Create, rename, or delete category divisions
            </DialogDescription>
          </DialogHeader>

          {/* Add Category Form */}
          <form onSubmit={handleCreateCategory} className="flex gap-2 pt-2 border-b border-border pb-4">
            <Input
              type="text"
              placeholder="New category name..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
              className="flex-1 h-10 bg-muted/10 border-border text-sm"
            />
            <Button type="submit" disabled={loading || actionLoading} className="h-10 text-xs font-bold gap-1 shrink-0">
              <Plus className="h-4 w-4" />
              <span>Create</span>
            </Button>
          </form>

          {/* Category List */}
          <div className="flex-1 overflow-y-auto space-y-3 pt-4 min-h-[200px]">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-2 border border-border rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors">
                {editingCatId === c.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      required
                      className="h-8 bg-card border-border text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-[10px] font-bold"
                      onClick={() => handleUpdateCategory(c.id, editingCatName)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[10px] font-bold"
                      onClick={() => setEditingCatId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-sm text-foreground">{c.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-muted"
                        onClick={() => {
                          setEditingCatId(c.id)
                          setEditingCatName(c.name)
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                        onClick={() => setDeleteCategoryTarget(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteProductTarget !== null}
        onClose={() => setDeleteProductTarget(null)}
        onConfirm={() => deleteProductTarget && executeDeleteProduct(deleteProductTarget)}
        title={t("Delete Product", "ပစ္စည်း ဖျက်သိမ်းရန်")}
        description={t(
          "Are you sure you want to delete this product? It will be deactivated in the system.",
          "ဤပစ္စည်းအား စနစ်မှ ဖျက်သိမ်းရန် သေချာပါသလား။"
        )}
        confirmText={t("Delete Product", "ဖျက်သိမ်းမည်")}
        variant="danger"
      />

      {/* Category Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteCategoryTarget !== null}
        onClose={() => setDeleteCategoryTarget(null)}
        onConfirm={() => deleteCategoryTarget && executeDeleteCategory(deleteCategoryTarget)}
        title={t("Delete Category", "အမျိုးအစား ဖျက်သိမ်းရန်")}
        description={t(
          "Are you sure you want to delete this category?",
          "ဤအမျိုးအစားအား စနစ်မှ ဖျက်သိမ်းရန် သေချာပါသလား။"
        )}
        confirmText={t("Delete Category", "ဖျက်သိမ်းမည်")}
        variant="danger"
      />
    </div>
  )
}
