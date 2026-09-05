"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoricalBarJSON } from "@/lib/apiTypes";
import { formatDate, formatPrice } from "@/lib/format";

export function PriceChart({ bars }: { bars: HistoricalBarJSON[] }) {
  if (bars.length === 0) {
    return <p className="text-sm text-stone-500">No historical data available.</p>;
  }

  const data = bars.map((b) => ({ date: b.date, close: b.close }));

  return (
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
          <Line type="monotone" dataKey="close" stroke="#44403c" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
