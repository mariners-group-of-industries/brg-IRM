import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getSession } from "@/lib/session";

export default async function RootPage() {
  const portalUser = await getPortalSession();
  if (portalUser) {
    redirect("/portal");
  }
  const staffUser = await getSession();
  if (staffUser) {
    redirect("/dashboard");
  }
  redirect("/portal/login");
}
