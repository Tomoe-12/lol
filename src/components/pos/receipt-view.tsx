"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, ShoppingBag } from "lucide-react"
import { useLanguage } from "@/providers/language-provider"

export interface ReceiptTransaction {
  id: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  currency?: string;
  exchangeRate?: number;
  totalInMMK?: number;
  paymentMethod: string;
  cashReceived: number | null;
  changeGiven: number | null;
  status: string;
  note: string | null;
  receiptEmail: string | null;
  createdAt: string | Date;
  branch: {
    id: string;
    name: string;
    address: string | null;
    receiptHeader: string | null;
  };
  staff: {
    id: string;
    name: string;
  };
  items: {
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    note: string | null;
    product: {
      id: string;
      name: string;
    };
    variant?: {
      id: string;
      name: string;
      barcode?: string | null;
    } | null;
  }[];
}

interface ReceiptViewProps {
  transaction: ReceiptTransaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptView({ transaction, isOpen, onClose }: ReceiptViewProps) {
  const { t } = useLanguage()

  React.useEffect(() => {
    if (isOpen && transaction) {
      // Auto-trigger window print for receipt printer testing if desired
      // For now, we let the user click the button to trigger it manually.
    }
  }, [isOpen, transaction])

  if (!transaction) return null

  const handlePrint = () => {
    window.print()
  }

  // Calculate totals
  const totalMMK = transaction.total
  const dateString = new Date(transaction.createdAt).toLocaleString()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-card border-border flex flex-col max-h-[90vh] overflow-hidden p-6 rounded-2xl select-none print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Print wrapper to target with CSS print directives */}
        <div id="receipt-print-area" className="flex-1 overflow-y-auto pr-1 print:overflow-visible print:pr-0 print:text-black">
          {/* Receipt Content Layout */}
          <div className="flex flex-col items-center text-center space-y-2 border-b border-dashed border-border pb-4 print:border-black/50">
            <h1 className="text-lg font-black uppercase text-foreground print:text-black">INVENTORY MANAGEMENT SYSTEM</h1>
            <h2 className="text-sm font-bold text-foreground print:text-black">{transaction.branch.name}</h2>
            <p className="text-xs text-muted-foreground max-w-[200px] leading-tight print:text-black/80">
              {transaction.branch.address || "Yangon, Myanmar"}
            </p>
            <p className="text-[10px] text-muted-foreground whitespace-pre-line leading-snug pt-1 print:text-black/70">
              {transaction.branch.receiptHeader}
            </p>
          </div>

          {/* Receipt Info */}
          <div className="py-3 text-[11px] text-muted-foreground border-b border-dashed border-border space-y-1 print:border-black/50 print:text-black/80">
            <div className="flex justify-between">
              <span>{t("Receipt ID:", "ဘောက်ချာ အမှတ်:")}</span>
              <span className="font-mono text-foreground print:text-black">{transaction.id}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("Date:", "အချိန်:")}</span>
              <span className="text-foreground print:text-black">{dateString}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("Cashier:", "ငွေကိုင်:")}</span>
              <span className="text-foreground print:text-black">{transaction.staff.name}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("Payment:", "ချေမှု:")}</span>
              <span className="text-foreground print:text-black font-semibold">{transaction.paymentMethod}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-[11px] my-3 border-b border-dashed border-border print:border-black/50">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50 pb-1.5 print:text-black/70 print:border-black/30">
                <th className="font-bold py-1">{t("Item", "ပစ္စည်း")}</th>
                <th className="font-bold text-center py-1">{t("Qty", "အရေအတွက်")}</th>
                <th className="font-bold text-right py-1">{t("Total", "စုစုပေါင်း")}</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item: ReceiptTransaction["items"][number]) => {
                const name = item.product.name
                const optionName = item.variant ? `(${item.variant.name})` : ""
                return (
                  <tr key={item.id} className="text-foreground print:text-black align-top border-b border-border/20 last:border-none print:border-black/10">
                    <td className="py-2 pr-2">
                      <div className="font-bold leading-tight">{name}</div>
                      {optionName && (
                        <div className="text-[9px] text-muted-foreground leading-none mt-0.5 print:text-black/70">{optionName}</div>
                      )}
                    </td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2 font-bold">{item.total.toLocaleString()}Ks</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="text-right text-[11px] space-y-1.5 pb-4 border-b border-dashed border-border print:border-black/50 print:text-black">
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground print:text-black/80">{t("Subtotal:", "စုစုပေါင်း:")}</span>
              <span>{transaction.subtotal.toLocaleString()} Ks</span>
            </div>
            {transaction.discountAmount > 0 && (
              <div className="flex justify-between font-medium text-primary print:text-black">
                <span className="text-muted-foreground print:text-black/80">{t("Discount:", "လျှော့စျေး:")}</span>
                <span>-{transaction.discountAmount.toLocaleString()} Ks</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs text-foreground pt-1 border-t border-border/20 print:border-black/15 print:text-black">
              <span>{t("Grand Total:", "ကျသင့်ငွေ:")}</span>
              <span className="text-sm">{totalMMK.toLocaleString()} Ks</span>
            </div>
            {transaction.cashReceived !== null && (
              <div className="flex justify-between font-semibold pt-1 border-t border-border/20 print:border-black/15">
                <span className="text-muted-foreground print:text-black/80">{t("Cash Paid:", "ပေးငွေ:")}</span>
                <span>{transaction.cashReceived.toLocaleString()} Ks</span>
              </div>
            )}
            {transaction.changeGiven !== null && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted-foreground print:text-black/80">{t("Change:", "ပြန်အမ်းငွေ:")}</span>
                <span>{transaction.changeGiven.toLocaleString()} Ks</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center py-4 space-y-1 print:text-black">
            <p className="text-xs font-bold text-foreground print:text-black">{t("Thank you!", "ကျေးဇူးတင်ပါသည်!")}</p>
            <p className="text-[9px] text-muted-foreground print:text-black/70">{t("Please keep receipt for refund / exchange within 3 days.", "၃ ရက်အတွင်း ပစ္စည်းလဲလှယ်ရန် ဘောက်ချာသိမ်းထားပါ။")}</p>
          </div>
        </div>

        {/* Buttons (Hidden in print) */}
        <DialogFooter className="border-t border-border pt-4 flex-row gap-2 mt-auto print:hidden">
          <Button
            variant="outline"
            className="w-1/2 font-semibold flex items-center justify-center gap-1.5"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            <span>{t("Print Receipt", "ဘောက်ချာရိုက်ထုတ်မည်")}</span>
          </Button>
          <Button
            className="w-1/2 font-bold flex items-center justify-center gap-1.5"
            onClick={onClose}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{t("New Order", "အော်ဒါအသစ်")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
