"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCartStore } from "@/lib/store/useCartStore"
import { useLanguage } from "@/providers/language-provider"
import { Check, CreditCard, Banknote, QrCode, AlertCircle, HandCoins, User, Truck, Phone, MapPin } from "lucide-react"

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  onSuccess: (receipt: unknown) => void;
}

type PaymentMethodType = "CASH" | "CARD" | "QR" | "SPLIT" | "DEBT"

export function PaymentDialog({ isOpen, onClose, staffId, staffName, onSuccess }: PaymentDialogProps) {
  const { t } = useLanguage()
  const items = useCartStore((state) => state.items)
  const activeBranchId = useCartStore((state) => state.activeBranchId)
  const orderDiscount = useCartStore((state) => state.orderDiscount)
  const orderDiscountType = useCartStore((state) => state.orderDiscountType)
  const clearCart = useCartStore((state) => state.clearCart)

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethodType>("CASH")
  const [cashReceivedMMK, setCashReceivedMMK] = React.useState<string>("")
  const [note, setNote] = React.useState<string>("")
  const [receiptEmail, setReceiptEmail] = React.useState<string>("")
  
  // Delivery Fields
  const [isDelivery, setIsDelivery] = React.useState<boolean>(false)
  const [deliveryCustomerName, setDeliveryCustomerName] = React.useState<string>("")
  const [deliveryPhone, setDeliveryPhone] = React.useState<string>("")
  const [deliveryAddress, setDeliveryAddress] = React.useState<string>("")

  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  // Split payment amounts
  const [splitCashMMK, setSplitCashMMK] = React.useState<string>("")
  const [splitNonCashMMK, setSplitNonCashMMK] = React.useState<string>("")
  const [splitMethod, setSplitMethod] = React.useState<"CARD" | "QR">("CARD")

  // Reset state when opening
  React.useEffect(() => {
    if (isOpen) {
      setPaymentMethod("CASH")
      setCashReceivedMMK("")
      setSplitCashMMK("")
      setSplitNonCashMMK("")
      setNote("")
      setReceiptEmail("")
      setIsDelivery(false)
      setDeliveryCustomerName("")
      setDeliveryPhone("")
      setDeliveryAddress("")
      setError(null)
      setLoading(false)
    }
  }, [isOpen])

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const itemsDiscountTotal = items.reduce((sum, item) => sum + (item.discount || 0), 0)
  
  let finalOrderDiscount = 0
  if (orderDiscount > 0) {
    if (orderDiscountType === "percentage") {
      finalOrderDiscount = (subtotal * orderDiscount) / 100
    } else {
      finalOrderDiscount = orderDiscount
    }
  }

  const totalDiscount = itemsDiscountTotal + finalOrderDiscount
  const totalMMK = Math.max(0, subtotal - totalDiscount)

  // Live change calculations
  const mmkCash = parseFloat(cashReceivedMMK) || 0
  const totalCashReceivedMMK = mmkCash
  
  const changeMMK = totalCashReceivedMMK > 0 ? Math.max(0, totalCashReceivedMMK - totalMMK) : 0

  // Split payment validation
  const splitCash = parseFloat(splitCashMMK) || 0
  const splitNonCash = parseFloat(splitNonCashMMK) || 0
  const totalSplitEntered = splitCash + splitNonCash
  const splitRemainingMMK = Math.max(0, totalMMK - totalSplitEntered)

  const handleSplitCashChange = (value: string) => {
    setSplitCashMMK(value)
    const cashVal = parseFloat(value)
    if (!isNaN(cashVal) && cashVal < 0) {
      setError("Split payment amounts cannot be negative")
      return
    }
    setError(null)
    const validCash = isNaN(cashVal) || cashVal < 0 ? 0 : cashVal
    const remaining = Math.max(0, totalMMK - validCash)
    setSplitNonCashMMK(remaining.toString())
  }

  const handleSplitNonCashChange = (value: string) => {
    setSplitNonCashMMK(value)
    const nonCashVal = parseFloat(value)
    if (!isNaN(nonCashVal) && nonCashVal < 0) {
      setError("Split payment amounts cannot be negative")
      return
    }
    if (!isNaN(nonCashVal) && nonCashVal > totalMMK) {
      setError(`Split payment amount cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`)
      return
    }
    setError(null)
  }

  const handleCheckout = async () => {
    if (loading) return
    setError(null)

    // Validations
    if (!activeBranchId) {
      setError("Please select a valid branch before checkout")
      return
    }
    if (items.length === 0) {
      setError("Please add at least one item before checkout")
      return
    }
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        setError(`Quantity for ${item.product.name} must be a whole number greater than 0`)
        return
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
        setError(`Selling price for ${item.product.name} must be greater than 0`)
        return
      }
      if (!item.selectedVariant?.id) {
        setError(`Please select a valid variant for ${item.product.name}`)
        return
      }
      const availableStock = item.selectedVariant.stockLevels?.find((stock) => stock.branchId === activeBranchId)?.quantity || 0
      if (item.selectedVariant.stockLevels && availableStock < item.quantity) {
        setError(`Not enough stock for ${item.product.name}. Available: ${availableStock}`)
        return
      }
    }

    if (finalOrderDiscount > subtotal || totalDiscount > subtotal) {
      setError("Order discount cannot exceed subtotal")
      return
    }

    // Minimum Selling Price Enforcement (R2)
    for (const item of items) {
      const costPrice = item.selectedVariant?.costPrice ?? 0
      if (costPrice > 0) {
        const effectiveSellingPrice = (item.unitPrice * item.quantity - (item.discount || 0)) / item.quantity
        if (effectiveSellingPrice < costPrice) {
          setError(`Selling price for ${item.product.name} (${effectiveSellingPrice} Ks) cannot be lower than cost price (${costPrice} Ks)`)
          return
        }
      }
    }

    if (paymentMethod === "CASH" && totalCashReceivedMMK < totalMMK) {
      setError("Received cash is less than total amount / လက်ခံရရှိငွေ မလုံလောက်ပါ")
      return
    }

    if (paymentMethod === "SPLIT") {
      const rawCash = parseFloat(splitCashMMK)
      const rawNonCash = parseFloat(splitNonCashMMK)
      if ((!isNaN(rawCash) && rawCash < 0) || (!isNaN(rawNonCash) && rawNonCash < 0)) {
        setError("Split payment amounts cannot be negative")
        return
      }
      if (splitCash > totalMMK) {
        setError(`Split cash amount (${splitCash.toLocaleString()} Ks) cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`)
        return
      }
      if (splitNonCash > totalMMK) {
        setError(`Split non-cash amount (${splitNonCash.toLocaleString()} Ks) cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`)
        return
      }
      if (totalSplitEntered > totalMMK) {
        setError(`Total split payment amount (${totalSplitEntered.toLocaleString()} Ks) cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`)
        return
      }
      if (Math.abs(totalSplitEntered - totalMMK) > 1) {
        setError(`Split total must equal total order amount. Remaining: ${splitRemainingMMK.toLocaleString()} Ks`)
        return
      }
    }

    setLoading(true)
    
    // Prepare transaction payload
    const payload = {
      branchId: activeBranchId,
      staffId,
      subtotal,
      discountAmount: totalDiscount,
      total: totalMMK, // Database stores totals in MMK as primary base
      currency: "MMK",
      exchangeRate: 1,
      paymentMethod,
      cashReceived: paymentMethod === "CASH" ? totalCashReceivedMMK : (paymentMethod === "SPLIT" ? splitCash : null),
      changeGiven: paymentMethod === "CASH" ? changeMMK : null,
      note: note || null,
      receiptEmail: receiptEmail || null,
      isDelivery,
      deliveryCustomerName: isDelivery ? deliveryCustomerName : null,
      deliveryPhone: isDelivery ? deliveryPhone : null,
      deliveryAddress: isDelivery ? deliveryAddress : null,
      items,
    }

    try {
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed")
      }

      // Success callback to show receipt print view
      onSuccess(data.transaction)
      clearCart()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process checkout transaction")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-card border-border">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span className="text-foreground">{t("POS Sales Voucher", "အရောင်းဘောက်ချာ")}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {t("Cashier:", "ငွေကိုင်:")} <strong className="text-foreground">{staffName}</strong>
            </span>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs font-semibold text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto p-1 flex-1">
          {/* Left side: Payment Methods */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("Select Payment Method", "ပေးချေမည့် နည်းလမ်း")}
            </h3>

            {/* Payment buttons grid */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={paymentMethod === "CASH" ? "default" : "outline"}
                className="h-14 flex flex-col items-center justify-center gap-1 font-semibold rounded-xl"
                onClick={() => setPaymentMethod("CASH")}
              >
                <Banknote className="h-4 w-4" />
                <span className="text-xs">{t("Cash", "ငွေသား")}</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "CARD" ? "default" : "outline"}
                className="h-14 flex flex-col items-center justify-center gap-1 font-semibold rounded-xl"
                onClick={() => setPaymentMethod("CARD")}
              >
                <CreditCard className="h-4 w-4" />
                <span className="text-xs">{t("Card", "ကတ်ဖြင့်")}</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "QR" ? "default" : "outline"}
                className="h-14 flex flex-col items-center justify-center gap-1 font-semibold rounded-xl"
                onClick={() => setPaymentMethod("QR")}
              >
                <QrCode className="h-4 w-4" />
                <span className="text-xs">Mobile QR</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "DEBT" ? "default" : "outline"}
                className={`h-14 flex flex-col items-center justify-center gap-1 font-semibold rounded-xl ${
                  paymentMethod === "DEBT" ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                }`}
                onClick={() => setPaymentMethod("DEBT")}
              >
                <HandCoins className="h-4 w-4" />
                <span className="text-xs">{t("DEBT", "ကြွေးရောင်း")}</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "SPLIT" ? "default" : "outline"}
                className="h-14 flex flex-col items-center justify-center gap-1 font-semibold rounded-xl col-span-2"
                onClick={() => {
                  setPaymentMethod("SPLIT")
                  setSplitCashMMK("")
                  setSplitNonCashMMK(totalMMK.toString())
                  setError(null)
                }}
              >
                <span className="text-xs">{t("Split Payment", "ခွဲခြားပေးချေမည်")}</span>
              </Button>
            </div>

            {/* Inputs based on payment method */}
            {paymentMethod === "CASH" && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    {t("Cash Received (MMK)", "လက်ခံရရှိငွေ (ကျပ်)")}
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter Ks amount"
                    value={cashReceivedMMK}
                    onChange={(e) => setCashReceivedMMK(e.target.value)}
                    className="h-11 text-base font-bold bg-muted/20 border-border text-foreground"
                  />
                  {/* Quick cash shortcut buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[5000, 10000, 20000, 50000].map((amount) => (
                      <Button
                        key={amount}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs font-semibold"
                        onClick={() => setCashReceivedMMK(amount.toString())}
                      >
                        {amount.toLocaleString()}Ks
                      </Button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {paymentMethod === "SPLIT" && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={splitMethod === "CARD" ? "default" : "outline"}
                    size="sm"
                    className="w-1/2 text-xs"
                    onClick={() => setSplitMethod("CARD")}
                  >
                    Cash + Card
                  </Button>
                  <Button
                    type="button"
                    variant={splitMethod === "QR" ? "default" : "outline"}
                    size="sm"
                    className="w-1/2 text-xs"
                    onClick={() => setSplitMethod("QR")}
                  >
                    Cash + QR
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    {t("Cash Amount (MMK)", "ငွေသား ပမာဏ")}
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter Cash Ks"
                    value={splitCashMMK}
                    onChange={(e) => handleSplitCashChange(e.target.value)}
                    className="h-10 text-sm font-bold bg-muted/20 border-border text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    {splitMethod === "CARD" ? t("Card Amount (MMK)", "ကတ် ပမာဏ") : t("QR Amount (MMK)", "QR ပမာဏ")}
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter Non-cash Ks"
                    value={splitNonCashMMK}
                    onChange={(e) => handleSplitNonCashChange(e.target.value)}
                    className="h-10 text-sm font-bold bg-muted/20 border-border text-foreground"
                  />
                </div>

                <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border border-border text-xs">
                  <span className="text-muted-foreground">{t("Remaining to split:", "ခွဲရန်ကျန် ပမာဏ:")}</span>
                  <span className={`font-bold ${splitRemainingMMK > 0 ? "text-destructive" : "text-primary"}`}>
                    {splitRemainingMMK.toLocaleString()} Ks
                  </span>
                </div>
              </div>
            )}

            {(paymentMethod === "CARD" || paymentMethod === "QR") && (
              <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border border-dashed border-border rounded-xl text-center">
                {paymentMethod === "CARD" ? (
                  <>
                    <CreditCard className="h-10 w-10 text-primary mb-2 animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">Swipe or Insert Card on External Sales Voucher</span>
                    <span className="text-xs text-muted-foreground mt-1">{t("Swipe card on external POS terminal", "ပြင်ပဘဏ်ကတ်စက်တွင် ကတ်ခြစ်ပြီး ငွေလက်ခံပါ")}</span>
                  </>
                ) : (
                  <>
                    <QrCode className="h-10 w-10 text-primary mb-2 animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">Scan Shop QR Code for Wallet Payment</span>
                    <span className="text-xs text-muted-foreground mt-1">{t("Scan shop QR code for wallet payment", "ဆိုင်၏ KBZPay, CBPay, WavePay QR စကန်ဖတ်ခိုင်းပါ")}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side: Summary & details */}
          <div className="space-y-4 border-l border-border pl-0 md:pl-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("Order Summary", "အရောင်းအကျဉ်းချုပ်")}
            </h3>

            {/* Calculations Table */}
            <div className="space-y-2 border border-border p-4 rounded-xl bg-muted/10">
              <div className="flex justify-between text-sm text-foreground">
                <span className="text-muted-foreground">{t("Subtotal:", "စုစုပေါင်း:")}</span>
                <span>{subtotal.toLocaleString()} Ks</span>
              </div>
              <div className="flex justify-between text-sm text-foreground">
                <span className="text-muted-foreground">{t("Discount:", "လျှော့စျေး:")}</span>
                <span className="text-primary font-semibold">-{totalDiscount.toLocaleString()} Ks</span>
              </div>
              <div className="flex justify-between text-sm text-foreground">
                <span className="text-muted-foreground">{t("Tax (inclusive):", "အခွန်ထည့်ပြီး:")}</span>
                <span>0 Ks</span>
              </div>
              <div className="border-t border-border my-2 pt-2 flex flex-col">
                <div className="flex justify-between items-center text-base font-extrabold text-foreground">
                  <span>{t("Grand Total:", "ကျသင့်ငွေ:")}</span>
                  <span className="text-xl text-foreground font-black">{totalMMK.toLocaleString()} Ks</span>
                </div>
              </div>
            </div>

            {/* Live Change Calculator (For Cash) */}
            {paymentMethod === "CASH" && totalCashReceivedMMK > 0 && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold">
                  {t("Change to Return", "ပြန်အမ်းငွေ")}
                </span>
                <span className="text-2xl font-black text-primary">
                  {changeMMK.toLocaleString()} Ks
                </span>
              </div>
            )}

            {/* Delivery Section (Replaces Email & Notes) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border">
                <input
                  type="checkbox"
                  id="isDeliveryToggle"
                  checked={isDelivery}
                  onChange={(e) => setIsDelivery(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="isDeliveryToggle" className="text-sm font-bold text-foreground cursor-pointer select-none flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span>{t("Delivery", "ပို့ဆောင်ပေးရမည်")}</span>
                </label>
              </div>

              {isDelivery && (
                <div className="space-y-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("Customer Name *", "ဝယ်သူအမည် *")}
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Daw Aye Aye"
                      value={deliveryCustomerName}
                      onChange={(e) => setDeliveryCustomerName(e.target.value)}
                      className="h-9 text-xs bg-background border-border"
                      required={isDelivery}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("Phone Number *", "ဖုန်းနံပါတ် *")}
                    </label>
                    <Input
                      type="tel"
                      placeholder="e.g. 09123456789"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      className="h-9 text-xs bg-background border-border"
                      required={isDelivery}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("Delivery Address *", "ပို့ဆောင်ရမည့် လိပ်စာ *")}
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. No. 12, Pyay Road, Kamayut Tsp, Yangon"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="h-9 text-xs bg-background border-border"
                      required={isDelivery}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4 flex-row items-center justify-between gap-4 mt-auto">
          <Button
            type="button"
            variant="outline"
            className="px-6 font-semibold"
            onClick={onClose}
            disabled={loading}
          >
            {t("Cancel", "မလုပ်တော့ပါ")}
          </Button>
          <Button
            type="button"
            size="lg"
            className="px-10 font-bold bg-primary text-primary-foreground flex items-center gap-2 rounded-xl"
            onClick={handleCheckout}
            disabled={loading || items.length === 0}
          >
            <Check className="h-5 w-5" />
            <span>{t("Complete Order", "ငွေလက်ခံပြီး")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
