'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export interface DivisionLeaveDataPoint {
  divisi: string;
  cuti_tahunan: number;
  sakit: number;
  izin: number;
}

interface DivisionLeaveBarChartProps {
  data: DivisionLeaveDataPoint[];
  height?: number;
}

// Warna memakai token tema agar otomatis menyesuaikan mode terang/gelap.
const CHART_COLORS = {
  cuti_tahunan: 'var(--primary)',
  sakit: 'var(--destructive)',
  izin: 'var(--chart-2)',
};
const AXIS_COLOR = 'var(--muted-foreground)';
const GRID_COLOR = 'var(--border)';

const LABELS: Record<string, string> = {
  cuti_tahunan: 'Cuti Tahunan',
  sakit: 'Sakit',
  izin: 'Izin',
};

export default function DivisionLeaveBarChart({ data, height = 320 }: DivisionLeaveBarChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="divisi"
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
            tickFormatter={(val) => `${val}h`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.42)', radius: 12 }}
            contentStyle={{
              backgroundColor: 'var(--popover)',
              color: 'var(--popover-foreground)',
              borderRadius: '18px',
              border: '1px solid rgba(255,255,255,0.8)',
              boxShadow:
                '0 20px 34px -18px rgba(54,38,92,0.38), 0 8px 16px -12px rgba(54,38,92,0.2)',
              fontSize: '12px',
              fontWeight: 600,
              padding: '10px 14px',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`${value} hari kerja`, LABELS[name] || name]}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={44}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ paddingBottom: 4 }}
            formatter={(val) => (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {LABELS[val] || val}
              </span>
            )}
          />
          <Bar dataKey="cuti_tahunan" fill={CHART_COLORS.cuti_tahunan} radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false} />
          <Bar dataKey="sakit" fill={CHART_COLORS.sakit} radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false} />
          <Bar dataKey="izin" fill={CHART_COLORS.izin} radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
