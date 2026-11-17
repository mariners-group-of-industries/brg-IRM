"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
    <div className="h-48 w-full" role="img" aria-label="Shareholder turnout, last six meetings">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -14, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--shadow-sm)",
            }}
            labelStyle={{ fontWeight: 600, color: "var(--foreground)" }}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Turnout"] as [string, string]}
          />
          <Bar dataKey="turnout" name="Turnout" fill="var(--brand-navy)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
