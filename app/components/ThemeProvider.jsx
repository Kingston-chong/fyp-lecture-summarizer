"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  normalizeAppTheme,
  persistAppTheme,
  readAppThemeFromStorage,
} from "@/lib/appTheme";

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

function readThemeFromDom() {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  return normalizeAppTheme(t);
}

function resolveClientTheme() {
  return normalizeAppTheme(readAppThemeFromStorage() ?? readThemeFromDom());
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveClientTheme);

  useLayoutEffect(() => {
    const resolved = resolveClientTheme();
    persistAppTheme(resolved);
    setThemeState((prev) => (prev === resolved ? prev : resolved));
  }, []);

  const setTheme = useCallback((next) => {
    const resolved = persistAppTheme(next);
    setThemeState(resolved);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
