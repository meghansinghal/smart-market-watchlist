"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoricalBarJSON } from "@/lib/apiTypes";
import { formatDate, formatPrice } from "@/lib/format";
import { TONE_HEX, type Tone } from "@/lib/tone";

interface ChartPoint {
  date: string;
  price: number;
}

export function PriceChart({
  bars,
  current,
  checkpoint,
  tone = "grey",
  compact = false,
}: {
  bars: HistoricalBarJSON[];
  /** The live/current observation — appended as the chart's final point so
   * the line actually reaches "now", since `bars` only ever covers
   * completed trading days. */
  current?: ChartPoint | null;
  /** Where "since your last visit" started — ties the chart directly back
   * to the product's core concept instead of showing an undifferentiated
   * price history. */
  checkpoint?: ChartPoint | null;
  /** Same grey/amber/green/red vocabulary as badges elsewhere — colors the
   * checkpoint→now segment (the actual change being reported), not the
   * full history. */
  tone?: Tone;
  /** A tiny, axis-free trend line for list/card contexts — no markers, no
   * legend, just the shape of the last few weeks. */
  compact?: boolean;
}) {
  if (bars.length === 0) {
    return compact ? null : <p className="text-sm text-stone-500">No historical data available.</p>;
  }

  const data = [
    ...bars.map((b) => ({ date: b.date, close: b.close })),
    ...(current ? [{ date: current.date, close: current.price }] : []),
  ];

  if (compact) {
    return (
      <div className="h-7 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            {/* Without an explicit domain, the y-axis defaults toward
             * starting at 0 — for a price series that barely varies
             * relative to its absolute value, that compresses real
             * day-to-day movement into a nearly flat line. Fitting the
             * domain tightly to the data's own range (hidden — this is
             * still just a trend line, not a readable axis) is what
             * actually makes the shape visible. */}
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line
              type="monotone"
              dataKey="close"
              stroke={TONE_HEX[tone]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Snap the checkpoint marker to the closest actual data point at or
  // before its date — a reference line/dot needs to land on a real
  // category value the x-axis knows about, not an arbitrary date.
  const checkpointPoint = checkpoint
    ? data.reduce<{ date: string; close: number } | null>((best, point) => {
        if (new Date(point.date).getTime() > new Date(checkpoint.date).getTime()) return best;
        if (!best || new Date(point.date).getTime() > new Date(best.date).getTime()) return point;
        return best;
      }, null)
    : null;
  const lastPoint = data[data.length - 1];
  const checkpointTime = checkpointPoint ? new Date(checkpointPoint.date).getTime() : null;

  // A second, colored line drawn only from the checkpoint onward — same
  // data, an extra key that's null before the checkpoint so Recharts skips
  // that stretch — visually ties the checkpoint→now segment to the
  // classification's tone instead of leaving it the same neutral grey as
  // the rest of the history.
  const highlightedData = data.map((point) => ({
    ...point,
    highlightClose: checkpointTime !== null && new Date(point.date).getTime() >= checkpointTime ? point.close : null,
  }));

  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={highlightedData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
              minTickGap={30}
              stroke="currentColor"
              className="text-stone-400"
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11 }}
              width={64}
              tickFormatter={(v: number) => formatPrice(v)}
              stroke="currentColor"
              className="text-stone-400"
            />
            <Tooltip
              formatter={(value) => formatPrice(Number(value))}
              labelFormatter={(label) => formatDate(String(label))}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e7e5e4" }}
            />
            <Line type="monotone" dataKey="close" stroke="#44403c" strokeWidth={2} dot={false} isAnimationActive={false} />
            {checkpointPoint && (
              <Line
                type="monotone"
                dataKey="highlightClose"
                stroke={TONE_HEX[tone]}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {checkpointPoint && (
              <>
                <ReferenceLine x={checkpointPoint.date} stroke="#a8a29e" strokeDasharray="4 4" />
                <ReferenceDot
                  x={checkpointPoint.date}
                  y={checkpointPoint.close}
                  r={4}
                  fill="#ffffff"
                  stroke="#78716c"
                  strokeWidth={2}
                />
              </>
            )}
            {current && lastPoint && (
              <ReferenceDot
                x={lastPoint.date}
                y={lastPoint.close}
                r={4}
                fill={TONE_HEX[tone]}
                stroke="#ffffff"
                strokeWidth={1}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {checkpointPoint && (
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full border border-stone-400 bg-white" aria-hidden />
            Last checked
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: TONE_HEX[tone] }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_HEX[tone] }} aria-hidden />
            Now
          </span>
        </div>
      )}
    </div>
  );
}
