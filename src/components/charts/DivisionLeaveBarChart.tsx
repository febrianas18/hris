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

export default function DivisionLeaveBarChart({
  data,
  height = 320,
}: DivisionLeaveBarChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="divisi"
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
            tickFormatter={(val) => `${val}h`}
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
                cuti_tahunan: 'Cuti Tahunan',
                sakit: 'Sakit',
                izin: 'Izin',
              };
              return [`${value} hari kerja`, labels[name] || name];
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(val) => {
              const labels: Record<string, string> = {
                cuti_tahunan: 'Cuti Tahunan',
                sakit: 'Sakit',
                izin: 'Izin',
              };
              return <span className="text-xs text-slate-600 font-medium">{labels[val] || val}</span>;
            }}
          />
          <Bar dataKey="cuti_tahunan" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="sakit" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="izin" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
