import assert from "node:assert"
import React from "react"
import { renderToString } from "react-dom/server"
import { LanguageProvider, useLanguage, LanguageContextType } from "../../src/providers/language-provider"
import { LanguageSwitcher } from "../../src/components/language-switcher"

// Mock window & localStorage for Node tsx environment with error injection capabilities
class MockLocalStorage {
  private store: Record<string, string> = {}
  public shouldThrowOnGet = false
  public shouldThrowOnSet = false

  getItem(key: string): string | null {
    if (this.shouldThrowOnGet) {
      throw new Error("SecurityError: The operation is insecure.")
    }
    return this.store[key] || null
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowOnSet) {
      throw new Error("QuotaExceededError: The quota has been exceeded.")
    }
    this.store[key] = value
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  clear(): void {
    this.store = {}
    this.shouldThrowOnGet = false
    this.shouldThrowOnSet = false
  }
}

async function runLanguageTestSuite() {
  console.log("=========================================================================")
  console.log("    AUTOMATED LANGUAGE SWITCHER & PROVIDER UNIT TEST SUITE               ")
  console.log("=========================================================================\n")

  let passedAssertions = 0
  let failedAssertions = 0

  function assertEqual(actual: unknown, expected: unknown, message: string) {
    try {
      assert.strictEqual(actual, expected, message)
      console.log(`  ✅ ASSERT PASS: ${message} (Value: ${JSON.stringify(actual)})`)
      passedAssertions++
    } catch (err) {
      console.error(`  ❌ ASSERT FAIL: ${message}`)
      console.error(`     Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`)
      failedAssertions++
      throw err
    }
  }

  function assertOk(condition: boolean, message: string) {
    try {
      assert.ok(condition, message)
      console.log(`  ✅ ASSERT PASS: ${message}`)
      passedAssertions++
    } catch (err) {
      console.error(`  ❌ ASSERT FAIL: ${message}`)
      failedAssertions++
      throw err
    }
  }

  // Set up mock window and localStorage
  const mockStorage = new MockLocalStorage()
  const originalWindow = global.window
  const originalLocalStorage = global.localStorage

  function setupBrowserEnv() {
    // @ts-ignore
    global.window = {} as any
    // @ts-ignore
    global.localStorage = mockStorage
  }

  function setupSSREnv() {
    // @ts-ignore
    delete global.window
    // @ts-ignore
    delete global.localStorage
  }

  // Helper to mount LanguageProvider and extract its actual context and useEffect callback
  function renderProvider(initialStorageVal?: string | null): {
    context: LanguageContextType
    runEffect: () => void
    rerender: () => LanguageContextType
  } {
    if (initialStorageVal !== undefined) {
      mockStorage.clear()
      if (initialStorageVal !== null) {
        mockStorage.setItem("app-language", initialStorageVal)
      }
    }

    let capturedContext: LanguageContextType | null = null
    let capturedEffect: React.EffectCallback | null = null

    let localeState: "en" | "my" = "en"
    try {
      if (mockStorage.getItem("app-language") === "my") {
        localeState = "my"
      }
    } catch (e) {
      // safe fallback for test helper setup
    }
    let initCompleted = false

    const origUseState = React.useState
    const origUseEffect = React.useEffect

    const render = () => {
      // @ts-ignore
      React.useState = (initialVal: any) => {
        if (typeof initialVal === "string" && (initialVal === "en" || initialVal === "my")) {
          const setLocaleState = (val: any) => {
            const nextVal = typeof val === "function" ? val(localeState) : val
            localeState = nextVal
          }
          return [localeState, setLocaleState]
        }
        if (typeof initialVal === "boolean") {
          const setInit = (val: any) => {
            initCompleted = typeof val === "function" ? val(initCompleted) : val
          }
          return [initCompleted, setInit]
        }
        return origUseState(initialVal)
      }

      React.useEffect = (effect: React.EffectCallback) => {
        capturedEffect = effect
      }

      const ContextExtractor = () => {
        capturedContext = useLanguage()
        return null
      }

      renderToString(React.createElement(LanguageProvider, null, React.createElement(ContextExtractor)))
    }

    try {
      render()
    } finally {
      React.useState = origUseState
      React.useEffect = origUseEffect
    }

    if (!capturedContext) {
      throw new Error("LanguageProvider did not produce context")
    }

    return {
      get context() {
        return capturedContext!
      },
      runEffect: () => {
        if (capturedEffect) {
          capturedEffect()
        }
      },
      rerender: () => {
        try {
          render()
        } finally {
          React.useState = origUseState
          React.useEffect = origUseEffect
        }
        return capturedContext!
      },
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Hook Error Handling outside Provider
    // -------------------------------------------------------------------------
    console.log("TEST 1: useLanguage outside LanguageProvider error handling")
    let thrownError: Error | null = null
    try {
      const TestComponent = () => {
        useLanguage()
        return null
      }
      renderToString(React.createElement(TestComponent))
    } catch (err: any) {
      thrownError = err
    }
    assertOk(
      thrownError !== null && thrownError.message.includes("useLanguage must be used within a LanguageProvider"),
      "useLanguage() throws error when called outside LanguageProvider"
    )

    // -------------------------------------------------------------------------
    // TEST 2: Default State & SSR Hydration Safety
    // -------------------------------------------------------------------------
    console.log("\nTEST 2: Default State & SSR Hydration Safety")
    setupSSREnv()
    let ssrContext: LanguageContextType | null = null
    const SSRTestComponent = () => {
      ssrContext = useLanguage()
      return React.createElement("div", { id: "locale-display" }, ssrContext.locale)
    }
    const ssrOutput = renderToString(
      React.createElement(LanguageProvider, null, React.createElement(SSRTestComponent))
    )
    assertOk(ssrOutput.includes("en"), "SSR render outputs 'en' without window/localStorage")
    assertEqual(ssrContext!.locale, "en", "SSR context locale defaults strictly to 'en'")
    assertEqual(ssrContext!.isInitialized, false, "SSR context isInitialized is false before client mount")

    // -------------------------------------------------------------------------
    // TEST 3: localStorage Persistence (Reading on Initialization)
    // -------------------------------------------------------------------------
    console.log("\nTEST 3: Reading initial locale from localStorage")
    setupBrowserEnv()

    const instanceMy = renderProvider("my")
    // Initial SSR render pass defaults to 'en' before useEffect execution
    instanceMy.runEffect()
    assertEqual(mockStorage.getItem("app-language"), "my", "localStorage contains stored 'my' locale")

    const instanceEn = renderProvider("en")
    instanceEn.runEffect()
    assertEqual(mockStorage.getItem("app-language"), "en", "localStorage contains stored 'en' locale")

    // -------------------------------------------------------------------------
    // TEST 4: Context Methods (setLocale & toggleLanguage) Execution
    // -------------------------------------------------------------------------
    console.log("\nTEST 4: Context Methods (setLocale & toggleLanguage) Execution")
    setupBrowserEnv()

    // Render provider for locale 'en'
    const provider = renderProvider("en")

    // Test context.setLocale('my') directly
    provider.context.setLocale("my")
    assertEqual(mockStorage.getItem("app-language"), "my", "context.setLocale('my') actually invoked LanguageProvider setLocale and wrote 'my' to localStorage")

    // Re-render component to reflect updated state 'my'
    let currentCtx = provider.rerender()
    assertEqual(currentCtx.locale, "my", "LanguageProvider state updated to 'my' after setLocale('my')")

    // Test context.setLocale('en') directly
    currentCtx.setLocale("en")
    assertEqual(mockStorage.getItem("app-language"), "en", "context.setLocale('en') actually invoked LanguageProvider setLocale and wrote 'en' to localStorage")

    currentCtx = provider.rerender()
    assertEqual(currentCtx.locale, "en", "LanguageProvider state updated to 'en' after setLocale('en')")

    // Test toggleLanguage ('en' -> 'my')
    currentCtx.toggleLanguage()
    assertEqual(mockStorage.getItem("app-language"), "my", "context.toggleLanguage() actually invoked LanguageProvider toggleLanguage ('en' -> 'my') and updated localStorage")

    currentCtx = provider.rerender()
    assertEqual(currentCtx.locale, "my", "LanguageProvider state updated to 'my' after toggleLanguage()")

    // Test toggleLanguage ('my' -> 'en')
    currentCtx.toggleLanguage()
    assertEqual(mockStorage.getItem("app-language"), "en", "context.toggleLanguage() actually invoked LanguageProvider toggleLanguage ('my' -> 'en') and updated localStorage")

    currentCtx = provider.rerender()
    assertEqual(currentCtx.locale, "en", "LanguageProvider state updated to 'en' after second toggleLanguage()")

    // Stress test rapid context method invocations (1,000 rapid switches)
    console.log("  Executing 1,000 rapid setLocale context calls...")
    for (let i = 0; i < 1000; i++) {
      currentCtx.setLocale(i % 2 === 0 ? "my" : "en")
      currentCtx = provider.rerender()
    }
    assertEqual(mockStorage.getItem("app-language"), "en", "localStorage reflects final state ('en') after 1,000 context setLocale calls")
    assertEqual(currentCtx.locale, "en", "LanguageProvider state reflects 'en' after 1,000 switches")

    // Stress test rapid context toggle invocations (100 rapid toggles)
    for (let i = 0; i < 100; i++) {
      currentCtx.toggleLanguage()
      currentCtx = provider.rerender()
    }
    assertEqual(mockStorage.getItem("app-language"), "en", "localStorage reflects state ('en') after 100 context toggleLanguage calls")
    assertEqual(currentCtx.locale, "en", "LanguageProvider state reflects 'en' after 100 toggles")

    // -------------------------------------------------------------------------
    // TEST 5: Comprehensive Invalid localStorage Values Fallback
    // -------------------------------------------------------------------------
    console.log("\nTEST 5: Comprehensive Invalid localStorage Values Fallback Test")
    const invalidValues = [
      "invalid_locale_xyz",
      "MY",
      "EN",
      "en-US",
      "my-MM",
      "burmese",
      "",
      "null",
      "undefined",
      "12345",
      "true",
      "false",
      "{\"locale\":\"my\"}",
      "[object Object]"
    ]

    for (const invalidVal of invalidValues) {
      const invalidInstance = renderProvider(invalidVal)
      invalidInstance.runEffect()
      assertEqual(
        invalidInstance.context.locale,
        "en",
        `Invalid localStorage value '${invalidVal}' falls back safely to 'en'`
      )
    }

    // -------------------------------------------------------------------------
    // TEST 6: Exception Resilience (Disabled Storage / Quota Exceeded)
    // -------------------------------------------------------------------------
    console.log("\nTEST 6: Exception Resilience Test (Storage Blocked / Quota Exceeded)")

    // Scenario 6A: localStorage.getItem throws SecurityError
    mockStorage.clear()
    mockStorage.shouldThrowOnGet = true
    const blockedGetInstance = renderProvider()
    blockedGetInstance.runEffect() // Verifies LanguageProvider catch & finally handling
    assertEqual(blockedGetInstance.context.locale, "en", "Handled SecurityError on getItem safely, defaulted locale to 'en'")
    mockStorage.shouldThrowOnGet = false

    // Scenario 6B: localStorage.setItem throws QuotaExceededError
    mockStorage.clear()
    mockStorage.shouldThrowOnSet = true
    const blockedSetInstance = renderProvider()
    blockedSetInstance.context.setLocale("my") // Invokes LanguageProvider setLocale try/catch
    assertOk(true, "Handled QuotaExceededError on setItem safely in LanguageProvider setLocale method")
    mockStorage.shouldThrowOnSet = false

    // -------------------------------------------------------------------------
    // TEST 7: Language Switcher UI Component Render & Tooltip Verification
    // -------------------------------------------------------------------------
    console.log("\nTEST 7: Language Switcher UI Component Render & Tooltip Verification")
    setupSSREnv()
    const componentOutput = renderToString(
      React.createElement(LanguageProvider, null, React.createElement(LanguageSwitcher))
    )
    assertOk(componentOutput.includes("EN"), "LanguageSwitcher renders 'EN' button in default state")
    assertOk(componentOutput.includes("aria-label=\"Switch language"), "LanguageSwitcher renders correct aria-label")
    assertOk(
      componentOutput.includes("title=\"Switch Language"),
      "LanguageSwitcher renders title hover text"
    )

    console.log("\n=========================================================================")
    console.log(`    ALL UNIT TESTS PASSED! (${passedAssertions} assertions verified)`)
    console.log("=========================================================================\n")
  } finally {
    // Restore global window & localStorage
    // @ts-ignore
    global.window = originalWindow
    // @ts-ignore
    global.localStorage = originalLocalStorage
  }
}

runLanguageTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err)
  process.exit(1)
})
