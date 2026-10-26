'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyAttendanceStat } from '@/utils/analytics';

interface AttendanceTrendAreaChartProps {
  data: WeeklyAttendanceStat[];
  height?: number;
}

const LABELS: Record<string, string> = {
  hadir: 'Hadir tepat waktu',
  terlambat: 'Terlambat',
};

export default function AttendanceTrendAreaChart({
  data,
  height = 264,
}: AttendanceTrendAreaChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 10, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id="attendanceAreaHadir" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4099ff" stopOpacity={0.34} />
              <stop offset="70%" stopColor="#4099ff" stopOpacity={0.07} />
              <stop offset="100%" stopColor="#4099ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="attendanceAreaLate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb64d" stopOpacity={0.3} />
              <stop offset="70%" stopColor="#ffb64d" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#ffb64d" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="4 8"
            vertical={false}
            stroke="#e5edf7"
            strokeWidth={1}
          />
          <XAxis
            dataKey="minggu"
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            interval={0}
            padding={{ left: 28, right: 28 }}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
          />
          <YAxis hide domain={[0, 'auto']} allowDecimals={false} />

          <Tooltip
            cursor={{ stroke: '#cfe0f4', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{
              backgroundColor: '#ffffff',
              color: '#162033',
              borderRadius: '14px',
              border: '1px solid #e5edf7',
              boxShadow: '0 18px 38px -26px rgba(31, 76, 133, 0.45)',
              fontSize: '12px',
              fontWeight: 600,
              padding: '10px 12px',
            }}
            labelStyle={{ color: '#64748b', fontSize: '11px', marginBottom: 4 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${Number(value ?? 0)} orang-hari`,
              LABELS[name] || name,
            ]}
            labelFormatter={(label, payload) => {
              const range = payload?.[0]?.payload?.rentang;
              return range ? `${label} · ${range}` : label;
            }}
          />

          <Area
            type="monotone"
            dataKey="terlambat"
            stroke="#d97706"
            strokeWidth={2.2}
            fill="url(#attendanceAreaLate)"
            dot={{ r: 4, fill: '#d97706', stroke: '#ffffff', strokeWidth: 3 }}
            activeDot={{ r: 7, fill: '#d97706', stroke: '#ffffff', strokeWidth: 3 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="hadir"
            stroke="#1f6fd0"
            strokeWidth={2.6}
            fill="url(#attendanceAreaHadir)"
            dot={{ r: 4, fill: '#1f6fd0', stroke: '#ffffff', strokeWidth: 3 }}
            activeDot={{ r: 7, fill: '#1f6fd0', stroke: '#ffffff', strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
