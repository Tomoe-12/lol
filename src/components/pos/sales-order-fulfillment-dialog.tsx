"use client"

import * as React from "react"
import { ClipboardCheck, Loader2, Package, Search, UserRound } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/providers/language-provider"

type Order = {
  id: string
  branchId: string
  status: string
  amountPaid: number
  customer?: { name: string; phone?: string | null; phones?: string[]; email?: string | null; address?: string | null } | null
  items: { id: string; variantId: string; quantity: number; fulfilledQuantity: number; unitPrice?: number | null; variant: { name: string; costPrice: number; price: number; stockLevels?: { branchId: string; quantity: number }[]; product: { name: string; price: number } } }[]
}

interface Props { isOpen: boolean; onClose: () => void; branchId: string; onSuccess: (transaction: unknown) => void }

export function SalesOrderFulfillmentDialog({ isOpen, onClose, branchId, onSuccess }: Props) {
  const { t } = useLanguage()
  const [orders, setOrders] = React.useState<Order[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [prices, setPrices] = React.useState<Record<string, string>>({})
  const [quantities, setQuantities] = React.useState<Record<string, string>>({})
  const [amountCollected, setAmountCollected] = React.useState("")
  const [paymentMethod, setPaymentMethod] = React.useState("CASH")
  const [fulfillmentMode, setFulfillmentMode] = React.useState<"STORE" | "DELIVERY">("STORE")
  const [deliveryFee, setDeliveryFee] = React.useState("")
  const [deliveryFeePayer, setDeliveryFeePayer] = React.useState<"STORE" | "CUSTOMER">("CUSTOMER")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const selected = orders.find((order) => order.id === selectedId)
  const visibleOrders = orders.filter((order) => `${order.id} ${order.customer?.name || ""} ${order.customer?.phone || ""}`.toLowerCase().includes(search.toLowerCase()))
  const selectedItems = selected?.items.filter((item) => item.quantity > (item.fulfilledQuantity || 0)) || []
  const referencePrice = (item: Order["items"][number]) => item.variant.price > 0 ? item.variant.price : item.variant.product.price
  const finalTotal = selectedItems.reduce((sum, item) => sum + (Number(quantities[item.variantId] || 0) * Number(prices[item.variantId] || 0)), 0)
  const lineChecks = selectedItems.map((item) => {
    const quantity = Number(quantities[item.variantId] || 0)
    const availableStock = item.variant.stockLevels?.find((stock) => stock.branchId === selected?.branchId)?.quantity || 0
    const finalPrice = Number(prices[item.variantId] || 0)
    return { item, quantity, availableStock, finalPrice, stockShort: quantity > availableStock, priceInvalid: finalPrice <= 0 || finalPrice < item.variant.costPrice || finalPrice > referencePrice(item) }
  })
  const hasStockShortage = lineChecks.some((line) => line.stockShort)
  const hasPriceError = lineChecks.some((line) => line.priceInvalid)
  const hasQuantityError = lineChecks.some((line) => line.quantity <= 0)
  const remainingBalance = Math.max(0, finalTotal - (selected?.amountPaid || 0))
  const exactBalanceCollected = Number(amountCollected || 0) === remainingBalance
  const canComplete = Boolean(selected && selectedItems.length > 0 && !loading && !hasStockShortage && !hasPriceError && !hasQuantityError && exactBalanceCollected)
  const canDeliver = Boolean(selected && selectedItems.length > 0 && !loading && !hasStockShortage && !hasPriceError && !hasQuantityError && (selected.customer?.address || "").trim())

  const loadOrders = React.useCallback(async () => {
    const res = await fetch("/api/sales-orders")
    if (!res.ok) return
    const data = await res.json()
    setOrders((data.salesOrders || []).filter((order: Order) => (!branchId || order.branchId === branchId) && order.status === "CONFIRMED" && order.items.some((item) => item.quantity > (item.fulfilledQuantity || 0))))
  }, [branchId])

  React.useEffect(() => { if (isOpen) { setError(null); setSelectedId(""); setSearch(""); setPrices({}); setQuantities({}); setAmountCollected(""); setFulfillmentMode("STORE"); setDeliveryFee(""); setDeliveryFeePayer("CUSTOMER"); void loadOrders() } }, [isOpen, loadOrders])

  const chooseOrder = (id: string) => {
    const order = orders.find((item) => item.id === id)
    setSelectedId(id)
    if (!order) return
    const nextPrices: Record<string, string> = {}
    const nextQuantities: Record<string, string> = {}
    order.items.forEach((item) => { nextPrices[item.variantId] = String(item.unitPrice || referencePrice(item) || ""); nextQuantities[item.variantId] = String(item.quantity - (item.fulfilledQuantity || 0)) })
    setPrices(nextPrices); setQuantities(nextQuantities); setAmountCollected(""); setFulfillmentMode("STORE"); setDeliveryFee(""); setDeliveryFeePayer("CUSTOMER"); setError(null)
  }

  const handleSubmit = async () => {
    if (!selected) return
    setLoading(true); setError(null)
    try {
      const items = selectedItems.filter((item) => Number(quantities[item.variantId]) > 0).map((item) => ({ variantId: item.variantId, quantity: Number(quantities[item.variantId]), unitPrice: Number(prices[item.variantId]) }))
      if (!items.length || items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) throw new Error("Enter a final selling price for every fulfilled item.")
      const res = await fetch("/api/pos/fulfill-sales-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salesOrderId: selected.id, items, amountCollected: Number(amountCollected || 0), paymentMethod, fulfillmentMode, deliveryFee: Number(deliveryFee || 0), deliveryFeePayer, deliveryAddress: selected.customer?.address || "", deliveryPhone: selected.customer?.phones?.[0] || selected.customer?.phone || "" }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fulfillment failed")
      onSuccess(data.transaction); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : "Fulfillment failed") } finally { setLoading(false) }
  }

  return <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sales-order-fulfillment-dialog flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="border-b bg-muted/20 px-6 py-5"><DialogTitle className="flex items-center gap-3 text-xl"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardCheck className="h-5 w-5" /></span><span>{t("Fulfill Sales Order", "အရောင်းအမှာစာ ဖြည့်ဆည်းရန်")}</span></DialogTitle><p className="pl-12 text-sm text-muted-foreground">Choose an order, set the final price, then complete the sale.</p></DialogHeader>
      <div className="grid min-h-0 flex-1 md:grid-cols-[330px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-b bg-muted/10 p-4 md:border-b-0 md:border-r"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Open orders</p><p className="text-sm font-semibold">{orders.length} ready to fulfill</p></div><Package className="h-5 w-5 text-primary" /></div><div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or order" className="pl-9" /></div><div className="space-y-2 pr-1">{visibleOrders.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No open Sales Orders are available for this register.</div> : visibleOrders.map((order) => <button key={order.id} type="button" onClick={() => chooseOrder(order.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === order.id ? "border-primary bg-primary/10 shadow-sm" : "bg-card hover:border-primary/50 hover:bg-accent/40"}`}><div className="flex items-start justify-between gap-2"><span className="font-mono text-xs font-bold">#{order.id.slice(-6).toUpperCase()}</span><Badge variant={order.status === "CONFIRMED" ? "success" : "outline"}>{order.status}</Badge></div><p className="mt-2 truncate text-sm font-bold">{order.customer?.name || "Unnamed customer"}</p><p className="mt-1 text-xs text-muted-foreground">{order.items.reduce((sum, item) => sum + item.quantity, 0)} requested units · Deposit {order.amountPaid.toLocaleString()} Ks</p></button>)}</div></aside>
        <section className="flex min-w-0 flex-col overflow-y-auto p-5 md:p-6">{error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}{!selected ? <div className="flex flex-1 flex-col items-center justify-center text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardCheck className="h-8 w-8" /></div><h3 className="text-lg font-bold">Select an order to begin</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">Sales Order details will appear here. Final price, payment, and stock are handled at this step.</p></div> : <><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-muted-foreground">ORDER #{selected.id.slice(-6).toUpperCase()}</p><h3 className="mt-1 flex items-center gap-2 text-xl font-black"><UserRound className="h-5 w-5 text-primary" />{selected.customer?.name || "Unnamed customer"}</h3><div className="mt-2 space-y-0.5 text-sm text-muted-foreground">{(selected.customer?.phones?.length ? selected.customer.phones : selected.customer?.phone ? [selected.customer.phone] : []).map((phone) => <p key={phone}>{phone}</p>)}{selected.customer?.email && <p>{selected.customer.email}</p>}{selected.customer?.address && <p>{selected.customer.address}</p>}</div></div><div className="rounded-lg border bg-emerald-500/10 px-4 py-3 text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Deposit received</p><p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{selected.amountPaid.toLocaleString()} Ks</p></div></div><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold">Fulfillment lines</h4><p className="text-xs text-muted-foreground">Set the actual quantity and final sale price now.</p></div><Badge variant="outline">{selectedItems.length} lines remaining</Badge></div><div className="space-y-3 overflow-y-auto pr-1">{selectedItems.map((item) => <div key={item.id} className="rounded-xl border bg-card p-4 shadow-sm"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-bold">{item.variant.product.name}</p><p className="text-xs text-muted-foreground">{item.variant.name}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px]"><Badge variant="outline">Cost {item.variant.costPrice.toLocaleString()} Ks</Badge><Badge variant="outline">Catalog price {referencePrice(item).toLocaleString()} Ks</Badge><Badge variant={lineChecks.find((line) => line.item.id === item.id)?.stockShort ? "destructive" : "outline"}>Stock {lineChecks.find((line) => line.item.id === item.id)?.availableStock || 0}</Badge></div></div><Badge variant={lineChecks.find((line) => line.item.id === item.id)?.stockShort ? "destructive" : "outline"}>{item.quantity - (item.fulfilledQuantity || 0)} requested</Badge></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Quantity</label><Input type="number" min={1} max={item.quantity - (item.fulfilledQuantity || 0)} value={quantities[item.variantId] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.variantId]: event.target.value }))} /></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Final sale price</label><Input type="number" min={item.variant.costPrice} max={referencePrice(item)} value={prices[item.variantId] || ""} placeholder={`Between ${item.variant.costPrice.toLocaleString()} and ${referencePrice(item).toLocaleString()} Ks`} onChange={(event) => setPrices((current) => ({ ...current, [item.variantId]: event.target.value }))} /></div></div></div>)}</div><div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-[1fr_220px]"><div className="rounded-xl bg-muted/30 p-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Final total</span><span className="font-black">{finalTotal.toLocaleString()} Ks</span></div><div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Deposit applied</span><span className="font-semibold text-emerald-600">-{selected.amountPaid.toLocaleString()} Ks</span></div><div className="mt-3 flex justify-between border-t pt-3 text-base font-black"><span>Balance due</span><span className="text-primary">{remainingBalance.toLocaleString()} Ks</span></div></div><div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Fulfillment path</label><select value={fulfillmentMode} onChange={(event) => setFulfillmentMode(event.target.value as "STORE" | "DELIVERY")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="STORE">Complete in store</option><option value="DELIVERY">Send to Delivery</option></select><label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Collect now</label><Input type="number" min={0} value={amountCollected} onChange={(event) => setAmountCollected(event.target.value)} placeholder={remainingBalance.toLocaleString()} /><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="QR">QR</option></select>{fulfillmentMode === "DELIVERY" && <><label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delivery fee</label><Input type="number" min={0} value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} placeholder="0 Ks" /><select value={deliveryFeePayer} onChange={(event) => setDeliveryFeePayer(event.target.value as "STORE" | "CUSTOMER")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="CUSTOMER">Customer pays delivery fee</option><option value="STORE">Store pays delivery fee</option></select></>}</div></div><p className="mt-4 text-xs text-muted-foreground">The catalog price is a reference. The final sale price is the actual price used for this customer.</p></>}</section>
      </div>
      <DialogFooter className="border-t bg-muted/10 px-6 py-4"><label className="mr-auto flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={fulfillmentMode === "DELIVERY"} onChange={(event) => setFulfillmentMode(event.target.checked ? "DELIVERY" : "STORE")} className="h-4 w-4 rounded border-input accent-primary" />{t("Send to Delivery", "ပို့ဆောင်ရန်")}</label><Button variant="outline" onClick={onClose}>{t("Cancel", "မလုပ်တော့ပါ")}</Button><Button onClick={handleSubmit} disabled={fulfillmentMode === "DELIVERY" ? !canDeliver : !canComplete}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{fulfillmentMode === "DELIVERY" ? t("Create Delivery", "ပို့ဆောင်မှုဖန်တီးရန်") : t("Complete in Store", "ဆိုင်တွင်ပြီးစီးရန်")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

