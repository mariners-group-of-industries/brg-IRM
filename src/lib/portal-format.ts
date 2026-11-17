import type { PortalLocale } from "./portal-i18n";
export function portalMeetingDate(value: string, timeZone = "Asia/Dhaka", locale: PortalLocale = "en") {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(value));
}
export function portalMeetingTime(value: string, timeZone = "Asia/Dhaka", locale: PortalLocale = "en") {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(new Date(value));
}
