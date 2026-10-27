'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { WeeklyAttendanceStat } from '@/utils/analytics';

interface AttendanceStackedBarChartProps {
  data: WeeklyAttendanceStat[];
  height?: number;
  showLegend?: boolean;
}

const CHART_COLORS = {
  hadir: '#10b981',
  terlambat: '#f59e0b',
  cuti_izin: '#3b82f6',
  tanpa_keterangan: '#ef4444',
};

const LEGEND_ITEMS = [
  { key: 'hadir', label: 'Hadir tepat waktu', color: CHART_COLORS.hadir },
  { key: 'terlambat', label: 'Terlambat', color: CHART_COLORS.terlambat },
  { key: 'cuti_izin', label: 'Cuti / Sakit / Izin', color: CHART_COLORS.cuti_izin },
  { key: 'tanpa_keterangan', label: 'Tanpa keterangan', color: CHART_COLORS.tanpa_keterangan },
];

const AXIS_COLOR = 'var(--muted-foreground)';
const GRID_COLOR = 'var(--border)';

const LABELS: Record<string, string> = {
  hadir: 'Hadir Tepat Waktu',
  terlambat: 'Terlambat',
  cuti_izin: 'Cuti / Sakit / Izin',
  tanpa_keterangan: 'Tanpa Keterangan (Alpa)',
};

export default function AttendanceStackedBarChart({
  data,
  height = 260,
  showLegend = true,
}: AttendanceStackedBarChartProps) {
  return (
    <div className="w-full space-y-3">
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-muted-foreground">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      )}

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 4 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="minggu"
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              tickMargin={8}
            />
            <YAxis
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.42)', radius: 12 }}
              contentStyle={{
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: '0 12px 24px -10px rgba(0,0,0,0.18)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 12px',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `${value} orang/hari`,
                LABELS[name] || name,
              ]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.rentang ? `${label} (${payload[0].payload.rentang})` : label
              }
            />
            <Bar dataKey="hadir" stackId="attendance" fill={CHART_COLORS.hadir} maxBarSize={54} isAnimationActive={false} />
            <Bar dataKey="terlambat" stackId="attendance" fill={CHART_COLORS.terlambat} maxBarSize={54} isAnimationActive={false} />
            <Bar dataKey="cuti_izin" stackId="attendance" fill={CHART_COLORS.cuti_izin} maxBarSize={54} isAnimationActive={false} />
            <Bar
              dataKey="tanpa_keterangan"
              stackId="attendance"
              fill={CHART_COLORS.tanpa_keterangan}
              radius={[6, 6, 0, 0]}
              maxBarSize={54}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
