"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { EmptyState } from "@/components/shared/states";
import { BarChart3 } from "lucide-react";

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];

export interface Series {
  key: string;
  label: string;
  color?: string;
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function ChartTooltip({ active, payload, label, unit }: TooltipProps<number, string> & { unit?: string; payload?: any[]; label?: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1.5 font-semibold text-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
              {p.name}
            </span>
            <span className="tabular font-semibold text-foreground">
              {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendContent({ payload }: { payload?: { value: string; color: string }[] }) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
      {payload.map((p) => (
        <span key={p.value} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
          {p.value}
        </span>
      ))}
    </div>
  );
}

function NoData({ height }: { height: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center">
      <EmptyState icon={BarChart3} title="No data yet" description="Data will appear here once records exist." className="py-4" />
    </div>
  );
}

export function BarChartView({
  data,
  xKey,
  series,
  height = 280,
  stacked,
  horizontal,
  unit,
  showLegend = series.length > 1,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
  unit?: string;
  showLegend?: boolean;
}) {
  if (!data?.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }} barCategoryGap={horizontal ? "22%" : "28%"}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey={xKey} tick={axis} axisLine={false} tickLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axis} axisLine={false} tickLine={false} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? "end" : "middle"} height={data.length > 8 ? 56 : 30} />
            <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip unit={unit} />} />
        {showLegend && <Legend content={<LegendContent />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? "a" : undefined}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={stacked ? (i === series.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={horizontal ? 18 : 38}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, nameKey, valueKey, height = 260, centerLabel, centerValue }: { data: Record<string, unknown>[]; nameKey: string; valueKey: string; height?: number; centerLabel?: string; centerValue?: React.ReactNode }) {
  const total = data?.reduce((a, d) => a + Number(d[valueKey] ?? 0), 0) ?? 0;
  if (!data?.length || total === 0) return <NoData height={height} />;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="82%" paddingAngle={2} strokeWidth={0} cy="45%">
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Legend content={<LegendContent />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center" style={{ top: `calc(${height * 0.45}px - 22px)` }}>
        <span className="font-heading text-2xl font-bold leading-none">{centerValue ?? total}</span>
        {centerLabel && <span className="mt-1 text-[11px] text-muted-foreground">{centerLabel}</span>}
      </div>
    </div>
  );
}

export function AreaTrend({ data, xKey, series, height = 280, unit, domain }: { data: Record<string, unknown>[]; xKey: string; series: Series[]; height?: number; unit?: string; domain?: [number, number] }) {
  if (!data?.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} domain={domain} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        {series.length > 1 && <Legend content={<LegendContent />} />}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i]} strokeWidth={2.2} fill={`url(#grad-${s.key})`} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({ data, xKey, series, height = 280, unit }: { data: Record<string, unknown>[]; xKey: string; series: Series[]; height?: number; unit?: string }) {
  if (!data?.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        {series.length > 1 && <Legend content={<LegendContent />} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i]} strokeWidth={2.2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
