"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store/useCartStore"
import { useLanguage } from "@/providers/language-provider"
import { Play, Trash2, Clock } from "lucide-react"

interface HoldListDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HoldListDialog({ isOpen, onClose }: HoldListDialogProps) {
  const { t } = useLanguage()
  const heldCarts = useCartStore((state) => state.heldCarts)
  const resumeCart = useCartStore((state) => state.resumeCart)
  const deleteHeldCart = useCartStore((state) => state.deleteHeldCart)

  const handleResume = (id: string) => {
    resumeCart(id)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            <span>{t("Held Transactions", "ဆိုင်းငံ့ထားသော ခြင်းများ")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="my-4 max-h-[300px] overflow-y-auto space-y-2 pr-1">
          {heldCarts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t("No held transactions found", "ဆိုင်းငံ့ထားသော အရောင်းမရှိပါ။")}
            </div>
          ) : (
            heldCarts.map((cart) => {
              const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
              
              // Calculate cart total price
              const cartTotal = cart.items.reduce((total, item) => {
                const itemTotal = (item.unitPrice * item.quantity) - item.discount
                return total + itemTotal
              }, 0)

              // Format date
              const timeString = new Date(cart.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })

              return (
                <div
                  key={cart.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition duration-150"
                >
                  <div className="flex flex-col space-y-1">
                    <span className="font-bold text-sm text-foreground">
                      {cart.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Held at {timeString} &bull; {itemsCount} items &bull; {cartTotal.toLocaleString()} Ks
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/20 hover:border-destructive hover:bg-destructive/10"
                      onClick={() => deleteHeldCart(cart.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="font-semibold flex items-center gap-1.5"
                      onClick={() => handleResume(cart.id)}
                    >
                      <Play className="h-4 w-4 fill-current stroke-none" />
                      {t("Resume", "ဆက်လုပ်ရန်")}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
