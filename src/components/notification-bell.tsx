"use client"

import * as React from "react"
import { Bell, ShoppingCart, Calendar, DollarSign, ClipboardList, Loader2 } from "lucide-react"
import { useUser } from "@/providers/auth-provider"
import { Button } from "@/components/ui/button"

interface AlertNotification {
  type: "LOW_STOCK" | "UPCOMING_SHIFT" | "EXCHANGE_RATE" | "CRITICAL_LOG"
  title: string
  message: string
  timestamp: string
}

export function NotificationBell() {
  const { user } = useUser()
  const [notifications, setNotifications] = React.useState<AlertNotification[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const email = user.email || user.primaryEmailAddress?.emailAddress
      const res = await fetch(`/api/notifications?email=${email}`)
      if (!res.ok) return
      const data = await res.json()
      const list = (data.notifications ?? []) as AlertNotification[]
      setNotifications(list)

      // Count unread count (e.g. from local storage last read timestamp)
      const lastRead = localStorage.getItem("last_read_notifications")
      if (lastRead) {
        const count = list.filter((n) => new Date(n.timestamp).getTime() > Number(lastRead)).length
        setUnreadCount(count)
      } else {
        setUnreadCount(list.length)
      }
    } catch (err) {
      console.error("Fetch notifications error:", err)
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    const syncUser = async () => {
      if (!user) return
      try {
        const res = await fetch("/api/staff/sync", { method: "POST" })
        if (!res.ok && (res.status === 403 || res.status === 401)) {
          window.location.href = "/access-denied"
        }
      } catch (err) {
        console.error("Auto staff sync error:", err)
      }
    };
    syncUser()
    fetchNotifications()
    // Poll notifications every 2 minutes (reduce DB load)
    const interval = setInterval(fetchNotifications, 120000)
    return () => clearInterval(interval)
  }, [user, fetchNotifications])

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleDropdown = () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
    if (nextOpen) {
      // Mark as read when dropdown is opened
      localStorage.setItem("last_read_notifications", Date.now().toString())
      setUnreadCount(0)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "LOW_STOCK":
        return <ShoppingCart className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      case "UPCOMING_SHIFT":
        return <Calendar className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
      case "EXCHANGE_RATE":
        return <DollarSign className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      default:
        return <ClipboardList className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const diffMs = Date.now() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleDropdown}
        className="relative h-9 w-9 rounded-xl hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[400px] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg z-50 p-2 space-y-1">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border mb-1">
            <span className="font-semibold text-xs text-foreground">Notifications</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No notifications / သတိပေးချက်များမရှိပါ
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {notifications.slice(0, 15).map((n, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                >
                  {getIcon(n.type)}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
                      {n.message}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-medium pt-0.5">
                      {formatTime(n.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
