import AppShell from "../components/AppShell";

export default function SummaryLayout({ children }) {
  return (
    <AppShell showBackToDashboard showSidebar hidePrevUploads>
      {children}
    </AppShell>
  );
}

