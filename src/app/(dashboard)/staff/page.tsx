"use client"

import * as React from "react"
import {
  Users,
  Plus,
  Search,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  Filter,
  Lock,
  ShieldCheck,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { TablePagination } from "@/components/ui/table-pagination"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ALL_MODULE_KEYS,
  MODULE_LABELS,
  ModuleKey,
  StaffPermissions,
  sanitizePermissions,
  hasModuleWritePermission,
  hasModuleReadPermission,
} from "@/lib/permissions"

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "OWNER" | "MANAGER" | "CASHIER"

interface Branch {
  id: string
  name: string
}

interface StaffMember {
  id: string
  clerkId?: string
  name: string
  email: string
  password?: string
  pin: string | null
  role: Role
  permissions?: StaffPermissions | unknown
  branchId: string
  branch: {
    id: string
    name: string
  }
  _count: {
    transactions: number
  }
}

const ROLE_LABELS: Record<Role, { en: string; my: string; color: string }> = {
  OWNER: { en: "Owner", my: "ပိုင်ရှင်", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  MANAGER: { en: "Manager", my: "မန်နေဂျာ", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  CASHIER: { en: "Cashier", my: "ငွေကိုင်", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StaffPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const userRole = (user?.role || user?.publicMetadata?.role) as string ?? "CASHIER"
  const canWriteStaff = hasModuleWritePermission(user, "staff")
  const canReadStaff = hasModuleReadPermission(user, "staff")

  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  
  // Data
  const [staff, setStaff] = React.useState<StaffMember[]>([])
  const [branches, setBranches] = React.useState<Branch[]>([])

  // UI state
  const [searchQuery, setSearchQuery] = React.useState("")
  const [revealedPins, setRevealedPins] = React.useState<Record<string, boolean>>({})
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<string, boolean>>({})

  // Filters — Directory
  const [filterBranch, setFilterBranch] = React.useState("")
  const [filterRole, setFilterRole] = React.useState("")

  // Pagination
  const [staffPage, setStaffPage] = React.useState(1)
  const [staffPageSize, setStaffPageSize] = React.useState(10)

  // Dialog State: Staff Add/Edit
  const [isStaffFormOpen, setIsStaffFormOpen] = React.useState(false)
  const [editingStaff, setEditingStaff] = React.useState<StaffMember | null>(null)
  const [staffName, setStaffName] = React.useState("")
  const [staffEmail, setStaffEmail] = React.useState("")
  const [staffPassword, setStaffPassword] = React.useState("123456")
  const [staffPin, setStaffPin] = React.useState("")
  const [staffRole, setStaffRole] = React.useState<Role>("CASHIER")
  const [staffBranchId, setStaffBranchId] = React.useState("")

  // Dialog State: Permission Management
  const [isPermsModalOpen, setIsPermsModalOpen] = React.useState(false)
  const [selectedStaffForPerms, setSelectedStaffForPerms] = React.useState<StaffMember | null>(null)
  const [editingPerms, setEditingPerms] = React.useState<StaffPermissions>(() => sanitizePermissions(null, "CASHIER"))
  const [permsSaving, setPermsSaving] = React.useState(false)
  const [permsSuccess, setPermsSuccess] = React.useState<string | null>(null)
  const [permsError, setPermsError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [staffRes, branchesRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/inventory"), // Returns branches
      ])

      const [staffData, branchesData] = await Promise.all([
        staffRes.json(),
        branchesRes.json(),
      ])

      setStaff(staffData.staff ?? [])
      setBranches(branchesData.branches ?? [])

      if (branchesData.branches?.length > 0 && !staffBranchId) {
        setStaffBranchId(user?.branchId || branchesData.branches[0].id)
      }
    } catch (err) {
      console.error("Failed to load staff page data:", err)
      setError("Failed to load staff data")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (user?.branchId && userRole !== "OWNER") {
      setStaffBranchId(user.branchId)
      setFilterBranch(user.branchId)
    }
  }, [user?.branchId, userRole])

  const togglePinReveal = (staffId: string) => {
    setRevealedPins((prev) => ({ ...prev, [staffId]: !prev[staffId] }))
  }

  const togglePasswordReveal = (staffId: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [staffId]: !prev[staffId] }))
  }

  const handleOpenStaffForm = (member?: StaffMember) => {
    setError(null)
    if (member) {
      setEditingStaff(member)
      setStaffName(member.name)
      setStaffEmail(member.email)
      setStaffPassword(member.password || "123456")
      setStaffPin(member.pin ?? "")
      setStaffRole(member.role)
      setStaffBranchId(member.branchId)
    } else {
      setEditingStaff(null)
      setStaffName("")
      setStaffEmail("")
      setStaffPassword("123456")
      setStaffPin("")
      setStaffRole("CASHIER")
      setStaffBranchId(userRole === "MANAGER" && user?.branchId ? user.branchId : ((user?.branchId || branches[0]?.id) ?? ""))
    }
    setIsStaffFormOpen(true)
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setActionLoading(true)

    try {
      const payload = {
        name: staffName,
        email: staffEmail,
        password: staffPassword || "123456",
        pin: staffPin || null,
        role: staffRole,
        branchId: staffBranchId,
      }

      let res: Response
      if (editingStaff) {
        res = await fetch("/api/staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingStaff.id, ...payload }),
        })
      } else {
        res = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to save staff member")
      }

      setIsStaffFormOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save staff error:", err)
      setError(err instanceof Error ? err.message : "Failed to save staff member")
    } finally {
      setActionLoading(false)
    }
  }

  const [deleteStaffTarget, setDeleteStaffTarget] = React.useState<string | null>(null)

  const executeDeleteStaff = async (id: string) => {
    setError(null)
    setActionLoading(true)

    try {
      const res = await fetch(`/api/staff?id=${id}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete staff member")
      }

      fetchData()
    } catch (err) {
      console.error("Delete staff error:", err)
      setError(err instanceof Error ? err.message : "Failed to delete staff member")
    } finally {
      setActionLoading(false)
      setDeleteStaffTarget(null)
    }
  }

  // Permission Modal Handlers
  const handleOpenPermissionsModal = (member: StaffMember) => {
    setSelectedStaffForPerms(member)
    setEditingPerms(sanitizePermissions(member.permissions, member.role))
    setPermsSuccess(null)
    setPermsError(null)
    setIsPermsModalOpen(true)
  }

  const handleToggleRead = (key: ModuleKey, checked: boolean) => {
    if (selectedStaffForPerms?.role === "OWNER") return
    setEditingPerms((prev) => {
      const currentMod = prev[key] || { read: false, write: false }
      return {
        ...prev,
        [key]: {
          read: checked,
          write: !checked ? false : currentMod.write,
        },
      }
    })
  }

  const handleToggleWrite = (key: ModuleKey, checked: boolean) => {
    if (selectedStaffForPerms?.role === "OWNER") return
    setEditingPerms((prev) => {
      const currentMod = prev[key] || { read: false, write: false }
      return {
        ...prev,
        [key]: {
          read: checked ? true : currentMod.read,
          write: checked,
        },
      }
    })
  }

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaffForPerms) return
    if (selectedStaffForPerms.role === "OWNER") {
      setIsPermsModalOpen(false)
      return
    }

    setPermsSaving(true)
    setPermsError(null)
    setPermsSuccess(null)

    try {
      let res = await fetch(`/api/staff/${selectedStaffForPerms.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editingPerms }),
      })

      if (!res.ok && res.status === 404) {
        res = await fetch("/api/staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedStaffForPerms.id,
            name: selectedStaffForPerms.name,
            email: selectedStaffForPerms.email,
            password: selectedStaffForPerms.password || "123456",
            pin: selectedStaffForPerms.pin,
            role: selectedStaffForPerms.role,
            branchId: selectedStaffForPerms.branchId,
            permissions: editingPerms,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update permissions")
      }

      setPermsSuccess(t("Permissions updated successfully!", "အခွင့်အရေးများကို ပြင်ဆင်ပြီးပါပြီ။"))
      if (user?.reload) {
        await user.reload()
      }
      await fetchData()
      setTimeout(() => {
        setIsPermsModalOpen(false)
      }, 600)
    } catch (err) {
      console.error("Save permissions error:", err)
      setPermsError(err instanceof Error ? err.message : "Failed to update permissions")
    } finally {
      setPermsSaving(false)
    }
  }

  // Helper for branch boundary & role restrictions on permission button
  const canManageMemberPermissions = (member: StaffMember): boolean => {
    if (!canWriteStaff) return false
    if (userRole === "CASHIER") return false
    if (userRole === "OWNER") return true
    if (userRole === "MANAGER") {
      return member.branchId === user?.branchId
    }
    return false
  }

  // Filter staff list
  const filteredStaff = staff.filter((member) => {
    const matchSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchBranch = !filterBranch || member.branchId === filterBranch
    const matchRole = !filterRole || member.role === filterRole
    return matchSearch && matchBranch && matchRole
  })

  // Paginated slice
  const pagedStaff = filteredStaff.slice((staffPage - 1) * staffPageSize, staffPage * staffPageSize)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading staff data...</span>
      </div>
    )
  }

  if (userRole === "CASHIER" || !canReadStaff) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-4 rounded-xl text-sm font-semibold">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Access Denied: You do not have permission to view the staff directory.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("Staff Directory", "ဝန်ထမ်းရေးရာ စာရင်း")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "Manage staff members, passwords, roles, permissions, and branch assignments",
              "ဝန်ထမ်းအချက်အလက်၊ စကားဝှက်၊ အခန်းကဏ္ဍ၊ အခွင့်အရေးများနှင့် ဆိုင်ခွဲများ စီမံရန်"
            )}
          </p>
        </div>
        {canWriteStaff && (
          <div>
            <Button onClick={() => handleOpenStaffForm()}>
              <Plus className="h-4 w-4 mr-1" />
              {t("Add Staff Member", "ဝန်ထမ်းသစ်ထည့်ရန်")}
            </Button>
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Search by name, email, branch...", "အမည်၊ အီးမေးလ်၊ ဆိုင်ခွဲဖြင့် ရှာရန်...")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setStaffPage(1); }}
          />
        </div>

        <select
          value={filterBranch}
          onChange={(e) => { setFilterBranch(e.target.value); setStaffPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">
            {userRole === "MANAGER" ? (branches.find(b => b.id === user?.branchId)?.name ?? branches[0]?.name ?? "My Branch") : t("All Branches", "ဆိုင်ခွဲ အားလုံး")}
          </option>
          {userRole === "OWNER" && branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        
        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); setStaffPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="MANAGER">Manager</option>
          <option value="CASHIER">Cashier</option>
        </select>

        {(filterBranch || filterRole) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterBranch(""); setFilterRole(""); setStaffPage(1); }}>
            <Filter className="h-3.5 w-3.5 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Staff Directory Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("STAFF MEMBER", "ဝန်ထမ်းအမည်")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("EMAIL", "အီးမေးလ်")}</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("PASSWORD", "စကားဝှက်")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("BRANCH", "ဆိုင်ခွဲ")}</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("ROLE", "ရာထူး")}</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("SALES", "အရောင်း")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pagedStaff.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No staff members found.</p>
                </td>
              </tr>
            ) : (
              pagedStaff.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono tracking-wider text-xs">
                        {member.password ? (revealedPasswords[member.id] ? member.password : "••••••••") : "123456"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={() => togglePasswordReveal(member.id)}
                      >
                        {revealedPasswords[member.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.branch?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={ROLE_LABELS[member.role].color} variant="secondary">
                      {t(ROLE_LABELS[member.role].en, ROLE_LABELS[member.role].my)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline">{member._count.transactions} txn</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {canManageMemberPermissions(member) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          title={t("Manage Permissions", "အခွင့်အရေးများ စီမံရန်")}
                          onClick={() => handleOpenPermissionsModal(member)}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {canWriteStaff && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenStaffForm(member)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteStaffTarget(member.id)}
                            disabled={actionLoading}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          total={filteredStaff.length}
          page={staffPage}
          pageSize={staffPageSize}
          onPageChange={setStaffPage}
          onPageSizeChange={(s) => { setStaffPageSize(s); setStaffPage(1); }}
        />
      </div>

      {/* ─── Dialog: Add/Edit Staff ────────────────────────────────────────── */}
      <Dialog open={isStaffFormOpen} onOpenChange={setIsStaffFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              Set account credentials, login password, branch permissions, and checkout PINs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name *</label>
              <Input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Su Su"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email Address *</label>
              <Input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="e.g. susu@pos.com"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Login Password *", "စကားဝှက် *")}</label>
              <div className="relative">
                <Input
                  type="text"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="e.g. 123456"
                  required
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50 pointer-events-none" />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">{t("Password used by staff to log in. Default is 123456.", "ဝန်ထမ်း ဝင်ရောက်ရန် စကားဝှက်။ မူလမှာ 123456 ဖြစ်သည်။")}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Role *", "ရာထူး *")}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as Role)}
                  required
                >
                  <option value="CASHIER">{t("Cashier", "ငွေကိုင်")}</option>
                  <option value="MANAGER">{t("Manager", "မန်နေဂျာ")}</option>
                  <option value="OWNER">{t("Owner", "ပိုင်ရှင်")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Assigned Branch *", "သတ်မှတ်ထားသော ဆိုင်ခွဲ *")}</label>
                {userRole === "MANAGER" ? (
                  <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {branches.find(b => b.id === user?.branchId)?.name ?? branches[0]?.name ?? "My Branch"}
                  </div>
                ) : (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={staffBranchId}
                    onChange={(e) => setStaffBranchId(e.target.value)}
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">POS Checkout PIN (4 digits)</label>
              <Input
                type="text"
                pattern="[0-9]{4}"
                maxLength={4}
                value={staffPin}
                onChange={(e) => setStaffPin(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 1234"
              />
              <span className="text-[10px] text-muted-foreground">Required for POS terminal cashier verification.</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStaffFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingStaff ? "Update Staff" : "Create Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Permission Management ─────────────────────────────────── */}
      <Dialog open={isPermsModalOpen} onOpenChange={setIsPermsModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t("Staff Permission Management", "ဝန်ထမ်း အခွင့်အရေး စီမံခန့်ခွဲမှု")}
            </DialogTitle>
            {selectedStaffForPerms && (
              <DialogDescription asChild>
                <div className="pt-2 flex flex-wrap gap-2 items-center text-xs">
                  <span className="font-bold text-foreground">{selectedStaffForPerms.name}</span>
                  <span className="text-muted-foreground">({selectedStaffForPerms.email})</span>
                  <Badge className={ROLE_LABELS[selectedStaffForPerms.role].color} variant="secondary">
                    {t(ROLE_LABELS[selectedStaffForPerms.role].en, ROLE_LABELS[selectedStaffForPerms.role].my)}
                  </Badge>
                  <Badge variant="outline">{selectedStaffForPerms.branch?.name}</Badge>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedStaffForPerms?.role === "OWNER" ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{t("Owner permissions are unrestricted and cannot be modified", "ပိုင်ရှင် အခွင့်အရေးကို ပြင်ဆင်၍မရပါ")}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground my-2">
              {t(
                "Configure Read and Write access for each module. Enabling Write automatically enables Read. Disabling Read automatically disables Write.",
                "အဓိက အခန်းကဏ္ဍတစ်ခုစီအတွက် ကြည့်ရှုခွင့် နှင့် ပြင်ဆင်ခွင့် များကို သတ်မှတ်ပါ။ ပြင်ဆင်ခွင့်ဖွင့်ပါက ကြည့်ရှုခွင့်အလိုအလျောက် ပွင့်မည်ဖြစ်ပြီး၊ ကြည့်ရှုခွင့်ပိတ်ပါက ပြင်ဆင်ခွင့်အလိုအလျောက် ပိတ်ပါမည်။"
              )}
            </p>
          )}

          <form onSubmit={handleSavePermissions} className="space-y-4">
            {/* 9-Module Checkbox Grid */}
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-xs font-bold text-muted-foreground">
                <div className="col-span-6">{t("MODULE", "အခန်းကဏ္ဍ")}</div>
                <div className="col-span-3 text-center">{t("READ", "ကြည့်ရှုခွင့်")}</div>
                <div className="col-span-3 text-center">{t("WRITE", "ပြင်ဆင်ခွင့်")}</div>
              </div>
              {ALL_MODULE_KEYS.map((key) => {
                const isOwnerTarget = selectedStaffForPerms?.role === "OWNER"
                const modLabel = MODULE_LABELS[key]
                const labelText = t(modLabel.en, modLabel.my)
                const isReadChecked = Boolean(editingPerms[key]?.read)
                const isWriteChecked = Boolean(editingPerms[key]?.write)

                return (
                  <div key={key} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                    <div className="col-span-6 flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{labelText}</span>
                      <span className="text-[11px] text-muted-foreground">{t(modLabel.en, modLabel.my)}</span>
                    </div>
                    <div className="col-span-3 flex justify-center items-center">
                      <input
                        type="checkbox"
                        checked={isReadChecked}
                        disabled={isOwnerTarget}
                        onChange={(e) => handleToggleRead(key, e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <div className="col-span-3 flex justify-center items-center">
                      <input
                        type="checkbox"
                        checked={isWriteChecked}
                        disabled={isOwnerTarget}
                        onChange={(e) => handleToggleWrite(key, e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {permsError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {permsError}
              </div>
            )}

            {permsSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-3 font-semibold">
                <Check className="h-4 w-4 shrink-0" />
                {permsSuccess}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPermsModalOpen(false)}>
                {selectedStaffForPerms?.role === "OWNER" ? "Close" : "Cancel"}
              </Button>
              {selectedStaffForPerms?.role !== "OWNER" && (
                <Button type="submit" disabled={permsSaving}>
                  {permsSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("Save Permissions", "အခွင့်အရေးများ သိမ်းဆည်းရန်")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteStaffTarget !== null}
        onClose={() => setDeleteStaffTarget(null)}
        onConfirm={() => deleteStaffTarget && executeDeleteStaff(deleteStaffTarget)}
        title={t("Remove Staff Member", "ဝန်ထမ်း ထုတ်ပယ်ရန်")}
        description={t(
          "Are you sure you want to remove this staff member from the system?",
          "ဤဝန်ထမ်းအား စနစ်မှ ထုတ်ပယ်ရန် သေချာပါသလား။"
        )}
        confirmText={t("Remove Staff", "ထုတ်ပယ်မည်")}
        variant="danger"
        loading={actionLoading}
      />
    </div>
  )
}
