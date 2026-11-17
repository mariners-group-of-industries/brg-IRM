import type { Metadata } from "next";
import { PortalLoginForm } from "./login-form";
import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextTarget = next && next.startsWith("/portal/") && !next.startsWith("/portal/login") && !next.includes("\\") ? next : "/portal";
  if (await getPortalSession()) redirect(nextTarget);
  return <PortalLoginForm nextTarget={nextTarget} />;
}
