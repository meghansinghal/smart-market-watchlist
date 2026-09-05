import type { ChangeClassification, Freshness } from "@/lib/apiTypes";

const CLASSIFICATION_STYLES: Record<ChangeClassification, string> = {
  SIGNIFICANT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  NOTABLE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  NORMAL: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const CLASSIFICATION_LABEL: Record<ChangeClassification, string> = {
  SIGNIFICANT: "Significant",
  NOTABLE: "Notable",
  NORMAL: "Normal",
};

export function ClassificationBadge({ classification }: { classification: ChangeClassification }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSIFICATION_STYLES[classification]}`}
    >
      {CLASSIFICATION_LABEL[classification]}
    </span>
  );
}

const FRESHNESS_STYLES: Record<Freshness, string> = {
  LIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  DELAYED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  STALE: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  CACHED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  STATIC: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  UNAVAILABLE: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const FRESHNESS_LABEL: Record<Freshness, string> = {
  LIVE: "Live",
  DELAYED: "Delayed",
  CLOSED: "Last close",
  STALE: "Stale",
  CACHED: "Cached",
  STATIC: "Static snapshot",
  UNAVAILABLE: "Unavailable",
};

export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${FRESHNESS_STYLES[freshness]}`}
    >
      {FRESHNESS_LABEL[freshness]}
    </span>
  );
}
