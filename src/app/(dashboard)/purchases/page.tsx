"use client"

import * as React from "react"
import { Search, Loader2, PackageCheck, Plus, Trash2, Building2, User, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import { TablePagination } from "@/components/ui/table-pagination"

interface Supplier {
  id: string
  name: string
}

interface ProductVariant {
  id: string
  productId: string
  name: string
  barcode: string
  costPrice?: number
  price?: number
}

interface Product {
  id: string
  name: string
  costPrice?: number
  price?: number
  variants: ProductVariant[]
}

interface PurchaseItem {
  id: string
  variantId: string
  quantity: number
  costPrice?: number
  unitCost?: number
  sellingPrice?: number
  total?: number
  variant: ProductVariant & { product: { name: string } }
}

interface PurchaseOrder {
  id: string
  orderNumber: string
  supplierId: string
  totalAmount: number
  totalCost?: number
  status: string
  notes: string | null
  note?: string | null
  voucherNumber?: string | null
  createdAt: string
  supplier: Supplier
  items: PurchaseItem[]
  branch?: { id: string; name: string } | null
  createdBy?: { id: string; name: string; role?: string } | null
  receivedBy?: { id: string; name: string; role?: string } | null
  receivedByStaff?: { id: string; name: string } | null
}

export default function PurchasesPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = user?.publicMetadata?.role as string | undefined
  const todayDate = React.useMemo(() => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }, [])

  const [orders, setOrders] = React.useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [branches, setBranches] = React.useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [historyFilter, setHistoryFilter] = React.useState<"ALL" | "RECEIVED" | "CANCELLED">("ALL")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [selectedBranchFilter, setSelectedBranchFilter] = React.useState("")

  // Reset page when search, filter, or branch filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, historyFilter, selectedBranchFilter])
  
  // Receive state
  const [selectedOrder, setSelectedOrder] = React.useState<PurchaseOrder | null>(null)
  const [viewOrder, setViewOrder] = React.useState<PurchaseOrder | null>(null)
  const [cancelOrderConfirm, setCancelOrderConfirm] = React.useState<PurchaseOrder | null>(null)
  const [receiveItems, setReceiveItems] = React.useState<{id: string; quantity: number; unitCost: number; sellingPrice: number}[]>([])
  const [receiveLoading, setReceiveLoading] = React.useState(false)

  // Create state
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = React.useState(false)
  const [newSupplierId, setNewSupplierId] = React.useState("")
  const [newVoucherNumber, setNewVoucherNumber] = React.useState("")
  const [newBranchId, setNewBranchId] = React.useState("")
  const [newNote, setNewNote] = React.useState("")
  const [newArrivalDate, setNewArrivalDate] = React.useState("")
  const [formItems, setFormItems] = React.useState<{ variantId: string; quantity: number; unitCost: number; sellingPrice: number }[]>([])

  const createCalculations = React.useMemo(() => {
    let totalCost = 0
    let totalSelling = 0
    formItems.forEach((item) => {
      const qty = Number(item.quantity) || 0
      const cost = Number(item.unitCost) || 0
      const sell = Number(item.sellingPrice) || 0
      totalCost += qty * cost
      totalSelling += qty * sell
    })
    return { totalCost, totalSelling }
  }, [formItems])
  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const poUrl = selectedBranchFilter && role === "OWNER"
        ? `/api/purchase-orders?branchId=${selectedBranchFilter}`
        : "/api/purchase-orders"
      const [resPO, resSup, resProd, resBranches] = await Promise.all([
        fetch(poUrl),
        fetch("/api/suppliers"),
        fetch("/api/products"),
        fetch("/api/branches")
      ])
      const dataPO = await resPO.json()
      const dataSup = await resSup.json()
      const dataProd = await resProd.json()
      const dataBranches = await resBranches.json()
      setBranches(dataBranches.branches || [])
      
      setOrders(dataPO.orders || [])
      setSuppliers(dataSup.suppliers || [])
      setProducts(dataProd.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [role, user?.branchId, selectedBranchFilter])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // CREATE LOGIC
  const openCreate = () => {
    setNewSupplierId(suppliers[0]?.id || "")
    setNewVoucherNumber("")
    setNewNote("")
    setNewArrivalDate(todayDate)
    setFormItems([{ variantId: "", quantity: 1, unitCost: 0, sellingPrice: 0 }])
    setIsCreateOpen(true)
  }

  const addFormItem = () => {
    setFormItems([...formItems, { variantId: "", quantity: 1, unitCost: 0, sellingPrice: 0 }])
  }

  const updateFormItem = (index: number, field: string, value: string | number) => {
    setFormItems(prev => prev.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    ))
  }

  const applyMarkupToForm = (index: number, percent: number) => {
    const cost = Number(formItems[index]?.unitCost) || 0
    if (cost <= 0) return
    const calculated = Math.round(cost * (1 + percent / 100))
    updateFormItem(index, "sellingPrice", calculated)
  }

  const removeFormItem = (index: number) => {
    const next = [...formItems]
    next.splice(index, 1)
    setFormItems(next)
  }


  const allVariants = React.useMemo(() => {
    return products.flatMap(p => 
      (p.variants || []).map(v => ({
        ...v,
        productName: p.name,
        productPrice: p.price,
        searchStr: `${p.name} ${v.name} ${v.barcode}`.toLowerCase()
      }))
    )
  }, [products])

  const handleCreateSubmit = async (e: React.FormEvent | null, confirmed = false) => {
    e?.preventDefault()

    if (!confirmed) {
      if (!newSupplierId) {
        setError(t("Please select a supplier before submitting.", "အမှာစာ မတင်မီ ပေးသွင်းသူ ရွေးချယ်ပါ။"))
        return
      }

      if (!newVoucherNumber.trim()) {
        setError(t("Please enter a voucher number.", "ဘောင်ချာနံပါတ် ဖြည့်သွင်းပါ။"))
        return
      }

      const hasInvalidItem = formItems.some((item) =>
        !item.variantId ||
        Number(item.quantity) <= 0 ||
        Number(item.unitCost) <= 0 ||
        Number(item.sellingPrice) <= 0
      )
      if (hasInvalidItem) {
        setError(t("Select a product and enter quantity, cost, and selling price greater than 0.", "ပစ္စည်းရွေးပြီး အရေအတွက်၊ မူရင်းဈေးနှင့် ရောင်းဈေးကို ၀ ထက်ကြီးသော တန်ဖိုးဖြည့်ပါ။"))
        return
      }

      setIsSubmitConfirmOpen(true)
      return
    }

    const validItems = formItems
      .filter(i => i.variantId)
      .map(i => ({
        variantId: i.variantId,
        quantity: Number(i.quantity) || 0,
        unitCost: Number(i.unitCost) || 0,
        sellingPrice: Number(i.sellingPrice) || 0
      }))
    if (validItems.length === 0) return

    setCreateLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          supplierId: newSupplierId, 
          branchId: newBranchId || undefined,
          note: newNote,
          items: validItems,
          arrivalDate: newArrivalDate,
          voucherNumber: newVoucherNumber.trim(),
          paymentStatus: "PAID",
          amountPaid: createCalculations.totalCost
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || data?.details || "Failed to create order")
      }
      
      const createData = await res.json()
      const submittedAt = new Date().toISOString()
      const receivedItems = (createData.order.items || []).map((item: { id: string }, index: number) => ({
        id: item.id,
        quantity: validItems[index].quantity,
        unitCost: validItems[index].unitCost,
        sellingPrice: validItems[index].sellingPrice,
      }))
      const orderStatusRes = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: createData.order.id, 
          status: "RECEIVED",
          items: receivedItems,
          paymentStatus: "PAID",
          amountPaid: createCalculations.totalCost,
          voucherNumber: newVoucherNumber.trim() || `DIRECT-${createData.order.id.slice(-8).toUpperCase()}`,
          arrivalDate: submittedAt
        })
      })
      if (!orderStatusRes.ok) {
        const data = await orderStatusRes.json().catch(() => null)
        throw new Error(data?.error || data?.details || "Failed to receive purchase immediately")
      }

      await fetchData()
      setIsCreateOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating purchase order")
    } finally {
      setCreateLoading(false)
    }
  }

  const updateReceiveItem = (id: string, field: "quantity" | "unitCost" | "sellingPrice", val: string) => {
    setReceiveItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: Number(val) } : item
    ))
  }

  const applyMarkupToReceive = (itemId: string, percent: number) => {
    const target = receiveItems.find(i => i.id === itemId)
    if (!target) return
    const cost = Number(target.unitCost) || 0
    if (cost <= 0) return
    const calculated = Math.round(cost * (1 + percent / 100))
    updateReceiveItem(itemId, "sellingPrice", String(calculated))
  }

  const handleReceive = async () => {
    if (!selectedOrder) return
    setReceiveLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedOrder.id,
          status: "RECEIVED",
          items: receiveItems
        })
      })
      
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to receive order")
      }
      
      await fetchData()
      setSelectedOrder(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error receiving order")
    } finally {
      setReceiveLoading(false)
    }
  }
  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: "CANCELLED" })
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to cancel order")
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order")
    }
  }

  const completedPurchases = orders.filter(o => 
    (o.status === "RECEIVED" || o.status === "CANCELLED") &&
    (historyFilter === "ALL" || o.status === historyFilter)
  ).filter(o => {
    const s = searchQuery.toLowerCase()
    return o.id.toLowerCase().includes(s) || 
      o.supplier.name.toLowerCase().includes(s) || 
      (o.voucherNumber && o.voucherNumber.toLowerCase().includes(s))
  })

  const paginatedCompleted = completedPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize)



  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-primary" />
            {t("Direct Purchases", "ချက်ချင်းအဝယ်")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-semibold">
            {t("Instantly receive goods dropped off by suppliers directly into your stock.", "ပေးသွင်းသူများ ထံမှ ပစ္စည်းများကို ကုန်ပစ္စည်းစာရင်းထဲသို့ တိုက်ရိုက် လက်ခံယူပါ။")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {role === "OWNER" && branches.length > 0 && (
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">{t("Active Branch", "ဆိုင်ခွဲ")}:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="bg-transparent border-0 text-sm font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-card text-foreground">{t("All Branches", "ဆိုင်ခွဲအားလုံး")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-card text-foreground">{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={openCreate} disabled={loading || createLoading || receiveLoading} className="font-bold gap-2">
            <Plus className="h-4 w-4" />
            {t("New Purchase", "ဝယ်ယူမှုအသစ်")}
          </Button>
        </div>
      </div>

      {/* Completed Purchases Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
          <h2 className="text-lg font-bold text-foreground">{t("Direct Purchases History", "ချက်ချင်းအဝယ် မှတ်တမ်း")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted p-1 rounded-md h-9">
              <button 
                onClick={() => setHistoryFilter("ALL")} 
                className={`px-3 text-xs font-bold rounded-sm transition-all ${historyFilter === "ALL" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >{t("All", "အားလုံး")}</button>
              <button 
                onClick={() => setHistoryFilter("RECEIVED")} 
                className={`px-3 text-xs font-bold rounded-sm transition-all ${historyFilter === "RECEIVED" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >{t("Received", "လက်ခံရရှိပြီး")}</button>
              <button 
                onClick={() => setHistoryFilter("CANCELLED")} 
                className={`px-3 text-xs font-bold rounded-sm transition-all ${historyFilter === "CANCELLED" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >{t("Cancelled", "ပယ်ဖျက်လိုက်သည်")}</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search by ID, supplier, or voucher...", "ID၊ ပေးသွင်းသူ သို့မဟုတ် ဘောင်ချာဖြင့် ရှာရန်...")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-[280px] bg-card"
              />
            </div>
          </div>
        </div>

        {loading ? null : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedPurchases.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                {t("No completed purchases found.", "ပြီးစီးသည့် အဝယ်များ မတွေ့ပါ။")}
              </div>
            ) : (
              paginatedCompleted.map(order => (
                <Card key={order.id} className="p-4 opacity-80 cursor-pointer hover:bg-muted/50 hover:opacity-100 transition-all" onClick={() => setViewOrder(order)}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-sm">PO-{order.id.slice(-6).toUpperCase()}</h3>
                      {order.voucherNumber && (
                        <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block mt-0.5">
                          {t("Voucher", "ဘောင်ချာ")}: {order.voucherNumber}
                        </div>
                      )}
                    </div>
                    <Badge variant={order.status === "CANCELLED" ? "secondary" : "outline"} className="text-[10px]">{order.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">{order.supplier.name}</div>
                  {order.branch && (
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1">
                      <Building2 className="h-3 w-3" />{order.branch.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{t("Purchased by", "ဝယ်ယူသူ")}: <strong className="text-foreground">{order.createdBy?.name || order.receivedBy?.name || order.receivedByStaff?.name || "Store Staff"}</strong></span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-sm font-semibold bg-muted/50 p-2 rounded flex justify-between">
                    <span>{t("Total Cost", "စုစုပေါင်း ကုန်ကျစရိတ်")}:</span>
                    <span>{(order.totalCost ?? order.totalAmount ?? 0).toLocaleString()} Ks</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
        <div className="mt-4">
          <TablePagination
            total={completedPurchases.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      </div>

      {/* Create PO Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("Create Purchase Order", "ဝယ်ယူမှု အမှာစာ အသစ်ပြုလုပ်ရန်")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">{t("Supplier", "ပေးသွင်းသူ")} <span className="text-destructive">*</span></label>
                <SearchableSelect 
                  items={suppliers}
                  value={newSupplierId}
                  onChange={setNewSupplierId}
                  placeholder={t("Select a supplier...", "ပေးသွင်းသူ ရွေးချယ်ပါ...")}
                  searchPlaceholder={t("Search supplier...", "ပေးသွင်းသူ ရှာဖွေပါ...")}
                  renderItem={(s) => s.name}
                  filterItem={(s, search) => s.name.toLowerCase().includes(search)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">{t("Voucher Number", "ဘောင်ချာနံပါတ်")} <span className="text-destructive">*</span></label>
                <Input 
                  required
                  value={newVoucherNumber} 
                  onChange={e => setNewVoucherNumber(e.target.value)} 
                  placeholder={t("e.g. VCH-00123", "ဥပမာ- VCH-00123")} 
                  className="h-10 bg-muted/10 border-border font-bold"
                />
              </div>

              {role === "OWNER" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">{t("Destination Branch", "ပေးပို့မည့် ဆိုင်ခွဲ")} <span className="text-destructive">*</span></label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-border bg-card text-sm font-semibold"
                    value={newBranchId}
                    onChange={e => setNewBranchId(e.target.value)}
                    required
                  >
                    <option value="">{t("-- Select Destination Branch --", "-- ပေးပို့မည့် ဆိုင်ခွဲ ရွေးချယ်ပါ --")}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">{t("Note (Optional)", "မှတ်ချက် (စိတ်ကြိုက်)")}</label>
                <Input 
                  value={newNote} 
                  onChange={e => setNewNote(e.target.value)} 
                  placeholder={t("e.g. Restock", "ဥပမာ- ပစ္စည်းဖြည့်ရန်")} 
                  className="h-10 bg-muted/10 border-border"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-foreground">{t("Order Items", "မှာယူမည့် ပစ္စည်းများ")}</label>
                <Button type="button" variant="outline" size="sm" disabled={createLoading} onClick={addFormItem} className="h-7 text-xs font-bold">
                  <Plus className="h-3 w-3 mr-1" /> {t("Add Product", "ပစ္စည်း ထည့်မည်")}
                </Button>
              </div>
              <div className="hidden sm:flex gap-2 items-end px-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground mt-4">
                <div className="flex-1">{t("Product Variant", "ပစ္စည်းအမျိုးအစား")}</div>
                <div className="w-20 text-center">{t("Qty", "အရေအတွက်")}</div>
                <div className="w-24 text-center">{t("Cost", "မူရင်းဈေး")}</div>
                <div className="w-28 text-center">{t("Sell Price", "ရောင်းဈေး")}</div>
                <div className="w-8"></div>
              </div>
              {formItems.map((item, index) => (
                <div key={index} className="flex flex-col gap-2 bg-muted/20 p-3 rounded-lg border border-border">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="flex-1 min-w-[220px] relative">
                      <SearchableSelect 
                        items={allVariants}
                        value={item.variantId}
                        onChange={(val) => {
                          updateFormItem(index, "variantId", val)
                          const found = allVariants.find(v => v.id === val)
                          if (found) {
                            if (found.costPrice !== undefined && found.costPrice > 0) {
                              updateFormItem(index, "unitCost", found.costPrice)
                            }
                            const sell = found.productPrice || found.price || 0
                            if (sell > 0) {
                              updateFormItem(index, "sellingPrice", sell)
                            }
                          }
                        }}
                        placeholder={t("Search product or barcode...", "ပစ္စည်း သို့မဟုတ် ဘားကုဒ် ရှာဖွေပါ...")}
                        searchPlaceholder={t("Search product, variant, or barcode...", "ပစ္စည်း သို့မဟုတ် ဘားကုဒ် ရှာဖွေပါ...")}
                        renderItem={(v) => `${v.productName} - ${v.name} [${v.barcode}]`}
                        filterItem={(v, search) => v.searchStr.includes(search)}
                      />
                    </div>
                    <div className="w-full sm:w-20">
                      <Input 
                        type="number" min={1} placeholder={t("Qty", "အရေအတွက်")} 
                        value={item.quantity} onChange={e => updateFormItem(index, "quantity", e.target.value)}
                        className="h-9 text-xs" title="Quantity"
                      />
                    </div>
                    <div className="w-full sm:w-24">
                      <Input 
                        type="number" min={1} placeholder={t("Cost", "မူရင်းဈေး")}
                        value={item.unitCost} onChange={e => updateFormItem(index, "unitCost", e.target.value)}
                        className="h-9 text-xs" title="Unit Cost"
                      />
                    </div>
                    <div className="w-full sm:w-28">
                      <Input 
                        type="number" min={1} placeholder={t("Sell Price", "ရောင်းဈေး")}
                        value={item.sellingPrice} onChange={e => updateFormItem(index, "sellingPrice", e.target.value)}
                        className="h-9 text-xs text-primary font-bold" title="Selling Price"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFormItem(index)} disabled={createLoading || formItems.length === 1} className="self-end sm:self-center h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("Markup", "အမြတ်")}:</span>
                    {[10, 15, 20, 25, 30].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyMarkupToForm(index, pct)}
                        className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-background hover:bg-primary hover:text-primary-foreground text-foreground border border-border transition-all shadow-xs active:scale-95 cursor-pointer"
                        title={`Set selling price to +${pct}% of cost`}
                      >
                        +{pct}%
                      </button>
                    ))}
                    <div className="inline-flex items-center gap-1 bg-background border border-border rounded-md px-1.5 py-0.5 shadow-xs">
                      <input
                        type="number"
                        placeholder="%"
                        min={0}
                        max={500}
                        className="w-10 h-4 text-[10px] font-bold text-center bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (val > 0) applyMarkupToForm(index, val)
                        }}
                      />
                      <span className="text-[9px] text-muted-foreground font-semibold">%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Totals Summary */}
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-border mt-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("Total Cost Price", "စုစုပေါင်းအရင်း")}: </span>
                <span className="font-bold text-foreground text-sm">{createCalculations.totalCost.toLocaleString()} Ks</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">{t("Total Sell Value", "စုစုပေါင်းရောင်းဈေး")}: </span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{createCalculations.totalSelling.toLocaleString()} Ks</span>
              </div>
            </div>
            
            {error && (
              <div className="p-3 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive border border-destructive/20 mt-3">
                {error}
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" disabled={createLoading} onClick={() => setIsCreateOpen(false)}>{t("Cancel", "မလုပ်တော့ပါ")}</Button>
              <Button type="submit" disabled={createLoading} className="font-bold">
                {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t("Submit Order", "အမှာစာ တင်မည်")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isSubmitConfirmOpen}
        onClose={() => { setIsSubmitConfirmOpen(false); setIsCreateOpen(true) }}
        onConfirm={() => { setIsSubmitConfirmOpen(false); void handleCreateSubmit(null, true) }}
        title={t("Confirm Purchase Order", "ဝယ်ယူမှု အမှာစာ အတည်ပြုရန်")}
        description={t(
          `Submit this order to ${suppliers.find(s => s.id === newSupplierId)?.name || "the selected supplier"} with ${formItems.length} item(s) totaling ${createCalculations.totalCost.toLocaleString()} Ks?`,
          `ဤအမှာစာကို ${suppliers.find(s => s.id === newSupplierId)?.name || "ရွေးချယ်ထားသော ပေးသွင်းသူ"} ထံ ${formItems.length} မျိုး၊ စုစုပေါင်း ${createCalculations.totalCost.toLocaleString()} Ks ဖြင့် တင်မည်လား။`
        )}
        confirmText={t("Submit Order", "အမှာစာ တင်မည်")}
        cancelText={t("Review", "ပြန်စစ်မည်")}
        variant="primary"
        loading={createLoading}
      />

      {/* Receive Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("Receive Order", "အမှာစာ လက်ခံရန်")}: PO-{selectedOrder?.id.slice(-6).toUpperCase()}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <p className="text-sm text-muted-foreground font-medium">
              {t("Update the actual received quantities, final unit cost (what you pay), and the POS selling price (what customers pay).", "လက်ခံရရှိသည့် အရေအတွက်၊ မူရင်းဈေးနှင့် ရောင်းဈေးများကို ပြင်ဆင်ပါ။")}
            </p>

            <div className="space-y-3">
              {selectedOrder?.items.map((item) => {
                const formItem = receiveItems.find(i => i.id === item.id)
                if (!formItem) return null
                return (
                  <div key={item.id} className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{item.variant?.product?.name} - {item.variant?.name}</div>
                        <div className="text-xs text-muted-foreground">{t("Ordered", "မှာယူထားသည်")}: {item.quantity} pcs @ {(item.unitCost ?? item.costPrice ?? 0).toLocaleString()} Ks</div>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                        <div className="space-y-1 w-20">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">{t("Rcvd Qty", "လက်ခံ ရရှိအရေအတွက်")}</label>
                          <Input 
                            type="number" 
                            className="h-8 text-sm" 
                            value={formItem.quantity}
                            onChange={e => updateReceiveItem(item.id, "quantity", e.target.value)}
                            min={0}
                          />
                        </div>
                        <div className="space-y-1 w-24">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">{t("Cost (Ks)", "မူရင်းဈေး (ကျပ်)")}</label>
                          <Input 
                            type="number" 
                            className="h-8 text-sm" 
                            value={formItem.unitCost}
                            onChange={e => updateReceiveItem(item.id, "unitCost", e.target.value)}
                            min={0}
                          />
                        </div>
                        <div className="space-y-1 w-28">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">{t("Sell Price (Ks)", "ရောင်းဈေး (ကျပ်)")}</label>
                          <Input 
                            type="number" 
                            className="h-8 text-sm text-primary font-bold" 
                            value={formItem.sellingPrice}
                            onChange={e => updateReceiveItem(item.id, "sellingPrice", e.target.value)}
                            min={0}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("Markup", "အမြတ်")}:</span>
                      {[10, 15, 20, 25, 30].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyMarkupToReceive(item.id, pct)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-background hover:bg-primary hover:text-primary-foreground text-foreground border border-border transition-all shadow-xs active:scale-95 cursor-pointer"
                          title={`Set selling price to +${pct}% of cost`}
                        >
                          +{pct}%
                        </button>
                      ))}
                      <div className="inline-flex items-center gap-1 bg-background border border-border rounded-md px-1.5 py-0.5 shadow-xs">
                        <input
                          type="number"
                          placeholder="%"
                          min={0}
                          max={500}
                          className="w-10 h-4 text-[10px] font-bold text-center bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            if (val > 0) applyMarkupToReceive(item.id, val)
                          }}
                        />
                        <span className="text-[9px] text-muted-foreground font-semibold">%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="mt-4 border-t border-border pt-4">
            <Button variant="outline" disabled={receiveLoading} onClick={() => setSelectedOrder(null)}>{t("Cancel", "မလုပ်တော့ပါ")}</Button>
            <Button onClick={handleReceive} disabled={receiveLoading} className="font-bold bg-primary text-primary-foreground">
              {receiveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Confirm Receipt", "လက်ခံရရှိမှု အတည်ပြုမည်")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("Purchase Order Details", "ဝယ်ယူမှု အမှာစာ အသေးစိတ်")}: PO-{viewOrder?.id.slice(-6).toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="flex justify-between items-start bg-muted/20 p-4 rounded-lg border border-border">
              <div>
                <p className="text-sm text-muted-foreground font-semibold">{t("Supplier", "ပေးသွင်းသူ")}</p>
                <p className="font-bold">{viewOrder?.supplier.name}</p>
                {viewOrder?.voucherNumber && (
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 inline-flex items-center gap-1.5 mt-1.5">
                    <span>{t("Voucher Number", "ဘောင်ချာနံပါတ်")}: <strong className="text-foreground">{viewOrder.voucherNumber}</strong></span>
                  </div>
                )}
                {viewOrder?.branch && (
                  <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                    <Building2 className="h-4 w-4" />
                    <span>{viewOrder.branch.name}</span>
                  </div>
                )}
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                  <User className="h-3.5 w-3.5" />
                  <span>{t("Purchased By", "ဝယ်ယူသူ")}: <strong className="text-foreground">{viewOrder?.createdBy?.name || viewOrder?.receivedBy?.name || viewOrder?.receivedByStaff?.name || "Store Staff"}</strong></span>
                </div>
                {viewOrder?.receivedBy?.name && (
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-1">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t("Received By", "လက်ခံသူ")}: <strong className="text-foreground">{viewOrder.receivedBy.name}</strong></span>
                  </div>
                )}
                {viewOrder?.note && (
                  <p className="text-sm mt-2"><span className="text-muted-foreground">{t("Note", "မှတ်ချက်")}:</span> {viewOrder.note}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground font-semibold">{t("Date", "ရက်စွဲ")}</p>
                <p className="font-bold text-sm">{viewOrder?.createdAt ? new Date(viewOrder.createdAt).toLocaleDateString() : ''}</p>
                <Badge className="mt-2">{viewOrder?.status}</Badge>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-3">{t("Order Items", "မှာယူသည့် ပစ္စည်းများ")}</h3>
              <div className="space-y-2">
                {viewOrder?.items.map((item) => (
                  <div key={item.id} className="p-3 bg-card border border-border rounded-lg flex justify-between items-center gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{item.variant?.product?.name} - {item.variant?.name}</p>
                      <p className="text-xs text-muted-foreground">{t("Barcode", "ဘားကုဒ်")}: {item.variant?.barcode || "N/A"}</p>
                    </div>
                    <div className="text-right text-xs shrink-0 space-y-1">
                      <p><span className="text-muted-foreground">{t("Quantity", "အရေအတွက်")}:</span> {item.quantity} pcs</p>
                      <p><span className="text-muted-foreground">{t("Cost Price", "မူရင်းဈေး")}:</span> {(item.unitCost ?? item.costPrice ?? 0).toLocaleString()} Ks</p>
                      <p><span className="text-muted-foreground">{t("Selling Price", "ရောင်းဈေး")}:</span> {(item.sellingPrice ?? 0).toLocaleString()} Ks</p>
                      <p className="font-bold text-primary">{t("Total Cost", "စုစုပေါင်းအရင်း")} : {(item.total ?? (item.quantity * (item.unitCost ?? item.costPrice ?? 0))).toLocaleString()} Ks</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-border">
              <div className="text-right">
                <p className="text-sm text-muted-foreground font-semibold">{t("Grand Total", "စုစုပေါင်း ပမာဏ")}</p>
                <p className="text-xl font-black text-primary">{(viewOrder?.totalCost ?? viewOrder?.totalAmount ?? 0).toLocaleString()} Ks</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirm Dialog */}
      <Dialog open={!!cancelOrderConfirm} onOpenChange={(open) => !open && setCancelOrderConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Cancel Purchase Order?", "ဝယ်ယူမှု အမှာစာ ပယ်ဖျက်မလား။")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              {t(`Are you sure you want to cancel PO-${cancelOrderConfirm?.id.slice(-6).toUpperCase()}? This action cannot be undone.`, `ဝယ်ယူမှု အမှာစာ PO-${cancelOrderConfirm?.id.slice(-6).toUpperCase()} ကို ပယ်ဖျက်ရန် သေချာပါသလား။`)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={receiveLoading} onClick={() => setCancelOrderConfirm(null)}>{t("No, Keep it", "မပယ်ဖျက်ပါ")}</Button>
            <Button variant="destructive" onClick={() => {
              if (cancelOrderConfirm) {
                handleCancelOrder(cancelOrderConfirm.id)
                setCancelOrderConfirm(null)
              }
            }}>{t("Yes, Cancel Order", "ဟုတ်ကဲ့၊ ပယ်ဖျက်မည်")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
