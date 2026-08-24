"use client"

import * as React from "react"
import { useLanguage } from "@/providers/language-provider"
import { Search, Loader2, Truck, Plus, Edit2, Trash2, Mail, Phone, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { TablePagination } from "@/components/ui/table-pagination"

interface Supplier {
  id: string
  name: string
  contact: string | null
  email: string | null
  address: string | null
  _count?: {
    purchaseOrders: number
  }
}

export default function SuppliersPage() {
  const { t } = useLanguage()
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const [error, setError] = React.useState<string | null>(null)
  const [isSupplierOpen, setIsSupplierOpen] = React.useState(false)
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null)
  const [supName, setSupName] = React.useState("")
  const [supContact, setSupContact] = React.useState("")
  const [supEmail, setSupEmail] = React.useState("")
  const [supAddress, setSupAddress] = React.useState("")

  React.useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const supRes = await fetch("/api/suppliers")
      const supData = await supRes.json()
      if (supRes.ok) setSuppliers(supData.suppliers)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openSupplierForm = (s: Supplier | null = null) => {
    setEditingSupplier(s)
    if (s) {
      setSupName(s.name)
      setSupContact(s.contact || "")
      setSupEmail(s.email || "")
      setSupAddress(s.address || "")
    } else {
      setSupName("")
      setSupContact("")
      setSupEmail("")
      setSupAddress("")
    }
    setIsSupplierOpen(true)
  }

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supName) return
    setActionLoading(true)

    const payload = {
      id: editingSupplier?.id,
      name: supName,
      contact: supContact || null,
      email: supEmail || null,
      address: supAddress || null,
    }

    try {
      const res = await fetch("/api/suppliers", {
        method: editingSupplier ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to save supplier")
      }
      await fetchData()
      setIsSupplierOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving supplier")
    } finally {
      setActionLoading(false)
    }
  }

  const [deleteSupplierTarget, setDeleteSupplierTarget] = React.useState<string | null>(null)

  const executeDeleteSupplier = async (id: string) => {
    try {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to delete supplier")
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting supplier")
    } finally {
      setDeleteSupplierTarget(null)
    }
  }

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.contact && s.contact.toLowerCase().includes(q))
    )
  })

  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            {t("Suppliers", "ပေးသွင်းသူများ")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-semibold">
            {t("Manage your supplier directory", "ပေးသွင်းသူ လမ်းညွှန်များ စီမံရန်")}
          </p>
        </div>
        <Button onClick={() => openSupplierForm()} disabled={loading || actionLoading} className="font-bold gap-2">
          <Plus className="h-4 w-4" />
          {t("Add Supplier", "ပေးသွင်းသူ အသစ်ထည့်မည်")}
        </Button>
      </div>

      <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Search suppliers...", "ပေးသွင်းသူများ ရှာဖွေရန်...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-muted/20 border-transparent"
          />
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          {suppliers.length} {t("Total Suppliers", "စုစုပေါင်း ပေးသွင်းသူများ")}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl text-muted-foreground font-semibold">
          {t("No suppliers found. Add your first supplier to start.", "ပေးသွင်းသူ မတွေ့ပါ။ စတင်ရန် ပထမဦးဆုံး ပေးသွင်းသူ အသစ်ထည့်သွင်းပါ။")}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedSuppliers.map((sup) => (
              <Card key={sup.id} className="p-5 flex flex-col hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg leading-tight">{sup.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={loading || actionLoading} onClick={() => openSupplierForm(sup)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={loading || actionLoading} onClick={() => setDeleteSupplierTarget(sup.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2 mt-auto text-sm text-muted-foreground font-medium">
                  {sup.contact && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> <span>{sup.contact}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> <span>{sup.email}</span>
                    </div>
                  )}
                  {sup.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span className="line-clamp-2 leading-snug">{sup.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t text-xs font-semibold text-foreground">
                    <span>{sup._count?.purchaseOrders || 0} {t("Purchase Orders", "ဝယ်ယူမှု အမှာစာများ")}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <TablePagination
            total={filteredSuppliers.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      )}

      {/* Supplier Form Dialog */}
      <Dialog open={isSupplierOpen} onOpenChange={setIsSupplierOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? t("Edit Supplier", "ပေးသွင်းသူ ပြင်ဆင်မည်") : t("Add Supplier", "ပေးသွင်းသူ အသစ်ထည့်မည်")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSupplierSubmit} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">{t("Supplier Name *", "ပေးသွင်းသူ အမည် *")}</label>
              <Input required value={supName} onChange={(e) => setSupName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">{t("Contact Number", "ဆက်သွယ်ရန် ဖုန်းနံပါတ်")}</label>
              <Input value={supContact} onChange={(e) => setSupContact(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">{t("Email", "အီးမေးလ်")}</label>
              <Input type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">{t("Address", "လိပ်စာ")}</label>
              <Input value={supAddress} onChange={(e) => setSupAddress(e.target.value)} />
            </div>
            {error && (
              <div className="p-3 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                {error}
              </div>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" disabled={actionLoading} onClick={() => setIsSupplierOpen(false)}>{t("Cancel", "မလုပ်တော့ပါ")}</Button>
              <Button type="submit" disabled={loading || actionLoading}>{t("Save", "သိမ်းဆည်းမည်")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteSupplierTarget !== null}
        onClose={() => setDeleteSupplierTarget(null)}
        onConfirm={() => deleteSupplierTarget && executeDeleteSupplier(deleteSupplierTarget)}
        title={t("Delete Supplier", "ပေးသွင်းသူ ဖျက်သိမ်းရန်")}
        description={t("Are you sure you want to delete this supplier?", "ဤပေးသွင်းသူအား ဖျက်သိမ်းရန် သေချာပါသလား။")}
        confirmText={t("Delete", "ဖျက်သိမ်းမည်")}
        variant="danger"
      />
    </div>
  )
}
