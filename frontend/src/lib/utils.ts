import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats an ISO date string (or Date) – stored dates are UTC midnight, so read them in UTC. */
export function formatDate(value?: string | Date | null, pattern = "dd MMM yyyy"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  // Shift UTC-midnight dates so the calendar day doesn't move in negative offsets.
  const shifted = new Date(d.getTime() + d.getTimezoneOffset() * 60_000);
  return format(isDateOnly(d) ? shifted : d, pattern);
}

function isDateOnly(d: Date) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  return format(typeof value === "string" ? parseISO(value) : value, "dd MMM yyyy, HH:mm");
}

export function timeAgo(value?: string | Date | null): string {
  if (!value) return "";
  return formatDistanceToNow(typeof value === "string" ? parseISO(value) : value, { addSuffix: true });
}

/** "YYYY-MM-DD" from a stored date (UTC) or local Date. */
export function toInputDate(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return format(value, "yyyy-MM-dd");
}

export function todayInput(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function titleCase(s?: string | null): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050/api").replace(/\/api\/?$/, "");

export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits).replace(/\.0$/, "")}%`;
}

const HONORIFICS = /^(dr|prof|mr|mrs|ms|miss)\.?$/i;
/** First name without honorifics: "Dr. Aditi Rao" -> "Aditi". */
export function firstName(name?: string | null): string {
  const parts = (name ?? "").split(/\s+/).filter(Boolean);
  return parts.find((p) => !HONORIFICS.test(p)) ?? parts[0] ?? "";
}
