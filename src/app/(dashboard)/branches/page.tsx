"use client"

import * as React from "react"
import { Search, Loader2, Store, Plus, AlertCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { TablePagination } from "@/components/ui/table-pagination"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"

interface Branch {
  id: string
  name: string
  address: string | null
  isActive: boolean
  createdAt: string | Date
}

export default function BranchesPage() {
  const { t } = useLanguage()
  const { user } = useUser()
  const role = (user?.publicMetadata?.role as string) ?? "CASHIER"

  const [branches, setBranches] = React.useState<Branch[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const [isBranchFormOpen, setIsBranchFormOpen] = React.useState(false)
  const [branchName, setBranchName] = React.useState("")
  const [branchAddress, setBranchAddress] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  // Delete Confirmation State
  const [deletingBranch, setDeletingBranch] = React.useState<Branch | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState("")

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  React.useEffect(() => {
    if (role === "OWNER") {
      fetchData()
    }
  }, [role])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/branches?includeArchived=true")
      const data = await res.json()
      if (res.ok) {
        setBranches(data.branches ?? [])
      }
    } catch (err) {
      console.error("Fetch branches failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchName) {
      setError(t("Please fill out name", "အမည် ဖြည့်စွက်ပါ။"))
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: branchName,
          address: branchAddress || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to create branch")
      }
      setIsBranchFormOpen(false)
      setBranchName("")
      setBranchAddress("")
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create branch")
    } finally {
      setActionLoading(false)
    }
  }
  const confirmDeleteBranch = async () => {
    if (!deletingBranch) return
    setActionLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/branches?id=${deletingBranch.id}`, {
        method: "DELETE",
      })
      const d = await res.json()
      if (!res.ok) {
        throw new Error(d.error || "Failed to delete branch")
      }
      setDeletingBranch(null)
      await fetchData()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete branch")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRestoreBranch = async (id: string) => {
    setActionLoading(true)
    try {
      const res = await fetch("/api/branches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: true }),
      })
      const d = await res.json()
      if (!res.ok) {
        throw new Error(d.error || "Failed to restore branch")
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore branch")
    } finally {
      setActionLoading(false)
    }
  }

  if (role !== "OWNER") {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center space-y-3">
        <h2 className="text-xl font-bold text-destructive">{t("Access Denied", "လုပ်ဆောင်ခွင့် မရှိပါ")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("Only the store owner can access the branches configuration.", "ဆိုင်ပိုင်ရှင်သာ ဆိုင်ခွဲများ စီမံခန့်ခွဲမှုအား ဝင်ရောက်လုပ်ဆောင်နိုင်ပါသည်။")}
        </p>
      </div>
    )
  }

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.address && b.address.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const pagedBranches = filteredBranches.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">
            {t("Branch Outlets Setup", "ဆိုင်ခွဲများ စီမံပြင်ဆင်ခြင်း")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("Configure store branch locations, addresses, and track multiple outlets", "အရောင်းဆိုင်ခွဲများ၊ လိပ်စာများနှင့် ဆိုင်ခွဲအခြေအနေများကို စီမံပြင်ဆင်ပါ")}
          </p>
        </div>

        <Button
          className="h-10 text-xs font-bold gap-1 shadow-sm shrink-0"
          disabled={loading || actionLoading}
          onClick={() => {
            setError(null)
            setIsBranchFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          <span>{t("Add Branch", "ဆိုင်ခွဲအသစ်ထည့်မည်")}</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("Search branches by name or address...", "ဆိုင်ခွဲအမည် သို့မဟုတ် လိပ်စာဖြင့် ရှာဖွေရန်...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-border bg-muted/10 text-sm focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Branches Table List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span className="font-semibold">{t("Loading branch list...", "ဆိုင်ခွဲအချက်အလက်များ ဆွဲနေသည်...")}</span>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase">
                  <th className="px-4 py-3.5">{t("Branch Name", "ဆိုင်ခွဲအမည်")}</th>
                  <th className="px-4 py-3.5">{t("Address", "လိပ်စာ")}</th>
                  <th className="px-4 py-3.5">{t("Date Opened", "ဖွင့်လှစ်သည့်ရက်စွဲ")}</th>
                  <th className="px-4 py-3.5">{t("Status", "အခြေအနေ")}</th>
                  <th className="px-4 py-3.5 text-right">{t("Actions", "လုပ်ဆောင်ချက်များ")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBranches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground italic">
                      {t("No branches found. Please add a branch.", "မည်သည့်ဆိုင်ခွဲမျှ မရှိသေးပါ။ ဆိုင်ခွဲအသစ် ထည့်သွင်းပါ။")}
                    </td>
                  </tr>
                ) : (
                  pagedBranches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-muted/10 font-semibold text-foreground">
                      <td className="px-4 py-3.5 font-bold flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        <span>{branch.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{branch.address || "—"}</td>
                      <td className="px-4 py-3.5 font-mono text-muted-foreground">
                        {new Date(branch.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        {branch.isActive ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold">
                            {t("Active", "ဖွင့်လှစ်ထားသည်")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-bold">
                            {t("Archived", "ပိတ်သိမ်းထားသည်")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {branch.isActive ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                            disabled={loading || actionLoading}
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteConfirmationText("")
                              setDeletingBranch(branch)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs font-bold text-primary hover:bg-primary/5"
                            disabled={loading || actionLoading}
                            onClick={() => handleRestoreBranch(branch.id)}
                          >
                            {t("Restore", "ပြန်ဖွင့်မည်")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredBranches.length > pageSize && (
            <TablePagination
              total={filteredBranches.length}
              page={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              pageSizeOptions={[5, 10, 20]}
            />
          )}
        </div>
      )}

      {/* ─── Add Branch Dialog ────────────────────────────────────────────── */}
      <Dialog open={isBranchFormOpen} onOpenChange={setIsBranchFormOpen}>
        <DialogContent className="max-w-md bg-card border-border p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              {t("Add New Branch Shop", "ဆိုင်ခွဲအသစ် တိုးချဲ့ဖွင့်လှစ်ခြင်း")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("Configure branch name and specific contact address details.", "ဆိုင်ခွဲအမည်နှင့် လိပ်စာအချက်အလက်များကို ဖြည့်သွင်းပါ")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBranchSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold mb-1 block text-muted-foreground">
                {t("Branch Name *", "ဆိုင်ခွဲအမည် *")}
              </label>
              <Input
                placeholder="e.g. Tamwe Branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                required
                className="bg-muted/10 border-border text-sm font-semibold h-10"
              />
            </div>

            <div>
              <label className="text-xs font-bold mb-1 block text-muted-foreground">
                {t("Address", "ဆိုင်ခွဲလိပ်စာ")}
              </label>
              <Input
                placeholder="e.g. No. 123, Tamwe Road, Yangon"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                className="bg-muted/10 border-border text-sm font-semibold h-10"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-3 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <DialogFooter className="flex-row gap-2 mt-4">
              <Button type="button" variant="outline" className="w-1/2" disabled={actionLoading} onClick={() => setIsBranchFormOpen(false)}>
                {t("Cancel", "မလုပ်တော့ပါ")}
              </Button>
              <Button type="submit" disabled={actionLoading} className="w-1/2 font-bold">
                {actionLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {t("Add Branch", "ဆိုင်ခွဲအသစ်ထည့်မည်")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Branch Confirmation Dialog ────────────────────────────── */}
      <Dialog open={!!deletingBranch} onOpenChange={(open) => { if (!open) setDeletingBranch(null); }}>
        <DialogContent className="max-w-md bg-card border-border p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t("Delete Branch Outlet", "ဆိုင်ခွဲ ဖျက်သိမ်းခြင်း")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {t(
                `Are you sure you want to delete the branch "${deletingBranch?.name}"? This action is permanent and cannot be undone.`,
                `ဆိုင်ခွဲ "${deletingBranch?.name}" အား အပြီးသတ်ဖျက်သိမ်းရန် သေချာပါသလား။ ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရနိုင်ပါ။`
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {deleteError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-3.5 font-semibold border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold mb-0.5">{t("Cannot Delete Branch", "ဆိုင်ခွဲ ဖျက်သိမ်း၍မရပါ")}</div>
                  <div>{deleteError}</div>
                </div>
              </div>
            )}

            {/* Confirmation text check */}
            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t(
                  "To confirm deletion, please type the phrase below:",
                  "ဆိုင်ခွဲအား ဖျက်သိမ်းရန် သေချာပါက အောက်ပါ စာသားအတိုင်း ရိုက်ထည့်ပါ -"
                )}
              </p>
              <div className="bg-muted/40 border border-border p-2 rounded-lg text-center font-mono text-xs font-bold text-foreground select-none">
                i want to delete {deletingBranch?.name} branch
              </div>
              <Input
                placeholder={`i want to delete ${deletingBranch?.name || ""} branch`}
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="bg-muted/10 border-border text-sm font-mono h-10 w-full"
                disabled={actionLoading}
              />
            </div>

            <DialogFooter className="flex-row gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-1/2"
                onClick={() => setDeletingBranch(null)}
                disabled={actionLoading}
              >
                {t("Cancel", "မလုပ်တော့ပါ")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-1/2 font-bold"
                onClick={confirmDeleteBranch}
                disabled={deleteConfirmationText !== `i want to delete ${deletingBranch?.name} branch` || actionLoading}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {t("Delete Branch", "ဆိုင်ခွဲဖျက်မည်")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
