"use client"

import * as React from "react"
import { useLanguage } from "@/providers/language-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { History, Printer, Search, RefreshCw, ShoppingBag, Loader2, Calendar, Building } from "lucide-react"
import type { ReceiptTransaction } from "./receipt-view"

interface TransactionItemRecord {
  id: string;
  productId?: string;
  variantId?: string | null;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  discount?: number;
  product?: {
    id?: string;
    name?: string;
    imageUrl?: string | null;
  };
  variant?: {
    name?: string;
  } | null;
}

interface SalesTransactionRecord {
  id: string;
  code?: string;
  branchId?: string;
  subtotal?: number;
  discountAmount?: number;
  totalAmount?: number;
  total?: number;
  paymentMethod?: string;
  cashReceived?: number | null;
  changeGiven?: number | null;
  status?: string;
  note?: string | null;
  createdAt: string | Date;
  branch?: {
    id?: string;
    name?: string;
    address?: string | null;
  };
  staffId?: string;
  staff?: {
    id?: string;
    name?: string;
  };
  items?: TransactionItemRecord[];
}

interface SalesHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  staffId?: string;
  userRole?: string;
  onSelectReceipt: (receipt: ReceiptTransaction) => void;
}

export function SalesHistoryDialog({
  isOpen,
  onOpenChange,
  branchId,
  staffId,
  userRole,
  onSelectReceipt,
}: SalesHistoryDialogProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = React.useState(false)
  const [transactions, setTransactions] = React.useState<SalesTransactionRecord[]>([])
  const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([])
  const [filterBranchId, setFilterBranchId] = React.useState<string>("ALL")
  const [search, setSearch] = React.useState("")

  const fetchHistory = React.useCallback(async () => {
    if (!isOpen) return
    setLoading(true)
    try {
      let url = branchId ? `/api/transactions?branchId=${branchId}` : "/api/transactions"
      let res = await fetch(url)
      let data = await res.json()

      // If OWNER and no transactions returned for specific activeBranchId, fallback to fetching all branches
      if (res.ok && userRole === "OWNER" && (!data.transactions || data.transactions.length === 0) && branchId) {
        url = "/api/transactions"
        res = await fetch(url)
        data = await res.json()
      }

      if (res.ok) {
        const allSales = (data.transactions || []) as SalesTransactionRecord[]
        setTransactions(allSales)
      }

      // Fetch branches for filter if OWNER
      if (userRole === "OWNER") {
        const branchRes = await fetch("/api/inventory")
        if (branchRes.ok) {
          const branchData = await branchRes.json()
          if (branchData.branches) setBranches(branchData.branches)
        }
      }
    } catch (err) {
      console.error("Failed to fetch sales history:", err)
    } finally {
      setLoading(false)
    }
  }, [isOpen, branchId, userRole])

  React.useEffect(() => {
    if (isOpen) {
      void fetchHistory()
    }
  }, [isOpen, fetchHistory])

  const filtered = React.useMemo(() => {
    return transactions.filter((tItem) => {
      if (filterBranchId !== "ALL") {
        const itemBranchId = tItem.branchId || tItem.branch?.id
        if (itemBranchId && itemBranchId !== filterBranchId) return false
      }

      if (!search.trim()) return true
      const q = search.toLowerCase()
      const codeMatch = (tItem.code || tItem.id || "").toLowerCase().includes(q)
      const staffMatch = (tItem.staff?.name || "").toLowerCase().includes(q)
      const branchMatch = (tItem.branch?.name || "").toLowerCase().includes(q)
      const itemsMatch = (tItem.items || []).some((i) => 
        (i.product?.name || i.variant?.name || "").toLowerCase().includes(q)
      )
      return codeMatch || staffMatch || branchMatch || itemsMatch
    })
  }, [transactions, search, filterBranchId])

  const handlePrintReceipt = (tItem: SalesTransactionRecord) => {
    const formattedReceipt: ReceiptTransaction = {
      id: tItem.id,
      subtotal: tItem.subtotal || tItem.totalAmount || 0,
      discountAmount: tItem.discountAmount || 0,
      total: tItem.totalAmount || tItem.total || 0,
      currency: "MMK",
      exchangeRate: 1,
      totalInMMK: tItem.totalAmount || tItem.total || 0,
      paymentMethod: tItem.paymentMethod || "CASH",
      cashReceived: tItem.cashReceived || null,
      changeGiven: tItem.changeGiven || null,
      status: tItem.status || "COMPLETED",
      note: tItem.note || null,
      receiptEmail: null,
      createdAt: tItem.createdAt,
      branch: {
        id: tItem.branch?.id || branchId || "",
        name: tItem.branch?.name || "Branch Shop",
        address: tItem.branch?.address || null,
        receiptHeader: null,
      },
      staff: {
        id: tItem.staff?.id || "",
        name: tItem.staff?.name || "Cashier",
      },
      items: (tItem.items || []).map((i) => ({
        id: i.id,
        productId: i.productId || "",
        variantId: i.variantId || null,
        quantity: i.quantity || 1,
        unitPrice: i.price || i.unitPrice || 0,
        discount: i.discount || 0,
        total: (i.quantity || 1) * (i.price || i.unitPrice || 0),
        note: null,
        product: {
          id: i.productId || "",
          name: i.product?.name || "Product",
          imageUrl: i.product?.imageUrl || null,
        },
        variant: i.variant ? { id: i.variantId || i.id, name: i.variant.name || "Default" } : null,
      })),
    }

    onSelectReceipt(formattedReceipt)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 bg-card border-border rounded-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <History className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground">
                  {t("Sales History & Vouchers", "အရောင်း ဘောက်ချာ မှတ်တမ်း")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t("View recent sales transactions and reprint receipts", "ရောင်းချခဲ့သော ဘောက်ချာများ ကြည့်ရန်နှင့် အစီရင်ခံစာ ထုတ်ရန်")}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchHistory()}
              disabled={loading}
              className="h-9 gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{t("Refresh", "ပြန်လည်ရယူရန်")}</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Stats Summary & Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/20 border-b border-border text-xs">
          <div className="bg-card border border-border p-3 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <p className="text-muted-foreground font-semibold">{t("Total Vouchers", "ဘောက်ချာ စုစုပေါင်း")}</p>
              <p className="text-base font-black text-foreground">{filtered.length} Vouchers</p>
            </div>
          </div>

          <div className="bg-card border border-border p-3 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-muted-foreground font-semibold">{t("Total Sales Revenue", "စုစုပေါင်း အရောင်းငွေ")}</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {filtered.reduce((sum, tItem) => sum + (tItem.totalAmount || tItem.total || 0), 0).toLocaleString()} Ks
              </p>
            </div>
          </div>

          {/* Branch Filter for Owner */}
          {userRole === "OWNER" && (
            <div className="bg-card border border-border p-2.5 rounded-xl flex items-center gap-2">
              <Building className="h-4 w-4 text-primary shrink-0" />
              <select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                className="w-full h-8 text-xs bg-background border-none rounded-md focus:outline-none font-semibold text-foreground cursor-pointer"
              >
                <option value="ALL">{t("All Branches", "ဆိုင်ခွဲ အားလုံး")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className={`${userRole === "OWNER" ? "col-span-1" : "col-span-2 sm:col-span-1"} bg-card border border-border p-2.5 rounded-xl flex items-center`}>
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("Search voucher / cashier / branch...", "ဘောက်ချာ / ဝန်ထမ်း / ဆိုင်ခွဲ ရှာရန်...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs bg-background border-border"
              />
            </div>
          </div>
        </div>

        {/* Transaction Table List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-semibold">{t("Loading sales history...", "အရောင်းမှတ်တမ်းများ ရယူနေပါသည်...")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-semibold">{t("No sales vouchers found", "အရောင်း ဘောက်ချာ စာရင်း မရှိသေးပါ")}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((tItem) => {
                const date = new Date(tItem.createdAt)
                const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                const dateStr = date.toLocaleDateString()
                const itemsSummary = (tItem.items || [])
                  .map((i) => `${i.product?.name || "Item"}${i.variant?.name ? ` (${i.variant.name})` : ""} x${i.quantity || 1}`)
                  .join(", ")

                return (
                  <div
                    key={tItem.id}
                    className="p-3.5 bg-card border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-all shadow-sm"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-primary">
                          #{tItem.code || tItem.id.slice(-8).toUpperCase()}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-semibold py-0">
                          {tItem.paymentMethod || "CASH"}
                        </Badge>
                        {tItem.branch?.name && (
                          <Badge variant="secondary" className="text-[10px] font-bold py-0 gap-1 bg-primary/10 text-primary border border-primary/20">
                            <Building className="h-2.5 w-2.5" />
                            {tItem.branch.name}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          {dateStr} • {timeStr}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-foreground truncate" title={itemsSummary}>
                        {itemsSummary || "Sales Order"}
                      </p>

                      {tItem.staff && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("Cashier", "အရောင်းဝန်ထမ်း")}: <span className="font-semibold text-foreground">{tItem.staff.name}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-muted-foreground block uppercase font-bold">{t("Total", "ကျသင့်ငွေ")}</span>
                        <span className="text-sm font-black text-primary">
                          {(tItem.totalAmount || tItem.total || 0).toLocaleString()} Ks
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintReceipt(tItem)}
                        className="h-8 gap-1.5 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{t("Receipt", "ဘောက်ချာ")}</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
