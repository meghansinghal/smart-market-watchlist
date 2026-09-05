/**
 * NSE (National Stock Exchange of India) trading holidays — the Equity /
 * Equity Derivatives segment calendar, as published by NSE. Several of
 * these (Holi, Ram Navami, Eid, Diwali, etc.) follow the lunar calendar
 * and shift every year, so this list must be updated annually. A year
 * with no entry here deliberately falls back to the weekend-only
 * approximation rather than silently reusing another year's dates.
 *
 * Source: NSE's published 2026 trading holiday calendar, cross-checked
 * against two independent financial-data aggregators (Sept 2026).
 */
const NSE_HOLIDAYS_BY_YEAR: Record<number, string[]> = {
  2026: [
    "2026-01-15", // Special trading holiday (Maharashtra municipal elections)
    "2026-01-26", // Republic Day
    "2026-03-03", // Holi
    "2026-03-26", // Shri Ram Navami
    "2026-03-31", // Shri Mahavir Jayanti
    "2026-04-03", // Good Friday
    "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
    "2026-05-01", // Maharashtra Day
    "2026-05-28", // Bakri Id
    "2026-06-26", // Muharram
    "2026-09-14", // Ganesh Chaturthi
    "2026-10-02", // Mahatma Gandhi Jayanti
    "2026-10-20", // Dussehra
    "2026-11-10", // Diwali-Balipratipada
    "2026-11-24", // Prakash Gurpurb Sri Guru Nanak Dev
    "2026-12-25", // Christmas
  ],
};

export function isNseHoliday(date: Date): boolean {
  const holidays = NSE_HOLIDAYS_BY_YEAR[date.getUTCFullYear()];
  if (!holidays) return false;
  return holidays.includes(date.toISOString().slice(0, 10));
}
