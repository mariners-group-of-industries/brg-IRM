import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
export default async function DashboardAlias() {
  if (!await getPortalSession()) redirect("/portal/login");
  redirect("/portal");
}
