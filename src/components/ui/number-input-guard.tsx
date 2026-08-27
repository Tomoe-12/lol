"use client"

import * as React from "react"

export function NumberInputGuard() {
  React.useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.type === "number") {
        event.preventDefault()
        target.blur()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.type === "number" && ["e", "E", "+", "-"].includes(event.key)) {
        event.preventDefault()
      }
    }

    document.addEventListener("wheel", handleWheel, { passive: false })
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("wheel", handleWheel)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return null
}
