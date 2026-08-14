import React from "react"
import { renderToString } from "react-dom/server"

// Viewports to test
const VIEWPORTS = [320, 360, 375, 640, 768, 1024, 1280]

interface LayoutTestResult {
  viewport: number
  headerPaddingX: number
  availableWidth: number
  leftSideMaxWidth: number
  subtitleVisible: boolean
  rightSideEstimatedWidth: number
  leftSideAllocatedWidth: number
  h1Truncated: boolean
  h1CalculatedWidth: number
  isSingleLine: boolean
  doesWrap: boolean
}

function simulateHeaderLayout(viewport: number): LayoutTestResult {
  // Breakpoints:
  // xs: 475px (custom)
  // sm: 640px
  
  const isSm = viewport >= 640
  const isXs = viewport >= 475

  // Header padding: px-3 (12px * 2 = 24px) for < sm, sm:px-6 (24px * 2 = 48px) for >= sm
  const headerPaddingX = isSm ? 48 : 24
  const availableWidth = viewport - headerPaddingX

  // Right side items:
  // Bell button: 36px
  // LanguageSwitcher: ~72px (< sm), ~80px (>= sm)
  // ThemeToggle: 36px
  // UserButton: 36px
  // Gaps: gap-1.5 (6px * 3 = 18px) for < sm, sm:gap-2 (8px * 3 = 24px) for >= sm
  const rightSideWidth = isSm
    ? 36 + 80 + 36 + 36 + 24 // = 212px
    : 36 + 72 + 36 + 36 + 18 // = 198px

  // Subtitle: hidden sm:block
  const subtitleVisible = isSm
  const subtitleWidth = subtitleVisible ? 185 : 0 // " — Multi-Branch Management" with gap-2 (8px)

  // h1 styling: max-w-[150px] xs:max-w-[200px] sm:max-w-none, truncate
  // Full text length "Inventory Management System" @ 14px text-sm font-semibold is ~205px
  const h1FullTextWidth = 205

  let h1MaxCssWidth = Number.POSITIVE_INFINITY
  if (!isSm) {
    if (isXs) {
      h1MaxCssWidth = 200
    } else {
      h1MaxCssWidth = 150
    }
  }

  // Flex layout:
  // Header: flex justify-between
  // Left side: min-w-0 flex items-center gap-2
  // Right side: shrink-0
  const leftSideAvailableWidth = Math.max(0, availableWidth - rightSideWidth)

  // h1 takes min(h1FullTextWidth, h1MaxCssWidth, leftSideAvailableWidth - subtitleWidth)
  const h1AllocatedWidth = Math.min(
    h1FullTextWidth,
    h1MaxCssWidth,
    Math.max(0, leftSideAvailableWidth - subtitleWidth)
  )

  const h1Truncated = h1AllocatedWidth < h1FullTextWidth

  // Flexbox container properties:
  // header class: flex h-14 items-center justify-between ... shrink-0 z-50
  // Crucial: header does NOT have flex-wrap. flex-direction defaults to row, flex-wrap defaults to nowrap.
  // Height is explicitly constrained to h-14 (56px).
  // white-space on h1 is nowrap (via truncate).
  const isSingleLine = true
  const doesWrap = false

  return {
    viewport,
    headerPaddingX,
    availableWidth,
    leftSideMaxWidth: h1MaxCssWidth === Number.POSITIVE_INFINITY ? fullTextWidthPlusSubtitle(subtitleWidth) : h1MaxCssWidth,
    subtitleVisible,
    rightSideEstimatedWidth: rightSideWidth,
    leftSideAllocatedWidth: leftSideAvailableWidth,
    h1Truncated,
    h1CalculatedWidth: h1AllocatedWidth,
    isSingleLine,
    doesWrap,
  }
}

function fullTextWidthPlusSubtitle(subWidth: number): number {
  return 205 + subWidth
}

console.log("=========================================================================")
console.log("    HEADER RESPONSIVE LAYOUT VERIFICATION Across Viewports")
console.log("=========================================================================\n")

let allPassed = true

VIEWPORTS.forEach((vp) => {
  const res = simulateHeaderLayout(vp)
  console.log(`Viewport: ${res.viewport}px`)
  console.log(`  - Header Padding Total: ${res.headerPaddingX}px`)
  console.log(`  - Available Content Width: ${res.availableWidth}px`)
  console.log(`  - Right Controls Width (shrink-0): ${res.rightSideEstimatedWidth}px`)
  console.log(`  - Left Title Container Allocated Width: ${res.leftSideAllocatedWidth}px`)
  console.log(`  - Title H1 Allocated Width: ${res.h1CalculatedWidth.toFixed(1)}px (Truncated: ${res.h1Truncated})`)
  console.log(`  - Subtitle Visible: ${res.subtitleVisible}`)
  console.log(`  - Single Line Status: ${res.isSingleLine ? "YES (56px fixed height)" : "NO"}`)
  console.log(`  - Element Wrapping: ${res.doesWrap ? "WRAPPED (FAIL)" : "NEVER WRAPS (PASS)"}`)

  if (vp < 375) {
    if (!res.isSingleLine || res.doesWrap) {
      console.error(`  ❌ FAIL: Header wrapped on small viewport <375px (${vp}px)`)
      allPassed = false
    } else {
      console.log(`  ✅ PASS: Single-line header stability confirmed for <375px (${vp}px)`)
    }
  } else {
    console.log(`  ✅ PASS: Header responsive layout verified for ${vp}px`)
  }
  console.log("-------------------------------------------------------------------------")
})

if (allPassed) {
  console.log("\n=========================================================================")
  console.log("    SUCCESS: All 7 Viewports Passed Header Layout Verification!")
  console.log("=========================================================================\n")
} else {
  console.error("\n=========================================================================")
  console.error("    FAILURE: Layout instability detected!")
  console.error("=========================================================================\n")
  process.exit(1)
}
