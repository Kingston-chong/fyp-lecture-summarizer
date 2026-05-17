import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const themeInitScript = `(function(){try{var s=localStorage.getItem('slide2notes-theme');if(s==='light'||s==='dark'){document.documentElement.setAttribute('data-theme',s);}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
