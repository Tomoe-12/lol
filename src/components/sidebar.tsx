"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, UserButton } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import { hasModuleReadPermission, ModuleKey } from "@/lib/permissions"
import type { ElementType } from "react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  Truck,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Store,
  ClipboardList,
  HandCoins,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useState, useEffect } from "react"

export interface NavItem {
  titleEn: string
  titleMy: string
  href: string
  icon: ElementType
  roles: string[]
  moduleKey?: ModuleKey
}

const navItems: NavItem[] = [
  {
    titleEn: "Dashboard",
    titleMy: "ဒက်ရှ်ဘုတ်",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "dashboard",
  },
  {
    titleEn: "Sales Voucher",
    titleMy: "အရောင်း ဘောက်ချာ",
    href: "/pos",
    icon: ShoppingCart,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    moduleKey: "pos",
  },
  {
    titleEn: "Stock Status",
    titleMy: "စတော့ အခြေအနေ",
    href: "/inventory",
    icon: Package,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "inventory",
  },
  {
    titleEn: "Setup",
    titleMy: "ဆက်တင်",
    href: "/setup",
    icon: Settings,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "setup",
  },
  {
    titleEn: "Branches",
    titleMy: "ဆိုင်ခွဲများ",
    href: "/branches",
    icon: Store,
    roles: ["OWNER"],
    moduleKey: "setup",
  },
  {
    titleEn: "Suppliers",
    titleMy: "ပေးသွင်းသူများ",
    href: "/suppliers",
    icon: Truck,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "purchases",
  },
  {
    titleEn: "Customers",
    titleMy: "ဝယ်သူများ",
    href: "/customers",
    icon: Users,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "salesOrders",
  },
  {
    titleEn: "Sales Orders",
    titleMy: "အရောင်း အမှာစာများ",
    href: "/sales-orders",
    icon: ClipboardList,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "salesOrders",
  },
  {
    titleEn: "Outstanding",
    titleMy: "ကြွေးကျန်များ",
    href: "/outstanding",
    icon: HandCoins,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    moduleKey: "outstanding",
  },
  {
    titleEn: "Delivery",
    titleMy: "ပို့ဆောင်ရေးများ",
    href: "/delivery",
    icon: Truck,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    moduleKey: "delivery",
  },
  {
    titleEn: "Purchases",
    titleMy: "အဝယ်များ",
    href: "/purchases",
    icon: Package,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "purchases",
  },
  {
    titleEn: "Purchase Orders",
    titleMy: "အဝယ် အမှာစာများ",
    href: "/purchase-orders",
    icon: Truck,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "purchases",
  },
  {
    titleEn: "Expenses",
    titleMy: "စရိတ်များ",
    href: "/expenses",
    icon: Receipt,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "expenses",
  },
  {
    titleEn: "Staff",
    titleMy: "ဝန်ထမ်းများ",
    href: "/staff",
    icon: Users,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "staff",
  },
  {
    titleEn: "Reports",
    titleMy: "အစီရင်ခံစာများ",
    href: "/reports",
    icon: BarChart3,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "reports",
  },
  {
    titleEn: "Settings",
    titleMy: "ဆက်တင်များ",
    href: "/settings",
    icon: Settings,
    roles: ["OWNER", "MANAGER"],
    moduleKey: "setup",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)

  // Force Clerk to reload user metadata so role changes are picked up immediately
  // without requiring a sign-out/sign-in cycle
  useEffect(() => {
    if (user) {
      user.reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // only re-run when the user id changes (i.e. on first load)

  // Get role from Clerk public metadata (fresh after reload)
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setCounts(null)
      return () => { active = false }
    }
    const refreshCounts = async () => {
      try {
        const responses = await Promise.all([
          fetch("/api/inventory?withStock=true"),
          fetch("/api/sales-orders"),
          fetch("/api/outstanding"),
          fetch("/api/delivery?status=PENDING"),
          fetch("/api/purchase-orders"),
        ])
        const data = await Promise.all(responses.map((response) => response.ok ? response.json() : null))
        if (!active) return
        const inventory = data[0]?.stockLevels || []
        const salesOrders = data[1]?.salesOrders || []
        const outstanding = data[2]
        const delivery = data[3]
        const purchaseOrders = data[4]?.orders || []
        setCounts({
          "/pos": salesOrders.filter((order: { status?: string; items?: { quantity?: number; fulfilledQuantity?: number }[] }) => order.status === "CONFIRMED" && (order.items || []).some((item) => (item.quantity || 0) > (item.fulfilledQuantity || 0))).length,
          "/inventory": inventory.filter((stock: { quantity?: number; lowStockThreshold?: number }) => (stock.quantity || 0) <= (stock.lowStockThreshold || 0)).length,
          "/sales-orders": salesOrders.filter((order: { status?: string }) => order.status === "DRAFT" || order.status === "CONFIRMED").length,
          "/outstanding": Number(outstanding?.totalDebtors || (outstanding?.debts || []).length || 0),
          "/delivery": Number(delivery?.stats?.pendingCount || (delivery?.orders || []).length || 0),
          "/purchase-orders": purchaseOrders.filter((order: { status?: string }) => order.status === "ORDERED" || order.status === "DRAFT").length,
        })
      } catch {
        if (active) setCounts(null)
      }
    }
    const handleCountsUpdated = () => { void refreshCounts() }
    void refreshCounts()
    window.addEventListener("purchase-orders-updated", handleCountsUpdated)
    window.addEventListener("focus", handleCountsUpdated)
    window.addEventListener("sales-orders-updated", handleCountsUpdated)
    window.addEventListener("delivery-updated", handleCountsUpdated)
    const refreshTimer = window.setInterval(() => { void refreshCounts() }, 15000)
    return () => {
      active = false
      window.removeEventListener("purchase-orders-updated", handleCountsUpdated)
      window.removeEventListener("focus", handleCountsUpdated)
      window.removeEventListener("sales-orders-updated", handleCountsUpdated)
      window.removeEventListener("delivery-updated", handleCountsUpdated)
      window.clearInterval(refreshTimer)
    }
  }, [user?.id])

  const filteredNav = navItems.filter((item) => {
    if (item.moduleKey) {
      return hasModuleReadPermission(user, item.moduleKey)
    }
    return item.roles.includes(role)
  })

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Store className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-black tracking-wider text-sidebar-foreground leading-none">
              SMARTPOS
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              {t("Multi-Branch POS & Stock", "ဆိုင်ခွဲပေါင်းစုံ POS & စတော့")}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const title = t(item.titleEn, item.titleMy)
            const count = counts?.[item.href] ?? 0
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? title : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{title}</span>
                      {count > 0 && (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4 min-w-4 justify-center">
                          {count}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User profile & Role */}
      <Separator className="bg-sidebar-border" />
      <div className={cn("px-4 py-3 flex items-center gap-3", collapsed && "justify-center")}>
        <UserButton />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-sidebar-foreground truncate">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress || t("Staff", "ဝန်ထမ်း")}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {role}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar shadow-sm hover:bg-sidebar-accent z-10"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
    </aside>
  )
}

