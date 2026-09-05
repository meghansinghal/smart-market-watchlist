/** Trading-day helpers. We treat any non-Saturday/Sunday as a trading day —
 * good enough for a demo; a real system would consult an exchange calendar
 * for holidays. */

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Midnight-UTC date one calendar day before `date`. */
function previousDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Calendar-day identity for a Date, ignoring time-of-day — e.g. two bars
 * fetched at different times of the same trading session (or a stored
 * midnight-normalized date vs. a provider's actual trade timestamp) still
 * compare equal. */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 09:15 IST expressed as a UTC Date for the given calendar day. */
export function atMarketOpen(date: Date): Date {
  const d = toUtcMidnight(date);
  d.setUTCHours(3, 45, 0, 0); // 09:15 IST == 03:45 UTC
  return d;
}

/** 15:30 IST expressed as a UTC Date for the given calendar day. */
export function atMarketClose(date: Date): Date {
  const d = toUtcMidnight(date);
  d.setUTCHours(10, 0, 0, 0); // 15:30 IST == 10:00 UTC
  return d;
}

/** The trading day (UTC-midnight-normalized) whose session is the most
 * recently available one as of `now` — today, if today is a trading day
 * whose session has at least started, otherwise the closest prior trading
 * day. Used to tell "this is last-close data" apart from "this is missing
 * a whole session's worth of updates" while the market is closed. */
export function mostRecentTradingDay(now: Date): Date {
  const today = toUtcMidnight(now);
  if (!isWeekend(today) && now.getTime() >= atMarketOpen(today).getTime()) {
    return today;
  }
  let candidate = previousDay(today);
  while (isWeekend(candidate)) candidate = previousDay(candidate);
  return candidate;
}

/** The close timestamp (15:30 IST) of the most recently completed session
 * as of `now`. If today's session is still running or hasn't started yet,
 * this is the previous trading day's close. */
export function mostRecentMarketClose(now: Date): Date {
  const today = toUtcMidnight(now);
  if (!isWeekend(today) && now.getTime() >= atMarketClose(today).getTime()) {
    return atMarketClose(today);
  }
  let candidate = previousDay(today);
  while (isWeekend(candidate)) candidate = previousDay(candidate);
  return atMarketClose(candidate);
}

/** The last `n` *completed* trading days strictly before `asOf`, oldest
 * first, normalized to midnight UTC. "Completed" means we never include
 * `asOf` itself — it's the in-progress/live day. */
export function lastNTradingDays(asOf: Date, n: number): Date[] {
  const days: Date[] = [];
  let cursor = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  cursor = previousDay(cursor);
  while (days.length < n) {
    if (!isWeekend(cursor)) {
      days.push(new Date(cursor));
    }
    cursor = previousDay(cursor);
  }
  return days.reverse();
}

export function isMarketLikelyOpen(now: Date): boolean {
  if (isWeekend(now)) return false;
  // NSE cash session: 09:15–15:30 IST (IST = UTC+5:30).
  const istMinutes =
    ((now.getUTCHours() * 60 + now.getUTCMinutes() + 5 * 60 + 30) % (24 * 60));
  return istMinutes >= 9 * 60 + 15 && istMinutes <= 15 * 60 + 30;
}
