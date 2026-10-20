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
import { WeeklyAttendanceStat } from '@/utils/analytics';

interface AttendanceStackedBarChartProps {
  data: WeeklyAttendanceStat[];
  height?: number;
}

export default function AttendanceStackedBarChart({
  data,
  height = 320,
}: AttendanceStackedBarChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="minggu"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(val) => `${val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const labels: Record<string, string> = {
                hadir: 'Hadir Tepat Waktu',
                terlambat: 'Terlambat',
                cuti_izin: 'Cuti / Sakit / Izin',
                tanpa_keterangan: 'Tanpa Keterangan (Alpa)',
              };
              return [`${value} orang/hari`, labels[name] || name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]?.payload?.rentang) {
                return `${label} (${payload[0].payload.rentang})`;
              }
              return label;
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(val) => {
              const labels: Record<string, string> = {
                hadir: 'Hadir Tepat Waktu',
                terlambat: 'Terlambat',
                cuti_izin: 'Cuti / Izin',
                tanpa_keterangan: 'Tanpa Keterangan',
              };
              return <span className="text-xs text-slate-600 font-medium">{labels[val] || val}</span>;
            }}
          />
          <Bar dataKey="hadir" stackId="attendance" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="terlambat" stackId="attendance" fill="#f59e0b" radius={[0, 0, 0, 0]} />
          <Bar dataKey="cuti_izin" stackId="attendance" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="tanpa_keterangan" stackId="attendance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
