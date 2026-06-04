import { redirect } from "next/navigation";

/** Legacy URL — guest try lives on the dashboard. */
export default function TryPage() {
  redirect("/dashboard");
}
