"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/providers/language-provider"
import { Delete } from "lucide-react"

interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
  branchName: string;
}

interface PinSwitchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staff: StaffSession) => void;
  locked?: boolean; // When true, dialog cannot be dismissed without a valid PIN
}

export function PinSwitchDialog({ isOpen, onClose, onSuccess, locked = false }: PinSwitchDialogProps) {
  const { t } = useLanguage()
  const [pin, setPin] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)

  // Reset state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setPin("")
      setError(null)
      setLoading(false)
    }
  }, [isOpen])

  const verifyPin = React.useCallback(async (enteredPin: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/pos/auth-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed")
      }

      onSuccess(data.staff)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authenticate PIN")
      setPin("") // Reset PIN on error so they must re-enter
    } finally {
      setLoading(false)
    }
  }, [onSuccess, onClose])

  const handleKeyPress = React.useCallback((num: string) => {
    if (pin.length < 4 && !loading) {
      setError(null)
      const newPin = pin + num
      setPin(newPin)
      if (newPin.length === 4) {
        void verifyPin(newPin)
      }
    }
  }, [pin, loading, verifyPin])

  const handleBackspace = React.useCallback(() => {
    if (pin.length > 0 && !loading) {
      setError(null)
      setPin(pin.slice(0, -1))
    }
  }, [pin, loading])

  const handleClear = React.useCallback(() => {
    if (!loading) {
      setError(null)
      setPin("")
    }
  }, [loading])

  // Listen to keyboard number inputs when dialog is open
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in some input or loading
      if (loading) return

      // Map key to digit
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleKeyPress(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault()
        handleClear()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, loading, handleKeyPress, handleBackspace, handleClear])

  // When locked, clicking outside or pressing Escape does nothing
  const handleOpenChange = (open: boolean) => {
    if (!open && locked) return // block closing
    if (!open) onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`max-w-xs bg-card border-border p-6 rounded-2xl ${locked ? "[&>button]:hidden" : ""}`}
        onInteractOutside={(e) => { if (locked) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (locked) e.preventDefault() }}
      >
        <DialogHeader className="space-y-1 items-center">
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("Cashier PIN", "ပင်နံပါတ်ထည့်ပါ")}
          </DialogTitle>
          <span className="text-xs text-muted-foreground">
            {t("Enter 4-digit code for cashier switch", "ငွေကိုင် လဲလှယ်ရန် ဂဏန်း ၄ လုံး ထည့်ပါ")}
          </span>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 my-4">
          {/* Display Dots */}
          <div className="flex space-x-4 h-10 items-center justify-center">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                  pin.length > index
                    ? "bg-primary border-primary scale-110"
                    : "border-muted-foreground/35 bg-transparent"
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-xs text-destructive text-center font-semibold bg-destructive/10 px-3 py-1.5 rounded-md w-full animate-bounce">
              {error}
            </div>
          )}

          {/* PIN Pad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <Button
                key={num}
                variant="outline"
                className="h-14 text-lg font-bold hover:bg-muted text-foreground border-border rounded-xl"
                onClick={() => handleKeyPress(num)}
                disabled={loading}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-14 text-sm font-semibold hover:bg-muted text-muted-foreground rounded-xl"
              onClick={handleClear}
              disabled={loading}
            >
              {t("Clear", "ရှင်းမည်")}
            </Button>
            <Button
              variant="outline"
              className="h-14 text-lg font-bold hover:bg-muted text-foreground border-border rounded-xl"
              onClick={() => handleKeyPress("0")}
              disabled={loading}
            >
              0
            </Button>
            <Button
              variant="ghost"
              className="h-14 text-destructive hover:bg-destructive/10 rounded-xl"
              onClick={handleBackspace}
              disabled={loading}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
