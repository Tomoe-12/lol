/* eslint-disable @next/next/no-img-element */
"use client"

import * as React from "react"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import {
  Package,
  Search,
  Building,
  ArrowLeftRight,
  Plus,
  Minus,
  AlertCircle,
  AlertTriangle,
  History,
  TrendingDown,
  Filter,
  Loader2,
  Pencil,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TablePagination } from "@/components/ui/table-pagination"

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: {
    id: string;
    name: string;
  };
  variants: {
    id: string;
    barcode?: string | null;
  }[];
}

interface StockLevel {
  id: string;
  branchId: string;
  variantId: string;
  variant: {
    id: string;
    name: string;
    barcode: string | null;
    costPrice?: number;
    price?: number;
    lowStockThreshold: number;
    highStockThreshold?: number;
    product: Product;
  };
  quantity: number;
  lowStockThreshold: number;
  highStockThreshold?: number;
}

interface Branch {
  id: string;
  name: string;
  address: string | null;
}

interface InventoryLog {
  id: string;
  branch?: { id: string; name: string } | null;
  variantId: string;
  variant: {
    name: string;
    product: {
      name: string;
    };
  };
  change: number;
  reason: string;
  note: string | null;
  createdAt: string;
  performedBy?: { id: string; name: string; role?: string } | null;
  transaction?: {
    id: string;
    staff?: { id: string; name: string } | null;
    customer?: { id: string; name: string; phone?: string | null } | null;
  } | null;
  salesOrder?: {
    id: string;
    createdByStaff?: { id: string; name: string } | null;
    customer?: { id: string; name: string; phone?: string | null } | null;
  } | null;
  purchaseOrder?: {
    id: string;
    receivedBy?: { id: string; name: string } | null;
    supplier?: { id: string; name: string; contact?: string | null } | null;
  } | null;
}

interface InventoryLogSource {
  id?: string
  orderNumber?: string
  branch?: { name?: string }
  customer?: { name?: string; phones?: string[]; phone?: string | null }
  paymentStatus?: string
  amountPaid?: number
  supplier?: { name?: string; contact?: string | null; email?: string | null }
  staff?: { name?: string }
  createdByStaff?: { name?: string } | null
  receivedBy?: { name?: string } | null
  total?: number
  paymentMethod?: string
  items?: {
    quantity?: number
    fulfilledQuantity?: number
    unitPrice?: number | null
    total?: number | null
    variant?: {
      name?: string
      product?: { name?: string }
    } | null
    product?: { name?: string } | null
  }[]
}

interface InventoryLogDetails {
  sourceType: string;
  source: InventoryLogSource | null;
}

export default function InventoryPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"

  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"stock" | "logs">("stock")
  
  // Data State
  const [branches, setBranches] = React.useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("")
  const [stockLevels, setStockLevels] = React.useState<StockLevel[]>([])
  const [logs, setLogs] = React.useState<InventoryLog[]>([])
  const [selectedLog, setSelectedLog] = React.useState<InventoryLog | null>(null)
  const [selectedLogDetails, setSelectedLogDetails] = React.useState<InventoryLogDetails | null>(null)
  const [logDetailsLoading, setLogDetailsLoading] = React.useState(false)
  const [categories, setCategories] = React.useState<string[]>([])
  
  // Filter States
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState("ALL")
  const [filterLowStock, setFilterLowStock] = React.useState(false)
  const [filterMaxStock, setFilterMaxStock] = React.useState(false)

  // Pagination
  const [invPage, setInvPage] = React.useState(1)
  const [invPageSize, setInvPageSize] = React.useState(25)

  // Adjust / Edit Dialog State
  const [adjustType, setAdjustType] = React.useState<"ADD" | "SUBTRACT">("ADD")
  const [adjustQty, setAdjustQty] = React.useState<string>("")
  const [adjustReason, setAdjustReason] = React.useState<string>("ADJUSTMENT")
  const [adjustNote, setAdjustNote] = React.useState<string>("")

  // Transfer Dialog State
  const [isTransferOpen, setIsTransferOpen] = React.useState(false)
  const [transferStock, setTransferStock] = React.useState<StockLevel | null>(null)
  const [transferDestBranchId, setTransferDestBranchId] = React.useState<string>("")
  const [transferQty, setTransferQty] = React.useState<string>("")
  const [transferNote, setTransferNote] = React.useState<string>("")

  // Edit Product Price Dialog State
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editStock, setEditStock] = React.useState<StockLevel | null>(null)
  const [editCostPrice, setEditCostPrice] = React.useState<string>("")
  const [editSellingPrice, setEditSellingPrice] = React.useState<string>("")

  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    void fetchInventory()
  }, [])

  React.useEffect(() => {
    if (user?.branchId && role !== "OWNER") {
      setSelectedBranchId(user.branchId)
    }
  }, [user?.branchId, role])

  const fetchInventory = async (branchId?: string, options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      let targetBranch = branchId || selectedBranchId
      const url = targetBranch
        ? `/api/inventory?branchId=${targetBranch}`
        : "/api/inventory?withStock=true"

      let response = await fetch(url)
      let data = await response.json()

      if (response.ok) {
        if (data.branches) setBranches(data.branches)
        
        // Always select an actual branch (default to activeBranchId or first branch in list)
        if (!targetBranch) {
          const defaultBranch = data.activeBranchId || (data.branches && data.branches.length > 0 ? data.branches[0].id : "")
          if (defaultBranch) {
            setSelectedBranchId(defaultBranch)
            targetBranch = defaultBranch
            // Fetch for that specific branch so data is isolated to that branch
            const branchRes = await fetch(`/api/inventory?branchId=${defaultBranch}`)
            if (branchRes.ok) {
              const branchData = await branchRes.json()
              data = branchData
            }
          }
        } else if (!selectedBranchId) {
          setSelectedBranchId(targetBranch)
        }

        setStockLevels(data.stockLevels ?? [])
        setLogs(data.logs ?? [])

        const uniqueCats: string[] = Array.from(
          new Set(
            (data.stockLevels ?? []).map((s: StockLevel) => s.variant.product.category.name)
          )
        )
        setCategories(uniqueCats)
      }
    } catch (err) {
      console.error("Failed to fetch inventory data:", err)
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }

  const viewInventoryLog = async (log: InventoryLog) => {
    setSelectedLog(log)
    setSelectedLogDetails(null)
    setLogDetailsLoading(true)
    try {
      const response = await fetch(`/api/inventory/logs/${log.id}`)
      if (response.ok) setSelectedLogDetails(await response.json() as InventoryLogDetails)
    } finally {
      setLogDetailsLoading(false)
    }
  }

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId)
    void fetchInventory(branchId)
  }

  // Filtered stock list
  const filteredStock = stockLevels.filter((s) => {
    const matchesSearch =
      s.variant.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.variant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.variant.barcode && s.variant.barcode.includes(searchQuery))
    
    const matchesCategory =
      selectedCategory === "ALL" || s.variant.product.category.name === selectedCategory
      
    const matchesLowStock = !filterLowStock || s.quantity <= s.lowStockThreshold
    const maxThreshold = s.highStockThreshold ?? s.variant.highStockThreshold ?? 100
    const matchesMaxStock = !filterMaxStock || (maxThreshold > 0 && s.quantity >= maxThreshold)

    return matchesSearch && matchesCategory && matchesLowStock && matchesMaxStock
  })

  const pagedStock = filteredStock.slice((invPage - 1) * invPageSize, invPage * invPageSize)

  // Count items low and high in stock
  const lowStockCount = stockLevels.filter((s) => s.quantity <= s.lowStockThreshold).length
  const maxStockCount = stockLevels.filter((s) => {
    const maxThreshold = s.highStockThreshold ?? s.variant.highStockThreshold ?? 100
    return maxThreshold > 0 && s.quantity >= maxThreshold
  }).length

  // Handlers
  const handleCombinedEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editStock) return
    if (!editCostPrice || isNaN(Number(editCostPrice)) || Number(editCostPrice) < 0) {
      setError(t("Please enter a valid cost price", "မှန်ကန်သော ဝယ်ရင်းဈေး ရိုက်ထည့်ပါ။"))
      return
    }
    if (!editSellingPrice || isNaN(Number(editSellingPrice)) || Number(editSellingPrice) < 0) {
      setError(t("Please enter a valid selling price", "မှန်ကန်သော ရောင်းဈေး ရိုက်ထည့်ပါ။"))
      return
    }

    setActionLoading(true)
    setError(null)
    try {
      // 1. Update Product Cost & Selling Prices
      const priceRes = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editStock.variant.product.id,
          name: editStock.variant.product.name,
          categoryId: editStock.variant.product.category.id,
          variants: [
            {
              id: editStock.variant.id,
              name: editStock.variant.name,
              barcode: editStock.variant.barcode,
              lowStockThreshold: editStock.variant.lowStockThreshold || 10,
              costPrice: Number(editCostPrice),
              price: Number(editSellingPrice),
            }
          ]
        }),
      })

      const priceData = await priceRes.json()
      if (!priceRes.ok) {
        throw new Error(priceData.error || "Failed to update product prices")
      }

      // 2. Optional: Adjust Stock Quantity if adjustQty > 0
      if (adjustQty && !isNaN(Number(adjustQty)) && Number(adjustQty) > 0) {
        const changeAmount = adjustType === "ADD" ? Number(adjustQty) : -Number(adjustQty)
        const adjustRes = await fetch("/api/inventory/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: selectedBranchId,
            variantId: editStock.variantId,
            changeAmount,
            reason: adjustReason,
            note: adjustNote,
          }),
        })

        const adjustData = await adjustRes.json()
        if (!adjustRes.ok) {
          throw new Error(adjustData.error || "Adjustment failed")
        }
      }

      setIsEditOpen(false)
      setEditStock(null)
      setAdjustQty("")
      setAdjustNote("")
      await fetchInventory(selectedBranchId, { silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product")
    } finally {
      setActionLoading(false)
    }
  }

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferStock || !transferQty || isNaN(Number(transferQty)) || Number(transferQty) <= 0) {
      setError(t("Please enter a valid quantity", "မှန်ကန်သော အရေအတွက် ရိုက်ထည့်ပါ။"))
      return
    }

    if (!transferDestBranchId) {
      setError(t("Please select a destination branch", "ဆိုင်ခွဲ ရွေးချယ်ပါ။"))
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBranchId: selectedBranchId,
          toBranchId: transferDestBranchId,
          variantId: transferStock.variantId,
          quantity: Number(transferQty),
          note: transferNote,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Transfer failed")
      }

      setIsTransferOpen(false)
      // Reset form
      setTransferQty("")
      setTransferNote("")
      setTransferDestBranchId("")
      // Refetch
      await fetchInventory(selectedBranchId, { silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer stock")
    } finally {
      setActionLoading(false)
    }
  }

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "SALE":
        return t("Sale", "အရောင်း")
      case "ADJUSTMENT":
        return t("Adjustment", "လက်ကျန်ညှိ")
      case "TRANSFER_IN":
        return t("Transfer In", "ဆိုင်ခွဲအဝင်")
      case "TRANSFER_OUT":
        return t("Transfer Out", "ဆိုင်ခွဲအထွက်")
      case "PURCHASE_RECEIVED":
        return t("Purchase", "ပစ္စည်းဝယ်ယူမှု")
      default:
        return reason
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
            {t("Stock Status", "စတော့ အခြေအနေ")}
            {lowStockCount > 0 && <Badge variant="destructive" className="text-xs">{lowStockCount}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("Real-time stock tracking and inventory management across branches", "ဆိုင်ခွဲများအလိုက် စတော့ အခြေအနေနှင့် လက်ကျန် စီမံခန့်ခွဲမှု")}
          </p>
        </div>

        {/* Branch Selector */}
        {role === "OWNER" && branches.length > 0 && (
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
            <Building className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">{t("Active Branch", "ဆိုင်ခွဲ")}:</span>
            <select
              value={selectedBranchId || (branches[0]?.id ?? "")}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="bg-transparent border-0 text-sm font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-card text-foreground">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              {t("Total Catalog Items", "စုစုပေါင်းပစ္စည်းများ")}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(stockLevels.map((s) => s.variant.product.name)).size} Products
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stockLevels.length} SKUs in active inventory
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-destructive uppercase">
              {t("Low Stock Warning", "နည်းနေမှုများ")}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockCount} Products</div>
            <p className="text-xs text-muted-foreground mt-0.5">At or below warning limit</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
              {t("Inventory Cost Value", "စတော့အရင်းတန်ဖိုး")}
            </CardTitle>
            <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stockLevels.reduce((sum, s) => sum + (s.quantity > 0 ? s.quantity * (s.variant.costPrice || 0) : 0), 0).toLocaleString()} Ks
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Total capital invested in stock</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
              {t("Retail Sales Value", "စတော့ရောင်းဈေးတန်ဖိုး")}
            </CardTitle>
            <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stockLevels.reduce((sum, s) => sum + (s.quantity > 0 ? s.quantity * (s.variant.price || s.variant.product.price || 0) : 0), 0).toLocaleString()} Ks
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Potential total retail revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition-all focus:outline-none ${
            activeTab === "stock"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>{t("Stock Levels", "လက်ကျန်ပစ္စည်း")}</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition-all focus:outline-none ${
            activeTab === "logs"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          <span>{t("Inventory Logs", "လှုပ်ရှားမှုမှတ်တမ်း")}</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span className="font-semibold">{t("Loading branch inventory details...", "လက်ကျန်အချက်အလက်များ ဆွဲနေသည်...")}</span>
        </div>
      ) : activeTab === "stock" ? (
        <div className="space-y-4">
          {/* Filters Bar */}
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

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Select */}
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/10">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent border-0 text-xs font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">{t("All Categories", "အားလုံး")}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Low Stock Toggle */}
              <button
                onClick={() => {
                  setFilterLowStock(!filterLowStock)
                  if (!filterLowStock) setFilterMaxStock(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  filterLowStock
                    ? "bg-destructive/10 border-destructive text-destructive"
                    : "bg-muted/10 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{t("Low Stock", "နည်းနေမှုများ")}</span>
                {lowStockCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] py-0 px-1 font-bold">
                    {lowStockCount}
                  </Badge>
                )}
              </button>

              {/* Max Stock Toggle */}
              <button
                onClick={() => {
                  setFilterMaxStock(!filterMaxStock)
                  if (!filterMaxStock) setFilterLowStock(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  filterMaxStock
                    ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                    : "bg-muted/10 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{t("Max Stock", "အများဆုံးသတိပေး")}</span>
                {maxStockCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1 font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {maxStockCount}
                  </Badge>
                )}
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase font-bold">
                    <th className="px-5 py-3.5">{t("Product", "ပစ္စည်းအမည်")}</th>
                    <th className="px-5 py-3.5">{t("Barcode", "ဘားကုဒ်")}</th>
                    <th className="px-5 py-3.5">{t("Category", "အမျိုးအစား")}</th>
                    <th className="px-5 py-3.5 text-right">{t("Cost Price", "ဝယ်ရင်းဈေး")}</th>
                    <th className="px-5 py-3.5 text-right">{t("Retail Price", "ရောင်းဈေး")}</th>
                    <th className="px-5 py-3.5 text-center">{t("Stock Qty", "လက်ကျန်")}</th>
                    <th className="px-5 py-3.5 text-right">{t("Asset Value", "စတော့တန်ဖိုး")}</th>
                    <th className="px-5 py-3.5 text-right">{t("Actions", "ဆောင်ရွက်ချက်")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground italic">
                        {t("No products match your filters", "ပစ္စည်းမတွေ့ပါ။")}
                      </td>
                    </tr>
                  ) : (
                    pagedStock.map((s) => {
                      const isLow = s.quantity <= s.lowStockThreshold
                      const maxThreshold = s.highStockThreshold ?? s.variant.highStockThreshold ?? 100
                      const isHigh = !isLow && maxThreshold > 0 && s.quantity >= maxThreshold
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-muted/10 transition-colors ${
                            isLow ? "bg-destructive/5" : isHigh ? "bg-amber-500/5" : ""
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                {s.variant.product.imageUrl ? (
                                  <img
                                    src={s.variant.product.imageUrl}
                                    alt={s.variant.product.name}
                                    className="w-11 h-11 rounded-lg object-cover border border-border shadow-xs bg-muted"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center border border-border shadow-xs">
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                {/* Stock Status Badge Dot */}
                                <span
                                  className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card ${
                                    isLow
                                      ? "bg-destructive animate-pulse"
                                      : isHigh
                                      ? "bg-amber-500 animate-pulse"
                                      : s.quantity === 0
                                      ? "bg-muted-foreground"
                                      : "bg-emerald-500"
                                  }`}
                                  title={isLow ? "Low Stock" : isHigh ? "Max Stock Alert" : s.quantity === 0 ? "Out of Stock" : "In Stock"}
                                />
                              </div>
                              <div>
                                <div className="font-bold text-foreground text-sm flex gap-2 items-center">
                                  {s.variant.product.name}
                                  <Badge variant="secondary" className="text-[10px] py-0.5 px-1.5 h-auto leading-none">
                                    {s.variant.name}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground font-mono text-xs">
                            {s.variant.barcode || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant="outline" className="text-xs bg-muted/20 border-border">
                              {s.variant.product.category.name}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-muted-foreground">
                            {(s.variant.costPrice || 0).toLocaleString()} Ks
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-foreground">
                            {(s.variant.price || s.variant.product.price || 0).toLocaleString()} Ks
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`text-base font-bold ${
                                isLow ? "text-destructive" : isHigh ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                              }`}
                            >
                              {s.quantity.toLocaleString()}
                            </span>
                            {isLow && (
                              <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1 font-semibold uppercase">
                                {t("Low", "နည်းနေသည်")}
                              </Badge>
                            )}
                            {isHigh && (
                              <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1 font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                {t("Max", "အများဆုံး")}
                              </Badge>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-primary">
                            {(s.quantity > 0 ? s.quantity * (s.variant.costPrice || 0) : 0).toLocaleString()} Ks
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-bold gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border-blue-500/30"
                                onClick={() => {
                                  setTransferStock(s)
                                  setTransferQty("")
                                  setTransferNote("")
                                  setTransferDestBranchId("")
                                  setIsTransferOpen(true)
                                }}
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                <span>{t("Transfer", "လွှဲရန်")}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-bold gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                                onClick={() => {
                                  setEditStock(s)
                                  setEditCostPrice(String(s.variant.costPrice || 0))
                                  setEditSellingPrice(String(s.variant.price || s.variant.product.price || 0))
                                  setAdjustQty("")
                                  setAdjustNote("")
                                  setAdjustType("ADD")
                                  setAdjustReason("ADJUSTMENT")
                                  setIsEditOpen(true)
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                                <span>{t("Edit", "ပြင်ရန်")}</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              <TablePagination
                total={filteredStock.length}
                page={invPage}
                pageSize={invPageSize}
                onPageChange={setInvPage}
                onPageSizeChange={(s) => { setInvPageSize(s); setInvPage(1); }}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Logs Tab Content */
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase font-bold">
                  <th className="px-5 py-3.5">{t("Date & Time", "အချိန်")}</th>
                  <th className="px-5 py-3.5">{t("Branch", "ဆိုင်ခွဲ")}</th>
                  <th className="px-5 py-3.5">{t("Product", "ပစ္စည်း")}</th>
                  <th className="px-5 py-3.5 text-center">{t("Change", "အပြောင်းအလဲ")}</th>
                  <th className="px-5 py-3.5">{t("Operation Type", "အမျိုးအစား")}</th>
                  <th className="px-5 py-3.5">{t("Responsible staff", "တာဝန်ရှိသူ")}</th>
                  <th className="px-5 py-3.5">{t("Related flow", "ဆက်စပ်လုပ်ငန်းစဉ်")}</th>
                  <th className="px-5 py-3.5">{t("Details", "မှတ်ချက်")}</th>
                  <th className="px-5 py-3.5 text-right">{t("Action", "လုပ်ဆောင်ချက်")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground italic">
                      {t("No stock changes logged for this branch yet", "မှတ်တမ်းမရှိသေးပါ။")}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isPositive = log.change > 0
                    return (
                      <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-foreground">
                          {log.branch?.name || "—"}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-foreground">
                          {log.variant?.product?.name} {log.variant?.name ? `- ${log.variant.name}` : ""}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`font-black text-sm ${
                              isPositive ? "text-emerald-500" : "text-destructive"
                            }`}
                          >
                            {isPositive ? `+${log.change}` : log.change}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={
                              log.reason === "SALE"
                                ? "outline"
                                : log.reason === "ADJUSTMENT"
                                ? "secondary"
                                : "default"
                            }
                            className="text-xs"
                          >
                            {getReasonLabel(log.reason)}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="font-semibold">
                            {log.performedBy?.name ||
                              log.transaction?.staff?.name ||
                              log.salesOrder?.createdByStaff?.name ||
                              log.purchaseOrder?.receivedBy?.name ||
                              "Legacy / system"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="font-semibold">
                            {log.salesOrder
                              ? "Sales Order · " + (log.salesOrder.customer?.name || "Walk-in customer")
                              : log.transaction
                                ? "POS Sale · " + (log.transaction.customer?.name || "Walk-in customer")
                                : log.purchaseOrder
                                  ? "Purchase · " + (log.purchaseOrder.supplier?.name || "Supplier")
                                  : log.reason === "TRANSFER_IN" || log.reason === "TRANSFER_OUT"
                                    ? "Branch transfer"
                                    : "Manual adjustment"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          <span className="line-clamp-2">{log.note || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void viewInventoryLog(log)}>
                            <Eye className="h-3.5 w-3.5" />
                            {t("View", "ကြည့်ရန်")}
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Inventory Log Details", "ကုန်ပစ္စည်းလှုပ်ရှားမှု အသေးစိတ်")}</DialogTitle>
            <DialogDescription>{t("Complete history for this stock movement.", "ဤကုန်ပစ္စည်းလှုပ်ရှားမှု၏ အသေးစိတ်မှတ်တမ်း။")}</DialogDescription>
          </DialogHeader>
          {logDetailsLoading ? <div className="py-8 text-center text-sm text-muted-foreground">{t("Loading complete details...", "အသေးစိတ်များ ရယူနေပါသည်...")}</div> : selectedLog && <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-muted-foreground">{t("Product", "ပစ္စည်း")}</p><p className="mt-1 font-bold">{selectedLog.variant?.product?.name || "—"}</p><p className="text-xs text-muted-foreground">{selectedLog.variant?.name || "—"}</p></div>
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-muted-foreground">{t("Change", "အပြောင်းအလဲ")}</p><p className={`mt-1 text-xl font-black ${selectedLog.change > 0 ? "text-emerald-600" : "text-destructive"}`}>{selectedLog.change > 0 ? `+${selectedLog.change}` : selectedLog.change}</p></div>
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-muted-foreground">{t("Operation Type", "အမျိုးအစား")}</p><p className="mt-1 font-bold">{getReasonLabel(selectedLog.reason)}</p></div>
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-muted-foreground">{t("Date & Time", "အချိန်")}</p><p className="mt-1 font-semibold">{new Date(selectedLog.createdAt).toLocaleString()}</p></div>
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-muted-foreground">{t("Branch", "ဆိုင်ခွဲ")}</p><p className="mt-1 font-semibold">{selectedLog?.branch?.name || selectedLogDetails?.source?.branch?.name || "—"}</p></div>
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-muted-foreground">{t("Responsible staff", "တာဝန်ရှိသူ")}</p><p className="mt-1 font-semibold">{selectedLog?.performedBy?.name || selectedLogDetails?.source?.staff?.name || selectedLogDetails?.source?.createdByStaff?.name || selectedLogDetails?.source?.receivedBy?.name || "Legacy / system"}</p></div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:col-span-2"><p className="text-xs font-bold uppercase text-primary">{t("Source Details", "မူရင်းအကြောင်းအရာ အသေးစိတ်")}</p>{selectedLogDetails?.source ? <div className="mt-2 space-y-2"><p><span className="font-semibold">{selectedLogDetails.sourceType.replaceAll("_", " ")}:</span> #{String(selectedLogDetails.source.id || selectedLogDetails.source.orderNumber || "—").slice(-10).toUpperCase()}</p>{(selectedLogDetails.sourceType === "SALES_ORDER" || selectedLogDetails.sourceType === "POS_TRANSACTION") && <><p><span className="font-semibold">{t("Customer", "ဝယ်သူ")}:</span> {selectedLogDetails.source.customer?.name || "Walk-in customer"}</p><p><span className="font-semibold">{t("Customer phone", "ဝယ်သူဖုန်း")}:</span> {(selectedLogDetails.source.customer?.phones || [selectedLogDetails.source.customer?.phone || ""]).filter(Boolean).join(", ") || "—"}</p></>}{selectedLogDetails.sourceType === "SALES_ORDER" && <p><span className="font-semibold">{t("Payment", "ပေးချေမှု")}:</span> {selectedLogDetails.source.paymentStatus || "—"} · {(selectedLogDetails.source.amountPaid || 0).toLocaleString()} Ks</p>}{selectedLogDetails.sourceType === "PURCHASE_ORDER" && <><p><span className="font-semibold">{t("Supplier", "ပေးသွင်းသူ")}:</span> {selectedLogDetails.source.supplier?.name || "—"}</p><p><span className="font-semibold">{t("Supplier contact", "ပေးသွင်းသူ ဆက်သွယ်ရန်")}:</span> {selectedLogDetails.source.supplier?.contact || selectedLogDetails.source.supplier?.email || "—"}</p><p><span className="font-semibold">{t("Payment", "ပေးချေမှု")}:</span> {selectedLogDetails.source.paymentStatus || "—"} · {(selectedLogDetails.source.amountPaid || 0).toLocaleString()} Ks</p></>}{selectedLogDetails.sourceType === "POS_TRANSACTION" && <><p><span className="font-semibold">{t("Cashier", "ငွေကိုင်")}:</span> {selectedLogDetails.source.staff?.name || "—"}</p><p><span className="font-semibold">{t("Total", "စုစုပေါင်း")}:</span> {(selectedLogDetails.source.total || 0).toLocaleString()} Ks · {selectedLogDetails.source.paymentMethod || "—"}</p></>}{selectedLogDetails.sourceType === "TRANSFER" && <p>{t("This log is one side of a stock transfer. The note identifies the destination or source branch.", "ဤမှတ်တမ်းသည် စတော့လွှဲပြောင်းမှု၏ တစ်ဖက်ဖြစ်ပြီး မှတ်ချက်တွင် သွားမည့်/လာမည့် ဆိုင်ခွဲကို ဖော်ပြထားပါသည်။")}</p>}</div> : <p className="mt-2 text-sm text-muted-foreground">{t("No linked order was found. This may be a manual adjustment or an older log.", "ချိတ်ဆက်ထားသော အမှာစာ မတွေ့ပါ။ လက်ဖြင့်ပြင်ဆင်မှု သို့မဟုတ် အဟောင်းမှတ်တမ်း ဖြစ်နိုင်ပါသည်။")}</p>}</div>
            {selectedLogDetails?.source?.items && selectedLogDetails.source.items.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3 sm:col-span-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {t("Products and quantities", "ပစ္စည်းနှင့် အရေအတွက်")}
                </p>
                <div className="mt-2 divide-y divide-border">
                  {selectedLogDetails.source.items.map((item, index) => (
                    <div key={index} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <div>
                        <p className="font-semibold">
                          {item.variant?.product?.name || item.product?.name || "—"}
                        </p>
                        {item.variant?.name && (
                          <p className="text-xs text-muted-foreground">
                            Variant: {item.variant.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-bold">
                          Qty: {item.quantity ?? 0}
                          {item.fulfilledQuantity !== undefined
                            ? " · Fulfilled: " + item.fulfilledQuantity
                            : ""}
                        </p>
                        {(item.unitPrice !== undefined || item.total !== undefined) && (
                          <p className="text-muted-foreground">
                            {(item.unitPrice || 0).toLocaleString()} Ks each
                            {item.total !== undefined
                              ? " · " + (item.total || 0).toLocaleString() + " Ks"
                              : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs font-semibold text-muted-foreground">{t("Notes / Reference", "မှတ်ချက် / ကိုးကားချက်")}</p><p className="mt-1 whitespace-pre-wrap">{selectedLog.note || t("No note was recorded.", "မှတ်ချက် မရှိပါ။")}</p></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedLog(null)}>{t("Close", "ပိတ်ရန်")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Stock Overlay Modal */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-md bg-card border-border p-6 rounded-2xl flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">
              {t("Transfer Stock", "ဆိုင်ခွဲအချင်းချင်းပစ္စည်းလွှဲခြင်း")}
            </DialogTitle>
            <DialogDescription>
              Move {transferStock?.variant.product.name} - {transferStock?.variant.name} from this branch to another location
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20 my-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleTransferSubmit} className="space-y-4 pt-2 min-w-0 w-full">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {t("Transfer From (Origin)", "လွှဲမည့်ဆိုင်ခွဲ")}
              </label>
              <div className="h-11 px-3 flex items-center bg-muted/20 border border-border rounded-lg text-sm text-muted-foreground font-semibold">
                {branches.find((b) => b.id === selectedBranchId)?.name}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {t("Transfer To (Destination)", "လက်ခံမည့်ဆိုင်ခွဲ")}
              </label>
              <select
                value={transferDestBranchId}
                onChange={(e) => setTransferDestBranchId(e.target.value)}
                required
                className="w-full h-11 px-3 rounded-lg border border-border bg-card text-foreground text-sm font-semibold focus:outline-none"
              >
                <option value="">Select branch...</option>
                {branches
                  .filter((b) => b.id !== selectedBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {t("Transfer Quantity", "အရေအတွက်")} (Max: {transferStock?.quantity})
              </label>
              <Input
                type="number"
                placeholder="Enter quantity to transfer"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                min="1"
                max={transferStock?.quantity || 0}
                required
                className="h-11 bg-muted/10 border-border font-bold text-base"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {t("Transfer Notes", "အသေးစိတ်မှတ်ချက်")}
              </label>
              <Input
                type="text"
                placeholder="Reason for transfer (e.g. branch runout)..."
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="h-11 bg-muted/10 border-border text-sm"
              />
            </div>

            <DialogFooter className="pt-2 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferOpen(false)}
                className="font-semibold shrink-0"
              >
                {t("Cancel", "ပယ်ဖျက်မည်")}
              </Button>
              <Button type="submit" disabled={loading || actionLoading} className="font-bold shrink-0">
                {actionLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                <span>{t("Execute Transfer", "ပစ္စည်းလွှဲပြောင်းမည်")}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Combined Edit Product & Adjust Stock Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg bg-card border-border p-6 rounded-2xl flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">
              {t("Edit Product & Adjust Stock", "ဈေးနှုန်း ပြင်ဆင်ရန် / စတော့ ညှိရန်")}
            </DialogTitle>
            <DialogDescription>
              Update prices and manage stock levels for {editStock?.variant.product.name} - {editStock?.variant.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCombinedEditSubmit} className="space-y-4 pt-2 min-w-0 w-full">
            {/* Product Summary Header */}
            <div className="p-3 bg-muted/20 border border-border rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-semibold">{t("Product Name", "ပစ္စည်းအမည်")}</p>
                <p className="text-sm font-bold text-foreground">{editStock?.variant.product.name} - {editStock?.variant.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-semibold">{t("Current Stock", "လက်ရှိ စတော့")}</p>
                <Badge variant="outline" className="font-black text-xs">
                  {editStock?.quantity || 0} Pcs
                </Badge>
              </div>
            </div>

            {/* Price Edit Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {t("Cost Price (Ks)", "ဝယ်ရင်းဈေး (ကျပ်)")}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(e.target.value)}
                  placeholder="0"
                  className="h-10 bg-background border-border text-foreground text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {t("Retail Selling Price (Ks)", "ရောင်းဈေး (ကျပ်)")}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={editSellingPrice}
                  onChange={(e) => setEditSellingPrice(e.target.value)}
                  placeholder="0"
                  className="h-10 bg-background border-border text-foreground text-sm font-bold"
                />
              </div>
            </div>

            {/* Stock Adjustment Section (Optional) */}
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground uppercase flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span>{t("Stock Quantity Adjustment (Optional)", "လက်ကျန်စတော့ ညှိရန် (မဖြစ်မနေ မဟုတ်ပါ)")}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={adjustType === "ADD" ? "default" : "outline"}
                  className="h-9 font-bold text-xs"
                  onClick={() => setAdjustType("ADD")}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  <span>{t("Add Stock", "တိုးရန်")}</span>
                </Button>
                <Button
                  type="button"
                  variant={adjustType === "SUBTRACT" ? "destructive" : "outline"}
                  className="h-9 font-bold text-xs"
                  onClick={() => setAdjustType("SUBTRACT")}
                >
                  <Minus className="mr-1 h-3.5 w-3.5" />
                  <span>{t("Subtract Stock", "လျှော့ရန်")}</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("Adjustment Qty", "ညှိမည့် အရေအတွက်")}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 (Leave blank if no change)"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="h-10 bg-background border-border text-sm font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("Adjustment Reason", "အကြောင်းအရင်း")}
                  </label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:outline-none"
                  >
                    <option value="ADJUSTMENT">{t("Manual Count", "လက်ကျန်ရေတွက်မှုညှိရန်")}</option>
                    <option value="DAMAGE">{t("Damaged Goods", "ပျက်စီးဆုံးရှုံးမှု")}</option>
                    <option value="WASTE">{t("Expired / Expiry-Wastage", "သက်တမ်းလွန်")}</option>
                    <option value="PURCHASE_RECEIVED">{t("Supplier Delivery", "ကုန်အသစ်ဝင်ခြင်း")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t("Note (Optional)", "မှတ်ချက်")}
                </label>
                <Input
                  type="text"
                  placeholder="Reason note..."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="h-10 bg-background border-border text-xs"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="pt-2 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="font-semibold shrink-0"
              >
                {t("Cancel", "ပယ်ဖျက်မည်")}
              </Button>
              <Button type="submit" disabled={loading || actionLoading} className="font-bold shrink-0">
                {actionLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                <span>{t("Save Changes", "သိမ်းဆည်းမည်")}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
