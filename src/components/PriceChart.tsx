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

interface ChartPoint {
  date: string;
  price: number;
}

export function PriceChart({
  bars,
  current,
  checkpoint,
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
}) {
  if (bars.length === 0) {
    return <p className="text-sm text-stone-500">No historical data available.</p>;
  }

  const data = [
    ...bars.map((b) => ({ date: b.date, close: b.close })),
    ...(current ? [{ date: current.date, close: current.price }] : []),
  ];

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

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            <Line
              type="monotone"
              dataKey="close"
              stroke="#44403c"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
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
              <ReferenceDot x={lastPoint.date} y={lastPoint.close} r={4} fill="#16a34a" stroke="#ffffff" strokeWidth={1} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {checkpointPoint && (
        <div className="flex justify-between text-xs text-stone-400">
          <span>Last checked</span>
          <span>Now</span>
        </div>
      )}
    </div>
  );
}
