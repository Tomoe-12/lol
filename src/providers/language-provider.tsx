"use client"

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react"

export type Language = "en" | "my"
export type Locale = Language

export interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  isMounted: boolean
  t: (en: string, my: string) => string
  // Compatibility aliases
  locale?: Language
  setLocale?: (lang: Language) => void
  isInitialized?: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const savedLanguage = localStorage.getItem("app-language") as Language | null
        if (savedLanguage === "en" || savedLanguage === "my") {
          setLanguageState(savedLanguage)
        }
      }
    } catch (e) {
      console.error("Failed to read language preference from localStorage", e)
    } finally {
      setIsMounted(true)
    }
  }, [])

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang)
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("app-language", newLang)
      }
    } catch (e) {
      console.error("Failed to save language preference to localStorage", e)
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === "en" ? "my" : "en"
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("app-language", next)
        }
      } catch (e) {
        console.error("Failed to save language preference to localStorage", e)
      }
      return next
    })
  }, [])

  const t = useCallback(
    (en: string, my: string) => {
      return language === "my" ? my : en
    },
    [language]
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      isMounted,
      t,
      locale: language,
      setLocale: setLanguage,
      isInitialized: isMounted,
    }),
    [language, setLanguage, toggleLanguage, isMounted, t]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

