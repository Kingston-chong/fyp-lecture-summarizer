import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import {
  APP_THEME_COOKIE,
  APP_THEME_INIT_SCRIPT,
  normalizeAppTheme,
} from "@/lib/appTheme";
import { APP_FONTS_URL } from "@/lib/appFonts";
import "./globals.css";
import "./components/modal-shared.css";
import "./components/misc-inline.css";
import Providers from "./providers";
import Analytics from "./components/Analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slide2Notes",
  description: "Slide2Notes is a tool that helps you take notes from slides",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = normalizeAppTheme(cookieStore.get(APP_THEME_COOKIE)?.value);

  return (
    <html lang="en" suppressHydrationWarning data-theme={theme}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link href={APP_FONTS_URL} rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
