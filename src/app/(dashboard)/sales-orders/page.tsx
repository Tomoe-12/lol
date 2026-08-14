"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import { 
  ClipboardList, 
  Search, 
  Plus, 
  Loader2,
  Trash2,
  PackageCheck,
  Eye,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  Truck
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { SearchableSelect } from "@/components/ui/searchable-select"
import { format } from "date-fns"

interface Customer {
  id: string
  name: string
}

interface ProductVariant {
  id: string
  productId: string
  name: string
  barcode: string
  product: { name: string; price: number }
  costPrice?: number
  stockLevels?: { branchId: string; quantity: number }[]
}

interface SalesOrderItem {
  id: string
  variantId: string
  variant: ProductVariant
  quantity: number
  unitPrice: number
  unitCost?: number
  discount: number
  total: number
}

interface SalesOrder {
  id: string
  status: string
  paymentStatus: string
  paymentMethod?: string
  total: number
  totalCost?: number
  amountPaid: number
  createdAt: string
  branchId: string
  branch?: { id: string; name: string }
  customer?: Customer | null
  items: SalesOrderItem[]
  payments?: { id: string; amount: number; method: string; note?: string; createdAt: string }[]
  isPos?: boolean
  isDelivery?: boolean
  deliveryStatus?: string
  deliveryCustomerName?: string | null
  deliveryPhone?: string | null
  deliveryAddress?: string | null
}

export default function SalesOrdersPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = user?.publicMetadata?.role as string | undefined

  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])
  
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [branchFilter, setBranchFilter] = useState<string>("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, branchFilter])

  useEffect(() => {
    if (user?.branchId && role !== "OWNER") {
      setNewBranchId(user.branchId)
      setBranchFilter(user.branchId)
    }
  }, [user?.branchId, role])

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null)
  
  // Create Form State
  const [customerId, setCustomerId] = useState("")
  const [newBranchId, setNewBranchId] = useState("")
  const [formItems, setFormItems] = useState<{ variantId: string; quantity: number; unitPrice: number; unitCost: number; discount: number }[]>([])
  const [paymentStatus, setPaymentStatus] = useState("PARTIAL")
  const [amountPaid, setAmountPaid] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [saveAsDraft, setSaveAsDraft] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit Form State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Cancel & Refund Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
  const [editFormItems, setEditFormItems] = useState<{ variantId: string; quantity: number; unitPrice: number; unitCost: number; discount: number }[]>([])
  const [editPaymentStatus, setEditPaymentStatus] = useState("PARTIAL")
  const [editAmountPaid, setEditAmountPaid] = useState(0)
  const [editPaymentMethod, setEditPaymentMethod] = useState("CASH")
  const [editSaveAsDraft, setEditSaveAsDraft] = useState(false)
  
  const openEdit = (order: SalesOrder) => {
    setEditingOrder(order)
    setEditFormItems(order.items.map(item => ({
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost || item.variant?.costPrice || 0,
      discount: item.discount,
    })))
    setEditPaymentStatus(order.paymentStatus)
    setEditAmountPaid(order.amountPaid)
    setEditPaymentMethod(order.paymentMethod || "CASH")
    setEditSaveAsDraft(order.status === "DRAFT")
    setIsEditOpen(true)
    setViewOrder(null)
  }

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [resOrders, resCustomers, resProducts, resBranches] = await Promise.all([
        fetch("/api/sales-orders"),
        fetch("/api/customers"),
        fetch("/api/products"),
        role === "OWNER" ? fetch("/api/branches") : Promise.resolve(null)
      ])
      
      const dataOrders = await resOrders.json()
      const dataCustomers = await resCustomers.json()
      const dataProducts = await resProducts.json()
      
      if (resBranches) {
        const dataBranches = await resBranches.json()
        setBranches(dataBranches.branches || [])
      }
      
      setOrders(dataOrders.salesOrders || [])
      setCustomers(dataCustomers || [])
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allVars = (dataProducts.products || []).flatMap((p: any) => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p.variants || []).map((v: any) => ({ ...v, product: { name: p.name, price: p.price } }))
      )
      setVariants(allVars)
      
    } catch (error) {
      console.error("Failed to fetch data", error)
    } finally {
      setLoading(false)
    }
  }, [user?.branchId, role])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // R1 Calculations & Validations for Order Creation
  const orderCalculations = useMemo(() => {
    let subtotal = 0
    let totalDiscount = 0
    let totalCost = 0

    const itemValidations = formItems.map((item) => {
      const qty = Math.max(1, item.quantity || 1)
      const uPrice = Number(item.unitPrice) || 0
      const discount = Number(item.discount) || 0
      const unitCost = Number(item.unitCost) || 0
      const lineTotal = (qty * uPrice) - discount
      const effectiveSellingPrice = uPrice - (discount / qty)
      const isBelowCost = item.variantId !== "" && effectiveSellingPrice < unitCost

      const variant = variants.find(v => v.id === item.variantId)
      const retailPrice = variant?.product.price || 0
      const isAboveRetail = item.variantId !== "" && retailPrice > 0 && uPrice >= retailPrice

      // Calculate available stock for the origin branch
      const targetBranchId = newBranchId || user?.branchId || ""
      let availStock = 0
      if (variant && variant.stockLevels) {
        if (targetBranchId) {
          const sl = (variant.stockLevels as { branchId: string; quantity: number }[]).find((s) => s.branchId === targetBranchId)
          availStock = sl ? sl.quantity : 0
        } else {
          availStock = (variant.stockLevels as { branchId: string; quantity: number }[]).reduce((sum: number, s) => sum + (s.quantity || 0), 0)
        }
      }

      const isPreOrder = item.variantId !== "" && qty > availStock
      const shortQty = isPreOrder ? qty - availStock : 0

      if (item.variantId) {
        subtotal += qty * uPrice
        totalDiscount += discount
        totalCost += qty * unitCost
      }

      return {
        ...item,
        qty,
        uPrice,
        discount,
        unitCost,
        lineTotal,
        effectiveSellingPrice,
        retailPrice,
        availStock,
        isPreOrder,
        shortQty,
        isBelowCost,
        isAboveRetail
      }
    })

    const total = subtotal - totalDiscount
    const hasCostError = itemValidations.some(i => i.isBelowCost)
    const hasRetailError = itemValidations.some(i => i.isAboveRetail)
    const hasStockError = itemValidations.some(i => i.isPreOrder)
    const isOrderDraft = saveAsDraft

    return {
      subtotal,
      totalDiscount,
      total,
      totalCost,
      itemValidations,
      hasCostError,
      hasRetailError,
      hasStockError,
      isOrderDraft
    }
  }, [formItems, variants, newBranchId, user?.branchId, saveAsDraft])

  // R2 Payment Amount Sync for Create Form
  useEffect(() => {
    if (paymentStatus === "PAID") {
      setAmountPaid(orderCalculations.total)
    }
  }, [paymentStatus, orderCalculations.total])

  // R2 Payment Amount Validation for Create Form
  const paymentError = useMemo(() => {
    if (orderCalculations.isOrderDraft) return null
    if (paymentStatus === "PARTIAL") {
      if (amountPaid <= 0) {
        return "Partial payment amount must be greater than 0."
      }
      if (amountPaid > orderCalculations.total) {
        return `Partial payment amount (${amountPaid.toLocaleString()} Ks) cannot exceed total order price (${orderCalculations.total.toLocaleString()} Ks).`
      }
    }
    return null
  }, [paymentStatus, amountPaid, orderCalculations.total, orderCalculations.isOrderDraft])

  // Auto check saveAsDraft when out-of-stock items are detected
  useEffect(() => {
    if (orderCalculations.hasStockError) {
      setSaveAsDraft(true)
    }
  }, [orderCalculations.hasStockError])

  // Edit Form Calculations
  const editOrderCalculations = useMemo(() => {
    let subtotal = 0
    let totalDiscount = 0
    let totalCost = 0

    const itemValidations = editFormItems.map((item) => {
      const qty = Math.max(1, item.quantity || 1)
      const uPrice = Number(item.unitPrice) || 0
      const discount = Number(item.discount) || 0
      const unitCost = Number(item.unitCost) || 0
      const lineTotal = (qty * uPrice) - discount
      const effectiveSellingPrice = uPrice - (discount / qty)
      const isBelowCost = item.variantId !== "" && effectiveSellingPrice < unitCost

      const variant = variants.find(v => v.id === item.variantId)
      const retailPrice = variant?.product.price || 0
      const isAboveRetail = item.variantId !== "" && retailPrice > 0 && uPrice >= retailPrice

      // Calculate available stock for the origin branch
      const targetBranchId = editingOrder?.branchId || ""
      let availStock = 0
      if (variant && variant.stockLevels) {
        if (targetBranchId) {
          const sl = (variant.stockLevels as { branchId: string; quantity: number }[]).find((s) => s.branchId === targetBranchId)
          availStock = sl ? sl.quantity : 0
        } else {
          availStock = (variant.stockLevels as { branchId: string; quantity: number }[]).reduce((sum: number, s) => sum + (s.quantity || 0), 0)
        }
      }

      const isPreOrder = item.variantId !== "" && qty > availStock
      const shortQty = isPreOrder ? qty - availStock : 0

      if (item.variantId) {
        subtotal += qty * uPrice
        totalDiscount += discount
        totalCost += qty * unitCost
      }

      return {
        ...item,
        qty,
        uPrice,
        discount,
        unitCost,
        lineTotal,
        effectiveSellingPrice,
        retailPrice,
        availStock,
        isPreOrder,
        shortQty,
        isBelowCost,
        isAboveRetail
      }
    })

    const total = subtotal - totalDiscount
    const hasCostError = itemValidations.some(i => i.isBelowCost)
    const hasRetailError = itemValidations.some(i => i.isAboveRetail)
    const hasStockError = itemValidations.some(i => i.isPreOrder)
    const isOrderDraft = editSaveAsDraft

    return {
      subtotal,
      totalDiscount,
      total,
      totalCost,
      itemValidations,
      hasCostError,
      hasRetailError,
      hasStockError,
      isOrderDraft
    }
  }, [editFormItems, variants, editingOrder?.branchId, editSaveAsDraft])

  // Edit Form Payment Sync
  useEffect(() => {
    if (editPaymentStatus === "PAID") {
      setEditAmountPaid(editOrderCalculations.total)
    }
  }, [editPaymentStatus, editOrderCalculations.total])

  // Edit Form Payment Validation
  const editPaymentError = useMemo(() => {
    if (editOrderCalculations.isOrderDraft) return null
    if (editPaymentStatus === "PARTIAL") {
      if (editAmountPaid <= 0) {
        return "Partial payment amount must be greater than 0."
      }
      if (editAmountPaid > editOrderCalculations.total) {
        return `Partial payment amount (${editAmountPaid.toLocaleString()} Ks) cannot exceed total order price (${editOrderCalculations.total.toLocaleString()} Ks).`
      }
    }
    return null
  }, [editPaymentStatus, editAmountPaid, editOrderCalculations.total, editOrderCalculations.isOrderDraft])

  // Auto check editSaveAsDraft when out-of-stock items are detected in edit form
  useEffect(() => {
    if (editOrderCalculations.hasStockError) {
      setEditSaveAsDraft(true)
    }
  }, [editOrderCalculations.hasStockError])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    if (!editOrderCalculations.isOrderDraft && (editOrderCalculations.hasCostError || editPaymentError)) {
      return
    }
    setCreating(true)
    try {
      const finalItems = editOrderCalculations.itemValidations
        .filter(i => i.variantId)
        .map(i => ({
          variantId: i.variantId,
          quantity: i.qty,
          unitPrice: i.uPrice,
          unitCost: i.unitCost,
          discount: i.discount,
          total: i.lineTotal
        }))

      const res = await fetch(`/api/sales-orders/${editingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: finalItems,
          status: editOrderCalculations.isOrderDraft ? "DRAFT" : "CONFIRMED",
          paymentStatus: editPaymentStatus === "PAID" || (editAmountPaid >= editOrderCalculations.total && editOrderCalculations.total > 0) ? "PAID" : "PARTIAL",
          paymentMethod: editPaymentMethod,
          amountPaid: editPaymentStatus === "PAID" ? editOrderCalculations.total : editAmountPaid,
          subtotal: editOrderCalculations.subtotal,
          discount: editOrderCalculations.totalDiscount,
          total: editOrderCalculations.total,
        })
      })

      if (res.ok) {
        setIsEditOpen(false)
        setEditingOrder(null)
        fetchData()
      } else {
        const err = await res.json()
        setEditError(err.error || "Failed to update order")
      }
    } catch (error) {
      console.error(error)
      setEditError("An unexpected error occurred.")
    } finally {
      setCreating(false)
    }
  }

  const openCreate = () => {
    setCustomerId("")
    setNewBranchId(user?.branchId || branches[0]?.id || "")
    setFormItems([{ variantId: "", quantity: 1, unitPrice: 0, unitCost: 0, discount: 0 }])
    setPaymentStatus("PARTIAL")
    setAmountPaid(0)
    setPaymentMethod("CASH")
    setSaveAsDraft(false)
    setIsCreateOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderCalculations.isOrderDraft && (orderCalculations.hasCostError || paymentError)) {
      return
    }
    setCreating(true)
    try {
      const finalItems = orderCalculations.itemValidations
        .filter(i => i.variantId)
        .map(i => ({
          variantId: i.variantId,
          quantity: i.qty,
          unitPrice: i.uPrice,
          unitCost: i.unitCost,
          discount: i.discount,
          total: i.lineTotal
        }))

      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: role === "OWNER" && newBranchId ? newBranchId : user?.publicMetadata?.branchId,
          customerId: customerId || null,
          items: finalItems,
          status: orderCalculations.isOrderDraft ? "DRAFT" : "CONFIRMED",
          paymentStatus: paymentStatus === "PAID" || (amountPaid >= orderCalculations.total && orderCalculations.total > 0) ? "PAID" : "PARTIAL",
          paymentMethod: paymentMethod,
          amountPaid: paymentStatus === "PAID" ? orderCalculations.total : amountPaid,
          subtotal: orderCalculations.subtotal,
          discount: orderCalculations.totalDiscount,
          total: orderCalculations.total,
        })
      })

      if (res.ok) {
        setIsCreateOpen(false)
        fetchData()
      } else {
        const err = await res.json()
        setCreateError(err.error || "Failed to create order")
      }
    } catch (error) {
      console.error(error)
      setCreateError("An unexpected error occurred.")
    } finally {
      setCreating(false)
    }
  }

  const handleInitiateCancel = () => {
    if (!viewOrder) return;
    setCancelRefundAmount(viewOrder.amountPaid || 0);
    setCancelError(null);
    setCancelModalOpen(true);
  }

  const executeCancelOrder = async () => {
    if (!viewOrder) return;
    if (cancelRefundAmount < 0 || cancelRefundAmount > viewOrder.amountPaid) {
      setCancelError(`Refund amount must be between 0 and ${viewOrder.amountPaid.toLocaleString()} Ks`);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/sales-orders/${viewOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", refundAmount: cancelRefundAmount })
      });
      if (res.ok) {
        setCancelModalOpen(false);
        setViewOrder(null);
        fetchData();
      } else {
        const err = await res.json();
        setCancelError(err.error || "Failed to cancel order");
      }
    } catch {
      setCancelError("Failed to cancel order");
    } finally {
      setActionLoading(false);
    }
  }

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        setViewOrder(null)
        fetchData()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const markPaid = async (id: string, total: number) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "PAID", amountPaid: total })
      })
      if (res.ok) {
        setViewOrder(null)
        fetchData()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (o.customer?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter
      const matchesBranch = branchFilter === "ALL" || o.branchId === branchFilter
      return matchesSearch && matchesStatus && matchesBranch
    })
  }, [orders, searchQuery, statusFilter, branchFilter])

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (!role) return null

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-primary" />
            Sales Orders
          </h2>
          <p className="text-muted-foreground font-medium mt-1">
            Manage wholesale, deferred, and pre-orders.
          </p>
        </div>
        <Button onClick={openCreate} className="font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      <div className="flex items-center gap-4 py-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card font-medium"
          />
        </div>

        {role === "OWNER" && (
          <div className="w-[200px]">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("All Statuses", "အားလုံး")}</SelectItem>
              <SelectItem value="DRAFT">{t("Drafts & Pre-Orders", "ယာယီနှင့် ကြိုတင်မှာယူမှုများ")}</SelectItem>
              <SelectItem value="CONFIRMED">{t("Confirmed", "အတည်ပြုပြီး")}</SelectItem>
              <SelectItem value="COMPLETED">{t("Completed", "ပြီးစီးသည်")}</SelectItem>
              <SelectItem value="CANCELLED">{t("Cancelled", "ပယ်ဖျက်ပြီး")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-foreground">{t("ORDER ID", "အော်ဒါ အမှတ်")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("CUSTOMER", "ဝယ်သူ")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("DATE", "ရက်စွဲ")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("STATUS", "အခြေအနေ")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("PAYMENT", "ငွေပေးချေမှု")}</TableHead>
              <TableHead className="text-right font-bold text-foreground">{t("TOTAL PRICE", "စုစုပေါင်း ကျသင့်ငွေ")}</TableHead>
              <TableHead className="text-right font-bold text-foreground">{t("TOTAL COST", "စုစုပေါင်း ကုန်ကျစရိတ်")}</TableHead>
              <TableHead className="text-right font-bold text-foreground">{t("ACTIONS", "လုပ်ဆောင်ချက်များ")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground font-medium">
                  {t("No sales orders found.", "အရောင်းအမှာစာ ရှာမတွေ့ပါ။")}
                </TableCell>
              </TableRow>
            ) : (
            paginatedOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-bold text-xs font-mono">
                    {o.isPos ? "POS-" : "#"}{o.id.slice(-6).toUpperCase()}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {o.customer?.name || (o.isPos ? "Walk-in (POS)" : t("Walk-in", "လာရောက်ဝယ်ယူသူ"))}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-muted-foreground">
                    {format(new Date(o.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant={
                        o.status === "COMPLETED" ? "success" : 
                        o.status === "CONFIRMED" ? "warning" : 
                        o.status === "DRAFT" ? "outline" : "destructive"
                      } className={o.status === "DRAFT" ? "bg-muted text-muted-foreground border-border font-bold text-[10px]" : ""}>
                        {o.status}
                      </Badge>
                      {o.isDelivery && (
                        <Badge variant="outline" className={`text-[10px] font-bold flex items-center gap-1 ${o.deliveryStatus === "DELIVERED" ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" : "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10"}`}>
                          <Truck className="h-3 w-3" />
                          {o.deliveryStatus === "DELIVERED" ? "Delivered" : "Delivery"}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.paymentStatus === "PAID" ? "success" : "secondary"}>
                      {o.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {(o.total || 0).toLocaleString()} Ks
                  </TableCell>
                  <TableCell className="text-right font-semibold text-muted-foreground">
                    {(o.totalCost || 0).toLocaleString()} Ks
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setViewOrder(o)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={filteredOrders.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      {/* View Details Modal */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewOrder?.isPos ? "POS Transaction" : "Order"} #{viewOrder?.id.slice(-6).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {viewOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-muted/30 p-3 rounded-lg border">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Customer</p>
                  <p className="font-bold text-sm">{viewOrder.customer?.name || (viewOrder.isPos ? "Walk-in (POS)" : "None")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Status</p>
                  <Badge className="mt-1" variant={
                    viewOrder.status === "COMPLETED" ? "success" : 
                    viewOrder.status === "CONFIRMED" ? "warning" : "destructive"
                  }>
                    {viewOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Date</p>
                  <p className="font-semibold text-sm">{format(new Date(viewOrder.createdAt), "MMM d, yyyy HH:mm")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Payment Status</p>
                  <Badge className="mt-1" variant={viewOrder.paymentStatus === "PAID" ? "success" : "secondary"}>
                    {viewOrder.paymentStatus}
                  </Badge>
                </div>
                {viewOrder.paymentMethod && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">Payment Method</p>
                    <p className="font-semibold text-sm">{viewOrder.paymentMethod}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Amount Paid</p>
                  <p className="font-semibold text-sm">{(viewOrder.amountPaid || 0).toLocaleString()} Ks</p>
                </div>
                {viewOrder.branch?.name && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">Branch</p>
                    <p className="font-semibold text-sm">{viewOrder.branch.name}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold mb-2">Order Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewOrder.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {item.variant?.product?.name || "Product"}
                            {item.variant?.name ? ` - ${item.variant.name}` : ""}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.unitPrice.toLocaleString()} Ks</TableCell>
                          <TableCell className="text-right text-muted-foreground">{(item.unitCost || item.variant?.costPrice || 0).toLocaleString()} Ks</TableCell>
                          <TableCell className="text-right font-semibold">{item.total.toLocaleString()} Ks</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between items-center mt-4 p-3 bg-muted/20 rounded-lg border">
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">Total Cost Price: </span>
                    <span className="font-bold text-foreground">{(viewOrder.totalCost || 0).toLocaleString()} Ks</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">Total Sale Price: </span>
                    <span className="font-black text-lg text-primary">{(viewOrder.total || 0).toLocaleString()} Ks</span>
                  </div>
                </div>

                {viewOrder.paymentStatus !== "PAID" && (viewOrder.total - (viewOrder.amountPaid || 0)) > 0 && (
                  <div className="flex justify-between items-center mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <span className="font-bold text-red-600 dark:text-red-400">{t("Remaining Balance", "ကျန်ရှိသော ပမာဏ")}</span>
                    <span className="font-bold text-red-600 dark:text-red-400 text-lg">
                      {Math.max(0, viewOrder.total - viewOrder.amountPaid).toLocaleString()} Ks
                    </span>
                  </div>
                )}

                {/* Payment History Section */}
                {viewOrder.payments && viewOrder.payments.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <h4 className="font-bold text-sm mb-2 text-foreground flex items-center justify-between">
                      <span>{t("Payment History", "ငွေပေးချေမှု မှတ်တမ်း")}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        ({viewOrder.payments.length} {t("records", "ကြိမ်")})
                      </span>
                    </h4>
                    <div className="border rounded-lg overflow-hidden text-xs">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>{t("Date & Time", "ရက်စွဲ နှင့် အချိန်")}</TableHead>
                            <TableHead>{t("Method", "နည်းလမ်း")}</TableHead>
                            <TableHead>{t("Note", "မှတ်ချက်")}</TableHead>
                            <TableHead className="text-right">{t("Amount", "ပမာဏ")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewOrder.payments.map((p, idx) => (
                            <TableRow key={p.id || idx}>
                              <TableCell className="font-mono text-muted-foreground">
                                {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                  {p.method}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{p.note || "-"}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {p.amount.toLocaleString()} Ks
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t flex-wrap">
                {!viewOrder.isPos && viewOrder.status !== "DRAFT" && viewOrder.paymentStatus !== "PAID" && viewOrder.status !== "CANCELLED" && (
                  <Button 
                    onClick={() => markPaid(viewOrder.id, viewOrder.total)}
                    disabled={actionLoading}
                    variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                  >
                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                    Mark as Fully Paid
                  </Button>
                )}
                {!viewOrder.isPos && viewOrder.status === "DRAFT" && (
                  <Button 
                    onClick={() => openEdit(viewOrder)}
                    disabled={actionLoading}
                    className="bg-primary hover:bg-primary/90 text-white font-bold"
                  >
                    {t("Edit & Confirm Price", "ပြင်ဆင်ပြီး ဈေးနှုန်းသတ်မှတ်မည်")}
                  </Button>
                )}
                {!viewOrder.isPos && viewOrder.status !== "DRAFT" && viewOrder.status !== "COMPLETED" && viewOrder.status !== "CANCELLED" && (
                  <Button 
                    onClick={() => updateStatus(viewOrder.id, "COMPLETED")}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                    Mark as Delivered (Deduct Stock)
                  </Button>
                )}
                {!viewOrder.isPos && viewOrder.status !== "CANCELLED" && viewOrder.status !== "COMPLETED" && (
                  <Button 
                    variant="destructive"
                    onClick={handleInitiateCancel}
                    disabled={actionLoading}
                  >
                    Cancel Order
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Order & Refund Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("Cancel Sales Order & Process Refund", "အမှာစာ ပယ်ဖျက်၍ ပြန်အမ်းငွေ သတ်မှတ်ရန်")}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {t("Are you sure you want to cancel this sales order?", "ဤအရောင်းအမှာစာအား ပယ်ဖျက်ရန် သေချာပါသလား။")}
              {viewOrder && viewOrder.amountPaid > 0 && (
                <span className="block mt-1 font-semibold text-foreground">
                  {t(`Total Amount Paid: ${viewOrder.amountPaid.toLocaleString()} Ks`, `စုစုပေါင်း ပေးချေထားသော ပမာဏ - ${viewOrder.amountPaid.toLocaleString()} ကျပ်`)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {cancelError && (
            <div className="p-3 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              {cancelError}
            </div>
          )}

          {viewOrder && viewOrder.amountPaid > 0 && (
            <div className="space-y-2 py-2 border-t border-b border-border my-2">
              <label className="text-xs font-bold text-foreground block">
                {t("Refund Amount to Customer (Ks)", "ဝယ်သူသို့ ပြန်အမ်းမည့် ပမာဏ (ကျပ်)")}
              </label>
              <Input
                type="number"
                value={cancelRefundAmount}
                onChange={(e) => setCancelRefundAmount(Number(e.target.value))}
                placeholder="0"
                min={0}
                max={viewOrder.amountPaid}
                className="font-mono text-base"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("Enter 0 if you want to retain the amount as a non-refundable cancellation fee.", "ငွေပြန်မအမ်းဘဲ ပယ်ဖျက်ကြေးအဖြစ် သိမ်းဆည်းလိုပါက 0 ထည့်ပါ။")}
              </p>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCancelModalOpen(false)}>
              {t("Cancel", "မလုပ်တော့ပါ")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={executeCancelOrder}
              disabled={actionLoading}
              className="font-bold"
            >
              {actionLoading ? "Processing..." : t("Confirm Cancel", "အမှာစာ ပယ်ဖျက်မည်")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          <div id="dialog-portal-root" className="absolute inset-0 pointer-events-none z-[99999]" />
          <div className="flex-1 overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{t("Create Sales Order", "အရောင်းအမှာစာ အသစ်ပြုလုပ်ရန်")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
            
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("Select Customer", "ဝယ်သူ ရွေးချယ်ရန်")}</label>
              <SearchableSelect 
                items={customers}
                value={customerId}
                onChange={setCustomerId}
                placeholder={t("-- Walk-in Customer --", "-- လာရောက်ဝယ်ယူသူ --")}
                searchPlaceholder={t("Search customer...", "ဝယ်သူ ရှာဖွေရန်...")}
                renderItem={(c) => c.name}
                filterItem={(c, search) => c.name.toLowerCase().includes(search)}
              />
            </div>

            {role === "OWNER" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("Origin Branch", "ထွက်ရှိမည့် ဆိုင်ခွဲ")}</label>
                <SearchableSelect 
                  items={branches}
                  value={newBranchId}
                  onChange={setNewBranchId}
                  placeholder={t("-- Select Origin Branch --", "-- ဆိုင်ခွဲ ရွေးချယ်ရန် --")}
                  searchPlaceholder={t("Search branch...", "ဆိုင်ခွဲ ရှာဖွေရန်...")}
                  renderItem={(b) => b.name}
                  filterItem={(b, search) => b.name.toLowerCase().includes(search)}
                />
              </div>
            )}

            <div className="flex items-center gap-2 bg-muted/20 p-3 rounded-lg border border-border/80">
              <input 
                type="checkbox" 
                id="saveAsDraft" 
                checked={saveAsDraft} 
                onChange={(e) => setSaveAsDraft(e.target.checked)} 
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="saveAsDraft" className="text-sm font-bold text-foreground cursor-pointer select-none">
                {t("Save as Draft", "ယာယီအဖြစ် သိမ်းဆည်းမည် (ဈေးနှုန်းနှင့် စတော့ ကန့်သတ်ချက်များ ကျော်လွှားမည်)")}
              </label>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-bold flex items-center justify-between">
                <span>{t("Order Items", "အမှာစာ ပစ္စည်းများ")}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setFormItems([...formItems, { variantId: "", quantity: 1, unitPrice: 0, unitCost: 0, discount: 0 }])} className="h-8 text-xs font-bold gap-1">
                  <Plus className="h-3.5 w-3.5" /> {t("Add Row", "တန်းအသစ်ထည့်ရန်")}
                </Button>
              </div>
              <div className="overflow-x-auto border border-border rounded-xl bg-muted/10 p-2">
                <div className="min-w-[850px]">
                  <div className="grid grid-cols-[minmax(220px,3.5fr)_85px_100px_100px_120px_95px_110px_36px] gap-2.5 items-center px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground tracking-wider border-b border-border/50">
                    <div>{t("Product Variant", "ပစ္စည်းအမျိုးအစား")}</div>
                    <div className="text-center">{t("Qty", "အရေအတွက်")}</div>
                    <div className="text-right">{t("Cost Price", "ဝယ်ရင်းဈေး")}</div>
                    <div className="text-right">{t("Retail Price", "ရောင်းဈေး")}</div>
                    <div className="text-right">{t("Selling Price", "လက်ကားရောင်းဈေး")}</div>
                    <div className="text-right">{t("Discount", "လျှော့ဈေး")}</div>
                    <div className="text-right">{t("Total", "စုစုပေါင်း")}</div>
                    <div></div>
                  </div>
                  <div className="space-y-2 mt-2">
                    {orderCalculations.itemValidations.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className={`grid grid-cols-[minmax(220px,3.5fr)_85px_100px_100px_120px_95px_110px_36px] gap-2.5 items-center p-2.5 rounded-lg border shadow-sm transition-all ${item.isBelowCost || item.isAboveRetail ? 'border-destructive/60 bg-destructive/10' : 'bg-card border-border hover:border-muted-foreground/30'}`}>
                          <div className="min-w-0">
                            <SearchableSelect 
                              items={variants}
                              value={item.variantId}
                              onChange={val => {
                                const next = [...formItems]
                                const variant = variants.find(v => v.id === val)
                                next[idx].variantId = val
                                if (variant && variant.product?.price !== undefined) {
                                  next[idx].unitPrice = variant.product.price
                                  next[idx].unitCost = variant.costPrice || 0
                                }
                                setFormItems(next)
                              }}
                              placeholder={t("-- Select Product Variant --", "-- ပစ္စည်းရွေးချယ်ရန် --")}
                              searchPlaceholder={t("Search by name or barcode...", "အမည် သို့မဟုတ် ဘားကုဒ်ဖြင့် ရှာရန်...")}
                              renderItem={(v: ProductVariant & { product: { name: string; price: number }; stockLevels?: { branchId: string; quantity: number }[] }) => {
                                const targetBranchId = newBranchId || user?.branchId || ""
                                let stock = 0
                                if (v.stockLevels) {
                                  if (targetBranchId) {
                                    const sl = v.stockLevels.find((s: { branchId: string; quantity: number }) => s.branchId === targetBranchId)
                                    stock = sl ? sl.quantity : 0
                                  } else {
                                    stock = v.stockLevels.reduce((sum: number, s: { branchId: string; quantity: number }) => sum + (s.quantity || 0), 0)
                                  }
                                }
                                return `${v.product.name} - ${v.name} (${t("Stock", "လက်ကျန်")}: ${stock} Pcs)`
                              }}
                              filterItem={(v, search) => 
                                v.product.name.toLowerCase().includes(search) || 
                                v.name.toLowerCase().includes(search) ||
                                (v.barcode || "").toLowerCase().includes(search)
                              }
                            />
                            {item.variantId !== "" && (
                              <p className="text-[10px] text-muted-foreground font-semibold mt-1 pl-1">
                                {t("Stock Quantity", "လက်ကျန်စတော့")}: <span className="font-bold text-foreground">{item.availStock} Pcs</span>
                              </p>
                            )}
                          </div>
                          <div>
                            <Input 
                              type="number" min="1" required placeholder="1"
                              value={item.quantity || ""}
                              onChange={e => {
                                const next = [...formItems]
                                const qty = Number(e.target.value)
                                next[idx].quantity = qty
                                const variant = variants.find(v => v.id === item.variantId)
                                if (variant) {
                                  const targetBranchId = newBranchId || user?.branchId || ""
                                  let availStock = 0
                                  if (variant.stockLevels) {
                                    if (targetBranchId) {
                                      const sl = (variant.stockLevels as { branchId: string; quantity: number }[]).find((s) => s.branchId === targetBranchId)
                                      availStock = sl ? sl.quantity : 0
                                    } else {
                                      availStock = (variant.stockLevels as { branchId: string; quantity: number }[]).reduce((sum, s) => sum + (s.quantity || 0), 0)
                                    }
                                  }
                                  if (qty <= availStock && variant.product?.price !== undefined) {
                                    next[idx].unitPrice = variant.product.price
                                  }
                                }
                                setFormItems(next)
                              }}
                              className="w-full text-center px-1.5 h-9 font-bold text-sm bg-background border-border"
                            />
                          </div>
                          <div className="text-right text-xs font-semibold text-muted-foreground px-1 truncate" title={item.variantId ? `${(item.unitCost || 0).toLocaleString()} Ks` : ""}>
                            {item.variantId ? `${(item.unitCost || 0).toLocaleString()} Ks` : "-"}
                          </div>
                          <div className="text-right text-xs font-semibold text-muted-foreground px-1 truncate" title={item.variantId ? `${(item.retailPrice || 0).toLocaleString()} Ks` : ""}>
                            {item.variantId ? `${(item.retailPrice || 0).toLocaleString()} Ks` : "-"}
                          </div>
                          <div>
                            <Input 
                              type="number" min="0" required placeholder="Price"
                              value={item.unitPrice === 0 ? "" : item.unitPrice}
                              onChange={e => {
                                const next = [...formItems]; next[idx].unitPrice = Number(e.target.value); setFormItems(next)
                              }}
                              className={`w-full text-right px-2 h-9 font-semibold text-sm bg-background ${item.isAboveRetail ? 'text-destructive font-bold border-destructive' : 'border-border'}`}
                            />
                          </div>
                          <div>
                            <Input 
                              type="number" min="0" placeholder="0"
                              value={item.discount === 0 ? "" : item.discount}
                              onChange={e => {
                                const next = [...formItems]; next[idx].discount = Number(e.target.value); setFormItems(next)
                              }}
                              className="w-full text-right px-2 h-9 text-sm bg-background border-border"
                            />
                          </div>
                          <div className="text-right font-black text-sm text-foreground whitespace-nowrap px-1">
                            {item.variantId ? `${(item.lineTotal || 0).toLocaleString()} Ks` : "-"}
                          </div>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" type="button" onClick={() => {
                              const next = [...formItems]
                              next.splice(idx, 1)
                              setFormItems(next.length ? next : [{ variantId: "", quantity: 1, unitPrice: 0, unitCost: 0, discount: 0 }])
                            }} className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {item.isBelowCost && (
                          <p className="text-xs text-destructive font-semibold flex items-center gap-1 pl-2 pt-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {t("Validation Error: Effective selling price", "အမှား: လက်ရှိရောင်းဈေး")} ({item.effectiveSellingPrice.toLocaleString()} Ks) {t("is lower than cost price", "သည် ဝယ်ရင်းဈေးထက် နည်းနေပါသည်။")} ({item.unitCost.toLocaleString()} Ks).
                          </p>
                        )}
                        {item.isPreOrder && (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between mt-1">
                            <span className="flex items-center gap-1.5 font-bold">
                              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                              {t("Pre-Order Notice: Requested Qty", "ကြိုတင်မှာယူမှု အသိပေးချက်: မှာယူသော အရေအတွက်")} ({item.qty} Pcs) {t("exceeds available stock", "သည် လက်ကျန်ထက် ကျော်လွန်နေပါသည်။")} ({item.availStock} Pcs). {t("This order will be saved as a Pre-Order.", "ဤမှာယူမှုကို ကြိုတင်အမှာစာ/ယာယီမှာယူမှုအဖြစ် သိမ်းဆည်းပါမည်။")}
                            </span>
                            <Badge variant="outline" className="text-[11px] font-bold px-2 py-0.5 shrink-0 bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                              {item.shortQty} Pcs {t("Short", "လိုနေသည်")}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Order Totals Summary */}
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border">
              <div>
                <span className="text-sm font-semibold text-muted-foreground">{t("Total Cost Price", "စုစုပေါင်း အရင်းတန်ဖိုး")}: </span>
                <span className="font-bold text-foreground">{orderCalculations.totalCost.toLocaleString()} Ks</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-muted-foreground">{t("Total Order Price", "စုစုပေါင်း ကျသင့်ငွေ")}: </span>
                <span className="font-black text-lg text-primary">{orderCalculations.total.toLocaleString()} Ks</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("Payment Status", "ငွေပေးချေမှု အခြေအနေ")}</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg border bg-card text-sm font-medium"
                  value={paymentStatus}
                  onChange={e => {
                    setPaymentStatus(e.target.value)
                    if (e.target.value === "PAID") {
                      setAmountPaid(orderCalculations.total)
                    }
                  }}
                >
                  <option value="PARTIAL">{t("PARTIAL", "အပိုင်းလိုက် ပေးချေမည်")}</option>
                  <option value="PAID">{t("FULL (PAID)", "အပြည့်အဝ ပေးချေပြီး")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("Amount Paid", "ပေးချေသော ငွေပမာဏ")}</label>
                <Input 
                  type="number" min="0" required
                  value={paymentStatus === "PAID" ? orderCalculations.total : (amountPaid === 0 ? 0 : (amountPaid || ""))}
                  disabled={paymentStatus === "PAID"}
                  readOnly={paymentStatus === "PAID"}
                  onChange={e => setAmountPaid(Number(e.target.value))}
                  className={paymentError && !orderCalculations.isOrderDraft ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {orderCalculations.isOrderDraft ? (
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">
                    {t("(Draft Order: Default is 0 Ks. Advance deposit can be entered)", "(ယာယီမှာယူမှု: ပုံမှန်အားဖြင့် 0 ကျပ်ဖြစ်ပြီး စရန်ငွေ ထည့်သွင်းနိုင်ပါသည်)")}
                  </p>
                ) : paymentError && (
                  <p className="text-xs text-destructive font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {paymentError}
                  </p>
                )}
              </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">{t("Payment Method", "ငွေပေးချေသည့် နည်းလမ်း")}</label>
                    <select 
                      className="w-full h-10 px-3 rounded-lg border bg-card text-sm font-medium"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">{t("Cash", "ငွေသား")}</option>
                      <option value="CARD">{t("Card", "ကတ်")}</option>
                      <option value="TRANSFER">{t("Transfer", "ဘဏ်လွှဲ")}</option>
                    </select>
                  </div>
            </div>

            {orderCalculations.isOrderDraft && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {t("Pre-Order/Draft Mode: One or more items are out of stock (or Save as Draft is checked). This order will be saved as a Draft/Pre-order.", "ယာယီ/ကြိုတင်မှာယူမှုအဆင့်: စတော့မရှိသောကုန်ပစ္စည်းများပါဝင်သဖြင့် ယာယီမှာယူမှုအဖြစ် သိမ်းဆည်းပါမည်။")}
              </div>
            )}

            {!orderCalculations.isOrderDraft && orderCalculations.hasCostError && (
              <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {t("Cannot save order: One or more items are being sold below their cost price.", "အမှာစာ သိမ်းဆည်း၍မရပါ: အရင်းဈေးအောက် လျှော့ရောင်းထားသော ပစ္စည်းများ ရှိနေပါသည်။")}
              </div>
            )}
            {orderCalculations.hasRetailError && (
              <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {t("Cannot save order: Selling price must be strictly less than the standard retail price for wholesales.", "အမှာစာ သိမ်းဆည်း၍မရပါ: လက်ကားရောင်းဈေးသည် ပုံမှန်ရောင်းဈေးထက် နည်းရပါမည်။")}
              </div>
            )}
            {!orderCalculations.isOrderDraft && orderCalculations.hasStockError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                {t("Pre-Order Notice: One or more items exceed available stock. This order will be saved as a Pre-Order.", "ကြိုတင်အမှာစာ အသိပေးချက်: လက်ကျန်ထက် ကျော်လွန်နေသော ပစ္စည်းများ ရှိနေပါသဖြင့် ဤအမှာစာကို ယာယီမှာယူမှုအဖြစ် သိမ်းဆည်းပါမည်။")}
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>{t("Cancel", "ပယ်ဖျက်မည်")}</Button>
              <Button type="submit" disabled={creating || (!orderCalculations.isOrderDraft && orderCalculations.hasCostError) || orderCalculations.hasRetailError || (!orderCalculations.isOrderDraft && paymentError !== null)}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Save Sales Order", "အရောင်းအမှာစာ သိမ်းဆည်းမည်")}
              </Button>
            </DialogFooter>
          </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{t("Edit & Confirm Sales Order", "ယာယီအရောင်းအမှာစာ ပြင်ဆင်ပြီး အတည်ပြုရန်")} #{editingOrder?.id.slice(-6).toUpperCase()}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              
              <div className="flex items-center gap-2 bg-muted/20 p-3 rounded-lg border border-border/80">
                <input 
                  type="checkbox" 
                  id="editSaveAsDraft" 
                  checked={editSaveAsDraft} 
                  onChange={(e) => setEditSaveAsDraft(e.target.checked)} 
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="editSaveAsDraft" className="text-sm font-bold text-foreground cursor-pointer select-none">
                  {t("Keep as Draft", "ယာယီ/ကြိုတင်မှာယူမှုအဖြစ် ဆက်လက်ထားရှိမည် (ဈေးနှုန်းနှင့် စတော့ ကန့်သတ်ချက်များ ကျော်လွှားမည်)")}
                </label>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-bold flex items-center justify-between">
                  <span>{t("Order Items", "အမှာစာ ပစ္စည်းများ")}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditFormItems([...editFormItems, { variantId: "", quantity: 1, unitPrice: 0, unitCost: 0, discount: 0 }])} className="h-8 text-xs font-bold gap-1">
                    <Plus className="h-3.5 w-3.5" /> {t("Add Row", "တန်းအသစ်ထည့်ရန်")}
                  </Button>
                </div>
                <div className="overflow-x-auto border border-border rounded-xl bg-muted/10 p-2">
                  <div className="min-w-[850px]">
                    <div className="grid grid-cols-[minmax(220px,3.5fr)_85px_100px_100px_120px_95px_110px_36px] gap-2.5 items-center px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground tracking-wider border-b border-border/50">
                      <div>{t("Product Variant", "ပစ္စည်းအမျိုးအစား")}</div>
                      <div className="text-center">{t("Qty", "အရေအတွက်")}</div>
                      <div className="text-right">{t("Cost Price", "ဝယ်ရင်းဈေး")}</div>
                      <div className="text-right">{t("Retail Price", "ရောင်းဈေး")}</div>
                      <div className="text-right">{t("Selling Price", "လက်ကားရောင်းဈေး")}</div>
                      <div className="text-right">{t("Discount", "လျှော့ဈေး")}</div>
                      <div className="text-right">{t("Total", "စုစုပေါင်း")}</div>
                      <div></div>
                    </div>
                    <div className="space-y-2 mt-2">
                      {editOrderCalculations.itemValidations.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className={`grid grid-cols-[minmax(220px,3.5fr)_85px_100px_100px_120px_95px_110px_36px] gap-2.5 items-center p-2.5 rounded-lg border shadow-sm transition-all ${item.isBelowCost || item.isAboveRetail ? 'border-destructive/60 bg-destructive/10' : 'bg-card border-border hover:border-muted-foreground/30'}`}>
                            <div className="min-w-0">
                              <SearchableSelect 
                                items={variants}
                                value={item.variantId}
                                onChange={val => {
                                  const next = [...editFormItems]
                                  const variant = variants.find(v => v.id === val)
                                  next[idx].variantId = val
                                  if (variant && variant.product?.price !== undefined) {
                                    next[idx].unitPrice = variant.product.price
                                    next[idx].unitCost = variant.costPrice || 0
                                  }
                                  setEditFormItems(next)
                                }}
                                placeholder={t("-- Select Product Variant --", "-- ပစ္စည်းရွေးချယ်ရန် --")}
                                searchPlaceholder={t("Search by name or barcode...", "အမည် သို့မဟုတ် ဘားကုဒ်ဖြင့် ရှာရန်...")}
                                renderItem={(v) => {
                                  const targetBranchId = editingOrder?.branchId || ""
                                  let stock = 0
                                  if (v.stockLevels) {
                                    if (targetBranchId) {
                                      const sl = v.stockLevels.find((s) => s.branchId === targetBranchId)
                                      stock = sl ? sl.quantity : 0
                                    } else {
                                      stock = v.stockLevels.reduce((sum, s) => sum + (s.quantity || 0), 0)
                                    }
                                  }
                                  return `${v.product.name} - ${v.name} (${t("Stock", "လက်ကျန်")}: ${stock} Pcs)`
                                }}
                                filterItem={(v, search) => 
                                  v.product.name.toLowerCase().includes(search) || 
                                  v.name.toLowerCase().includes(search) ||
                                  (v.barcode || "").toLowerCase().includes(search)
                                }
                              />
                              {item.variantId !== "" && (
                                <p className="text-[10px] text-muted-foreground font-semibold mt-1 pl-1">
                                  {t("Stock Quantity", "လက်ကျန်စတော့")}: <span className="font-bold text-foreground">{item.availStock} Pcs</span>
                                </p>
                              )}
                            </div>
                            <div>
                              <Input 
                                type="number" min="1" required placeholder="1"
                                value={item.quantity || ""}
                                onChange={e => {
                                  const next = [...editFormItems]
                                  const qty = Number(e.target.value)
                                  next[idx].quantity = qty
                                  const variant = variants.find(v => v.id === item.variantId)
                                  if (variant) {
                                    const targetBranchId = editingOrder?.branchId || ""
                                    let availStock = 0
                                    if (variant.stockLevels) {
                                      if (targetBranchId) {
                                        const sl = (variant.stockLevels as { branchId: string; quantity: number }[]).find((s) => s.branchId === targetBranchId)
                                        availStock = sl ? sl.quantity : 0
                                      } else {
                                        availStock = (variant.stockLevels as { branchId: string; quantity: number }[]).reduce((sum, s) => sum + (s.quantity || 0), 0)
                                      }
                                    }
                                    if (qty <= availStock && variant.product?.price !== undefined) {
                                      next[idx].unitPrice = variant.product.price
                                    }
                                  }
                                  setEditFormItems(next)
                                }}
                                className="w-full text-center px-1.5 h-9 font-bold text-sm bg-background border-border"
                              />
                            </div>
                            <div className="text-right text-xs font-semibold text-muted-foreground px-1 truncate" title={item.variantId ? `${(item.unitCost || 0).toLocaleString()} Ks` : ""}>
                              {item.variantId ? `${(item.unitCost || 0).toLocaleString()} Ks` : "-"}
                            </div>
                            <div className="text-right text-xs font-semibold text-muted-foreground px-1 truncate" title={item.variantId ? `${(item.retailPrice || 0).toLocaleString()} Ks` : ""}>
                              {item.variantId ? `${(item.retailPrice || 0).toLocaleString()} Ks` : "-"}
                            </div>
                            <div>
                              <Input 
                                type="number" min="0" required placeholder="Price"
                                value={item.unitPrice === 0 ? "" : item.unitPrice}
                                onChange={e => {
                                  const next = [...editFormItems]; next[idx].unitPrice = Number(e.target.value); setEditFormItems(next)
                                }}
                                className={`w-full text-right px-2 h-9 font-semibold text-sm bg-background ${item.isAboveRetail ? 'text-destructive font-bold border-destructive' : 'border-border'}`}
                              />
                            </div>
                            <div>
                              <Input 
                                type="number" min="0" placeholder="0"
                                value={item.discount === 0 ? "" : item.discount}
                                onChange={e => {
                                  const next = [...editFormItems]; next[idx].discount = Number(e.target.value); setEditFormItems(next)
                                }}
                                className="w-full text-right px-2 h-9 text-sm bg-background border-border"
                              />
                            </div>
                            <div className="text-right font-black text-sm text-foreground whitespace-nowrap px-1">
                              {item.variantId ? `${(item.lineTotal || 0).toLocaleString()} Ks` : "-"}
                            </div>
                            <div className="flex justify-end">
                              <Button variant="ghost" size="icon" type="button" onClick={() => {
                                const next = [...editFormItems]
                                next.splice(idx, 1)
                                setEditFormItems(next.length ? next : [{ variantId: "", quantity: 1, unitPrice: 0, unitCost: 0, discount: 0 }])
                              }} className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {item.isBelowCost && !editOrderCalculations.isOrderDraft && (
                            <p className="text-xs text-destructive font-semibold flex items-center gap-1 pl-2 pt-1">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {t("Validation Error: Effective selling price", "အမှား: လက်ရှိရောင်းဈေး")} ({item.effectiveSellingPrice.toLocaleString()} Ks) {t("is lower than cost price", "သည် ဝယ်ရင်းဈေးထက် နည်းနေပါသည်။")} ({item.unitCost.toLocaleString()} Ks).
                            </p>
                          )}
                          {item.isPreOrder && (
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between mt-1">
                              <span className="flex items-center gap-1.5 font-bold">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                                {t("Pre-Order Notice: Requested Qty", "ကြိုတင်မှာယူမှု အသိပေးချက်: မှာယူသော အရေအတွက်")} ({item.qty} Pcs) {t("exceeds available stock", "သည် လက်ကျန်ထက် ကျော်လွန်နေပါသည်။")} ({item.availStock} Pcs). {t("This order will be saved as a Pre-Order / Draft.", "ဤမှာယူမှုကို ကြိုတင်အမှာစာ/ယာယီမှာယူမှုအဖြစ် သိမ်းဆည်းပါမည်။")}
                              </span>
                              <Badge variant="outline" className="text-[11px] font-bold px-2 py-0.5 shrink-0 bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                                {item.shortQty} Pcs {t("Short", "လိုနေသည်")}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Totals Summary */}
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border">
                <div>
                  <span className="text-sm font-semibold text-muted-foreground">{t("Total Cost Price", "စုစုပေါင်း အရင်းတန်ဖိုး")}: </span>
                  <span className="font-bold text-foreground">{editOrderCalculations.totalCost.toLocaleString()} Ks</span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-muted-foreground">{t("Total Order Price", "စုစုပေါင်း ကျသင့်ငွေ")}: </span>
                  <span className="font-black text-lg text-primary">{editOrderCalculations.total.toLocaleString()} Ks</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{t("Payment Status", "ငွေပေးချေမှု အခြေအနေ")}</label>
                  <select 
                    className="w-full h-10 px-3 rounded-lg border bg-card text-sm font-medium"
                    value={editPaymentStatus}
                    onChange={e => {
                      setEditPaymentStatus(e.target.value)
                      if (e.target.value === "PAID") {
                        setEditAmountPaid(editOrderCalculations.total)
                      }
                    }}
                  >
                    <option value="PARTIAL">{t("PARTIAL", "အပိုင်းလိုက် ပေးချေမည်")}</option>
                    <option value="PAID">{t("FULL (PAID)", "အပြည့်အဝ ပေးချေပြီး")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">{t("Amount Paid", "ပေးချေသော ငွေပမာဏ")}</label>
                  <Input 
                    type="number" min="0" required
                    value={editPaymentStatus === "PAID" ? editOrderCalculations.total : (editAmountPaid === 0 ? 0 : (editAmountPaid || ""))}
                    disabled={editPaymentStatus === "PAID"}
                    readOnly={editPaymentStatus === "PAID"}
                    onChange={e => setEditAmountPaid(Number(e.target.value))}
                    className={editPaymentError && !editOrderCalculations.isOrderDraft ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {editOrderCalculations.isOrderDraft ? (
                    <p className="text-[11px] text-muted-foreground font-medium mt-1">
                      {t("(Draft Order: Default is 0 Ks. Advance deposit can be entered)", "(ယာယီမှာယူမှု: ပုံမှန်အားဖြင့် 0 ကျပ်ဖြစ်ပြီး စရန်ငွေ ထည့်သွင်းနိုင်ပါသည်)")}
                    </p>
                  ) : editPaymentError && (
                    <p className="text-xs text-destructive font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {editPaymentError}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{t("Payment Method", "ငွေပေးချေသည့် နည်းလမ်း")}</label>
                  <select 
                    className="w-full h-10 px-3 rounded-lg border bg-card text-sm font-medium"
                    value={editPaymentMethod}
                    onChange={e => setEditPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">{t("Cash", "ငွေသား")}</option>
                    <option value="CARD">{t("Card", "ကတ်")}</option>
                    <option value="TRANSFER">{t("Transfer", "ဘဏ်လွှဲ")}</option>
                  </select>
                </div>
              </div>

              {editOrderCalculations.isOrderDraft && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {t("Pre-Order/Draft Mode: One or more items are out of stock (or Keep as Draft is checked). Order will remain as a Draft/Pre-order.", "ယာယီ/ကြိုတင်မှာယူမှုအဆင့်: စတော့မရှိသောကုန်ပစ္စည်းများပါဝင်သဖြင့် ယာယီမှာယူမှုအဖြစ် ဆက်လက်ထားရှိပါမည်။")}
                </div>
              )}

              {!editOrderCalculations.isOrderDraft && editOrderCalculations.hasCostError && (
                <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {t("Cannot save order: One or more items are being sold below their cost price.", "အမှာစာ သိမ်းဆည်း၍မရပါ: အရင်းဈေးအောက် လျှော့ရောင်းထားသော ပစ္စည်းများ ရှိနေပါသည်။")}
                </div>
              )}
              {editOrderCalculations.hasRetailError && (
                <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {t("Cannot save order: Selling price must be strictly less than the standard retail price for wholesales.", "အမှာစာ သိမ်းဆည်း၍မရပါ: လက်ကားရောင်းဈေးသည် ပုံမှန်ရောင်းဈေးထက် နည်းရပါမည်။")}
                </div>
              )}
              {!editOrderCalculations.isOrderDraft && editOrderCalculations.hasStockError && (
                <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {t("Cannot save order: One or more items exceed available stock. Pre-orders are disabled. Please restock via Purchase first.", "အမှာစာ သိမ်းဆည်း၍မရပါ: လက်ကျန်ထက် ကျော်လွန်နေသော ပစ္စည်းများ ရှိနေပါသည်။ ရှေးဦးစွာ ကုန်ပစ္စည်း ဖြည့်သွင်းပါ။")}
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>{t("Cancel", "ပယ်ဖျက်မည်")}</Button>
                <Button type="submit" disabled={creating || (!editOrderCalculations.isOrderDraft && (editOrderCalculations.hasCostError || editOrderCalculations.hasStockError)) || editOrderCalculations.hasRetailError || (!editOrderCalculations.isOrderDraft && editPaymentError !== null)}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Update & Confirm Order", "အမှာစာ အတည်ပြုသိမ်းဆည်းမည်")}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
