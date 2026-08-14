"use client"

import * as React from "react"
import { useLanguage } from "@/providers/language-provider"

export function LanguageSwitcher() {
  const { language, toggleLanguage, isMounted } = useLanguage()

  // Default to 'en' before hydration on client to prevent layout shift
  const currentLang = isMounted ? language : "en"

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 select-none cursor-pointer"
      aria-label={`Switch language. Current: ${currentLang === "en" ? "English" : "Myanmar"}`}
      title="Switch Language / ဘာသာစကား ပြောင်းရန်"
    >
      <span
        className={`rounded-full px-2.5 py-1 transition-all duration-200 font-semibold leading-none ${
          currentLang === "en"
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        }`}
      >
        EN
      </span>
      <span
        className={`rounded-full px-2.5 py-1 transition-all duration-200 font-semibold leading-none ${
          currentLang === "my"
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        }`}
      >
        မြန်မာ
      </span>
    </button>
  )
}

