"use client"

import { useEffect } from "react"
import { useUser, UserButton } from "@/providers/auth-provider"
import { usePathname, useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sidebar } from "@/components/sidebar"
import { NotificationBell } from "@/components/notification-bell"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage } from "@/providers/language-provider"
import { getModuleKeyForPath, hasModuleReadPermission } from "@/lib/permissions"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoaded } = useUser()
  const { t } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.replace("/sign-in")
        return
      }
      const moduleKey = getModuleKeyForPath(pathname)
      if (
        moduleKey &&
        !hasModuleReadPermission(user, moduleKey) &&
        pathname !== "/access-denied"
      ) {
        const role = user.role || (user.publicMetadata?.role as string) || "CASHIER"
        if (role === "CASHIER") {
          router.replace("/pos")
        } else {
          router.replace("/access-denied")
        }
      }
    }
  }, [isLoaded, user, pathname, router])

  const moduleKey = getModuleKeyForPath(pathname)
  const isUnauthorized = Boolean(
    isLoaded &&
      user &&
      moduleKey &&
      !hasModuleReadPermission(user, moduleKey) &&
      pathname !== "/access-denied"
  )

  if (!isLoaded || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm font-semibold text-muted-foreground">
        Loading session...
      </div>
    )
  }

  if (isUnauthorized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm font-semibold text-muted-foreground">
        Access Restricted. Redirecting...
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-3 sm:px-6 shrink-0 z-50">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-black tracking-wider text-foreground truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">
              SMARTPOS
            </h1>
            <span className="text-xs text-muted-foreground hidden sm:block shrink-0 font-medium">
              — {t("Multi-Branch Management System", "ဆိုင်ခွဲပေါင်းစုံ စီမံခန့်ခွဲမှု စနစ်")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <UserButton />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
