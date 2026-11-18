import { addDays, differenceInCalendarDays, format } from "date-fns";

/**
 * All attendance/leave "days" are stored as UTC midnight so that a calendar date
 * maps to exactly one value regardless of server timezone.
 */
export function toDateOnly(input: Date | string): Date {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T00:00:00.000Z`);
  }
  const d = new Date(input);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return d; // already a stored date-only value
  }
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function todayDateOnly(): Date {
  return toDateOnly(new Date());
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Iterate each calendar day (UTC) between start and end, inclusive. */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const total = differenceInCalendarDays(end, start);
  for (let i = 0; i <= total; i++) {
    const d = addDays(start, i);
    days.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
  }
  return days;
}

/** workingDays uses JS day numbers: 0 = Sunday … 6 = Saturday. */
export function workingDaysBetween(start: Date, end: Date, workingDays: number[]): Date[] {
  return eachDay(start, end).filter((d) => workingDays.includes(d.getUTCDay()));
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function nowHHmm(): string {
  return format(new Date(), "HH:mm");
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
