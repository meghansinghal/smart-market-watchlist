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

interface ToneStyle {
  /** Percentage/label text color. */
  text: string;
  /** Classification pill background/text/ring. */
  badge: string;
  /** Small status dot fill. */
  dot: string;
  /** Left-accent border for callout-style boxes. */
  border: string;
  /** Soft background to pair with `border`. */
  softBg: string;
  /** Full border+background for a standalone callout panel. */
  callout: string;
  /** Hex mirror of the same color, for SVG `stroke`/`fill` attributes
   * (the chart) that can't take a Tailwind class. */
  hex: string;
}

export const TONE_STYLES: Record<Tone, ToneStyle> = {
  grey: {
    text: "text-stone-500",
    badge: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200",
    dot: "bg-stone-300",
    border: "border-stone-300",
    softBg: "bg-stone-50",
    callout: "border-stone-200 bg-stone-50",
    hex: "#a8a29e",
  },
  amber: {
    text: "text-amber-700",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
    border: "border-amber-400",
    softBg: "bg-amber-50",
    callout: "border-amber-200 bg-amber-50",
    hex: "#d97706",
  },
  green: {
    text: "text-green-700",
    badge: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",
    dot: "bg-green-500",
    border: "border-green-400",
    softBg: "bg-green-50",
    callout: "border-green-200 bg-green-50",
    hex: "#16a34a",
  },
  red: {
    text: "text-red-700",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    dot: "bg-red-500",
    border: "border-red-400",
    softBg: "bg-red-50",
    callout: "border-red-200 bg-red-50",
    hex: "#dc2626",
  },
};
