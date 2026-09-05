import type { ChangeClassification, Freshness } from "@/lib/apiTypes";
import { classificationTone, TONE_STYLES } from "@/lib/tone";

const CLASSIFICATION_LABEL: Record<ChangeClassification, string> = {
  SIGNIFICANT: "Significant",
  NOTABLE: "Notable",
  NORMAL: "Normal",
};

/** `pct` (change since checkpoint) decides SIGNIFICANT's color — green for
 * a gain, red for a loss. NOTABLE is always amber and NORMAL always grey,
 * regardless of direction; see lib/tone.ts. */
export function ClassificationBadge({
  classification,
  pct,
}: {
  classification: ChangeClassification;
  pct?: number | null;
}) {
  const tone = classificationTone(classification, pct);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_STYLES[tone].badge}`}
    >
      {CLASSIFICATION_LABEL[classification]}
    </span>
  );
}

// Deliberately restrained: green only for genuinely live data, neutral
// stone for the common closed-market/last-close state, amber for anything
// that warrants a second look (stale/static), never red — none of these
// are errors, just different degrees of "how current is this."
const FRESHNESS_STYLES: Record<Freshness, string> = {
  LIVE: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",
  DELAYED: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  CLOSED: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200",
  STALE: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  CACHED: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  STATIC: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  UNAVAILABLE: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200",
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
