"use client"

import React, { useState, useEffect, useMemo } from "react"
import { format, subDays } from "date-fns"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import { 
  Download,
  Loader2,
  Building,
  Package,
  Users,
  CreditCard
} from "lucide-react"

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function ReportsPage() {
  const { t } = useLanguage()
  const { user } = useUser()
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"
  const branchId = user?.publicMetadata?.branchId as string | undefined

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderPayments: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expenses: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    salesOrders: any[]
  } | null>(null)

  // Date & Branch State
  const [dateRange, setDateRange] = useState<"LAST_7" | "LAST_30" | "CUSTOM">("LAST_7")
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL")

  useEffect(() => {
    if (role === "OWNER") {
      fetch("/api/branches")
        .then(res => res.json())
        .then(data => setBranches(data.branches || []))
    }
  }, [role])

  useEffect(() => {
    if (dateRange === "LAST_7") {
      setStartDate(subDays(new Date(), 7))
      setEndDate(new Date())
    } else if (dateRange === "LAST_30") {
      setStartDate(subDays(new Date(), 30))
      setEndDate(new Date())
    }
  }, [dateRange])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const url = new URL("/api/reports", window.location.origin)
      url.searchParams.append("startDate", startDate.toISOString())
      url.searchParams.append("endDate", endDate.toISOString())
      if (role !== "OWNER" && branchId) {
        url.searchParams.append("branchId", branchId)
      } else if (role === "OWNER" && selectedBranchId !== "ALL") {
        url.searchParams.append("branchId", selectedBranchId)
      }

      const res = await fetch(url.toString())
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedBranchId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportCSV = (filename: string, rows: any[][]) => {
    const csvContent = rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- Calculations ---

  // 1. Sales Data & COGS
  const salesSummary = useMemo(() => {
    if (!data) return { totalRevenue: 0, posRevenue: 0, orderRevenue: 0, txCount: 0, totalCOGS: 0, grossProfit: 0 }
    const posRevenue = data.transactions.reduce((sum, tx) => sum + tx.total, 0)
    const orderRevenue = data.orderPayments.reduce((sum, p) => sum + p.amount, 0)
    
    // Calculate COGS
    let posCOGS = 0
    data.transactions.forEach(tx => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.items.forEach((item: any) => {
        posCOGS += (item.quantity * (item.unitCost || 0))
      })
    })

    let orderCOGS = 0
    data.salesOrders.forEach(order => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order.items.forEach((item: any) => {
        orderCOGS += (item.quantity * (item.unitCost || 0))
      })
    })

    const totalRevenue = posRevenue + orderRevenue
    const totalCOGS = posCOGS + orderCOGS
    const grossProfit = totalRevenue - totalCOGS

    return {
      totalRevenue,
      posRevenue,
      orderRevenue,
      txCount: data.transactions.length + data.orderPayments.length,
      totalCOGS,
      grossProfit
    }
  }, [data])

  // 2. Product Performance
  const productPerformance = useMemo(() => {
    if (!data) return []
    const prodMap = new Map<string, { name: string, category: string, qty: number, revenue: number }>()
    
    data.transactions.forEach(tx => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.items.forEach((item: any) => {
        const key = `${item.product?.name} - ${item.variant?.name}`
        const categoryName = data.categories.find(c => c.id === item.product?.categoryId)?.name || "Uncategorized"
        const current = prodMap.get(key) || { name: key, category: categoryName, qty: 0, revenue: 0 }
        current.qty += item.quantity
        current.revenue += item.total
        prodMap.set(key, current)
      })
    })

    return Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue)
  }, [data])

  // 3. Staff Performance
  const staffPerformance = useMemo(() => {
    if (!data) return []
    const staffMap = new Map<string, { name: string, role: string, posRevenue: number, orderRevenue: number, txCount: number }>()
    
    data.transactions.forEach(tx => {
      const staffName = tx.staff?.name || "Unknown"
      const role = tx.staff?.role || "UNKNOWN"
      const current = staffMap.get(staffName) || { name: staffName, role, posRevenue: 0, orderRevenue: 0, txCount: 0 }
      current.posRevenue += tx.total
      current.txCount += 1
      staffMap.set(staffName, current)
    })

    data.orderPayments.forEach(p => {
      const staffName = "System (Sales Orders)"
      const role = "SYSTEM"
      const current = staffMap.get(staffName) || { name: staffName, role, posRevenue: 0, orderRevenue: 0, txCount: 0 }
      current.orderRevenue += p.amount
      current.txCount += 1
      staffMap.set(staffName, current)
    })

    return Array.from(staffMap.values()).sort((a, b) => (b.posRevenue + b.orderRevenue) - (a.posRevenue + a.orderRevenue))
  }, [data])

  // 4. Expenses
  const expenseSummary = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!data) return { total: 0, items: [] as any[] }
    const total = data.expenses.reduce((sum, e) => sum + e.amount, 0)
    return {
      total,
      items: [...data.expenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  }, [data])

  // 5. Profit & Loss Time Series
  const pnlData = useMemo(() => {
    if (!data) return []
    
    const dailyMap = new Map<string, { date: string, revenue: number, cogs: number, expenses: number, profit: number }>()
    
    const getDay = (dateStr: string) => {
      const day = format(new Date(dateStr), "MMM dd, yyyy")
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { date: day, revenue: 0, cogs: 0, expenses: 0, profit: 0 })
      }
      return dailyMap.get(day)!
    }

    data.transactions.forEach(tx => {
      const day = getDay(tx.createdAt)
      day.revenue += tx.total
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.items.forEach((item: any) => {
        day.cogs += (item.quantity * (item.unitCost || 0))
      })
    })

    data.orderPayments.forEach(p => {
      const day = getDay(p.createdAt)
      day.revenue += p.amount
    })

    data.salesOrders.forEach(order => {
      const day = getDay(order.createdAt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order.items.forEach((item: any) => {
        day.cogs += (item.quantity * (item.unitCost || 0))
      })
    })

    data.expenses.forEach(e => {
      const day = getDay(e.createdAt)
      day.expenses += e.amount
    })

    const sortedDays = Array.from(dailyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    sortedDays.forEach(day => {
      day.profit = day.revenue - day.cogs - day.expenses
    })

    return sortedDays
  }, [data])

  // 6. Branch Performance
  const branchPerformance = useMemo(() => {
    if (!data || role !== "OWNER" || selectedBranchId !== "ALL") return []
    const bMap = new Map<string, { name: string, revenue: number, cogs: number, expenses: number, profit: number }>()

    const getBranch = (bName?: string) => {
      const name = bName || "Unknown Branch"
      if (!bMap.has(name)) {
        bMap.set(name, { name, revenue: 0, cogs: 0, expenses: 0, profit: 0 })
      }
      return bMap.get(name)!
    }

    data.transactions.forEach(tx => {
      const b = getBranch(tx.branch?.name)
      b.revenue += tx.total
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.items.forEach((item: any) => {
        b.cogs += (item.quantity * (item.unitCost || 0))
      })
    })

    data.orderPayments.forEach(p => {
      const b = getBranch(p.salesOrder?.branch?.name)
      b.revenue += p.amount
    })

    data.salesOrders.forEach(order => {
      const b = getBranch(order.branch?.name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order.items.forEach((item: any) => {
        b.cogs += (item.quantity * (item.unitCost || 0))
      })
    })

    data.expenses.forEach(e => {
      const b = getBranch(e.branch?.name)
      b.expenses += e.amount
    })

    const arr = Array.from(bMap.values())
    arr.forEach(b => {
      b.profit = b.revenue - b.cogs - b.expenses
    })
    return arr.sort((a, b) => b.profit - a.profit)
  }, [data, role, selectedBranchId])

  if (role === "CASHIER") {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{t("Access Denied", "ဝင်ရောက်ခွင့်မရှိပါ")}</h2>
          <p className="text-muted-foreground mt-2">{t("You do not have permission to view reports.", "သင့်တွင် အစီရင်ခံစာများ ကြည့်ရှုပိုင်ခွင့် မရှိပါ။")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex gap-4 items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{t("Reports & Analytics", "အစီရင်ခံစာများနှင့် စာရင်းအင်းများ")}</h1>
            <p className="text-muted-foreground">{t("Comprehensive business performance insights", "စီးပွားရေး လုပ်ဆောင်ချက်ဆိုင်ရာ အစီရင်ခံစာများ")}</p>
          </div>
          
          {/* Branch Selector */}
          {role === "OWNER" && branches.length > 0 && (
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm self-start mt-1">
              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">{t("Active Branch", "လက်ရှိ ဆိုင်ခွဲ")}:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent border-0 text-sm font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-card text-foreground">{t("All Branches", "ဆိုင်ခွဲအားလုံး")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-card text-foreground">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center rounded-md border bg-muted/50 p-1">
            <Button
              variant={dateRange === "LAST_7" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDateRange("LAST_7")}
              className="text-xs"
            >
              {t("Last 7 Days", "လွန်ခဲ့သော ၇ ရက်")}
            </Button>
            <Button
              variant={dateRange === "LAST_30" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDateRange("LAST_30")}
              className="text-xs"
            >
              {t("Last 30 Days", "လွန်ခဲ့သော ရက် ၃၀")}
            </Button>
            <Button
              variant={dateRange === "CUSTOM" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDateRange("CUSTOM")}
              className="text-xs"
            >
              {t("Custom Range", "စိတ်ကြိုက် ရက်စွဲ")}
            </Button>
          </div>
          
          {dateRange === "CUSTOM" && (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="date" 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={format(startDate, "yyyy-MM-dd")}
                onChange={(e) => setStartDate(new Date(e.target.value || new Date()))}
              />
              <span className="text-muted-foreground text-sm">{t("to", "မှ")}</span>
              <input 
                type="date" 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={format(endDate, "yyyy-MM-dd")}
                onChange={(e) => setEndDate(new Date(e.target.value || new Date()))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("Total Revenue", "စုစုပေါင်း ဝင်ငွေ")}</CardDescription>
            <CardTitle className="text-2xl">{loading ? "..." : `${salesSummary.totalRevenue.toLocaleString()} Ks`}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("Total COGS", "စုစုပေါင်း ကုန်ကျစရိတ်")}</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{loading ? "..." : `${salesSummary.totalCOGS.toLocaleString()} Ks`}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("Gross Profit", "အကြမ်းဖျင်း အမြတ်")}</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{loading ? "..." : `${salesSummary.grossProfit.toLocaleString()} Ks`}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("Net Profit", "အသားတင် အမြတ်")}</CardDescription>
            <CardTitle className={`text-2xl ${(salesSummary.grossProfit - expenseSummary.total) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {loading ? "..." : `${(salesSummary.grossProfit - expenseSummary.total).toLocaleString()} Ks`}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="pnl" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pnl" className="flex items-center gap-2">{t("Profit & Loss", "အမြတ်နှင့် အရှုံး")}</TabsTrigger>
          {role === "OWNER" && selectedBranchId === "ALL" && (
            <TabsTrigger value="branches" className="flex items-center gap-2">{t("Branch Performance", "ဆိုင်ခွဲအလိုက် ဆောင်ရွက်ချက်")}</TabsTrigger>
          )}
          <TabsTrigger value="products" className="flex items-center gap-2"><Package className="h-4 w-4"/> {t("Product Performance", "ကုန်ပစ္စည်းအလိုက် ဆောင်ရွက်ချက်")}</TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2"><Users className="h-4 w-4"/> {t("Staff Performance", "ဝန်ထမ်းအလိုက် ဆောင်ရွက်ချက်")}</TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2"><CreditCard className="h-4 w-4"/> {t("Expenses", "စရိတ်များ")}</TabsTrigger>
        </TabsList>

        {/* P&L TAB */}
        <TabsContent value="pnl" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>{t("Profit & Loss Trend", "အမြတ်နှင့် အရှုံး အခြေအနေ")}</CardTitle>
                <CardDescription>{t("Revenue vs Expenses over time", "ဝင်ငွေနှင့် စရိတ်များ ယှဉ်ပြိုင်မှု")}</CardDescription>
              </CardHeader>
              <div className="h-80 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={12} tickMargin={10} />
                    <YAxis fontSize={12} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()} Ks`} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name={t("Revenue", "ဝင်ငွေ")} stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="cogs" name={t("COGS", "ကုန်ကျစရိတ်")} stroke="#f97316" strokeWidth={2} />
                    <Line type="monotone" dataKey="expenses" name={t("Expenses", "စရိတ်များ")} stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" name={t("Net Profit", "အသားတင် အမြတ်")} stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>{t("Daily Breakdown", "နေ့စဉ် အသေးစိတ် စာရင်း")}</CardTitle>
              </CardHeader>
              <div className="overflow-auto max-h-[350px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>{t("Date", "ရက်စွဲ")}</TableHead>
                      <TableHead className="text-right">{t("Revenue", "ဝင်ငွေ")}</TableHead>
                      <TableHead className="text-right">{t("COGS", "ကုန်ကျစရိတ်")}</TableHead>
                      <TableHead className="text-right">{t("Expenses", "စရိတ်များ")}</TableHead>
                      <TableHead className="text-right">{t("Net Profit", "အသားတင် အမြတ်")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pnlData.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("No data for this period.", "ဤကာလအတွင်း အချက်အလက် မရှိပါ။")}</TableCell></TableRow>
                    ) : (
                      [...pnlData].reverse().map((day, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{day.date}</TableCell>
                          <TableCell className="text-right text-emerald-600">{day.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-orange-600">{day.cogs.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-destructive">{day.expenses.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-bold ${day.profit >= 0 ? "text-blue-600" : "text-destructive"}`}>
                            {day.profit.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* BRANCH PERFORMANCE TAB */}
        {role === "OWNER" && selectedBranchId === "ALL" && (
          <TabsContent value="branches" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>{t("Branch Comparison", "ဆိုင်ခွဲများ နှိုင်းယှဉ်ချက်")}</CardTitle>
                  <CardDescription>{t("Revenue and Net Profit by Branch", "ဆိုင်ခွဲအလိုက် ဝင်ငွေနှင့် အသားတင် အမြတ်")}</CardDescription>
                </CardHeader>
                <div className="h-80 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchPerformance}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={12} tickMargin={10} />
                      <YAxis fontSize={12} />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()} Ks`} />
                      <Legend />
                      <Bar dataKey="revenue" name={t("Revenue", "ဝင်ငွေ")} fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name={t("Net Profit", "အသားတင် အမြတ်")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>{t("Branch Leaderboard", "ဆိုင်ခွဲများ ဦးဆောင်မှု ဇယား")}</CardTitle>
                </CardHeader>
                <div className="overflow-auto max-h-[350px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>{t("Branch", "ဆိုင်ခွဲ")}</TableHead>
                        <TableHead className="text-right">{t("Revenue", "ဝင်ငွေ")}</TableHead>
                        <TableHead className="text-right">{t("COGS", "ကုန်ကျစရိတ်")}</TableHead>
                        <TableHead className="text-right">{t("Expenses", "စရိတ်များ")}</TableHead>
                        <TableHead className="text-right">{t("Net Profit", "အသားတင် အမြတ်")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchPerformance.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("No branch data available.", "ဆိုင်ခွဲ အချက်အလက် မရှိသေးပါ။")}</TableCell></TableRow>
                      ) : (
                        branchPerformance.map((b, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell className="text-right text-emerald-600">{b.revenue.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-orange-600">{b.cogs.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-destructive">{b.expenses.toLocaleString()}</TableCell>
                            <TableCell className={`text-right font-bold ${b.profit >= 0 ? "text-blue-600" : "text-destructive"}`}>
                              {b.profit.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center print:hidden">
            <h3 className="text-lg font-bold">{t("Top Selling Products", "အရောင်းရဆုံး ပစ္စည်းများ")}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV("Product_Performance", [
                ["Product", "Category", "Quantity Sold", "Revenue (Ks)"],
                ...productPerformance.map(p => [p.name, p.category, p.qty, p.revenue])
              ])}>
                <Download className="h-4 w-4 mr-2"/> {t("Export CSV", "CSV ထုတ်ယူမည်")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                {t("Export PDF", "PDF ထုတ်ယူမည်")}
              </Button>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Product", "ကုန်ပစ္စည်း")}</TableHead>
                  <TableHead>{t("Category", "အမျိုးအစား")}</TableHead>
                  <TableHead className="text-right">{t("Qty Sold", "ရောင်းရသည့် အရေအတွက်")}</TableHead>
                  <TableHead className="text-right">{t("Revenue", "ဝင်ငွေ")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                ) : productPerformance.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("No sales data for this period.", "ဤကာလအတွင်း အရောင်း အချက်အလက် မရှိပါ။")}</TableCell></TableRow>
                ) : (
                  productPerformance.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{p.qty}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{p.revenue.toLocaleString()} Ks</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* STAFF TAB */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex justify-between items-center print:hidden">
            <h3 className="text-lg font-bold">{t("Staff Performance", "ဝန်ထမ်းအလိုက် ဆောင်ရွက်ချက်")}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV("Staff_Performance", [
                ["Staff Name", "Role", "Transactions", "POS Revenue", "Order Revenue", "Total Revenue"],
                ...staffPerformance.map(s => [s.name, s.role, s.txCount, s.posRevenue, s.orderRevenue, s.posRevenue + s.orderRevenue])
              ])}>
                <Download className="h-4 w-4 mr-2"/> {t("Export CSV", "CSV ထုတ်ယူမည်")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                {t("Export PDF", "PDF ထုတ်ယူမည်")}
              </Button>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Staff Member", "ဝန်ထမ်း")}</TableHead>
                  <TableHead>{t("Role", "ရာထူး")}</TableHead>
                  <TableHead className="text-right">{t("Transactions", "အရောင်းအကြိမ်ရေ")}</TableHead>
                  <TableHead className="text-right">{t("POS Sales", "POS အရောင်း")}</TableHead>
                  <TableHead className="text-right">{t("Order Payments", "အမှာစာ ငွေပေးချေမှု")}</TableHead>
                  <TableHead className="text-right">{t("Total Revenue", "စုစုပေါင်း ဝင်ငွေ")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                ) : staffPerformance.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("No staff data for this period.", "ဤကာလအတွင်း ဝန်ထမ်း အချက်အလက် မရှိပါ။")}</TableCell></TableRow>
                ) : (
                  staffPerformance.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell><Badge variant="secondary">{s.role}</Badge></TableCell>
                      <TableCell className="text-right">{s.txCount}</TableCell>
                      <TableCell className="text-right">{s.posRevenue.toLocaleString()} Ks</TableCell>
                      <TableCell className="text-right">{s.orderRevenue.toLocaleString()} Ks</TableCell>
                      <TableCell className="text-right font-black text-emerald-600">{(s.posRevenue + s.orderRevenue).toLocaleString()} Ks</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center print:hidden">
            <h3 className="text-lg font-bold">{t("Expense Log", "စရိတ် မှတ်တမ်း")}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV("Expenses_Log", [
                ["Date", "Branch", "Category", "Amount", "Note"],
                ...expenseSummary.items.map(e => [
                  format(new Date(e.createdAt), "yyyy-MM-dd HH:mm"),
                  e.branch?.name || "",
                  e.category,
                  e.amount,
                  e.note || ""
                ])
              ])}>
                <Download className="h-4 w-4 mr-2"/> {t("Export CSV", "CSV ထုတ်ယူမည်")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                {t("Export PDF", "PDF ထုတ်ယူမည်")}
              </Button>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Date", "ရက်စွဲ")}</TableHead>
                  <TableHead>{t("Category", "အမျိုးအစား")}</TableHead>
                  <TableHead>{t("Note", "မှတ်ချက်")}</TableHead>
                  <TableHead className="text-right">{t("Amount", "ပမာဏ")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                ) : expenseSummary.items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("No expenses recorded for this period.", "ဤကာလအတွင်း စရိတ်မှတ်တမ်း မရှိပါ။")}</TableCell></TableRow>
                ) : (
                  expenseSummary.items.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(e.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate" title={e.note || ""}>{e.note || "-"}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{e.amount.toLocaleString()} Ks</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
