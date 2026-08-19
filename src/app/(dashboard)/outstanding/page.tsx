"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import {
  HandCoins,
  Search,
  Filter,
  Loader2,
  DollarSign,
  Printer,
  Calendar,
  Building,
  User,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Receipt,
  FileText,
  Clock,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/ui/table-pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"

interface DebtItem {
  id: string
  salesOrderId: string
  branchId: string
  branchName: string
  customerId: string | null
  customerName: string
  customerPhone: string | null
  total: number
  amountPaid: number
  remainingDebt: number
  paymentStatus: string
  status: string
  createdAt: string
  lastPaymentDate: string
  itemsCount: number
  payments: Array<{
    id: string
    amount: number
    method: string
    note: string | null
    createdAt: string
  }>
}

interface Branch {
  id: string
  name: string
}

export default function OutstandingPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = user?.publicMetadata?.role as string | undefined

  // Data States
  const [debts, setDebts] = useState<DebtItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  // Metrics
  const [totalDebt, setTotalDebt] = useState(0)
  const [totalDebtors, setTotalDebtors] = useState(0)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBranch, setSelectedBranch] = useState<string>("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal States
  const [payModalItem, setPayModalItem] = useState<DebtItem | null>(null)
  const [payAmount, setPayAmount] = useState<number>(0)
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "QR" | "SPLIT">("CASH")
  const [payNote, setPayNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState("")

  // Receipt Modal State
  const [receiptItem, setReceiptItem] = useState<{
    order: DebtItem
    paymentAmount: number
    paymentMethod: string
    paymentDate: string
  } | null>(null)

  // Fetch Branches
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await fetch("/api/branches")
        if (res.ok) {
          const data = await res.json()
          setBranches(Array.isArray(data) ? data : (data.branches || []))
        }
      } catch (err) {
        console.error("Fetch branches error:", err)
      }
    }
    fetchBranches()
  }, [])

  // Fetch Debts
  const fetchDebts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set("q", searchQuery)
      if (selectedBranch) params.set("branchId", selectedBranch)

      const res = await fetch(`/api/outstanding?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDebts(data.debts || [])
        setTotalDebt(data.totalOutstandingDebt || 0)
        setTotalDebtors(data.totalDebtors || 0)
        setPendingOrdersCount(data.pendingOrdersCount || 0)
      }
    } catch (err) {
      console.error("Fetch outstanding debts error:", err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedBranch])

  useEffect(() => {
    fetchDebts()
  }, [fetchDebts])

  // Open Pay Modal
  const handleOpenPayModal = (item: DebtItem) => {
    setPayModalItem(item)
    setPayAmount(item.remainingDebt)
    setPayMethod("CASH")
    setPayNote("")
    setPayError("")
  }

  // Handle Debt Payment Submit
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payModalItem) return
    if (payAmount <= 0) {
      setPayError(t("Please enter a valid payment amount greater than 0.", "0 ထက်ကြီးသော မှန်ကန်သော ငွေပမာဏ ရိုက်ထည့်ပါ"))
      return
    }
    if (payAmount > payModalItem.remainingDebt) {
      setPayError(
        t(
          `Payment amount (${payAmount.toLocaleString()} Ks) cannot exceed remaining debt (${payModalItem.remainingDebt.toLocaleString()} Ks).`,
          `ပေးချေသော ငွေပမာဏ (${payAmount.toLocaleString()} ကျပ်) သည် ကျန်ရှိသော ကြွေးကျန် (${payModalItem.remainingDebt.toLocaleString()} ကျပ်) ထက် မပိုရပါ`
        )
      )
      return
    }

    setSubmitting(true)
    setPayError("")
    try {
      const res = await fetch("/api/outstanding/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderId: payModalItem.salesOrderId,
          amount: payAmount,
          method: payMethod,
          note: payNote,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to process debt collection payment")
      }

      // Show receipt modal
      const paidAmt = payAmount
      const paidMethod = payMethod
      const paidItem = payModalItem

      setReceiptItem({
        order: paidItem,
        paymentAmount: paidAmt,
        paymentMethod: paidMethod,
        paymentDate: new Date().toISOString(),
      })

      setPayModalItem(null)
      fetchDebts()
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment error")
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Print Receipt
  const handlePrintReceipt = () => {
    window.print()
  }

  // Pagination slice
  const paginatedDebts = debts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HandCoins className="h-7 w-7 text-amber-500" />
            {t("Outstanding Debt Collection Center", "ရရန်ရှိ ကြွေးကျန်များ စီမံခန့်ခွဲရေး စင်တာ")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "Track unpaid customer debts, manage partial order balances, and process debt collection payments",
              "ဝယ်ယူသူများထံမှ ရရန်ရှိသော ကြွေးကျန်များနှင့် အရစ်ကျ ပေးချေမှုများကို စနစ်တကျ ကောက်ခံရန်"
            )}
          </p>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-amber-500/30 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">
              {t("Total Debt to Collect", "စုစုပေါင်း သိမ်းရန်ရှိ ကြွေးကျန်")}
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {totalDebt.toLocaleString()} Ks
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">
              {t("Debtor Customers", "ကြွေးကျန်ရှိသူ ဝယ်သူများ")}
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{totalDebtors}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">
              {t("Unpaid Orders", "မပြီးပြတ်သေးသော ကြွေးကျန်အမှာစာများ")}
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{pendingOrdersCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("Search by customer name, phone, or order #...", "ဝယ်သူအမည်၊ ဖုန်း သို့မဟုတ် အမှာစာနံပါတ် ရှာရန်...")}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </div>

        {role === "OWNER" && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium focus:outline-none"
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="">{t("All Branches / ဆိုင်ခွဲအားလုံး", "ဆိုင်ခွဲအားလုံး")}</option>
              {Array.isArray(branches) && branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Debt Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">ORDER #</TableHead>
              <TableHead className="font-bold">CUSTOMER</TableHead>
              <TableHead className="font-bold">BRANCH</TableHead>
              <TableHead className="font-bold">DATE</TableHead>
              <TableHead className="text-right font-bold">TOTAL PRICE</TableHead>
              <TableHead className="text-right font-bold">PAID AMOUNT</TableHead>
              <TableHead className="text-right font-bold text-amber-600 dark:text-amber-400">REMAINING DEBT</TableHead>
              <TableHead className="text-center font-bold">STATUS</TableHead>
              <TableHead className="text-right font-bold">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading outstanding debts...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedDebts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground font-medium">
                  <HandCoins className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-500" />
                  <p>{t("No outstanding debts found! All customer accounts are fully paid.", "ကြွေးကျန်ရှိသော အမှာစာ မရှိပါခင်ဗျာ။")}</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedDebts.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold font-mono text-xs">
                    #{item.salesOrderId.slice(-6).toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{item.customerName}</span>
                      {item.customerPhone && (
                        <span className="text-xs text-muted-foreground font-mono">{item.customerPhone}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {item.branchName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {format(new Date(item.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.total.toLocaleString()} Ks
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.amountPaid.toLocaleString()} Ks
                  </TableCell>
                  <TableCell className="text-right font-black text-amber-600 dark:text-amber-400">
                    {item.remainingDebt.toLocaleString()} Ks
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold text-[10px]">
                      PARTIAL DEBT
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handleOpenPayModal(item)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                    >
                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                      {t("Collect Debt", "ကြွေးဆပ်မည်")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          total={debts.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Collect Debt Payment Modal */}
      <Dialog open={!!payModalItem} onOpenChange={(open) => !open && setPayModalItem(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <HandCoins className="h-6 w-6" />
              {t("Debt Collection Payment", "ကြွေးဆပ်ငွေ လက်ခံရန်")}
            </DialogTitle>
            <DialogDescription>
              {payModalItem && (
                <span className="block mt-1 text-foreground font-semibold">
                  Order #{payModalItem.salesOrderId.slice(-6).toUpperCase()} • {payModalItem.customerName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {payModalItem && (
            <form onSubmit={handlePaySubmit} className="space-y-4 py-2">
              {payError && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {/* Debt Summary Box */}
              <div className="bg-muted/40 p-4 rounded-xl border space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Order Amount:</span>
                  <span className="font-bold">{payModalItem.total.toLocaleString()} Ks</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Already Paid:</span>
                  <span className="font-bold">{payModalItem.amountPaid.toLocaleString()} Ks</span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400 border-t pt-2 text-base font-black">
                  <span>Remaining Debt:</span>
                  <span>{payModalItem.remainingDebt.toLocaleString()} Ks</span>
                </div>
              </div>

              {/* Amount to Pay Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold block">
                  {t("Payment Amount / ပေးချေမည့် ပမာဏ (Ks) *", "ပေးချေမည့် ပမာဏ (ကျပ်) *")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={payModalItem.remainingDebt}
                  value={payAmount || ""}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    if (val > payModalItem.remainingDebt) {
                      setPayAmount(payModalItem.remainingDebt)
                      setPayError(
                        t(
                          `Payment amount cannot exceed remaining debt (${payModalItem.remainingDebt.toLocaleString()} Ks).`,
                          `ပေးချေသော ငွေပမာဏသည် ကျန်ရှိသော ကြွေးကျန် (${payModalItem.remainingDebt.toLocaleString()} ကျပ်) ထက် မပိုရပါ`
                        )
                      )
                    } else {
                      setPayAmount(val)
                      setPayError("")
                    }
                  }}
                  placeholder="Enter amount..."
                  className={`text-lg font-bold ${payAmount > payModalItem.remainingDebt ? "border-destructive text-destructive" : "text-amber-600 dark:text-amber-400"}`}
                  required
                />
                {payError ? (
                  <p className="text-xs text-destructive font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {payError}
                  </p>
                ) : (
                  <span className="text-[11px] text-muted-foreground block">
                    Default is total remaining debt ({payModalItem.remainingDebt.toLocaleString()} Ks). Maximum allowed: {payModalItem.remainingDebt.toLocaleString()} Ks.
                  </span>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold block">
                  {t("Payment Method / ငွေပေးချေသည့် နည်းလမ်း *", "ငွေပေးချေသည့် နည်းလမ်း *")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={payMethod === "CASH" ? "default" : "outline"}
                    onClick={() => setPayMethod("CASH")}
                    className="flex flex-col gap-1 py-3 h-auto"
                  >
                    <Banknote className="h-4 w-4" />
                    <span className="text-xs">CASH</span>
                  </Button>
                  <Button
                    type="button"
                    variant={payMethod === "QR" ? "default" : "outline"}
                    onClick={() => setPayMethod("QR")}
                    className="flex flex-col gap-1 py-3 h-auto"
                  >
                    <QrCode className="h-4 w-4" />
                    <span className="text-xs">KPay / QR</span>
                  </Button>
                  <Button
                    type="button"
                    variant={payMethod === "CARD" ? "default" : "outline"}
                    onClick={() => setPayMethod("CARD")}
                    className="flex flex-col gap-1 py-3 h-auto"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span className="text-xs">CARD</span>
                  </Button>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block text-muted-foreground">
                  {t("Note / မှတ်ချက် (Optional)", "မှတ်ချက်")}
                </label>
                <Input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Paid via KPay by Ko Aung"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setPayModalItem(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {t("Confirm Payment & Receipt", "ငွေလက်ခံ၍ ပြေစာထုတ်မည်")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Printed Receipt Modal */}
      <Dialog open={!!receiptItem} onOpenChange={(open) => !open && setReceiptItem(null)}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-center font-bold flex items-center justify-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {t("Debt Collection Receipt", "ကြွေးဆပ် ပြေစာ")}
            </DialogTitle>
          </DialogHeader>

          {receiptItem && (
            <div className="space-y-4 text-xs font-mono py-2">
              <div className="text-center border-b pb-3 space-y-1">
                <h3 className="font-black text-sm uppercase">SMARTPOS RETAIL POS</h3>
                <p className="text-muted-foreground text-[10px]">{receiptItem.order.branchName}</p>
                <p className="text-[10px] text-muted-foreground">
                  Date: {format(new Date(receiptItem.paymentDate), "yyyy-MM-dd HH:mm:ss")}
                </p>
              </div>

              <div className="space-y-1.5 border-b pb-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt No:</span>
                  <span className="font-bold">RCP-{Date.now().toString().slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Ref:</span>
                  <span className="font-bold">#{receiptItem.order.salesOrderId.slice(-6).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-bold">{receiptItem.order.customerName}</span>
                </div>
              </div>

              <div className="space-y-2 border-b pb-3">
                <div className="flex justify-between">
                  <span>Previous Debt:</span>
                  <span>{receiptItem.order.remainingDebt.toLocaleString()} Ks</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  <span>Amount Paid:</span>
                  <span>-{receiptItem.paymentAmount.toLocaleString()} Ks</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment Method:</span>
                  <span>{receiptItem.paymentMethod}</span>
                </div>
                <div className="flex justify-between font-black text-amber-600 dark:text-amber-400 text-sm border-t pt-2">
                  <span>Remaining Debt:</span>
                  <span>{Math.max(0, receiptItem.order.remainingDebt - receiptItem.paymentAmount).toLocaleString()} Ks</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-muted-foreground pt-2">
                <p>Thank you for your business!</p>
                <p className="mt-1">ကျေးဇူးအထူးတင်ရှိပါသည်ခင်ဗျာ။</p>
              </div>

              <DialogFooter className="pt-2 flex justify-center">
                <Button onClick={handlePrintReceipt} className="w-full font-bold">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt / ပြေစာရိုက်ထုတ်မည်
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
