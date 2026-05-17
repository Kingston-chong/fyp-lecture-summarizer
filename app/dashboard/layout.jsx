import { Suspense } from "react";
import AppShell from "../components/AppShell";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap";

export default async function DashboardLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link href={FONTS_URL} rel="stylesheet" />
      <AppShell showBackToDashboard={false} showSidebar sidebarMobileOnly>
        <Suspense fallback={null}>{children}</Suspense>
      </AppShell>
    </>
  );
}
