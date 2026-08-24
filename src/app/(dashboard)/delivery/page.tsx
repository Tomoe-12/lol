"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import {
  Truck,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  User,
  Printer,
  FileText,
  Building,
  Calendar,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/ui/table-pagination"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Variant {
  id: string
  name: string
  product: {
    name: string
  }
}

interface SalesOrderItem {
  id: string
  quantity: number
  unitPrice: number
  total: number
  variant: Variant
}

interface Branch {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
  phone: string
  address?: string | null
}

interface DeliveryOrder {
  id: string
  createdAt: string
  status: "DRAFT" | "CONFIRMED" | "COMPLETED" | "CANCELLED"
  paymentStatus: "PARTIAL" | "PAID"
  subtotal: number
  discount: number
  total: number
  amountPaid: number
  isDelivery: boolean
  deliveryStatus: "PENDING" | "DELIVERED"
  deliveryCustomerName?: string | null
  deliveryPhone?: string | null
  deliveryAddress?: string | null
  branch: Branch
  customer?: Customer | null
  items: SalesOrderItem[]
}

export default function DeliveryPage() {
  const { user } = useUser()
  const { t } = useLanguage()

  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [stats, setStats] = useState({ pendingCount: 0, todayDeliveredCount: 0, totalCount: 0 })
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "DELIVERED" | "ALL">("PENDING")
  const [selectedBranch, setSelectedBranch] = useState("ALL")

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal / Waybill Print View
  const [selectedWaybill, setSelectedWaybill] = useState<DeliveryOrder | null>(null)
  const [isWaybillOpen, setIsWaybillOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Fetch Branches
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await fetch("/api/branches")
        if (res.ok) {
          const data = await res.json()
          setBranches(Array.isArray(data) ? data : data.branches || [])
        }
      } catch (e) {
        console.error("Failed to load branches", e)
      }
    }
    fetchBranches()
  }, [])

  // Fetch Delivery Orders
  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBranch && selectedBranch !== "ALL") params.append("branchId", selectedBranch)
      if (search.trim()) params.append("search", search.trim())
      if (statusFilter !== "ALL") params.append("status", statusFilter)

      const res = await fetch(`/api/delivery?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
        setStats(data.stats || { pendingCount: 0, todayDeliveredCount: 0, totalCount: 0 })
      }
    } catch (e) {
      console.error("Failed to fetch delivery orders", e)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch, search, statusFilter])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  // Mark as Delivered
  const handleMarkAsDelivered = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch("/api/delivery/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesOrderId: orderId, deliveryStatus: "DELIVERED" }),
      })
      if (res.ok) {
        fetchDeliveries()
      }
    } catch (e) {
      console.error("Failed to update delivery status", e)
    } finally {
      setUpdatingId(null)
    }
  }

  // Waybill Print Handler
  const handlePrintWaybill = () => {
    window.print()
  }

  // Filtered & Paginated
  const paginatedOrders = orders.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Truck className="h-7 w-7 text-primary" />
            {t("Delivery Center", "ပို့ဆောင်ရေးများ")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            {t("Track, manage, and confirm customer delivery orders.", "ဝယ်သူများ၏ ပစ္စည်းပို့ဆောင်မှု အမှာစာများကို ကြည့်ရှု၍ အတည်ပြုပေးပါ")}
          </p>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              {t("Pending Deliveries", "ပို့ဆောင်ရန် ကျန်ရှိသော အမှာစာများ")}
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.pendingCount.toLocaleString()}
            </span>
          </div>
          <div className="p-3 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              {t("Delivered Today", "ယနေ့ ပို့ဆောင်ပြီးစီးမှု")}
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.todayDeliveredCount.toLocaleString()}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-primary uppercase tracking-wider block">
              {t("Total Delivery Orders", "စုစုပေါင်း ပို့ဆောင်ရေး အမှာစာများ")}
            </span>
            <span className="text-2xl font-black text-primary">
              {stats.totalCount.toLocaleString()}
            </span>
          </div>
          <div className="p-3 bg-primary/20 rounded-xl text-primary">
            <Package className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-card border border-border rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("Search by customer name, phone, address...", "အမည်၊ ဖုန်း၊ လိပ်စာ ဖြင့် ရှာဖွေပါ...")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-10 text-sm bg-muted/20 border-border"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
            {/* Status Filter Toggle */}
            <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border text-xs font-bold">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "PENDING" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
              >
                {t("Pending", "ပို့ဆောင်ရန်ကျန်")}
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "DELIVERED" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => { setStatusFilter("DELIVERED"); setPage(1); }}
              >
                {t("Delivered", "ပို့ဆောင်ပြီး")}
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "ALL" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => { setStatusFilter("ALL"); setPage(1); }}
              >
                {t("All", "အားလုံး")}
              </button>
            </div>

            {/* Branch Filter (Owner Only) */}
            {user?.role === "OWNER" && (
              <select
                value={selectedBranch}
                onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
                className="h-10 px-3 bg-muted/20 border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="ALL">{t("All Branches", "ဆိုင်ခွဲအားလုံး")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Delivery Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">{t("Loading delivery orders...", "ပို့ဆောင်ရေး အမှာစာများ ရယူနေပါသည်...")}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-center space-y-3">
            <Truck className="h-12 w-12 stroke-[1.5] text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-base font-bold text-foreground">{t("No delivery orders found", "ပို့ဆောင်ရန် အမှာစာ မရှိသေးပါ")}</p>
              <p className="text-xs text-muted-foreground">{t("New orders requiring delivery will appear here automatically.", "ပို့ဆောင်ပေးရမည့် အမှာစာသစ်များ ဤနေရာတွင် ပေါ်လာပါမည်")}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-xs uppercase font-extrabold text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3.5 px-4">{t("Order & Date", "အော်ဒါအမှတ် နှင့် ရက်စွဲ")}</th>
                  <th className="py-3.5 px-4">{t("Branch", "ဆိုင်ခွဲ")}</th>
                  <th className="py-3.5 px-4">{t("Customer", "ဝယ်သူအမည်")}</th>
                  <th className="py-3.5 px-4">{t("Delivery Address", "ပို့ဆောင်ရမည့် လိပ်စာ")}</th>
                  <th className="py-3.5 px-4">{t("Items & Total", "အမျိုးအမည်နှင့် စုစုပေါင်း")}</th>
                  <th className="py-3.5 px-4">{t("Status", "အခြေအနေ")}</th>
                  <th className="py-3.5 px-4 text-right">{t("Action", "လုပ်ဆောင်ချက်")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedOrders.map((ord) => {
                  const custName = ord.deliveryCustomerName || ord.customer?.name || "Customer"
                  const custPhone = ord.deliveryPhone || ord.customer?.phone || "-"
                  const custAddr = ord.deliveryAddress || ord.customer?.address || "-"

                  return (
                    <tr key={ord.id} className="hover:bg-muted/20 transition-colors">
                      {/* Order ID & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-foreground">
                          #{ord.id.slice(-6).toUpperCase()}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Building className="h-3.5 w-3.5 text-muted-foreground" />
                          {ord.branch?.name}
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary" />
                          {custName}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-emerald-600" />
                          <a href={`tel:${custPhone}`} className="hover:underline text-emerald-600 dark:text-emerald-400 font-semibold">
                            {custPhone}
                          </a>
                        </div>
                      </td>

                      {/* Delivery Address */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-xs font-medium text-foreground flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{custAddr}</span>
                        </div>
                      </td>

                      {/* Items & Total */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-foreground">
                          {ord.items.length} {t("items", "မျိုး")}
                        </div>
                        <div className="text-xs font-black text-primary mt-0.5">
                          {ord.total.toLocaleString()} Ks
                        </div>
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3.5 px-4">
                        {ord.deliveryStatus === "DELIVERED" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{t("Delivered", "ပို့ပြီး")}</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{t("Pending", "ပို့ရန်ကျန်")}</span>
                          </Badge>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold flex items-center gap-1.5"
                            disabled={loading || updatingId !== null}
                            onClick={() => {
                              setSelectedWaybill(ord)
                              setIsWaybillOpen(true)
                            }}
                          >
                            <Printer className="h-3.5 w-3.5 text-primary" />
                            <span>{t("Waybill", "ပြေစာ")}</span>
                          </Button>

                          {ord.deliveryStatus === "PENDING" && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                              disabled={loading || updatingId !== null}
                              onClick={() => handleMarkAsDelivered(ord.id)}
                            >
                              {updatingId === ord.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              <span>{t("Mark Delivered", "ပို့ပြီးပြီ")}</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {orders.length > 0 && (
          <div className="p-4 border-t border-border bg-muted/20">
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={orders.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
            />
          </div>
        )}
      </div>

      {/* Printable Delivery Waybill Modal */}
      <Dialog open={isWaybillOpen} onOpenChange={setIsWaybillOpen}>
        <DialogContent className="max-w-md bg-card border-border p-6 rounded-2xl">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-lg font-black flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span>{t("Delivery Waybill", "ပို့ဆောင်ရေး ပြေစာ")}</span>
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                #{selectedWaybill?.id.slice(-6).toUpperCase()}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedWaybill && (
            <div className="space-y-4 py-2 text-sm text-foreground">
              {/* Delivery Details Header */}
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">{t("Branch", "ဆိုင်ခွဲ")}:</span>
                  <span className="font-bold">{selectedWaybill.branch?.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">{t("Date", "ရက်စွဲ")}:</span>
                  <span>{new Date(selectedWaybill.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                <div className="font-extrabold text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span>{selectedWaybill.deliveryCustomerName || selectedWaybill.customer?.name || "Customer"}</span>
                </div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{selectedWaybill.deliveryPhone || selectedWaybill.customer?.phone || "-"}</span>
                </div>
                <div className="text-xs font-medium text-foreground flex items-start gap-1.5 pt-1 border-t border-primary/10">
                  <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{selectedWaybill.deliveryAddress || selectedWaybill.customer?.address || "-"}</span>
                </div>
              </div>

              {/* Items List Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  {t("Delivery Items", "ပို့ဆောင်ရမည့် ပစ္စည်းများ")}
                </span>
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-muted/10">
                  {selectedWaybill.items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-primary" readOnly defaultChecked />
                        <span>{item.variant.product.name} ({item.variant.name})</span>
                      </div>
                      <span className="font-extrabold">x {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Payment Status */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border flex justify-between items-center">
                <span className="text-xs font-semibold text-muted-foreground">{t("Total Order Value", "စုစုပေါင်း အမှာစာ ပမာဏ")}:</span>
                <span className="text-base font-black text-primary">
                  {selectedWaybill.total.toLocaleString()} Ks
                </span>
              </div>

              {/* Customer Signature Box */}
              <div className="pt-4 border-t border-dashed border-border flex justify-between items-end text-xs text-muted-foreground">
                <div className="text-center w-28">
                  <div className="border-b border-border pb-8"></div>
                  <span className="mt-1 block font-semibold">{t("Deliverer", "ပို့ဆောင်သူ")}</span>
                </div>
                <div className="text-center w-28">
                  <div className="border-b border-border pb-8"></div>
                  <span className="mt-1 block font-semibold">{t("Receiver", "လက်ခံသူ")}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border pt-4 flex gap-2">
            <Button type="button" variant="outline" className="w-1/2" onClick={() => setIsWaybillOpen(false)}>
              {t("Close", "ပိတ်မည်")}
            </Button>
            <Button type="button" className="w-1/2 font-bold flex items-center gap-2" onClick={handlePrintWaybill}>
              <Printer className="h-4 w-4" />
              <span>{t("Print Waybill", "ပြေစာထုတ်မည်")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
