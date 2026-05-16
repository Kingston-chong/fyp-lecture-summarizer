import AppShell from "../components/AppShell";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap";

/** Summary routes: load dashboard fonts early (same URL as dashboard page.jsx). */
export default function SummaryLayout({ children }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link href={FONTS_URL} rel="stylesheet" />
      <AppShell showBackToDashboard showSidebar hidePrevUploads>
        {children}
      </AppShell>
    </>
  );
}
