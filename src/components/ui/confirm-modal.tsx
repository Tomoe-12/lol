"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "primary"
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm / အတည်ပြုမည်",
  cancelText = "Cancel / မလုပ်တော့ပါ",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md border-border bg-card"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader className="flex flex-col items-center sm:items-start gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-destructive/10 text-destructive"
                : variant === "warning"
                ? "bg-amber-500/10 text-amber-500"
                : "bg-primary/10 text-primary"
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "destructive" : "default"}
            onClick={() => {
              onConfirm()
            }}
            disabled={loading}
            className="rounded-xl font-semibold"
          >
            {loading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
