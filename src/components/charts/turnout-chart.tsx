"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TurnoutChart({
  data,
}: {
  data: { name: string; turnout: number }[];
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Shareholder turnout, last six meetings">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -14, bottom: 4 }} barCategoryGap="24%">
          <defs>
            <linearGradient id="turnoutBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--brand-navy)" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.6} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            unit="%"
          />
          <ReferenceLine
            y={50}
            stroke="var(--brand)"
            strokeDasharray="4 4"
            opacity={0.4}
            label={{ value: "50% Quorum target", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const val = Number(payload[0]?.value ?? 0);
                return (
                  <div className="rounded-xl border border-border/80 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
                    <p className="font-semibold text-foreground">{label}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-brand" />
                      <span className="text-muted-foreground">Turnout:</span>
                      <span className="font-bold text-foreground tabular-nums">{val.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="turnout"
            name="Turnout"
            fill="url(#turnoutBarGradient)"
            radius={[6, 6, 0, 0]}
            maxBarSize={42}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
