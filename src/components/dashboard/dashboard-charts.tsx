"use client"

import * as React from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts"

interface PeakHoursTooltipProps {
  payload: {
    txCount: number;
  };
}

interface BestSellersTooltipProps {
  payload: {
    revenue: number;
  };
}

interface RevenueTrendPoint {
  date: string;
  [branchName: string]: number | string;
}

interface PeakHourPoint {
  hour: string;
  amount: number;
  txCount: number;
}

interface ProductRankingPoint {
  name: string;
  quantity: number;
  revenue: number;
}

interface DashboardChartsProps {
  revenueTrends: RevenueTrendPoint[];
  peakHours: PeakHourPoint[];
  bestSellers: ProductRankingPoint[];
  branchNames: string[];
}

export function DashboardCharts({
  revenueTrends,
  peakHours,
  bestSellers,
  branchNames,
}: DashboardChartsProps) {
  // Cohesive premium color palette (Tailwind indigo/violet/emerald/sky colors mapped to HEX for Recharts)
  const colors = ["#6366f1", "#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6"]

  const formatYAxisKs = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M Ks`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k Ks`
    return `${value} Ks`
  }

  return (
    <div className="space-y-6">
      {/* 1. Branch Revenue Over Time (Daily Trends) */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-foreground">Revenue Trends (Last 7 Days)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily comparative sales revenue across active branches
          </p>
        </div>
        <div className="h-80 w-full text-xs font-semibold">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueTrends} margin={{ left: 15, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxisKs}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: "12px",
                  color: "var(--foreground)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
                formatter={(value: unknown) => [`${Number(value).toLocaleString()} Ks`, ""]}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingBottom: 10 }}
              />
              {branchNames.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  name={name}
                  fill={colors[index % colors.length]}
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* 2. Peak Hours Analysis (Area Chart) */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Peak Operating Hours</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hourly distribution of total sales today
            </p>
          </div>
          <div className="h-72 w-full text-xs font-semibold">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakHours} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="hour"
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxisKs}
                  dx={-10}
                />
                 <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "12px",
                    color: "var(--foreground)",
                  }}
                  formatter={(value: unknown, name: unknown, props: unknown) => {
                    const typedProps = props as PeakHoursTooltipProps
                    const txs = typedProps.payload.txCount
                    return [`${Number(value).toLocaleString()} Ks (${txs} txs)`, "Sales"]
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPeak)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Top Products Chart */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Top 5 Best-Selling Products</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranked by total quantity sold across all branches
            </p>
          </div>
          <div className="h-72 w-full text-xs font-semibold">
            {bestSellers.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground italic">
                No items sold today / အရောင်းမရှိသေးပါ။
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical" // Horizontal layout
                  data={bestSellers}
                  margin={{ left: 20, right: 10, top: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    dy={5}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                    dx={-5}
                  />
                   <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      color: "var(--foreground)",
                    }}
                    formatter={(value: unknown, name: unknown, props: unknown) => {
                      const typedProps = props as BestSellersTooltipProps
                      const rev = typedProps.payload.revenue
                      return [`${value} units (${rev.toLocaleString()} Ks)`, "Sold"]
                    }}
                  />
                  <Bar dataKey="quantity" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
