"use client";
import { SessionProvider } from "next-auth/react";
import ThemeProvider from "./components/ThemeProvider";
import ErrorBoundary from "./components/ErrorBoundary";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </ThemeProvider>
    </SessionProvider>
  );
}
