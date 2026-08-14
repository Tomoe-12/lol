"use client"

import * as React from "react"
import {
  DollarSign,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Building,
  Calendar,
  Filter,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { TablePagination } from "@/components/ui/table-pagination"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"

// ─── Types ───────────────────────────────────────────────────────────────────

type ExpenseCategory = "RENT" | "ELECTRICITY" | "WATER" | "SALARIES" | "SUPPLIES" | "OTHER"

interface Branch {
  id: string
  name: string
}

interface Expense {
  id: string
  branchId: string
  branch: Branch
  category: ExpenseCategory
  amount: number
  currency: string
  note: string | null
  date: string
  createdAt: string
}

interface BranchSummary {
  branch: Branch
  revenue: number
  totalExpenses: number
  netProfit: number
}

const CATEGORY_LABELS: Record<ExpenseCategory, { labelEn: string; labelMy: string; color: string }> = {
  RENT: { labelEn: "Rent", labelMy: "ငှားရမ်းခ", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  ELECTRICITY: { labelEn: "Electricity", labelMy: "မီးဖိုး", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  WATER: { labelEn: "Water", labelMy: "ရေဖိုး", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  SALARIES: { labelEn: "Salaries", labelMy: "လုပ်ခ", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  SUPPLIES: { labelEn: "Supplies", labelMy: "ပစ္စည်း", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  OTHER: { labelEn: "Other", labelMy: "အခြား", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"

  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Pagination
  const [expPage, setExpPage] = React.useState(1)
  const [expPageSize, setExpPageSize] = React.useState(10)

  // Data
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [summary, setSummary] = React.useState<BranchSummary[]>([])
  const [branches, setBranches] = React.useState<Branch[]>([])

  // Filters
  const [filterBranchId, setFilterBranchId] = React.useState("ALL")
  const [filterCategory, setFilterCategory] = React.useState<ExpenseCategory | "ALL">("ALL")
  const [filterStartDate, setFilterStartDate] = React.useState("")
  const [filterEndDate, setFilterEndDate] = React.useState("")

  // Add Expense Dialog
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [expBranchId, setExpBranchId] = React.useState("")
  const [expCategory, setExpCategory] = React.useState<ExpenseCategory>("RENT")
  const [expAmount, setExpAmount] = React.useState("")
  const [expCurrency, setExpCurrency] = React.useState("MMK")
  const [expNote, setExpNote] = React.useState("")
  const [expDate, setExpDate] = React.useState(new Date().toISOString().split("T")[0])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { fetchData() }, [])

  React.useEffect(() => {
    if (isFormOpen) {
      setExpCategory("RENT")
      setExpAmount("")
      setExpNote("")
      setExpDate(new Date().toISOString().split("T")[0])
      setError(null)
    }
  }, [isFormOpen])

  const buildQueryString = () => {
    const params = new URLSearchParams()
    if (filterBranchId !== "ALL") params.set("branchId", filterBranchId)
    if (filterStartDate) params.set("startDate", filterStartDate)
    if (filterEndDate) params.set("endDate", filterEndDate)
    return params.toString()
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const qs = buildQueryString()
      const [expRes, branchRes] = await Promise.all([
        fetch(`/api/expenses${qs ? `?${qs}` : ""}`),
        fetch("/api/inventory"),
      ])
      const [expData, branchData] = await Promise.all([expRes.json(), branchRes.json()])
      setExpenses(expData.expenses ?? [])
      setSummary(expData.summary ?? [])
      setBranches(branchData.branches ?? [])
      if (branchData.branches?.length > 0 && !expBranchId) {
        setExpBranchId(user?.branchId || branchData.branches[0].id)
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (user?.branchId && user.role !== "OWNER") {
      setExpBranchId(user.branchId)
      setFilterBranchId(user.branchId)
    }
  }, [user?.branchId, user?.role])

  const applyFilters = () => fetchData()

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expBranchId || !expCategory || !expAmount) {
      return setError(t("Please fill all required fields", "လိုအပ်သော အချက်အလက်များ အားလုံး ဖြည့်ပါ"))
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: expBranchId,
          category: expCategory,
          amount: Number(expAmount),
          currency: expCurrency,
          note: expNote || undefined,
          date: expDate,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to add expense")
      }
      setIsFormOpen(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setActionLoading(false)
    }
  }

  const [deleteExpenseTarget, setDeleteExpenseTarget] = React.useState<string | null>(null)

  const executeDeleteExpense = async (id: string) => {
    setActionLoading(true)
    try {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" })
      await fetchData()
    } catch (err) {
      console.error("Delete expense error:", err)
    } finally {
      setActionLoading(false)
      setDeleteExpenseTarget(null)
    }
  }

  // Filtered list
  const filteredExpenses = expenses.filter((e) => {
    const matchBranch = filterBranchId === "ALL" || e.branchId === filterBranchId
    const matchCat = filterCategory === "ALL" || e.category === filterCategory
    return matchBranch && matchCat
  })

  const pagedExpenses = filteredExpenses.slice((expPage - 1) * expPageSize, expPage * expPageSize)

  const formatMMK = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M Ks"
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K Ks"
    return n.toLocaleString() + " Ks"
  }

  const totalRevenue = summary.reduce((s, b) => s + b.revenue, 0)
  const totalExpenses = summary.reduce((s, b) => s + b.totalExpenses, 0)
  const totalNetProfit = totalRevenue - totalExpenses

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>{t("Loading expense data...", "ကုန်ကျစရိတ် ဒေတာ ရယူနေပါသည်...")}</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            {t("Expenses & Profit Report", "ကုန်ကျစရိတ်နှင့် အမြတ် အစီရင်ခံစာ")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Track branch expenses and calculate net profit", "ဆိုင်ခွဲအလိုက် ကုန်ကျစရိတ်များနှင့် အသားတင်အမြတ် စာရင်းများ")}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t("Log Expense", "စရိတ်စာရင်းသွင်းမည်")}
        </Button>
      </div>

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {t("Total Revenue", "စုစုပေါင်း ဝင်ငွေ")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatMMK(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("All branches combined", "ဆိုင်ခွဲအားလုံး ပေါင်းလဒ်")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              {t("Total Expenses", "စုစုပေါင်း ကုန်ကျစရိတ်")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatMMK(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("All branches combined", "ဆိုင်ခွဲအားလုံး ပေါင်းလဒ်")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              {t("Net Profit", "အသားတင် အမြတ်")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalNetProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totalNetProfit >= 0 ? "+" : ""}{formatMMK(totalNetProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("Revenue minus expenses", "ဝင်ငွေ နှုတ် ကုန်ကျစရိတ်")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Branch Profit Breakdown */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          {t("Net Profit by Branch", "ဆိုင်ခွဲအလိုက် အသားတင်အမြတ်")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((s) => (
            <Card key={s.branch.id} className="relative overflow-hidden">
              <div
                className={`absolute inset-0 opacity-5 ${s.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <CardContent className="pt-4">
                <p className="text-sm font-semibold">{s.branch.name}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t("Revenue", "ဝင်ငွေ")}</span>
                    <span className="text-emerald-600 font-medium">{formatMMK(s.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("Expenses", "ကုန်ကျစရိတ်")}</span>
                    <span className="text-red-600 font-medium">−{formatMMK(s.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span className="font-semibold text-foreground">{t("Net Profit", "အသားတင်အမြတ်")}</span>
                    <span className={`font-bold text-sm ${s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {s.netProfit >= 0 ? "+" : ""}{formatMMK(s.netProfit)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap bg-muted/30 rounded-xl p-4 border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
        {role === "OWNER" && (
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">{t("Branch", "ဆိုင်ခွဲ")}</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm cursor-pointer"
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
            >
              <option value="ALL">{t("All Branches", "ဆိုင်ခွဲ အားလုံး")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">{t("Category", "အမျိုးအစား")}</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm cursor-pointer"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | "ALL")}
          >
            <option value="ALL">{t("All Categories", "အမျိုးအစား အားလုံး")}</option>
            {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{t(val.labelEn, val.labelMy)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">{t("Start Date", "စတင်မည့် ရက်စွဲ")}</label>
          <Input
            type="date"
            className="w-36"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">{t("End Date", "ကုန်ဆုံးမည့် ရက်စွဲ")}</label>
          <Input
            type="date"
            className="w-36"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={applyFilters} className="mt-auto font-semibold">
          {t("Apply Filters", "စစ်ထုတ်မည်")}
        </Button>
      </div>

      {/* Expense List */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("DATE", "ရက်စွဲ")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("BRANCH", "ဆိုင်ခွဲ")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("CATEGORY", "အမျိုးအစား")}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("AMOUNT", "ပမာဏ")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("NOTE", "မှတ်ချက်")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>{t("No expense records found. Click \"Log Expense\" to add one.", "ကုန်ကျစရိတ် မှတ်တမ်း မရှိပါ။ \"စရိတ်စာရင်းသွင်းမည်\" ကို နှိပ်၍ ထည့်သွင်းပါ။")}</p>
                </td>
              </tr>
            ) : (
              pagedExpenses.map((expense) => (
                <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{expense.branch.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CATEGORY_LABELS[expense.category].color}`}>
                      {t(CATEGORY_LABELS[expense.category].labelEn, CATEGORY_LABELS[expense.category].labelMy)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    {expense.amount.toLocaleString()} {expense.currency}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground italic">{expense.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteExpenseTarget(expense.id)}
                      disabled={actionLoading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          total={filteredExpenses.length}
          page={expPage}
          pageSize={expPageSize}
          onPageChange={setExpPage}
          onPageSizeChange={(s) => { setExpPageSize(s); setExpPage(1); }}
        />
      </div>

      {/* ─── Add Expense Dialog ────────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Log New Expense", "ကုန်ကျစရိတ် အသစ်ထည့်ရန်")}</DialogTitle>
            <DialogDescription>
              {t("Record a branch operating expense for profit tracking", "အမြတ်ငွေ တွက်ချက်ရန် ဆိုင်ခွဲ လည်ပတ်စရိတ် မှတ်တမ်းတင်ပါ")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            {role === "OWNER" && (
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Branch *", "ဆိုင်ခွဲ *")}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
                  value={expBranchId}
                  onChange={(e) => setExpBranchId(e.target.value)}
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Category *", "အမျိုးအစား *")}</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
                value={expCategory}
                onChange={(e) => {
                  const val = e.target.value as ExpenseCategory
                  setExpCategory(val)
                  if (val !== "OTHER") {
                    setExpNote("")
                  }
                }}
                required
              >
                {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>{t(val.labelEn, val.labelMy)}</option>
                ))}
              </select>
            </div>
            {expCategory === "OTHER" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-sm font-medium mb-1 block">{t("Reason *", "အကြောင်းရင်း *")}</label>
                <Input
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder={t("e.g. Purchased coffee cups", "ဥပမာ - ကော်ဖီခွက်များ ဝယ်ယူခြင်း")}
                  required
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Amount *", "ပမာဏ *")}</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 500000"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Currency", "ငွေကြေး")}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
                  value={expCurrency}
                  onChange={(e) => setExpCurrency(e.target.value)}
                >
                  <option value="MMK">MMK (Kyat)</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Date *", "ရက်စွဲ *")}</label>
              <Input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                {t("Cancel", "မလုပ်တော့ပါ")}
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("Log Expense", "စရိတ်စာရင်းသွင်းမည်")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteExpenseTarget !== null}
        onClose={() => setDeleteExpenseTarget(null)}
        onConfirm={() => deleteExpenseTarget && executeDeleteExpense(deleteExpenseTarget)}
        title={t("Delete Expense", "စရိတ် ပယ်ဖျက်ရန်")}
        description={t("Are you sure you want to delete this expense record?", "ဤစရိတ်မှတ်တမ်းအား ပယ်ဖျက်ရန် သေချာပါသလား။")}
        confirmText={t("Delete", "ပယ်ဖျက်မည်")}
        variant="danger"
        loading={actionLoading}
      />

    </div>
  )
}
