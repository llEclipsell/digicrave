"use client";
// src/components/admin/RevenueChart.tsx
// Phase 6 — Recharts-based revenue chart

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { DailyRevenue } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueChartProps {
  data: DailyRevenue[];
  isLoading?: boolean;
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1.5">
        {label ? format(parseISO(label), "dd MMM") : ""}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold" style={{ color: p.color }}>
            ₹{p.value.toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "dd MMM"),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F97316" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 10 }}
          className="fill-muted-foreground"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          className="fill-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
        <Area
          type="monotone"
          dataKey="grossRevenue"
          name="Gross Revenue"
          stroke="#F97316"
          strokeWidth={2}
          fill="url(#gradGross)"
          dot={false}
          activeDot={{ r: 4, fill: "#F97316" }}
        />
        <Area
          type="monotone"
          dataKey="netSettlement"
          name="Net Settlement"
          stroke="#22C55E"
          strokeWidth={2}
          fill="url(#gradNet)"
          dot={false}
          activeDot={{ r: 4, fill: "#22C55E" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
