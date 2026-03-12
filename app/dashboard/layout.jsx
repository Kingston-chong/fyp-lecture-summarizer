import AppShell from "../components/AppShell";

export default function DashboardLayout({ children }) {
  return <AppShell showBackToDashboard={false}>{children}</AppShell>;
}

