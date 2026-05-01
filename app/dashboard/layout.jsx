import AppShell from "../components/AppShell";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DashboardLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }
  return (
    <AppShell showBackToDashboard={false} showSidebar sidebarMobileOnly>
      {children}
    </AppShell>
  );
}

