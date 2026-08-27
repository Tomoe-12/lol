"use client"

import * as React from "react"
import { Search, Loader2, PackageCheck, Truck, Plus, Trash2, Building2, User, UserCheck } from "lucide-react"
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
  price?: number
  costPrice?: number
  variants: ProductVariant[]
}

interface PurchaseItem {
  id: string
  variantId: string
  variant: {
    id: string
    name: string
    barcode: string
    product: Product
  }
  quantity: number
  unitCost: number
  sellingPrice: number
  total: number
}

interface PurchaseOrder {
  id: string
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED"
  totalCost: number
  paymentStatus: "NO_PAY" | "PARTIAL" | "PAID"
  amountPaid: number
  cashFlowAmount: number
  refundAmount: number
  supplierCredit: number
  arrivalDate: string | null
  voucherNumber: string | null
  note: string | null
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
  const [selectedBranchFilter, setSelectedBranchFilter] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // Reset page when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, historyFilter, selectedBranchFilter])
  
  // Receive state
  const [selectedOrder, setSelectedOrder] = React.useState<PurchaseOrder | null>(null)
  const [editOrder, setEditOrder] = React.useState<PurchaseOrder | null>(null)
  const [editItems, setEditItems] = React.useState<{ id: string; quantity: number; unitCost: number; sellingPrice: number }[]>([])
  const [editPaymentStatus, setEditPaymentStatus] = React.useState<"NO_PAY" | "PARTIAL" | "PAID">("NO_PAY")
  const [additionalPayment, setAdditionalPayment] = React.useState(0)
  const [editArrivalDate, setEditArrivalDate] = React.useState("")
  const [editVoucherNumber, setEditVoucherNumber] = React.useState("")
  const [viewOrder, setViewOrder] = React.useState<PurchaseOrder | null>(null)
  const [cancelOrderConfirm, setCancelOrderConfirm] = React.useState<PurchaseOrder | null>(null)
  const [receiveItems, setReceiveItems] = React.useState<{id: string; quantity: number; unitCost: number; sellingPrice: number}[]>([])
  const [receiveRefundAmount, setReceiveRefundAmount] = React.useState(0)
  const [receiveLoading, setReceiveLoading] = React.useState(false)
  const [cancelLoading, setCancelLoading] = React.useState(false)
  const [cancelRefund, setCancelRefund] = React.useState(0)

  // Create state
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = React.useState(false)
  const [newSupplierId, setNewSupplierId] = React.useState("")
  const [newBranchId, setNewBranchId] = React.useState("")
  const [newNote, setNewNote] = React.useState("")
  const [newPaymentStatus, setNewPaymentStatus] = React.useState<"NO_PAY" | "PARTIAL" | "PAID">("NO_PAY")
  const [newAmountPaid, setNewAmountPaid] = React.useState(0)
  const [newArrivalDate, setNewArrivalDate] = React.useState("")
  const [newVoucherNumber, setNewVoucherNumber] = React.useState("")
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
  const canSubmitCreate = React.useMemo(() => {
    const validItems = formItems.length > 0 && formItems.every((item) => {
      const quantity = Number(item.quantity)
      const unitCost = Number(item.unitCost)
      const sellingPrice = Number(item.sellingPrice)
      return Boolean(item.variantId) && Number.isInteger(quantity) && quantity > 0 && Number.isFinite(unitCost) && Number.isFinite(sellingPrice) && unitCost >= 0 && sellingPrice >= 0 && !(unitCost > 0 && sellingPrice > 0 && sellingPrice < unitCost)
    })
    const payment = Number.isFinite(newAmountPaid) && newAmountPaid >= 0 && (newPaymentStatus !== "PARTIAL" || newAmountPaid > 0) && (newPaymentStatus !== "NO_PAY" || newAmountPaid === 0) && (newPaymentStatus === "NO_PAY" || Boolean(newVoucherNumber.trim())) && (newPaymentStatus !== "PAID" || (createCalculations.totalCost > 0 && formItems.every(item => Number(item.unitCost) > 0 && Number(item.sellingPrice) > 0)))
    return Boolean(newSupplierId && (role !== "OWNER" || newBranchId) && validItems && payment && newArrivalDate && newArrivalDate >= todayDate)
  }, [createCalculations.totalCost, formItems, newAmountPaid, newArrivalDate, newBranchId, newPaymentStatus, newSupplierId, newVoucherNumber, role, todayDate])
  React.useEffect(() => {
    if (newPaymentStatus === "PARTIAL" && createCalculations.totalCost > 0 && newAmountPaid >= createCalculations.totalCost) {
      setNewPaymentStatus("PAID")
      setNewAmountPaid(createCalculations.totalCost)
    }
  }, [createCalculations.totalCost, newAmountPaid, newPaymentStatus])
  const receiveCalculations = React.useMemo(() => {
    const actualTotalCost = receiveItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0)
    const advancePaid = selectedOrder?.amountPaid || 0
    const totalPayment = advancePaid + additionalPayment
    const overpayment = Math.max(0, totalPayment - actualTotalCost)
    return { actualTotalCost, advancePaid, totalPayment, overpayment, supplierCredit: Math.max(0, overpayment - receiveRefundAmount) }
  }, [additionalPayment, receiveItems, selectedOrder?.amountPaid, receiveRefundAmount])
  const editTotalCost = React.useMemo(
    () => editItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    [editItems]
  )
  const editPaidSoFar = editOrder?.amountPaid || 0
  const editRemainingAmount = Math.max(0, editTotalCost - editPaidSoFar)
  React.useEffect(() => {
    const paidTotal = editPaidSoFar + additionalPayment
    if (editPaymentStatus === "PAID" && editTotalCost > paidTotal) {
      setEditPaymentStatus("PARTIAL")
      return
    }
    if (editPaymentStatus === "PARTIAL" && editTotalCost > 0 && paidTotal >= editTotalCost) {
      setEditPaymentStatus("PAID")
      setAdditionalPayment(Math.max(0, editTotalCost - editPaidSoFar))
    }
  }, [additionalPayment, editPaidSoFar, editPaymentStatus, editTotalCost])
  React.useEffect(() => {
    setReceiveRefundAmount(receiveCalculations.overpayment)
  }, [receiveCalculations.overpayment])
  const canReceive = React.useMemo(() => {
    const validItems = receiveItems.length > 0 && receiveItems.every((item) =>
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      Number.isFinite(item.unitCost) &&
      item.unitCost > 0 &&
      Number.isFinite(item.sellingPrice) &&
      item.sellingPrice > 0 &&
      item.sellingPrice >= item.unitCost
    )
    const validRefund = Number.isFinite(receiveRefundAmount) && receiveRefundAmount >= 0 && receiveRefundAmount <= receiveCalculations.overpayment
    const fullyPaid = receiveCalculations.totalPayment >= receiveCalculations.actualTotalCost
    return Boolean(selectedOrder && !receiveLoading && validItems && fullyPaid && editArrivalDate && editArrivalDate >= todayDate && editVoucherNumber.trim() && validRefund)
  }, [editArrivalDate, editVoucherNumber, receiveCalculations.actualTotalCost, receiveCalculations.overpayment, receiveCalculations.totalPayment, receiveItems, receiveLoading, receiveRefundAmount, selectedOrder, todayDate])
  const canSaveEdit = React.useMemo(() => {
    const validItems = editItems.length > 0 && editItems.every((item) => Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.unitCost) && Number.isFinite(item.sellingPrice) && item.unitCost >= 0 && item.sellingPrice >= 0 && !(item.unitCost > 0 && item.sellingPrice > 0 && item.sellingPrice < item.unitCost))
    const totalPayment = editPaidSoFar + additionalPayment
    const payment = editPaymentStatus === "NO_PAY" ? totalPayment === 0 : editPaymentStatus === "PARTIAL" ? totalPayment > 0 && Boolean(editVoucherNumber.trim()) : editItems.every(item => item.unitCost > 0 && item.sellingPrice > 0) && Boolean(editVoucherNumber.trim())
    return Boolean(editOrder && !receiveLoading && validItems && payment && editArrivalDate && editArrivalDate >= todayDate)
  }, [additionalPayment, editArrivalDate, editItems, editOrder, editPaidSoFar, editPaymentStatus, editVoucherNumber, receiveLoading, todayDate])
  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const poUrl = role === "OWNER" && selectedBranchFilter
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
      window.dispatchEvent(new Event("purchase-orders-updated"))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [role, selectedBranchFilter])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // CREATE LOGIC
  const openCreate = () => {
    setNewSupplierId(suppliers[0]?.id || "")
    setNewBranchId(role === "OWNER" ? (selectedBranchFilter || branches[0]?.id || "") : "")
    setNewNote("")
    setNewPaymentStatus("NO_PAY")
    setNewAmountPaid(0)
    setNewArrivalDate("")
    setNewVoucherNumber("")
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
      if (role === "OWNER" && !newBranchId) {
        setError(t("Please select a destination branch before submitting.", "အမှာစာ မတင်မီ ပေးပို့မည့် ဆိုင်ခွဲ ရွေးချယ်ပါ။"))
        return
      }

      const hasInvalidItem = formItems.some((item) => {
        const quantity = Number(item.quantity)
        const unitCost = Number(item.unitCost)
        const sellingPrice = Number(item.sellingPrice)
        return !item.variantId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || !Number.isFinite(sellingPrice) || unitCost < 0 || sellingPrice < 0 || (unitCost > 0 && sellingPrice > 0 && sellingPrice < unitCost)
      })
      if (hasInvalidItem) {
        setError(t("Select a product, enter a quantity greater than 0, use non-negative prices, and make selling price at least the cost price.", "ပစ္စည်းရွေးပြီး အရေအတွက်ကို ၀ ထက်ကြီးအောင်ထည့်ပါ။ ဈေးနှုန်းကို အနုတ်မထည့်ဘဲ ရောင်းဈေးကို မူရင်းဈေးထက် မနည်းအောင်ထည့်ပါ။"))
        return
      }
      if (!Number.isFinite(newAmountPaid) || newAmountPaid < 0) {
        setError(t("Paid amount cannot be negative or invalid.", "ပေးချေငွေကို အနုတ် သို့မဟုတ် မမှန်ကန်သောတန်ဖိုး မထည့်ရပါ။"))
        return
      }
      if (newPaymentStatus === "PARTIAL" && newAmountPaid <= 0) {
        setError(t("Partial Pay requires a paid amount greater than 0.", "တစ်စိတ်တစ်ပိုင်းပေးချေမှုအတွက် ပေးချေငွေကို ၀ ထက်ကြီးအောင်ထည့်ပါ။"))
        return
      }
      if (newPaymentStatus === "NO_PAY" && newAmountPaid !== 0) {
        setError(t("No Pay orders cannot have a paid amount.", "မပေးချေရသေးသော အမှာစာတွင် ပေးချေငွေ မထည့်ရပါ။"))
        return
      }
      if (newPaymentStatus === "PAID" && formItems.some((item) => Number(item.unitCost) <= 0 || Number(item.sellingPrice) <= 0)) {
        setError(t("Fully Paid orders require cost price and selling price.", "အပြည့်ပေးချေသည့် အမှာစာအတွက် မူရင်းဈေးနှင့် ရောင်းဈေး လိုအပ်ပါသည်။"))
        return
      }
      if (newPaymentStatus !== "NO_PAY" && !newVoucherNumber.trim()) {
        setError(t("Partial Pay and Fully Paid orders require a voucher number.", "တစ်စိတ်တစ်ပိုင်းနှင့် အပြည့်ပေးချေသည့် အမှာစာများအတွက် ဘောင်ချာနံပါတ် လိုအပ်ပါသည်။"))
        return
      }
      if (!newArrivalDate || newArrivalDate < todayDate) {
        setError(t("Arrival date is required.", "ရောက်ရှိမည့်ရက် မဖြစ်မနေထည့်ရပါမည်။"))
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
          paymentStatus: newPaymentStatus,
          amountPaid: newPaymentStatus === "PAID" ? createCalculations.totalCost : newAmountPaid,
          arrivalDate: newArrivalDate || null,
          voucherNumber: newVoucherNumber || null
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to create order")
      }
      
      // Auto-mark as ordered for simplicity in this flow, or leave as draft and add another button
      // To keep it simple, we just create it (which defaults to DRAFT in backend), then instantly mark ORDERED
      const createData = await res.json()
      
      const orderStatusRes = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: createData.order.id, status: "ORDERED" })
      })
      if (!orderStatusRes.ok) {
        const statusData = await orderStatusRes.json().catch(() => null)
        throw new Error(statusData?.error || "Failed to mark purchase order as ordered")
      }

      await fetchData()
      setIsCreateOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating purchase order")
    } finally {
      setCreateLoading(false)
    }
  }

  // RECEIVE LOGIC
  const handleOpenReceive = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setEditOrder(order)
    setEditPaymentStatus(order.paymentStatus || "NO_PAY")
    setAdditionalPayment(0)
    setEditArrivalDate(order.arrivalDate ? order.arrivalDate.slice(0, 10) : "")
    setEditVoucherNumber(order.voucherNumber || "")
    setEditItems(order.items.map(i => ({ id: i.id, quantity: i.quantity, unitCost: i.unitCost, sellingPrice: i.sellingPrice })))
    setReceiveItems(order.items.map(i => ({ id: i.id, quantity: i.quantity, unitCost: i.unitCost, sellingPrice: i.sellingPrice })))
    setReceiveRefundAmount(0)
  }

  const handleSaveEdit = async () => {
    if (!editOrder || editItems.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || !Number.isFinite(item.sellingPrice) || item.unitCost < 0 || item.sellingPrice < 0 || (item.unitCost > 0 && item.sellingPrice > 0 && item.sellingPrice < item.unitCost))) {
      setError(t("Quantity must be greater than 0, prices cannot be negative, and selling price cannot be less than cost price.", "အရေအတွက်ကို ၀ ထက်ကြီးအောင်ထည့်ပြီး ဈေးနှုန်းကို အနုတ်မထည့်ပါနှင့်။ ရောင်းဈေးသည် မူရင်းဈေးထက် မနည်းရပါ။"))
      return
    }
    if (!Number.isFinite(additionalPayment) || additionalPayment < 0) {
      setError(t("Additional payment cannot be negative or invalid.", "ထပ်ပေးချေငွေကို အနုတ် သို့မဟုတ် မမှန်ကန်သောတန်ဖိုး မထည့်ရပါ။"))
      return
    }
    const totalPayment = editPaidSoFar + additionalPayment
    if (editPaymentStatus === "PARTIAL" && totalPayment <= 0) {
      setError(t("Partial Pay requires a paid amount greater than 0.", "တစ်စိတ်တစ်ပိုင်းပေးချေမှုအတွက် ပေးချေငွေ လိုအပ်ပါသည်။"))
      return
    }
    if (editPaymentStatus === "NO_PAY" && totalPayment !== 0) {
      setError(t("No Pay orders cannot have a paid amount.", "မပေးချေရသေးသော အမှာစာတွင် ပေးချေငွေ မထည့်ရပါ။"))
      return
    }
    if (editPaymentStatus === "PAID" && editItems.some(item => item.unitCost <= 0 || item.sellingPrice <= 0)) {
      setError(t("Fully Paid orders require cost price and selling price.", "အပြည့်ပေးချေသည့် အမှာစာအတွက် မူရင်းဈေးနှင့် ရောင်းဈေး လိုအပ်ပါသည်။"))
      return
    }
    if (editPaymentStatus !== "NO_PAY" && !editVoucherNumber.trim()) {
      setError(t("Partial Pay and Fully Paid orders require a voucher number.", "တစ်စိတ်တစ်ပိုင်းနှင့် အပြည့်ပေးချေသည့် အမှာစာများအတွက် ဘောင်ချာနံပါတ် လိုအပ်ပါသည်။"))
      return
    }
    if (!editArrivalDate || editArrivalDate < todayDate) {
      setError(t("Arrival date is required.", "ရောက်ရှိမည့်ရက် မဖြစ်မနေထည့်ရပါမည်။"))
      return
    }
    setReceiveLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editOrder.id, status: editOrder.status, items: editItems, paymentStatus: editPaymentStatus, amountPaid: totalPayment, arrivalDate: editArrivalDate || null, voucherNumber: editVoucherNumber || null })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update purchase order")
      }
      await fetchData()
      setEditOrder(null)
      setSelectedOrder(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update purchase order")
    } finally {
      setReceiveLoading(false)
    }
  }

  const updateReceiveItem = (id: string, field: "quantity" | "unitCost" | "sellingPrice", val: string) => {
    const numericValue = Number(val)
    setReceiveItems(prev => prev.map(item => item.id === id ? { ...item, [field]: numericValue } : item))
    setEditItems(prev => prev.map(item => item.id === id ? { ...item, [field]: numericValue } : item))
  }

  const handleReceive = async () => {
    if (!selectedOrder) return
    if (receiveItems.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || !Number.isFinite(item.sellingPrice) || item.unitCost <= 0 || item.sellingPrice <= 0 || item.sellingPrice < item.unitCost)) {
      setError(t("Actual quantity, cost price, and selling price must be greater than 0, and selling price cannot be less than cost price.", "အရေအတွက်၊ မူရင်းဈေးနှင့် ရောင်းဈေးများကို ၀ ထက်ကြီးအောင် ထည့်ပြီး ရောင်းဈေးသည် မူရင်းဈေးထက် မနည်းရပါ။"))
      return
    }
    if (!editVoucherNumber.trim()) {
      setError(t("Voucher number is required before receiving goods.", "ပစ္စည်းလက်ခံရန် ဘောင်ချာနံပါတ် မဖြစ်မနေလိုအပ်ပါသည်။"))
      return
    }
    if (!editArrivalDate || editArrivalDate < todayDate) {
      setError(t("Arrival date is required and cannot be before today.", "ရောက်ရှိမည့်ရက် မဖြစ်မနေထည့်ရပြီး ယနေ့မတိုင်မီ ရက်မဖြစ်ရပါ။"))
      return
    }
    const actualTotalCost = receiveItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
    const advancePaid = selectedOrder.amountPaid || 0
    const totalPaymentAtReceive = advancePaid + additionalPayment
    const overpayment = Math.max(0, totalPaymentAtReceive - actualTotalCost)
    if (totalPaymentAtReceive < actualTotalCost) {
      setError(t(`Additional payment of ${(actualTotalCost - totalPaymentAtReceive).toLocaleString()} Ks is required before receiving.`, `ပစ္စည်းလက်ခံရန် ${(actualTotalCost - totalPaymentAtReceive).toLocaleString()} Ks ထပ်မံပေးချေရပါမည်။`))
      return
    }
    if (receiveRefundAmount < 0 || receiveRefundAmount > overpayment) {
      setError(t("Refund amount cannot exceed the overpayment.", "ပြန်အမ်းငွေသည် ပိုပေးထားသည့်ငွေထက် မကျော်ရပါ။"))
      return
    }
    setReceiveLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedOrder.id,
          status: "RECEIVED",
          items: receiveItems,
          paymentStatus: "PAID",
          amountPaid: totalPaymentAtReceive,
          refundAmount: receiveRefundAmount,
          supplierCredit: overpayment - receiveRefundAmount,
          arrivalDate: editArrivalDate,
          voucherNumber: editVoucherNumber.trim()
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
  const handleCancelOrder = async (orderId: string, refundAmount: number) => {
    if (!Number.isFinite(refundAmount) || refundAmount < 0) {
      setError(t("Refund amount cannot be negative or invalid.", "ပြန်အမ်းငွေကို အနုတ် သို့မဟုတ် မမှန်ကန်သောတန်ဖိုး မထည့်ရပါ။"))
      return
    }
    setCancelLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: "CANCELLED", refundAmount })
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to cancel purchase order")
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel purchase order")
    } finally {
      setCancelLoading(false)
    }
  }

  const completedPurchases = orders.filter(o => 
    (o.status === "RECEIVED" || o.status === "CANCELLED") &&
    (historyFilter === "ALL" || o.status === historyFilter)
  ).filter(o => {
    const s = searchQuery.toLowerCase()
    return o.id.toLowerCase().includes(s) || o.supplier.name.toLowerCase().includes(s)
  })

  const paginatedCompleted = completedPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const pendingOrders = orders.filter(o => o.status === "ORDERED" || o.status === "DRAFT")

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 min-h-[calc(100vh-4rem)] overflow-x-hidden">
      <div className="flex min-w-0 flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight flex items-start gap-2 break-words">
            <PackageCheck className="h-6 w-6 text-primary" />
            {t("Purchase Orders", "ဝယ်ယူမှု အမှာစာများ")}
            {pendingOrders.length > 0 && <Badge variant="destructive" className="text-xs">{pendingOrders.length}</Badge>}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground mt-1 font-semibold break-words">
            {t("Create purchase orders, receive goods, and automatically update your POS selling prices.", "ဝယ်ယူမှု အမှာစာများ ပြုလုပ်ပါ၊ ပစ္စည်းများ လက်ခံပါ၊ အရောင်းဈေးနှုန်းများကို အလိုအလျောက် ပြင်ဆင်ပါ။")}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col sm:flex-row sm:items-center gap-3 lg:w-auto">
          {role === "OWNER" && branches.length > 0 && (
            <div className="flex min-w-0 items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">{t("Active Branch", "ဆိုင်ခွဲ")}:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="min-w-0 flex-1 bg-transparent border-0 text-sm font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-card text-foreground">{t("All Branches", "ဆိုင်ခွဲအားလုံး")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-card text-foreground">{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={openCreate} disabled={loading || createLoading || receiveLoading || cancelLoading} className="w-full sm:w-auto font-bold gap-2 whitespace-normal leading-tight disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {t("New Purchase Order", "ဝယ်ယူမှု အမှာစာအသစ်")}
          </Button>
        </div>
      </div>

      {/* Pending Orders Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">{t("Pending Orders to Receive", "လက်ခံရန် ကျန်ရှိသော အမှာစာများ")}</h2>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : pendingOrders.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
            {t("No pending orders waiting to be received.", "လက်ခံရန် စောင့်ဆိုင်းနေသော အမှာစာများ မရှိပါ။")}
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {pendingOrders.map(order => {
              const arrivesToday = order.arrivalDate?.slice(0, 10) === todayDate
              return (
              <Card key={order.id} className={`min-w-0 p-4 flex flex-col gap-3 ${arrivesToday ? "border-2 border-destructive bg-destructive/10 shadow-destructive/20 shadow-md" : "border-primary/20 bg-primary/5"}`}>
                <div className="flex min-w-0 justify-between items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold break-words">PO-{order.id.slice(-6).toUpperCase()}</h3>
                    {arrivesToday && <div className="mt-1 text-xs font-black uppercase text-destructive">{t("Arrives Today", "ယနေ့ရောက်မည်")}</div>}
                    <div className="min-w-0 text-sm text-muted-foreground flex items-start gap-1 mt-1 break-words">
                      <Truck className="h-3 w-3" /> {order.supplier.name}
                    </div>
                    {order.branch && (
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-start gap-1 mt-1 break-words">
                        <Building2 className="h-3 w-3" />{order.branch.name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground flex items-start gap-1 mt-1 break-words">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{t("Purchased by", "ဝယ်ယူသူ")}: <strong className="text-foreground">{order.createdBy?.name || order.receivedBy?.name || order.receivedByStaff?.name || "Store Staff"}</strong></span>
                    </div>
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                      <span className="font-bold">{t("Remaining Amount", "ကျန်ငွေ")}: </span>
                      {order.totalCost > 0
                        ? `${Math.max(0, order.totalCost - (order.amountPaid || 0)).toLocaleString()} Ks`
                        : t("Not calculated yet", "မတွက်ချက်ရသေးပါ")}
                    </div>
                  </div>
                  <Badge className="shrink-0">{order.status}</Badge>
                </div>
                
                <div className="mt-auto pt-2 grid grid-cols-1 gap-2">
                  <Button className="w-full min-w-0 gap-1 whitespace-normal text-center leading-tight bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || receiveLoading || cancelLoading} onClick={() => handleOpenReceive(order)}>
                    {t("Review & Receive", "စစ်ဆေးပြီး လက်ခံမည်")}
                  </Button>
                  <Button variant="outline" className="w-full min-w-0 whitespace-normal text-center leading-tight disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || receiveLoading || cancelLoading} onClick={() => { setCancelRefund(0); setCancelOrderConfirm(order) }}>
                    {t("Cancel", "မလုပ်တော့ပါ")}
                  </Button>
                </div>
              </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Completed Purchases Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
          <h2 className="text-lg font-bold text-foreground">{t("Completed Purchases History", "ပြီးစီးသည့် အဝယ် မှတ်တမ်း")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted p-1 rounded-md h-9">
              <button 
                onClick={() => setHistoryFilter("ALL")} 
                disabled={loading}
                className={`px-3 text-xs font-bold rounded-sm transition-all ${historyFilter === "ALL" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >{t("All", "အားလုံး")}</button>
              <button 
                onClick={() => setHistoryFilter("RECEIVED")} 
                disabled={loading}
                className={`px-3 text-xs font-bold rounded-sm transition-all ${historyFilter === "RECEIVED" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >{t("Received", "လက်ခံရရှိပြီး")}</button>
              <button 
                onClick={() => setHistoryFilter("CANCELLED")} 
                disabled={loading}
                className={`px-3 text-xs font-bold rounded-sm transition-all ${historyFilter === "CANCELLED" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >{t("Cancelled", "ပယ်ဖျက်လိုက်သည်")}</button>
            </div>
            <div className="relative w-full sm:w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search history...", "မှတ်တမ်း ရှာဖွေရန်...")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full bg-card"
              />
            </div>
          </div>
        </div>

        {loading ? null : (
          <div className="grid min-w-0 gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {completedPurchases.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                {t("No completed purchases found.", "ပြီးစီးသည့် အဝယ်များ မတွေ့ပါ။")}
              </div>
            ) : (
              paginatedCompleted.map(order => (
                <Card key={order.id} className="min-w-0 p-4 opacity-80 cursor-pointer hover:bg-muted/50 hover:opacity-100 transition-all" onClick={() => setViewOrder(order)}>
                  <div className="flex min-w-0 justify-between items-start gap-3 mb-2">
                    <h3 className="font-bold text-sm">PO-{order.id.slice(-6).toUpperCase()}</h3>
                    <Badge variant={order.status === "CANCELLED" ? "secondary" : "outline"} className="shrink-0 text-[10px]">{order.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">{order.supplier.name}</div>
                  {order.branch && (
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />{order.branch.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{t("Purchased by", "ဝယ်ယူသူ")}: <strong className="text-foreground">{order.createdBy?.name || order.receivedBy?.name || order.receivedByStaff?.name || "Store Staff"}</strong></span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 mb-2">{new Date(order.createdAt).toLocaleDateString()}</div>
                  <div className="text-sm font-semibold bg-muted/50 p-2 rounded flex justify-between">
                    <span>{t("Total Cost", "စုစုပေါင်း ကုန်ကျစရိတ်")}:</span>
                    <span>{order.totalCost.toLocaleString()} Ks</span>
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
        <DialogContent className="w-[calc(100%-1rem)] sm:w-full max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("Create Purchase Order", "ဝယ်ယူမှု အမှာစာ အသစ်ပြုလုပ်ရန်")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">{t("Supplier", "ပေးသွင်းသူ")}</label>
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

              {role === "OWNER" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{t("Destination Branch", "ပေးပို့မည့် ဆိုင်ခွဲ")}</label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border bg-card"
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

            <div className="grid grid-cols-2 gap-4 border border-border rounded-xl bg-muted/20 p-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-foreground">{t("Supplier Payment", "ပေးသွင်းသူ ပေးချေမှု")}</label>
                <select className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" value={newPaymentStatus} onChange={e => { setNewPaymentStatus(e.target.value as typeof newPaymentStatus); if (e.target.value === "NO_PAY") setNewAmountPaid(0) }}>
                  <option value="NO_PAY">{t("No Pay", "မပေးရသေး")}</option>
                  <option value="PARTIAL">{t("Partial Pay", "တစ်စိတ်တစ်ပိုင်း")}</option>
                  <option value="PAID">{t("Fully Paid", "အပြည့်ပေးပြီး")}</option>
                </select>
              </div>
              {newPaymentStatus !== "NO_PAY" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-foreground">{t("Paid Amount", "ပေးချေငွေ")}</label>
                  <Input type="number" min={0} disabled={newPaymentStatus === "PAID"} value={newPaymentStatus === "PAID" ? createCalculations.totalCost : newAmountPaid} onChange={e => setNewAmountPaid(Number(e.target.value) || 0)} className="h-10 rounded-lg disabled:cursor-not-allowed disabled:opacity-70" />
                </div>
              )}
              <div className="space-y-1.5"><label className={`text-xs font-bold uppercase ${newArrivalDate === todayDate ? "text-destructive" : "text-foreground"}`}>{t("Arrival Date", "ရောက်ရှိမည့်ရက်")} <span className="text-destructive">*</span></label><Input required type="date" min={todayDate} value={newArrivalDate} onChange={e => setNewArrivalDate(e.target.value)} className={`h-10 rounded-lg ${newArrivalDate === todayDate ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive" : ""}`} />{newArrivalDate === todayDate && <p className="text-xs font-semibold text-destructive" role="alert">{t("Arrival is today — please arrange pickup.", "ယနေ့ရောက်မည့်အတွက် ပစ္စည်းသွားယူရန် စီစဉ်ပါ။")}</p>}</div>
              <div className="space-y-1.5"><label className="text-xs font-bold uppercase text-foreground">{t("Voucher Number", "ဘောင်ချာနံပါတ်")} {newPaymentStatus !== "NO_PAY" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(Optional)</span>}</label><Input required={newPaymentStatus !== "NO_PAY"} value={newVoucherNumber} onChange={e => setNewVoucherNumber(e.target.value)} placeholder={newPaymentStatus !== "NO_PAY" ? "Required" : "Optional"} className="h-10 rounded-lg" /></div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-foreground">{t("Order Items", "မှာယူမည့် ပစ္စည်းများ")}</label>
                <Button type="button" variant="outline" size="sm" onClick={addFormItem} disabled={createLoading} className="h-7 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus className="h-3 w-3 mr-1" /> {t("Add Product", "ပစ္စည်း ထည့်မည်")}
                </Button>
              </div>
              <div className="hidden sm:flex gap-2 items-end px-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground mt-4">
                <div className="flex-1">{t("Product Variant", "ပစ္စည်းအမျိုးအစား")}</div>
                <div className="w-20 text-center">{t("Qty", "အရေအတွက်")}</div>
                <><div className="w-24 text-center">{t("Cost", "မူရင်းဈေး")} {newPaymentStatus !== "PAID" && <span className="font-normal">({t("Optional", "စိတ်ကြိုက်")})</span>}</div><div className="w-28 text-center">{t("Sell Price", "ရောင်းဈေး")} {newPaymentStatus !== "PAID" && <span className="font-normal">({t("Optional", "စိတ်ကြိုက်")})</span>}</div></>
                <div className="w-8"></div>
              </div>
              {formItems.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-muted/20 p-3 rounded-lg border border-border">
                  <div className="w-full sm:flex-1 sm:min-w-0 relative">
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
                  <>
                    <div className="w-full sm:w-24">
                      <Input type="number" min={0} placeholder={newPaymentStatus === "PAID" ? t("Required", "မဖြစ်မနေ") : t("Optional", "စိတ်ကြိုက်")} value={item.unitCost} onChange={e => updateFormItem(index, "unitCost", e.target.value)} className="h-9 text-xs" title="Unit Cost" />
                    </div>
                    <div className="w-full sm:w-28">
                      <Input type="number" min={0} placeholder={newPaymentStatus === "PAID" ? t("Required", "မဖြစ်မနေ") : t("Optional", "စိတ်ကြိုက်")} value={item.sellingPrice} onChange={e => updateFormItem(index, "sellingPrice", e.target.value)} className="h-9 text-xs" title="Selling Price" />
                    </div>
                  </>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFormItem(index)} disabled={createLoading || formItems.length === 1} className="self-end sm:self-center h-8 w-8 text-destructive disabled:cursor-not-allowed disabled:opacity-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
              <Button type="submit" disabled={createLoading || !canSubmitCreate} title={!canSubmitCreate ? t("Complete all required fields before submitting.", "တင်သွင်းရန် လိုအပ်သောအချက်များအားလုံး ဖြည့်စွက်ပါ။") : undefined} className="font-bold disabled:cursor-not-allowed disabled:opacity-50">
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
            {selectedOrder && selectedOrder.paymentStatus !== "PAID" && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-bold">{t("Full payment required before receiving", "ပစ္စည်းလက်ခံမီ အပြည့်ပေးချေရပါမည်")}</p>
                <p className="mt-1 text-xs">{t("This order is currently No Pay or Partial Pay. Receiving it will complete the supplier payment using the actual received total cost.", "ဤအမှာစာသည် မပေးရသေးခြင်း သို့မဟုတ် တစ်စိတ်တစ်ပိုင်းပေးထားခြင်း ဖြစ်ပါသည်။ လက်ခံရရှိသည့် စုစုပေါင်းအရင်းအတိုင်း ပေးချေပြီးမှ ပစ္စည်းလက်ခံပါမည်။")}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground font-medium">
              {t("Update the actual received quantities, final unit cost (what you pay), and the POS selling price (what customers pay).", "လက်ခံရရှိသည့် အရေအတွက်၊ မူရင်းဈေးနှင့် ရောင်းဈေးများကို ပြင်ဆင်ပါ။")}
            </p>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl border border-border">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-foreground">{t("Supplier Payment", "ပေးသွင်းသူ ပေးချေမှု")}</label>
                <select disabled={selectedOrder?.paymentStatus === "PAID"} className="w-full h-10 px-3 rounded-lg border bg-background text-sm disabled:cursor-not-allowed disabled:opacity-70" value={editPaymentStatus} onChange={e => { setEditPaymentStatus(e.target.value as typeof editPaymentStatus); if (e.target.value === "NO_PAY") setAdditionalPayment(0) }}>
                  <option value="NO_PAY" disabled={selectedOrder?.paymentStatus === "PARTIAL" || selectedOrder?.paymentStatus === "PAID"}>{t("No Pay", "မပေးရသေး")}</option>
                  <option value="PARTIAL">{t("Partial Pay", "တစ်စိတ်တစ်ပိုင်း")}</option>
                  <option value="PAID">{t("Fully Paid", "အပြည့်ပေးပြီး")}</option>
                </select>
              </div>
              {(selectedOrder?.amountPaid || 0) > 0 && <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-foreground">{t("Paid So Far", "ပေးပြီးသားငွေ")}</label>
                <Input disabled value={`${(selectedOrder?.amountPaid || 0).toLocaleString()} Ks`} className="bg-muted/50 font-semibold disabled:cursor-not-allowed disabled:opacity-70" />
              </div>}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-foreground">{t("Remaining Amount", "ကျန်ငွေ")}</label>
                <Input disabled value={editTotalCost > 0 ? `${editRemainingAmount.toLocaleString()} Ks` : t("Not calculated yet", "မတွက်ချက်ရသေးပါ")} className="bg-blue-50 font-semibold text-blue-900 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-950/30 dark:text-blue-200" />
              </div>
              {editPaymentStatus !== "NO_PAY" && (editPaymentStatus !== "PAID" || editRemainingAmount > 0) && <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-foreground">{t("Additional Payment", "ထပ်ပေးမည့်ငွေ")}</label>
                <Input type="number" min={0} value={additionalPayment} onChange={e => setAdditionalPayment(Number(e.target.value) || 0)} className="disabled:cursor-not-allowed disabled:opacity-70" />
              </div>}
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold uppercase ${editArrivalDate === todayDate ? "text-destructive" : "text-foreground"}`}>{t("Arrival Date", "ရောက်ရှိမည့်ရက်")} <span className="text-destructive">*</span></label>
                <Input required type="date" min={todayDate} value={editArrivalDate} onChange={e => setEditArrivalDate(e.target.value)} className={editArrivalDate === todayDate ? "border-destructive ring-1 ring-destructive" : ""} />
                {editArrivalDate === todayDate && <p className="text-xs font-semibold text-destructive" role="alert">{t("Arrival is today — please arrange pickup.", "ယနေ့ရောက်မည့်အတွက် ပစ္စည်းသွားယူရန် စီစဉ်ပါ။")}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-foreground">{t("Voucher Number", "ဘောင်ချာနံပါတ်")} <span className="text-destructive">*</span></label>
                <Input required value={editVoucherNumber} onChange={e => setEditVoucherNumber(e.target.value)} placeholder={t("Required to receive", "လက်ခံရန် မဖြစ်မနေ")}/>
              </div>
            </section>

            <div className="space-y-3">
              {selectedOrder?.items.map((item) => {
                const formItem = receiveItems.find(i => i.id === item.id)
                if (!formItem) return null
                return (
                  <div key={item.id} className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="flex-1">
                      <div className="font-bold text-sm">{item.variant?.product?.name} - {item.variant?.name}</div>
                      <div className="text-xs text-muted-foreground">{t("Ordered", "မှာယူထားသည်")}: {item.quantity} pcs @ {item.unitCost} Ks</div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                      <div className="space-y-1 w-20">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">{t("Rcvd Qty", "လက်ခံ ရရှိအရေအတွက်")}</label>
                        <Input 
                          type="number" 
                          className="h-8 text-sm" 
                          value={formItem.quantity}
                          onChange={e => updateReceiveItem(item.id, "quantity", e.target.value)}
                          min={1}
                        />
                      </div>
                      <div className="space-y-1 w-24">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">{t("Cost (Ks)", "မူရင်းဈေး (ကျပ်)")}</label>
                        <Input 
                          type="number" 
                          className="h-8 text-sm" 
                          value={formItem.unitCost}
                          onChange={e => updateReceiveItem(item.id, "unitCost", e.target.value)}
                          min={1}
                        />
                      </div>
                      <div className="space-y-1 w-28">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">{t("Sell Price (Ks)", "ရောင်းဈေး (ကျပ်)")}</label>
                        <Input 
                          type="number" 
                          className="h-8 text-sm text-primary font-bold" 
                          value={formItem.sellingPrice}
                          onChange={e => updateReceiveItem(item.id, "sellingPrice", e.target.value)}
                          min={1}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{t("Advance paid", "ကြိုတင်ပေးပြီးငွေ")}</span><strong>{receiveCalculations.advancePaid.toLocaleString()} Ks</strong></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{t("Actual total cost", "အမှန်တကယ် စုစုပေါင်းအရင်း")}</span><strong>{receiveCalculations.actualTotalCost.toLocaleString()} Ks</strong></div>
              {receiveCalculations.overpayment > 0 && <>
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-bold">{t("Overpayment detected", "ပိုပေးထားသောငွေ တွေ့ရှိပါသည်")}</p>
                  <p className="text-xs mt-1">{t("Choose how to settle the amount above the actual cost.", "အမှန်တကယ်အရင်းထက် ပိုပေးထားသောငွေကို မည်သို့ရှင်းမည်ကို ရွေးပါ။")}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase text-foreground">{t("Automatic refund", "အလိုအလျောက် ပြန်အမ်းငွေ")}</label>
                    <Input type="number" min={0} value={receiveCalculations.overpayment} disabled aria-readonly="true" className="bg-muted/50 font-semibold disabled:cursor-not-allowed disabled:opacity-70" />
                  </div>
                  <div className="text-xs text-muted-foreground sm:pb-2">
                    {t("Remaining supplier credit", "Supplier Credit အဖြစ်ကျန်ငွေ")}: <strong className="text-foreground">{receiveCalculations.supplierCredit.toLocaleString()} Ks</strong>
                  </div>
                </div>
              </>}
            </div>
          </div>

          <DialogFooter className="mt-4 border-t border-border pt-4">
            <Button variant="outline" disabled={receiveLoading} onClick={() => { setSelectedOrder(null); setEditOrder(null) }}>{t("Close", "ပိတ်မည်")}</Button>
            <Button variant="outline" onClick={handleSaveEdit} disabled={receiveLoading || !canSaveEdit} title={!canSaveEdit ? t("Complete all required fields before saving.", "သိမ်းရန် လိုအပ်သောအချက်များအားလုံး ဖြည့်စွက်ပါ။") : undefined}>
              {t("Save for Later", "နောက်မှဆက်လုပ်ရန် သိမ်းမည်")}
            </Button>
            <Button onClick={handleReceive} disabled={!canReceive} title={!canReceive ? t("Complete all required fields before receiving goods.", "ပစ္စည်းလက်ခံရန် လိုအပ်သောအချက်များအားလုံး ဖြည့်စွက်ပါ။") : undefined} className="font-bold bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
              {receiveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Receive Goods", "ပစ္စည်းများ လက်ခံမည်")}
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
            <div className="flex justify-between items-start bg-muted/20 p-4 rounded-lg border border-border flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted-foreground font-semibold">{t("Supplier", "ပေးသွင်းသူ")}</p>
                <p className="font-bold">{viewOrder?.supplier.name}</p>
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
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <p>{t("Supplier Payment", "ပေးသွင်းသူ ပေးချေမှု")}: <strong className="text-foreground">{viewOrder?.paymentStatus}</strong></p>
                  <p>{t("Paid Amount", "ပေးချေငွေ")}: <strong className="text-foreground">{(viewOrder?.amountPaid || 0).toLocaleString()} Ks</strong></p>
                  {(viewOrder?.supplierCredit || 0) > 0 && <p>{t("Supplier Credit", "Supplier Credit")}: <strong className="text-foreground">{(viewOrder?.supplierCredit || 0).toLocaleString()} Ks</strong></p>}
                  {(viewOrder?.refundAmount || 0) > 0 && <p>{t("Refunded", "ပြန်အမ်းငွေ")}: <strong className="text-foreground">{(viewOrder?.refundAmount || 0).toLocaleString()} Ks</strong></p>}
                  {viewOrder?.arrivalDate && <p>{t("Arrival Date", "ရောက်ရှိမည့်ရက်")}: {new Date(viewOrder.arrivalDate).toLocaleDateString()}</p>}
                  {viewOrder?.voucherNumber && <p>{t("Voucher Number", "ဘောင်ချာနံပါတ်")}: {viewOrder.voucherNumber}</p>}
                </div>
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
                      <p><span className="text-muted-foreground">{t("Cost Price", "မူရင်းဈေး")}:</span> {item.unitCost.toLocaleString()} Ks</p>
                      <p><span className="text-muted-foreground">{t("Selling Price", "ရောင်းဈေး")}:</span> {item.sellingPrice.toLocaleString()} Ks</p>
                      <p className="font-bold text-primary">{t("Total Cost", "စုစုပေါင်းအရင်း")}: {item.total.toLocaleString()} Ks</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-border">
              <div className="text-right">
                <p className="text-sm text-muted-foreground font-semibold">{t("Grand Total", "စုစုပေါင်း ပမာဏ")}</p>
                <p className="text-xl font-black text-primary">{viewOrder?.totalCost.toLocaleString()} Ks</p>
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
            <div className="mt-4 space-y-1.5">
              <label className="text-sm font-semibold">{t("Supplier Refund Amount", "ပေးသွင်းသူ ပြန်အမ်းငွေ")}</label>
              <Input type="number" min={0} max={cancelOrderConfirm?.amountPaid || 0} value={cancelRefund} onChange={e => setCancelRefund(Number(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">{t("Enter how much the supplier returned. This is recorded in cash flow.", "ပေးသွင်းသူ ပြန်အမ်းသည့်ငွေကို ထည့်ပါ။ ငွေစီးဆင်းမှုတွင် မှတ်တမ်းတင်ပါမည်။")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={cancelLoading} onClick={() => setCancelOrderConfirm(null)}>{t("No, Keep it", "မပယ်ဖျက်ပါ")}</Button>
            <Button variant="destructive" disabled={cancelLoading || !cancelOrderConfirm || cancelRefund < 0 || cancelRefund > (cancelOrderConfirm.amountPaid || 0)} onClick={() => {
              if (cancelOrderConfirm) {
                handleCancelOrder(cancelOrderConfirm.id, cancelRefund)
                setCancelOrderConfirm(null)
              }
            }}>{t("Yes, Cancel Order", "ဟုတ်ကဲ့၊ ပယ်ဖျက်မည်")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
