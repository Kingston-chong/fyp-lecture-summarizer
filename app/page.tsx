import { redirect } from "next/navigation";

/** ChatGPT-style: land on the app workspace, not a marketing page. */
export default function HomePage() {
  redirect("/dashboard");
}
