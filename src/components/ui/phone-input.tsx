"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11)
}

export function isValidMyanmarPhone(value: string): boolean {
  return /^09\d{9}$/.test(value)
}

export const PhoneInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  function PhoneInput({ onChange, onWheel, type: _type, ...props }, ref) {
    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={11}
        minLength={11}
        pattern="09[0-9]{9}"
        onChange={(event) => {
          const sanitized = sanitizePhoneInput(event.currentTarget.value)
          if (event.currentTarget.value !== sanitized) {
            event.currentTarget.value = sanitized
          }
          onChange?.(event)
        }}
        onWheel={(event) => {
          event.preventDefault()
          event.currentTarget.blur()
          onWheel?.(event)
        }}
      />
    )
  },
)
