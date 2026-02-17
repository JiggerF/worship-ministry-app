const MELBOURNE_TZ = "Australia/Melbourne";

/**
 * Get the "current" Sunday to display.
 * Rule: If today is Sunday and before 12pm Melbourne time, show this Sunday.
 * Otherwise, show the next upcoming Sunday.
 */
export function getCurrentSunday(): Date {
  const now = new Date();
  const melbourneNow = new Date(
    now.toLocaleString("en-US", { timeZone: MELBOURNE_TZ })
  );

  const dayOfWeek = melbourneNow.getDay(); // 0 = Sunday
  const hour = melbourneNow.getHours();

  if (dayOfWeek === 0 && hour < 12) {
    // It's Sunday before noon in Melbourne — show today
    return startOfDay(melbourneNow);
  }

  // Find next Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(melbourneNow);
  nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
  return startOfDay(nextSunday);
}

/**
 * Get all Sundays in a given month.
 */
export function getSundaysInMonth(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const date = new Date(year, month, 1);

  while (date.getMonth() === month) {
    if (date.getDay() === 0) {
      sundays.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }

  return sundays;
}

/**
 * Format a date as "Sun, Feb 15, 2026"
 */
export function formatSundayDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date as "DD-MM-YYYY" (for availability form checkboxes)
 */
export function formatDateDMY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format as ISO date string "YYYY-MM-DD"
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
