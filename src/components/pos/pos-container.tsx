"use client"

import * as React from "react"
import { useCartStore } from "@/lib/store/useCartStore"
import { ProductGrid } from "./product-grid"
import { CartPanel } from "./cart-panel"
import { AddonVariantSelector } from "./addon-variant-selector"
import { PinSwitchDialog } from "./pin-switch-dialog"
import { HoldListDialog } from "./hold-list-dialog"
import { PaymentDialog } from "./payment-dialog"
import { ReceiptView, type ReceiptTransaction } from "./receipt-view"
import { SalesHistoryDialog } from "./sales-history-dialog"
import { SalesOrderFulfillmentDialog } from "./sales-order-fulfillment-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { User, LogOut, KeyRound, Building, History, ClipboardCheck } from "lucide-react"
import { useLanguage } from "@/providers/language-provider"
import { useUser } from "@/providers/auth-provider"
import type { Branch, Category, Product, StaffSession } from "@/types/pos"

interface POSContainerProps {
  initialBranches: Branch[];
  initialCategories: Category[];
  initialProducts: Product[];
  initialStaff?: StaffSession | null;
}

export function POSContainer({
  initialBranches,
  initialCategories,
  initialProducts,
  initialStaff = null,
}: POSContainerProps) {
  const { t } = useLanguage()
  const { user } = useUser()
  // Zustand States & Actions
  const activeBranchId = useCartStore((state) => state.activeBranchId)
  const activeBranchName = useCartStore((state) => state.activeBranchName)
  const exchangeRate = useCartStore((state) => state.exchangeRate)
  const setBranch = useCartStore((state) => state.setBranch)
  const setExchangeRate = useCartStore((state) => state.setExchangeRate)

  // Local Component States - Active staff defaults to initialStaff with NO PIN lock requirement
  const [activeStaff, setActiveStaff] = React.useState<StaffSession | null>(initialStaff)
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
  const [products, setProducts] = React.useState<Product[]>(initialProducts)

  React.useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  const refreshProducts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/products")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setProducts(data)
        } else if (data.products && Array.isArray(data.products)) {
          setProducts(data.products)
        }
      }
    } catch (err) {
      console.error("Failed to refresh products", err)
    }
  }, [])
  
  // Dialog Open States - PIN pad disabled
  const [isPinOpen, setIsPinOpen] = React.useState(false)
  const [isHoldOpen, setIsHoldOpen] = React.useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false)
  const [isBranchSelectOpen, setIsBranchSelectOpen] = React.useState(false)
  const [isRateOpen, setIsRateOpen] = React.useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false)
  const [isFulfillmentOpen, setIsFulfillmentOpen] = React.useState(false)

  // API State
  const [currentReceipt, setCurrentReceipt] = React.useState<ReceiptTransaction | null>(null)
  const [newRateVal, setNewRateVal] = React.useState("")
  const [rateLoading, setRateLoading] = React.useState(false)

  // Initialize assigned branch for staff directly, or first branch if none set
  React.useEffect(() => {
    const targetBranchId = activeStaff?.branchId || user?.branchId
    const isOwnerRole = (activeStaff?.role || user?.role) === "OWNER"
    const targetBranchName =
      activeStaff?.branchName ||
      user?.branchName ||
      initialBranches.find((b) => b.id === targetBranchId)?.name ||
      ""

    const hasValidActiveBranch = Boolean(
      activeBranchId && initialBranches.some((branch) => branch.id === activeBranchId)
    )

    if (targetBranchId && (!isOwnerRole || !hasValidActiveBranch)) {
      setBranch(targetBranchId, targetBranchName)
    } else if (!hasValidActiveBranch && initialBranches.length > 0) {
      setBranch(initialBranches[0].id, initialBranches[0].name)
    }
  }, [activeStaff, user, activeBranchId, initialBranches, setBranch])

  // Lock screen if no cashier is active
  React.useEffect(() => {
    if (!activeStaff) {
      setIsPinOpen(true)
    }
  }, [activeStaff])

  const handleStaffLogin = (staff: StaffSession) => {
    setActiveStaff(staff)
    // Clear the lock flag and set unlocked so refresh no longer shows PIN screen
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pos_unlocked", "true")
      sessionStorage.removeItem("pos_locked")
    }
    // If cashier has a designated branch, update the register branch
    if (staff.branchId) {
      const staffBranch = initialBranches.find((b) => b.id === staff.branchId)
      setBranch(staff.branchId, staffBranch?.name || staff.branchName || "")
    }
    setIsPinOpen(false)
  }

  const handleStaffLogout = () => {
    // Persist the lock so page refresh still requires PIN
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pos_locked", "true")
      sessionStorage.removeItem("pos_unlocked")
    }
    setActiveStaff(null)
  }

  const handleUpdateExchangeRate = async () => {
    const rateVal = parseFloat(newRateVal)
    if (!rateVal || rateVal <= 0 || !activeStaff) return

    setRateLoading(true)
    try {
      const response = await fetch("/api/pos/exchange-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mmkPerUsd: rateVal,
          setByStaffId: activeStaff.id,
          branchId: activeBranchId,
        }),
      })

      if (response.ok) {
        setExchangeRate(rateVal)
        setIsRateOpen(false)
      }
    } catch (error) {
      console.error("Failed to update exchange rate", error)
    } finally {
      setRateLoading(false)
    }
  }

  const handleCheckoutSuccess = (transaction: unknown) => {
    setCurrentReceipt(transaction as ReceiptTransaction)
    setIsReceiptOpen(true)
    refreshProducts()
  }

  const handleSelectBranch = (branch: Branch) => {
    setBranch(branch.id, branch.name)
    setIsBranchSelectOpen(false)
  }

  const isOwner = activeStaff?.role === "OWNER"

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden select-none bg-background text-foreground">

      {/* Sales Voucher Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-6">
          {/* Active cashier info */}
          {activeStaff ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                {activeStaff.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {activeStaff.name} ({activeStaff.role})
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">{t("Logged in cashier", "ဝင်ရောက်ထားသော ငွေကိုင်")}</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-bold italic">{t("No Cashier Session", "ငွေကိုင် အကောင့် မဝင်ရသေးပါ")}</span>
          )}

          {/* Active Branch info */}
          <div
            className={`flex items-center gap-3 border-l border-border pl-6 ${
              isOwner ? "cursor-pointer hover:opacity-80" : "cursor-default"
            }`}
            onClick={() => {
              if (isOwner) setIsBranchSelectOpen(true)
            }}
          >
            <Building className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-black text-foreground">
                {activeBranchName || t("Select Branch...", "ဆိုင်ခွဲ ရွေးပါ...")}
              </span>
              {!isOwner && (
                <span className="text-[9px] text-muted-foreground font-semibold">{t("Assigned Branch", "သတ်မှတ်ထားသော ဆိုင်ခွဲ")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Exchange Rate & Switch cashier buttons */}
        <div className="flex items-center gap-4">
          {/* Exchange rate widget */}
          <div className="flex items-baseline gap-2 bg-muted/30 border border-border px-3 py-1.5 rounded-lg">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("Rate:", "နှုန်း:")}</span>
            <span className="text-xs font-black text-foreground">1 USD = {exchangeRate.toLocaleString()} Ks</span>
            {activeStaff && (activeStaff.role === "OWNER" || activeStaff.role === "MANAGER") && (
              <button
                onClick={() => {
                  setNewRateVal(exchangeRate.toString())
                  setIsRateOpen(true)
                }}
                className="text-[10px] text-primary hover:underline font-semibold ml-1.5 focus:outline-none"
              >
                {t("Edit", "ပြင်ရန်")}
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            className="text-xs font-bold border-border text-foreground hover:bg-muted gap-1.5"
          >
            <History className="h-3.5 w-3.5 text-primary" />
            <span>{t("History", "မှတ်တမ်း")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFulfillmentOpen(true)}
            className="text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span>{t("Fulfill Order", "အမှာစာ ဖြည့်ဆည်းရန်")}</span>
          </Button>

        </div>
      </header>

      {/* POS Main Content Panels */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Side: Cart Panel (40% width) */}
        <section className="w-[380px] lg:w-[420px] shrink-0 h-full border-r border-border">
          <CartPanel
            onCheckoutClick={() => setIsPaymentOpen(true)}
            onHoldCartsClick={() => setIsHoldOpen(true)}
          />
        </section>

        {/* Right Side: Product Grid (60% width) */}
        <section className="flex-1 h-full p-6 overflow-hidden bg-muted/10">
          <ProductGrid
            products={products}
            categories={initialCategories}
            onProductClick={(product) => {
              // 1-Click selection: If product has only 1 variant option, add directly to cart!
              if (product.variants && product.variants.length <= 1) {
                const defaultVariant = product.variants[0] || null
                useCartStore.getState().addItem({
                  product: {
                    id: product.id,
                    name: product.name,
                    imageUrl: product.imageUrl,
                    categoryId: product.categoryId,
                    price: product.price,
                  },
                  selectedVariant: defaultVariant,
                  quantity: 1,
                  discount: 0,
                  discountType: "fixed",
                })
              } else {
                // If product has multiple variants (e.g. sizes), open customization modal
                setSelectedProduct(product)
              }
            }}
          />
        </section>
      </main>

      {/* ─── POS MODALS & DIALOGS ────────────────────────────────────────────── */}

      {/* Variant & Addons customizer modal */}
      <AddonVariantSelector
        product={selectedProduct}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Held Carts list modal */}
      <HoldListDialog
        isOpen={isHoldOpen}
        onClose={() => setIsHoldOpen(false)}
      />

      {/* Cash checkout payment dialog */}
      <PaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        staffId={activeStaff?.id || ""}
        staffName={activeStaff?.name || ""}
        onSuccess={handleCheckoutSuccess}
      />

      <ReceiptView
        transaction={currentReceipt}
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false)
          setCurrentReceipt(null)
        }}
      />

      {/* Branch selector modal */}
      <Dialog open={isBranchSelectOpen} onOpenChange={setIsBranchSelectOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">{t("Select Branch", "ဆိုင်ခွဲရွေးပါ")}</DialogTitle>
          </DialogHeader>
          <div className="my-4 max-h-60 overflow-y-auto space-y-2 pr-1">
            {initialBranches.map((branch) => {
              const isActive = branch.id === activeBranchId
              return (
                <Button
                  key={branch.id}
                  variant={isActive ? "default" : "outline"}
                  onClick={() => handleSelectBranch(branch)}
                  className="w-full justify-start text-xs font-semibold py-5 rounded-lg text-left"
                >
                  {branch.name}
                  {isActive && <span className="ml-auto text-[10px] bg-primary-foreground text-primary px-1.5 py-0.5 rounded font-bold">{t("Active", "လက်ရှိ")}</span>}
                </Button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Exchange Rate settings editor modal */}
      <Dialog open={isRateOpen} onOpenChange={setIsRateOpen}>
        <DialogContent className="max-w-xs bg-card border-border p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">{t("Set Daily Exchange Rate", "နေ့စဉ် လဲလှယ်နှုန်း သတ်မှတ်ရန်")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase">{t("MMK per 1 USD", "ဒေါ်လာလဲနှုန်း")}</label>
            <Input
              type="number"
              placeholder="e.g. 4500 Ks"
              value={newRateVal}
              onChange={(e) => setNewRateVal(e.target.value)}
              className="h-10 text-sm bg-muted/20 border-border text-foreground font-bold"
            />
            <span className="text-[10px] text-muted-foreground block">{t("Note: This will update the daily conversion rate for checkouts.", "မှတ်ချက်။ ဤငွေလဲနှုန်းသည် အရောင်းစာရင်းတွက်ချက်ရာတွင် အသုံးပြုပါမည်။")}</span>
          </div>
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button variant="outline" className="w-1/2" onClick={() => setIsRateOpen(false)}>
              {t("Cancel", "မလုပ်တော့ပါ")}
            </Button>
            <Button className="w-1/2 font-semibold" onClick={handleUpdateExchangeRate} disabled={rateLoading}>
              {rateLoading ? t("Updating...", "ပြင်ဆင်နေသည်...") : t("Save Rate", "သိမ်းဆည်းမည်")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales History Modal */}
      <SalesHistoryDialog
        isOpen={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        branchId={activeBranchId}
        staffId={activeStaff?.id || user?.id}
        userRole={activeStaff?.role || user?.role}
        onSelectReceipt={(receipt) => {
          setCurrentReceipt(receipt)
          setIsReceiptOpen(true)
        }}
      />

      <SalesOrderFulfillmentDialog
        isOpen={isFulfillmentOpen}
        onClose={() => setIsFulfillmentOpen(false)}
        branchId={activeBranchId}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  )
}

