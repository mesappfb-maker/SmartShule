'use client'

// SmartShule — Composants graphiques avancés avec Recharts
// =====================================================
// Composants réutilisables : AreaChart, BarChart, LineChart, PieChart, DonutChart
// Toutes les couleurs sont configurables et adaptatives (clair/sombre)

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'

interface ChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  yKey: string
  height?: number
  color?: string
}

const COLORS = ['#2563EB', '#0F766E', '#F59E0B', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D']

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'hsl(var(--popover-foreground))',
}

// =====================================================
// AreaChart (recettes, dépenses)
// =====================================================

export function SSAreaChart({ data, xKey, yKey, height = 300, color = '#2563EB' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.8} />
            <stop offset="95%" stopColor={color} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={yKey} stroke={color} fillOpacity={1} fill={`url(#gradient-${yKey})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// =====================================================
// BarChart (comparaisons mensuelles)
// =====================================================

interface BarChartProps extends ChartProps {
  y2Key?: string
  color2?: string
}

export function SSBarChart({ data, xKey, yKey, y2Key, height = 300, color = '#2563EB', color2 = '#F59E0B' }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
        <Tooltip contentStyle={tooltipStyle} />
        {y2Key && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
        {y2Key && <Bar dataKey={y2Key} fill={color2} radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  )
}

// =====================================================
// LineChart (croissance)
// =====================================================

export function SSLineChart({ data, xKey, yKey, height = 300, color = '#0F766E' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// =====================================================
// DonutChart (répartition par catégorie)
// =====================================================

interface DonutProps {
  data: Array<{ name: string; value: number }>
  height?: number
  colors?: string[]
}

export function SSDonutChart({ data, height = 300, colors = COLORS }: DonutProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
          dataKey="value"
          label={(entry: { name?: string }) => entry?.name || ''}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// =====================================================
// PieChart (répartition simple)
// =====================================================

export function SSPieChart({ data, height = 300, colors = COLORS }: DonutProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          dataKey="value"
          label={(entry: { name?: string }) => entry?.name || ''}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// =====================================================
// Mini sparkline (dans les cartes stats)
// =====================================================

export function SSSparkline({ data, yKey, color = '#2563EB', height = 40 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.6} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${yKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
