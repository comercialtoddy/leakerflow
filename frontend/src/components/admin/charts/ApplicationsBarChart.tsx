'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface MonthlySubmission {
  month: string;
  count: number;
}

interface ApplicationsBarChartProps {
  data: MonthlySubmission[];
  title?: string;
  description?: string;
  className?: string;
}

export function ApplicationsBarChart({ 
  data, 
  title = "Monthly Application Submissions",
  description = "Author application submissions over the last 6 months",
  className 
}: ApplicationsBarChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-orange-600">
            Applications: <span className="font-semibold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const maxValue = Math.max(...data.map(item => item.count));
  const yAxisMax = Math.ceil(maxValue * 1.2); // Add 20% padding

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                stroke="#888888"
              />
              <YAxis 
                className="text-xs" 
                stroke="#888888"
                domain={[0, yAxisMax]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                fill="#f97316"
                radius={[4, 4, 0, 0]}
                className="hover:opacity-80 transition-opacity"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 