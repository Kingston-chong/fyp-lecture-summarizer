import { Suspense } from "react";
import AppShell from "../components/AppShell";

export default function DashboardLayout({ children }) {
  return (
    <AppShell showBackToDashboard={false} showSidebar sidebarMobileOnly>
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
