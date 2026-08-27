"use client"

import * as React from "react"
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  Download,
  Building,
  User,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardCharts } from "@/components/dashboard/dashboard-charts"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"

interface Stats {
  revenueMMK: number;
  salesOrderDepositsMMK: number;
  transactionCount: number;
  lowStockCount: number;
  pendingReceivables: number;
  activeStaffCount: string;
}

interface BranchPerf {
  id: string;
  name: string;
  revenue: number;
  txn: number;
  status: "online" | "offline";
}

interface LiveFeedItem {
  id: string;
  branchName: string;
  staffName: string;
  total: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
}

interface ProductRanking {
  name: string;
  quantity: number;
  revenue: number;
}

interface StaffRanking {
  name: string;
  role: string;
  txn: number;
  revenue: number;
}

interface RevenueTrendPoint {
  date: string;
  [branchName: string]: number | string;
}

interface PeakHourPoint {
  hour: string;
  amount: number;
  txCount: number;
}

export default function DashboardPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"

  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"charts" | "rankings">("charts")

  // API Data
  const [stats, setStats] = React.useState<Stats>({
    revenueMMK: 0,
    salesOrderDepositsMMK: 0,
    transactionCount: 0,
    lowStockCount: 0,
    pendingReceivables: 0,
    activeStaffCount: "0 / 0",
  })
  const [branchPerformance, setBranchPerformance] = React.useState<BranchPerf[]>([])
  const [revenueTrends, setRevenueTrends] = React.useState<RevenueTrendPoint[]>([])
  const [peakHours, setPeakHours] = React.useState<PeakHourPoint[]>([])
  const [bestSellers, setBestSellers] = React.useState<ProductRanking[]>([])
  const [worstSellers, setWorstSellers] = React.useState<ProductRanking[]>([])
  const [staffRankings, setStaffRankings] = React.useState<StaffRanking[]>([])
  const [liveFeed, setLiveFeed] = React.useState<LiveFeedItem[]>([])
  const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([])
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("ALL")

  const kpiSkeleton = "bg-muted animate-pulse rounded-lg"

  // Fetch all dashboard data from API
  const fetchDashboardData = React.useCallback(async (isRefresh = false, branchId = selectedBranchId) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch(`/api/dashboard/stats?branchId=${branchId}`)
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
        if (data.branches) setBranches(data.branches)
        if (data.selectedBranchId) setSelectedBranchId(data.selectedBranchId)
        setBranchPerformance(data.branchPerformance)
        setRevenueTrends(data.revenueTrends)
        setPeakHours(data.peakHours)
        setBestSellers(data.bestSellers)
        setWorstSellers(data.worstSellers)
        setStaffRankings(data.staffRankings)
        setLiveFeed(data.liveFeed)
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedBranchId])

  React.useEffect(() => {
    fetchDashboardData(false, selectedBranchId)
  }, [fetchDashboardData, selectedBranchId])

  const handleExport = (type: "transactions" | "stock") => {
    window.open(`/api/dashboard/export?type=${type}`, "_blank")
  }

  const branchNames = branchPerformance.map((b) => b.name)
  const tableSkeleton = (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted" />
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Management Dashboard</h1>
            <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-xs font-bold gap-1 px-2.5 py-1">
              <Building className="h-3.5 w-3.5" />
              {selectedBranchId === "ALL" 
                ? t("All Branches", "ဆိုင်ခွဲအားလုံး") 
                : (branches.find(b => b.id === selectedBranchId)?.name || "Selected Branch")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time business insights and analytics
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Branch Selector Dropdown */}
          {role === "OWNER" && (
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">Active Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  const newBranchId = e.target.value
                  setSelectedBranchId(newBranchId)
                  fetchDashboardData(false, newBranchId)
                }}
                className="bg-transparent border-0 text-sm font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-card text-foreground font-bold">
                  {t("All Branches", "ဆိုင်ခွဲအားလုံး")}
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-card text-foreground font-medium">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CSV Exporting buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("transactions")}
            disabled={loading}
            className="text-xs font-bold border-border text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-primary" />
            Export Sales
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("stock")}
            disabled={loading}
            className="text-xs font-bold border-border text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-primary" />
            Export Stock
          </Button>
          
          <Button
            onClick={() => fetchDashboardData(true, selectedBranchId)}
            disabled={loading || refreshing}
            size="sm"
            className="text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("Cash Received Today", "ယနေ့ လက်ခံရရှိငွေ")}
              </CardDescription>
              <div className="rounded-xl p-2 bg-emerald-500/10">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className={`${kpiSkeleton} h-8 w-40`} />
            ) : (
              <>
                <div className="text-2xl font-black text-foreground">{stats.revenueMMK.toLocaleString()} Ks</div>
                <p className="text-xs text-muted-foreground mt-1">Today only ({new Date().toLocaleDateString()}) · Includes {stats.salesOrderDepositsMMK.toLocaleString()} Ks in sales-order deposits</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pending Receivables
              </CardDescription>
              <div className={`rounded-xl p-2 ${stats.pendingReceivables > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                <Building className={`h-4 w-4 ${stats.pendingReceivables > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className={`${kpiSkeleton} h-8 w-40`} />
            ) : (
              <>
                <div className={`text-2xl font-black ${stats.pendingReceivables > 0 ? "text-red-500" : "text-foreground"}`}>
                  {stats.pendingReceivables.toLocaleString()} Ks
                </div>
                <p className="text-xs text-muted-foreground mt-1">Money owed by customers</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("Transactions", "ပြေစာစုစုပေါင်း")}
              </CardDescription>
              <div className="rounded-xl p-2 bg-blue-500/10">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className={`${kpiSkeleton} h-8 w-24`} />
            ) : (
              <>
                <div className="text-2xl font-black text-foreground">{stats.transactionCount} Orders</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {role === "MANAGER" ? "For your branch" : "Across all branches"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("Low Stock Alerts", "ပစ္စည်းနည်းနေမှု")}
              </CardDescription>
              <div className={`rounded-xl p-2 ${stats.lowStockCount > 0 ? "bg-destructive/10" : "bg-amber-500/10"}`}>
                <Package className={`h-4 w-4 ${stats.lowStockCount > 0 ? "text-destructive" : "text-amber-500"}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className={`${kpiSkeleton} h-8 w-24`} />
            ) : (
              <>
                <div className={`text-2xl font-black ${stats.lowStockCount > 0 ? "text-destructive" : "text-foreground"}`}>
                  {stats.lowStockCount} Products
                </div>
                <p className="text-xs text-muted-foreground mt-1">Below target threshold</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("Active Staff", "တာဝန်ကျဝန်ထမ်း")}
              </CardDescription>
              <div className="rounded-xl p-2 bg-purple-500/10">
                <Users className="h-4 w-4 text-purple-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className={`${kpiSkeleton} h-8 w-20`} />
            ) : (
              <>
                <div className="text-2xl font-black text-foreground">{stats.activeStaffCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Cashiers active today</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Main content grid */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Left Side: Branch Performance + Charts/Rankings tabs (2/3 width) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Branch Performance table card */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center justify-between text-foreground">
                <span>{t("Branch Performance", "ဆိုင်ခွဲအခြေအနေ")}</span>
                <Badge variant="success" className="text-[10px] px-1.5 py-0.5 animate-pulse">Live Feed</Badge>
              </CardTitle>
              <CardDescription className="text-xs">Revenues and transactions processed today</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                tableSkeleton
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold text-[10px] uppercase">
                      <th className="p-4">{t("Branch", "ဆိုင်ခွဲ")}</th>
                      <th className="p-4">{t("Cash Received Today", "ယနေ့ လက်ခံရရှိငွေ")}</th>
                      <th className="p-4 text-center">Tx Count</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-muted-foreground italic">
                          No active branches found.
                        </td>
                      </tr>
                    ) : (
                      branchPerformance.map((b) => (
                        <tr key={b.id} className="border-b border-border hover:bg-muted/10">
                          <td className="p-4 font-bold text-foreground flex items-center gap-2">
                            <Building className="h-3.5 w-3.5 text-primary" />
                            {b.name}
                          </td>
                          <td className="p-4 font-extrabold text-foreground">{b.revenue.toLocaleString()} Ks</td>
                          <td className="p-4 text-center text-muted-foreground font-semibold">{b.txn} txs</td>
                          <td className="p-4 text-center">
                            <span className="flex items-center justify-center">
                              <span className={`h-2 w-2 rounded-full inline-block ${b.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/35"}`} />
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>

          {/* Segmented control for Charts vs Rankings */}
          <div className="flex gap-2 border-b border-border pb-3">
            <Button
              variant={activeTab === "charts" ? "default" : "outline"}
              onClick={() => setActiveTab("charts")}
              className="text-xs font-bold shrink-0 rounded-lg"
            >
              {t("Charts & Trends", "ပုံဖော်ပြဇယားများ")}
            </Button>
            <Button
              variant={activeTab === "rankings" ? "default" : "outline"}
              onClick={() => setActiveTab("rankings")}
              className="text-xs font-bold shrink-0 rounded-lg"
            >
              {t("Rankings & Audit", "အဆင့်သတ်မှတ်ချက်များ")}
            </Button>
          </div>

          {/* Dynamic Tab Panels */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
              ))}
            </div>
          ) : activeTab === "charts" ? (
            <DashboardCharts
              revenueTrends={revenueTrends}
              peakHours={peakHours}
              bestSellers={bestSellers}
              branchNames={branchNames}
            />
          ) : (
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Cashier attribution table */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-foreground">Cashier Leaderboard</CardTitle>
                  <CardDescription className="text-xs">Today only · POS sales plus sales-order payments collected by each staff member</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold text-[10px] uppercase">
                          <th className="p-3">Cashier</th>
                          <th className="p-3 text-center">Orders</th>
                          <th className="p-3 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffRankings.map((staff, idx) => (
                          <tr key={staff.name} className="border-b border-border hover:bg-muted/10 last:border-none">
                            <td className="p-3 font-bold text-foreground flex items-center gap-2">
                              <span className="text-[10px] bg-muted font-black px-1.5 py-0.5 rounded text-muted-foreground">#{idx+1}</span>
                              {staff.name}
                            </td>
                            <td className="p-3 text-center text-muted-foreground font-semibold">{staff.txn}</td>
                            <td className="p-3 text-right font-extrabold text-foreground">{staff.revenue.toLocaleString()} Ks</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Worst selling items */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-foreground">Slowest Moving Products</CardTitle>
                  <CardDescription className="text-xs">Lowest sales volume</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold text-[10px] uppercase">
                          <th className="p-3">Product</th>
                          <th className="p-3 text-center">Volume</th>
                          <th className="p-3 text-right">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {worstSellers.map((prod, idx) => (
                          <tr key={prod.name} className="border-b border-border hover:bg-muted/10 last:border-none">
                            <td className="p-3 font-bold text-foreground flex items-center gap-2">
                              <span className="text-[10px] bg-muted font-black px-1.5 py-0.5 rounded text-muted-foreground">#{idx+1}</span>
                              {prod.name}
                            </td>
                            <td className="p-3 text-center text-muted-foreground font-semibold">{prod.quantity} units</td>
                            <td className="p-3 text-right font-extrabold text-foreground">{prod.revenue.toLocaleString()} Ks</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Side: Live Sales Feed ticker (1/3 width) */}
        <div>
          <Card className="border-border h-full flex flex-col max-h-[80vh] overflow-hidden">
            <CardHeader className="border-b border-border shrink-0 bg-muted/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{t("Live Sales Feed", "တိုက်ရိုက်ရောင်းချမှုများ")}</span>
              </CardTitle>
              <CardDescription className="text-xs">Last 10 completed orders today</CardDescription>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
                  ))}
                </div>
              ) : liveFeed.length === 0 ? (
                <div className="text-center py-20 text-xs text-muted-foreground italic">
                  {t("No sales processed today", "ယနေ့အရောင်းမရှိသေးပါ။")}
                </div>
              ) : (
                liveFeed.map((tx) => {
                  const timeStr = new Date(tx.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-lg border border-border bg-muted/10 hover:border-muted-foreground/20 transition duration-150 flex flex-col space-y-1.5"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col space-y-0.5">
                          <span className="text-[10px] font-bold text-muted-foreground font-mono">{tx.id}</span>
                          <span className="text-xs font-black text-foreground">
                            {tx.branchName}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-foreground">
                          {tx.total.toLocaleString()} Ks
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          {tx.staffName} &bull; {tx.paymentMethod}
                        </span>
                        <span className="font-semibold">{timeStr}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
