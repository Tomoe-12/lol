"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { createPortal } from "react-dom"

export function SearchableSelect<T>({ 
  items, 
  value, 
  onChange, 
  placeholder,
  searchPlaceholder,
  renderItem,
  filterItem 
}: { 
  items: T[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder: string,
  searchPlaceholder: string,
  renderItem: (item: T) => React.ReactNode,
  filterItem: (item: T, search: string) => boolean 
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [coords, setCoords] = React.useState<{ top?: number, bottom?: number, left: number, width: number }>({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = React.useState(false)
  
  const ref = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])
  
  const updatePosition = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const shouldFlip = spaceBelow < 250 && spaceAbove > spaceBelow

    let top: number | undefined = shouldFlip ? undefined : rect.bottom
    let bottom: number | undefined = shouldFlip ? (window.innerHeight - rect.top) : undefined
    let left = rect.left

    // Find the nearest ancestor that establishes a containing block for fixed elements
    let current = ref.current?.parentElement
    let hasContainingBlock = false
    while (current) {
      const style = window.getComputedStyle(current)
      if (
        (style.transform && style.transform !== 'none') ||
        (style.translate && style.translate !== 'none') ||
        (style.filter && style.filter !== 'none') ||
        (style.backdropFilter && style.backdropFilter !== 'none') ||
        (style.willChange && (style.willChange.includes('transform') || style.willChange.includes('translate')))
      ) {
        hasContainingBlock = true
        const containerRect = current.getBoundingClientRect()
        if (shouldFlip) {
          bottom = containerRect.bottom - rect.top
          top = undefined
        } else {
          top = rect.bottom - containerRect.top
          bottom = undefined
        }
        left = rect.left - containerRect.left
        break
      }
      current = current.parentElement
    }
    
    setCoords({ top, bottom, left, width: rect.width })
  }

  const handleToggle = () => {
    if (!open) {
      updatePosition()
    }
    setSearch("")
    setOpen(!open)
  }

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        if (popupRef.current && popupRef.current.contains(event.target as Node)) return
        setOpen(false)
      }
    }

    function handleScroll(e: Event) {
      if (open) {
        if (popupRef.current && popupRef.current.contains(e.target as Node)) return
        updatePosition() // Reposition instead of closing! Much better UX.
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleScroll)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleScroll)
    }
  }, [open])

  // @ts-expect-error - generic id property
  const selectedItem = items.find(i => i.id === value)
  const filtered = items.filter(i => filterItem(i, search.toLowerCase()))

  const popup = open && mounted ? (
    <div 
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed z-[99999] rounded-md border bg-popover text-popover-foreground shadow-lg outline-none animate-in fade-in-80 pointer-events-auto flex flex-col ${coords.bottom !== undefined ? 'mb-1' : 'mt-1'}`}
      style={{
        top: coords.top,
        bottom: coords.bottom,
        left: coords.left,
        width: coords.width,
        maxHeight: '250px'
      }}
    >
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input 
          className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground" 
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="flex-1 overflow-y-auto p-1 bg-popover rounded-b-md">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No results found.</div>
        ) : (
          filtered.map(item => (
            <div 
              // @ts-expect-error - generic id property
              key={item.id}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // @ts-expect-error - generic id property
                onChange(value === item.id ? "" : item.id)
                setOpen(false)
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // @ts-expect-error - generic id property
                onChange(value === item.id ? "" : item.id)
                setOpen(false)
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // @ts-expect-error - generic id property
                onChange(value === item.id ? "" : item.id)
                setOpen(false)
              }}
            >
              <Check 
                // @ts-expect-error - generic id property
                className={`mr-2 h-4 w-4 shrink-0 ${value === item.id ? "opacity-100 text-primary" : "opacity-0"}`} 
              />
              <span className="truncate">{renderItem(item)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="relative w-full" ref={ref}>
      <div 
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={handleToggle}
      >
        <span className="truncate">{selectedItem ? renderItem(selectedItem) : placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </div>
      {popup && mounted && typeof window !== "undefined" && createPortal(
        popup, 
        (ref.current?.closest('[role="dialog"]') as HTMLElement) || document.body
      )}
    </div>
  )
}
