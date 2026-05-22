import { Suspense } from "react";
import AppShell from "@/app/components/AppShell";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";

export const metadata = {
  title: "Account settings – Slide2Notes",
};

export default async function AccountSettingsLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }
  return (
    <AppShell showBackToDashboard>
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}