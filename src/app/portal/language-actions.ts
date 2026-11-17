"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PORTAL_LOCALE_COOKIE } from "@/lib/portal-i18n";
export async function setPortalLocaleAction(locale: string) {
  if (locale !== "en" && locale !== "bn") return { ok: false as const };
  (await cookies()).set(PORTAL_LOCALE_COOKIE, locale, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/portal", "layout"); return { ok: true as const };
}
