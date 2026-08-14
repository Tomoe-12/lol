"use client"

import React, { useState, useEffect } from "react"
import { useUser } from "@/providers/auth-provider"
import { useLanguage } from "@/providers/language-provider"
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  MoreHorizontal,
  Loader2,
  Trash2,
  Edit
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TablePagination } from "@/components/ui/table-pagination"
import { format } from "date-fns"

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
}

export default function CustomersPage() {
  const { user } = useUser()
  const { t } = useLanguage()
  const role = user?.publicMetadata?.role as string | undefined

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form State
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (role === "OWNER" || role === "MANAGER") {
      fetchCustomers()
    }
  }, [role])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers(searchQuery)
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const fetchCustomers = async (search = "") => {
    try {
      setLoading(true)
      const res = await fetch(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      const data = await res.json()
      if (res.ok) {
        setCustomers(data)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, address }),
      })

      if (res.ok) {
        setIsModalOpen(false)
        resetForm()
        fetchCustomers()
      } else {
        const data = await res.json()
      }
    } catch (error) {
      setError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setName("")
    setPhone("")
    setEmail("")
    setAddress("")
    setError("")
  }

  if (role === "CASHIER") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Access Denied.</p>
      </div>
    )
  }

  const paginatedCustomers = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            {t("Customers", "ဖောက်သည်များ")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your customer database and contact info.
          </p>
        </div>
        {(role === "OWNER" || role === "MANAGER") && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-bold shadow-md">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>

      <div className="flex items-center py-4">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card font-medium shadow-sm"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-foreground">{t("CUSTOMER", "အမည်")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("CONTACT", "ဆက်သွယ်ရန်")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("ADDRESS", "လိပ်စာ")}</TableHead>
              <TableHead className="font-bold text-foreground">JOINED DATE</TableHead>
              <TableHead className="text-right font-bold text-foreground">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground font-medium">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">
                    {c.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {c.phone}
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {c.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.address ? (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground max-w-[200px] truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-muted-foreground">
                    {format(new Date(c.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" disabled>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={customers.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the details of the new customer.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Name <span className="text-destructive">*</span></label>
              <Input
                required
                placeholder="e.g. John Doe, City Supermarket"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold">Phone</label>
              <Input
                placeholder="e.g. 09-123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Email</label>
              <Input
                type="email"
                placeholder="e.g. contact@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Address</label>
              <Input
                placeholder="e.g. 123 Main St, Yangon"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
