"use client"

import * as React from "react"
import { useCartStore } from "@/lib/store/useCartStore"
import { useLanguage } from "@/providers/language-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Trash, Plus, Minus, Tag, Notebook, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface CartPanelProps {
  onCheckoutClick: () => void;
  onHoldCartsClick: () => void;
}

export function CartPanel({ onCheckoutClick, onHoldCartsClick }: CartPanelProps) {
  const { t } = useLanguage()
  const items = useCartStore((state) => state.items)
  const activeBranchId = useCartStore((state) => state.activeBranchId)
  const orderDiscount = useCartStore((state) => state.orderDiscount)
  const orderDiscountType = useCartStore((state) => state.orderDiscountType)
  const heldCarts = useCartStore((state) => state.heldCarts)
  
  // Actions
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const updateItemNote = useCartStore((state) => state.updateItemNote)
  const setOrderDiscount = useCartStore((state) => state.setOrderDiscount)
  const holdCart = useCartStore((state) => state.holdCart)
  const clearCart = useCartStore((state) => state.clearCart)

  // Local dialog states
  const [isDiscountOpen, setIsDiscountOpen] = React.useState(false)
  const [discountVal, setDiscountVal] = React.useState("")
  const [discountType, setDiscountType] = React.useState<"percentage" | "fixed">("fixed")
  const [discountError, setDiscountError] = React.useState<string | null>(null)

  const [isHoldOpen, setIsHoldOpen] = React.useState(false)
  const [holdName, setHoldName] = React.useState("")

  const [activeItemNotes, setActiveItemNotes] = React.useState<{ [key: string]: string }>({})
  const [editingNotesId, setEditingNotesId] = React.useState<string | null>(null)

  // Calculations
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

  const grandTotalMMK = Math.max(0, subtotal - itemsDiscountTotal - finalOrderDiscount)

  const handleApplyOrderDiscount = () => {
    setDiscountError(null)
    const val = parseFloat(discountVal) || 0
    if (val < 0) {
      setDiscountError(t("Discount amount cannot be negative", "လျှော့စျေး ပမာဏသည် နှုတ်ကိန်း ဖြစ်၍မရပါ"))
      return
    }

    let calculatedDiscount = val
    if (discountType === "percentage") {
      if (val > 100) {
        setDiscountError(t("Discount percentage cannot exceed 100%", "လျှော့စျေး ရာခိုင်နှုန်းသည် ၁၀၀% မကျော်လွန်နိုင်ပါ"))
        return
      }
      calculatedDiscount = (subtotal * val) / 100
    }

    if (calculatedDiscount > subtotal) {
      setDiscountError(t(`Order discount (${calculatedDiscount.toLocaleString()} Ks) cannot exceed subtotal (${subtotal.toLocaleString()} Ks)`, `ခြင်းလျှော့စျေး (${calculatedDiscount.toLocaleString()} ကျပ်) သည် စုစုပေါင်းထက် မပိုနိုင်ပါ`))
      return
    }

    setOrderDiscount(val, discountType)
    setIsDiscountOpen(false)
  }

  const handleHoldCartSubmit = () => {
    holdCart(holdName.trim())
    setHoldName("")
    setIsHoldOpen(false)
  }

  const handleOpenDiscountDialog = () => {
    setDiscountVal(orderDiscount.toString())
    setDiscountType(orderDiscountType)
    setDiscountError(null)
    setIsDiscountOpen(true)
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none overflow-hidden">
      {/* Cart Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
          <Notebook className="h-4 w-4 text-primary" />
          <span>{t("Shopping Cart", "ဝယ်ယူမှုစာရင်း")}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onHoldCartsClick}
            className="h-8 w-8 text-foreground hover:bg-muted relative"
            title="Held Orders"
          >
            <Clock className="h-4 w-4" />
            {heldCarts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                {heldCarts.length}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearCart}
            disabled={items.length === 0}
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            title="Clear Cart"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10 space-y-2">
            <span className="text-3xl">🛒</span>
            <span className="text-xs font-semibold">{t("Cart is empty", "ဝယ်ယူမှုစာရင်းမရှိသေးပါ။")}</span>
            <span className="text-[10px] text-muted-foreground max-w-[180px]">{t("Scan a barcode or click a product to add items.", "ဘားကုဒ် ဖတ်ပါ သို့မဟုတ် ပစ္စည်းကို နှိပ်၍ ထည့်ပါ။")}</span>
          </div>
        ) : (
          items.map((item) => {
            const itemTotal = (item.unitPrice * item.quantity) - (item.discount || 0)
            const stockLevels = item.selectedVariant?.stockLevels
            const availableStock = stockLevels
              ? stockLevels.find((stock) => stock.branchId === activeBranchId)?.quantity || 0
              : undefined
            return (
              <div
                key={item.id}
                className="flex flex-col p-3 rounded-xl border border-border bg-muted/10 hover:border-muted-foreground/25 transition duration-150 space-y-2"
              >
                {/* Product details */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col space-y-0.5 max-w-[70%]">
                    <span className="font-extrabold text-xs text-foreground leading-tight">
                      {item.product.name}
                    </span>
                    {/* Selected Options */}
                    <div className="flex flex-wrap gap-1 items-center pt-0.5">
                      {item.selectedVariant && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {item.selectedVariant.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-xs text-foreground">
                      {itemTotal.toLocaleString()} Ks
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {item.unitPrice.toLocaleString()} Ks
                    </span>
                  </div>
                </div>

                {/* Adjust note or discount */}
                <div className="flex justify-between items-center pt-1 border-t border-border/40">
                  {/* Quantity adjustments */}
                  <div className="flex items-center gap-1.5 bg-muted/60 p-0.5 rounded-lg border border-border/50">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-foreground rounded-md"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={availableStock}
                      step={1}
                      value={item.quantity}
                      onChange={(event) => {
                        const nextQuantity = Number(event.target.value)
                        if (!Number.isInteger(nextQuantity) || nextQuantity < 1) return
                        if (availableStock !== undefined && nextQuantity > availableStock) return
                        updateQuantity(item.id, nextQuantity)
                      }}
                      className="h-6 w-12 px-1 text-center text-xs font-bold text-foreground"
                      aria-label={t("Quantity", "အရေအတွက်")}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-foreground rounded-md"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={availableStock !== undefined && item.quantity >= availableStock}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Actions (Notes, Delete) */}
                  <div className="flex items-center gap-2">
                    {editingNotesId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder={t("Note", "မှတ်ချက်")}
                          value={activeItemNotes[item.id] || ""}
                          onChange={(e) => setActiveItemNotes({ ...activeItemNotes, [item.id]: e.target.value })}
                          className="h-7 text-[10px] px-2 w-28 bg-background border-border text-foreground"
                        />
                        <Button
                          size="sm"
                          className="h-7 text-[10px] px-2"
                          onClick={() => {
                            updateItemNote(item.id, activeItemNotes[item.id] || "")
                            setEditingNotesId(null)
                          }}
                        >
                          {t("Save", "သိမ်းမည်")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveItemNotes({ ...activeItemNotes, [item.id]: item.note || "" })
                          setEditingNotesId(item.id)
                        }}
                        className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        {item.note ? t("Edit Note", "မှတ်ချက် ပြင်ရန်") : t("+ Note", "+ မှတ်ချက်")}
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Render inline note if exists */}
                {item.note && (
                  <div className="text-[10px] bg-primary/5 text-primary border border-primary/10 rounded p-1.5 font-medium italic">
                    {t("Note:", "မှတ်ချက်:")} {item.note}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Cart Summary Panel */}
      <div className="border-t border-border p-4 bg-muted/10 space-y-4">
        <div className="space-y-1.5 text-xs font-semibold text-foreground">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("Subtotal:", "စုစုပေါင်း:")}</span>
            <span>{subtotal.toLocaleString()} Ks</span>
          </div>
          {itemsDiscountTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Item Discount:", "ပစ္စည်းလျှော့စျေး:")}</span>
              <span className="text-primary">-{itemsDiscountTotal.toLocaleString()} Ks</span>
            </div>
          )}
          {finalOrderDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Order Discount:", "ခြင်းလျှော့စျေး:")}</span>
              <span className="text-primary">-{finalOrderDiscount.toLocaleString()} Ks</span>
            </div>
          )}
          <div className="border-t border-border/60 my-2 pt-2 flex flex-col">
            <div className="flex justify-between items-center text-sm font-extrabold text-foreground">
              <span>{t("Grand Total:", "ကျသင့်ငွေ:")}</span>
              <span className="text-lg font-black">{grandTotalMMK.toLocaleString()} Ks</span>
            </div>
          </div>
        </div>

        {/* Toolbar buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="text-xs font-bold border-border text-foreground hover:bg-muted"
            onClick={handleOpenDiscountDialog}
            disabled={items.length === 0}
          >
            <Tag className="h-4 w-4 mr-1.5 text-primary" />
            {t("Discount", "လျှော့စျေး")}
          </Button>
          <Button
            variant="outline"
            className="text-xs font-bold border-border text-foreground hover:bg-muted"
            onClick={() => setIsHoldOpen(true)}
            disabled={items.length === 0}
          >
            <Clock className="h-4 w-4 mr-1.5 text-primary" />
            {t("Hold Cart", "စောင့်ဆိုင်း")}
          </Button>
        </div>

        <Button
          onClick={onCheckoutClick}
          disabled={items.length === 0}
          size="lg"
          className="w-full font-black text-sm bg-primary text-primary-foreground py-6 rounded-xl hover:scale-[1.01] transition duration-200"
        >
          {t("Pay Now", "ငွေချေမည်")} ({grandTotalMMK.toLocaleString()} Ks)
        </Button>
      </div>

      {/* Discount Dialog */}
      <Dialog open={isDiscountOpen} onOpenChange={setIsDiscountOpen}>
        <DialogContent className="max-w-xs bg-card border-border p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">{t("Order Discount", "ခြင်းလျှော့စျေး")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-3">
            {discountError && (
              <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-semibold">
                {discountError}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={discountType === "fixed" ? "default" : "outline"}
                className="w-1/2 text-xs"
                onClick={() => {
                  setDiscountType("fixed")
                  setDiscountError(null)
                }}
              >
                {t("Flat Ks", "ကျပ်")}
              </Button>
              <Button
                type="button"
                variant={discountType === "percentage" ? "default" : "outline"}
                className="w-1/2 text-xs"
                onClick={() => {
                  setDiscountType("percentage")
                  setDiscountError(null)
                }}
              >
                {t("Percent %", "ရာခိုင်နှုန်း")}
              </Button>
            </div>
            <Input
              type="number"
              placeholder={discountType === "fixed" ? "e.g. 1000 Ks" : "e.g. 5%"}
              value={discountVal}
              onChange={(e) => {
                setDiscountVal(e.target.value)
                setDiscountError(null)
              }}
              className="h-10 text-sm bg-muted/20 border-border text-foreground font-bold"
            />
          </div>
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button variant="outline" className="w-1/2" onClick={() => setIsDiscountOpen(false)}>
              {t("Cancel", "မလုပ်တော့ပါ")}
            </Button>
            <Button className="w-1/2 font-semibold" onClick={handleApplyOrderDiscount}>
              {t("Apply", "သုံးမည်")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Cart Dialog */}
      <Dialog open={isHoldOpen} onOpenChange={setIsHoldOpen}>
        <DialogContent className="max-w-xs bg-card border-border p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">{t("Hold Order", "ဆိုင်းငံ့ရန်")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-3">
            <label className="text-xs font-semibold text-muted-foreground">{t("Enter Table No. or Order Name", "စားပွဲအမှတ် သို့မဟုတ် နာမည် ထည့်ပါ")}</label>
            <Input
              placeholder="e.g. Table 5 / Cust Min"
              value={holdName}
              onChange={(e) => setHoldName(e.target.value)}
              className="h-10 text-sm bg-muted/20 border-border text-foreground font-semibold"
            />
          </div>
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button variant="outline" className="w-1/2" onClick={() => setIsHoldOpen(false)}>
              {t("Cancel", "မလုပ်တော့ပါ")}
            </Button>
            <Button className="w-1/2 font-semibold" onClick={handleHoldCartSubmit}>
              {t("Hold", "စောင့်မည်")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
