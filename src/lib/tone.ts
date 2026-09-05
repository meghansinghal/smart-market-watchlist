import type { ChangeClassification } from "@/lib/apiTypes";

/**
 * The one semantic color vocabulary used everywhere a classification or a
 * price change is rendered — badges, dots, sparklines, chart accents,
 * callouts. Kept in one place so "what does amber mean" never drifts
 * between components.
 *
 *   NORMAL                -> grey  (nothing worth a second look)
 *   NOTABLE                -> amber (worth a glance, direction doesn't matter)
 *   SIGNIFICANT + up        -> green
 *   SIGNIFICANT + down/flat -> red
 */
export type Tone = "grey" | "amber" | "green" | "red";

export function classificationTone(
  classification: ChangeClassification | null | undefined,
  pct: number | null | undefined,
): Tone {
  if (classification === "NOTABLE") return "amber";
  if (classification === "SIGNIFICANT") {
    return pct !== null && pct !== undefined && pct < 0 ? "red" : "green";
  }
  return "grey";
}

export const TONE_TEXT: Record<Tone, string> = {
  grey: "text-stone-500",
  amber: "text-amber-700",
  green: "text-green-700",
  red: "text-red-700",
};

export const TONE_BADGE: Record<Tone, string> = {
  grey: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  green: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",
  red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

export const TONE_DOT: Record<Tone, string> = {
  grey: "bg-stone-300",
  amber: "bg-amber-500",
  green: "bg-green-500",
  red: "bg-red-500",
};

export const TONE_BORDER: Record<Tone, string> = {
  grey: "border-stone-300",
  amber: "border-amber-400",
  green: "border-green-400",
  red: "border-red-400",
};

export const TONE_SOFT_BG: Record<Tone, string> = {
  grey: "bg-stone-50",
  amber: "bg-amber-50",
  green: "bg-green-50",
  red: "bg-red-50",
};

export const TONE_CALLOUT: Record<Tone, string> = {
  grey: "border-stone-200 bg-stone-50",
  amber: "border-amber-200 bg-amber-50",
  green: "border-green-200 bg-green-50",
  red: "border-red-200 bg-red-50",
};

// Hex mirrors of the same palette for contexts that can't take a Tailwind
// class — SVG `stroke`/`fill` attributes in the chart.
export const TONE_HEX: Record<Tone, string> = {
  grey: "#a8a29e",
  amber: "#d97706",
  green: "#16a34a",
  red: "#dc2626",
};
