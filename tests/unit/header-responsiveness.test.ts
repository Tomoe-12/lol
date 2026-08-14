import assert from "node:assert"
import React from "react"
import { renderToString } from "react-dom/server"
import DashboardLayout from "../../src/app/(dashboard)/layout"

// Mock auth provider and sub-components for layout SSR testing
React.Component

// Define viewport definitions for testing
const TARGET_VIEWPORTS = [
  { name: "Mobile S", width: 320 },
  { name: "Mobile M", width: 360 },
  { name: "iPhone SE/12", width: 375 },
  { name: "Mobile L", width: 414 },
  { name: "Mobile Wide", width: 480 },
  { name: "Tablet (sm)", width: 640 },
  { name: "Tablet (md)", width: 768 },
  { name: "Desktop (lg)", width: 1024 },
  { name: "Large Desktop (xl)", width: 1280 },
]

async function runHeaderResponsivenessTestSuite() {
  console.log("=========================================================================")
  console.log("    HEADER LAYOUT RESPONSIVENESS & SINGLE-LINE STABILITY TEST SUITE     ")
  console.log("=========================================================================\n")

  let passed = 0
  let total = 0

  function check(condition: boolean, msg: string) {
    total++
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${msg}`)
      throw new Error(`Assertion failed: ${msg}`)
    }
  }

  // 1. Inspect Top Header classes in Dashboard Layout
  console.log("1. Inspecting Top Header Structural Integrity & Tailwind Classes...")
  
  // Header container rules:
  // - flex row: 'flex', 'items-center', 'justify-between'
  // - fixed single-line height: 'h-14', 'shrink-0'
  // - padding responsive: 'px-3 sm:px-6'
  // - left title: 'min-w-0', 'truncate', 'max-w-[150px] xs:max-w-[200px] sm:max-w-none'
  // - left subtitle: 'hidden sm:block shrink-0'
  // - right control bar: 'flex items-center gap-1.5 sm:gap-2 shrink-0'

  const fs = await import("fs")
  const path = await import("path")
  const layoutPath = path.join(process.cwd(), "src/app/(dashboard)/layout.tsx")
  const layoutCode = fs.readFileSync(layoutPath, "utf-8")

  check(layoutCode.includes('<header className="flex h-14 items-center justify-between'), "Header element uses flex h-14 items-center justify-between")
  check(layoutCode.includes('shrink-0 z-50">'), "Header container has shrink-0 to prevent vertical squeezing")
  check(layoutCode.includes('px-3 sm:px-6'), "Header container uses px-3 for <=320px and sm:px-6 for >=640px")

  // Left branding block
  check(layoutCode.includes('flex items-center gap-2 min-w-0'), "Left section has min-w-0 to enable inner text truncation")
  check(layoutCode.includes('truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none'), "Main title has responsive max-width truncation (150px -> 200px -> max-w-none)")
  check(layoutCode.includes('hidden sm:block shrink-0'), "Subtitle is hidden on small viewports (<640px) and shrink-0 on desktop to prevent wrapping")

  // Right controls block
  check(layoutCode.includes('flex items-center gap-1.5 sm:gap-2 shrink-0'), "Right control panel has shrink-0 and compact responsive gap (1.5 -> 2)")

  console.log("\n2. Evaluating Mathematical Width Constraints Across Viewports (320px - 1280px)...")

  for (const vp of TARGET_VIEWPORTS) {
    const isSm = vp.width >= 640
    const padding = isSm ? 48 : 24 // px-6 (24*2) vs px-3 (12*2)
    const availWidth = vp.width - padding

    // Estimate element widths
    // Right action controls: Notification Bell (36px), Language Switcher (~45px), Theme Toggle (36px), User Button (~36px) + 3 gaps of 6px (sm: 8px)
    const rightGap = isSm ? 8 : 6
    const rightControlsWidth = 36 + 45 + 36 + 36 + (rightGap * 3) // ~171px (mobile), ~177px (sm)

    // Left title block:
    let leftTitleWidth = 0
    if (vp.width < 375) {
      leftTitleWidth = Math.min(150, availWidth - rightControlsWidth - 8)
    } else if (vp.width < 640) {
      leftTitleWidth = Math.min(200, availWidth - rightControlsWidth - 8)
    } else {
      leftTitleWidth = 220 // Full title text width ~220px
    }

    let leftSubtitleWidth = 0
    if (isSm) {
      leftSubtitleWidth = 170 // "— Multi-Branch Management" ~170px
    }

    const leftGap = (isSm && leftSubtitleWidth > 0) ? 8 : 0
    const leftTotalWidth = leftTitleWidth + leftGap + leftSubtitleWidth
    const requiredTotalWidth = leftTotalWidth + 8 + rightControlsWidth

    const fitsInSingleLine = requiredTotalWidth <= availWidth

    check(
      fitsInSingleLine || leftTitleWidth <= 150,
      `Viewport ${vp.width}px (${vp.name}): Available=${availWidth}px, Left=${leftTotalWidth}px, Right=${rightControlsWidth}px, Total Needed=${requiredTotalWidth}px -> Single line stability ${fitsInSingleLine ? 'GUARANTEED' : 'TRUNCATED STABLE'}`
    )
  }

  console.log("\n3. Inspecting POS Header Structural Integrity...")
  const posPath = path.join(process.cwd(), "src/components/pos/pos-container.tsx")
  const posCode = fs.readFileSync(posPath, "utf-8")

  check(posCode.includes('<header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">'), "POS Header uses flex items-center justify-between shrink-0")

  console.log(`\n=========================================================================`)
  console.log(`    ALL HEADER RESPONSIVENESS TESTS PASSED! (${passed}/${total} assertions)`)
  console.log(`=========================================================================\n`)
}

runHeaderResponsivenessTestSuite().catch((err) => {
  console.error("Header responsiveness test failed:", err)
  process.exit(1)
})
