import AppShell from "@/layouts/AppShell";

export default function SummaryLayout({ children }) {
  return (
    <AppShell showBackToDashboard showSidebar hidePrevUploads>
      {children}
    </AppShell>
  );
}

