import { format, formatDistanceToNow } from "date-fns";

/** 17 Nov 2026 */
export function formatDate(value: Date | string): string {
  return format(new Date(value), "d MMM yyyy");
}

/** 17 Nov 2026, 10:30 AM */
export function formatDateTime(value: Date | string): string {
  return format(new Date(value), "d MMM yyyy, h:mm a");
}

/** "10:30 AM" */
export function formatTime(value: Date | string): string {
  return format(new Date(value), "h:mm a");
}

/** "3 days ago" */
export function timeAgo(value: Date | string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

/** 1,234 with thousands separators */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/** 62.5% */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}
