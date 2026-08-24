"use client"

import * as React from "react"
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Building,
  User,
  Filter,
} from "lucide-react"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { TablePagination } from "@/components/ui/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Staff {
  id: string
  name: string
  role: string
  branchId: string
}

interface Branch {
  id: string
  name: string
}

interface ShiftSchedule {
  id: string
  staffId: string
  staff: Staff
  branchId: string
  branch: Branch
  date: string
  startTime: string
  endTime: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"
  const myBranchId = (user?.publicMetadata?.branchId as string) ?? ""

  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Data
  const [schedules, setSchedules] = React.useState<ShiftSchedule[]>([])
  const [staff, setStaff] = React.useState<Staff[]>([])
  const [branches, setBranches] = React.useState<Branch[]>([])

  // Filters (only used by Owners)
  const [filterBranchId, setFilterBranchId] = React.useState("ALL")
  const [filterStartDate, setFilterStartDate] = React.useState("")
  const [filterEndDate, setFilterEndDate] = React.useState("")

  // Add Shift Dialog
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [shiftStaffId, setShiftStaffId] = React.useState("")
  const [shiftBranchId, setShiftBranchId] = React.useState("")
  const [shiftDate, setShiftDate] = React.useState(new Date().toISOString().split("T")[0])
  const [shiftStartTime, setShiftStartTime] = React.useState("09:00")
  const [shiftEndTime, setShiftEndTime] = React.useState("17:00")

  React.useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildQueryString = () => {
    const params = new URLSearchParams()
    // For Managers, the API already scopes to their branch — no need to send branchId
    if (role !== "MANAGER" && filterBranchId !== "ALL") params.set("branchId", filterBranchId)
    if (filterStartDate) params.set("startDate", filterStartDate)
    if (filterEndDate) params.set("endDate", filterEndDate)
    return params.toString()
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const qs = buildQueryString()
      const [scheduleRes, staffRes, branchRes] = await Promise.all([
        fetch(`/api/schedule${qs ? `?${qs}` : ""}`),
        fetch("/api/staff"),
        fetch("/api/inventory"), // returns branches
      ])

      const [scheduleData, staffData, branchData] = await Promise.all([
        scheduleRes.json(),
        staffRes.json(),
        branchRes.json(),
      ])

      setSchedules(scheduleData.schedules ?? [])
      setStaff(staffData.staff ?? [])
      setBranches(branchData.branches ?? [])

      // Pre-select first staff in form
      const allStaff: Staff[] = staffData.staff ?? []
      const branchStaff = role === "MANAGER"
        ? allStaff.filter((s) => s.branchId === myBranchId)
        : allStaff
      if (branchStaff.length > 0 && !shiftStaffId) {
        setShiftStaffId(branchStaff[0].id)
      }

      // Pre-select branch in form
      if (branchData.branches?.length > 0 && !shiftBranchId) {
        setShiftBranchId(user?.branchId || branchData.branches[0].id)
      }
    } catch (err) {
      console.error("Failed to load schedule data:", err)
      setError("Failed to fetch shift data")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (user?.branchId && user.role !== "OWNER") {
      setShiftBranchId(user.branchId)
      setFilterBranchId(user.branchId)
    }
  }, [user?.branchId, user?.role])

  const handleApplyFilters = () => {
    fetchData()
  }

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shiftStaffId || !shiftBranchId || !shiftDate || !shiftStartTime || !shiftEndTime) {
      return setError("Please fill in all fields")
    }

    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: shiftStaffId,
          branchId: shiftBranchId,
          date: shiftDate,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save shift")
      }

      setIsFormOpen(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setActionLoading(false)
    }
  }

  const [deleteShiftTarget, setDeleteShiftTarget] = React.useState<string | null>(null)

  const executeDeleteShift = async (id: string) => {
    setActionLoading(true)
    try {
      await fetch(`/api/schedule?id=${id}`, { method: "DELETE" })
      await fetchData()
    } catch (err) {
      console.error("Delete shift error:", err)
    } finally {
      setActionLoading(false)
      setDeleteShiftTarget(null)
    }
  }

  // Group schedules by Date
  const groupedSchedules = React.useMemo(() => {
    const groups: Record<string, ShiftSchedule[]> = {}
    schedules.forEach((s) => {
      const d = new Date(s.date).toDateString()
      if (!groups[d]) groups[d] = []
      groups[d].push(s)
    })
    return groups
  }, [schedules])

  // Staff available in the Assign Shift form
  const formStaff = React.useMemo(() => {
    if (role === "MANAGER") return staff.filter((s) => s.branchId === myBranchId)
    return staff
  }, [staff, role, myBranchId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading shift schedules...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Shift Scheduler
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Schedule and manage staff work hours per branch", "ဝန်ထမ်း တာဝန်ကျချိန်ဇယားများ")}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} disabled={loading || actionLoading || formStaff.length === 0}>
          <Plus className="h-4 w-4 mr-1" />
          Assign Shift
        </Button>
      </div>

      {/* Filters — Owners see branch selector; Managers don't need it */}
      <div className="flex items-end gap-3 flex-wrap bg-muted/30 rounded-xl p-4 border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
        {role !== "MANAGER" && (
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">Branch</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-44"
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Start Date</label>
          <Input
            type="date"
            className="w-40 h-9"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">End Date</label>
          <Input
            type="date"
            className="w-40 h-9"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
        <Button onClick={handleApplyFilters} disabled={loading || actionLoading} variant="outline" className="h-9 px-4">
          Apply Filters
        </Button>
      </div>

      {/* Schedule Feed */}
      <div className="space-y-6">
        {Object.keys(groupedSchedules).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No shifts scheduled for the selected filters</p>
            <p className="text-xs mt-1">Click &quot;Assign Shift&quot; to schedule staff</p>
          </div>
        ) : (
          Object.keys(groupedSchedules).map((dateStr) => (
            <div key={dateStr} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground border-b border-border pb-1">
                {dateStr}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedSchedules[dateStr].map((schedule) => (
                  <Card key={schedule.id} className="hover:shadow-md transition-shadow relative overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm">{schedule.staff.name}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {schedule.staff.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building className="h-3.5 w-3.5" />
                            <span>{schedule.branch.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{schedule.startTime} – {schedule.endTime}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5 shrink-0"
                          onClick={() => setDeleteShiftTarget(schedule.id)}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Dialog: Assign Shift ─────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Work Shift</DialogTitle>
            <DialogDescription>
              Assign a staff member to a branch and time slot.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddShift} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Staff Member *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={shiftStaffId}
                onChange={(e) => setShiftStaffId(e.target.value)}
                required
              >
                {formStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Assigned Branch *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={shiftBranchId}
                onChange={(e) => setShiftBranchId(e.target.value)}
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Shift Date *</label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Start Time *</label>
                <Input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End Time *</label>
                <Input
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={actionLoading} onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Shift Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteShiftTarget !== null}
        onClose={() => setDeleteShiftTarget(null)}
        onConfirm={() => deleteShiftTarget && executeDeleteShift(deleteShiftTarget)}
        title={t("Remove Shift Assignment", "အလုပ်ချိန် သတ်မှတ်ချက် ဖျက်ပစ်ရန်")}
        description={t("Are you sure you want to remove this shift assignment?", "ဤအလုပ်ချိန် သတ်မှတ်ချက်အား ဖျက်ပစ်ရန် သေချာပါသလား။")}
        confirmText={t("Remove", "ဖျက်ပစ်မည်")}
        variant="danger"
        loading={actionLoading}
      />
    </div>
  )
}
