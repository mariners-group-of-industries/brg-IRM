import "server-only";
import { cookies } from "next/headers";
import { PORTAL_LOCALE_COOKIE, type PortalLocale } from "./portal-i18n";
export async function getPortalLocale(): Promise<PortalLocale> { return (await cookies()).get(PORTAL_LOCALE_COOKIE)?.value === "bn" ? "bn" : "en"; }
