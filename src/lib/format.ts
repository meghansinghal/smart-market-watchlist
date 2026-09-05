import type { Freshness } from "@/lib/apiTypes";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatPct(n: number | null, digits = 2): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

export function formatVolume(volume: number | null): string {
  if (volume === null) return "—";
  if (volume >= 1_00_00_000) return `${(volume / 1_00_00_000).toFixed(2)}Cr`;
  if (volume >= 1_00_000) return `${(volume / 1_00_000).toFixed(2)}L`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return String(volume);
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * How to describe an observation's timestamp depends on what kind of
 * observation it is: "12m ago" is meaningful for something that's supposed
 * to be moving right now (LIVE/DELAYED), but for last-close/stale/cached/
 * static data an absolute "as of <date, time>" is more honest — it doesn't
 * imply the number is still ticking, and a relative time like "2d ago"
 * would otherwise make a perfectly normal Friday closing price read as
 * broken by Monday morning.
 */
export function formatObservationTimestamp(iso: string, freshness: Freshness): string {
  if (freshness === "LIVE" || freshness === "DELAYED") {
    return formatRelativeTime(iso);
  }
  return `as of ${formatDateTime(iso)}`;
}
