import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBagIcon,
  TrendingUpIcon,
  ClockIcon,
  PackageIcon,
  Loader2Icon,
  BarChart2Icon,
  UsersIcon,
  AlertTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RepeatIcon,
  XCircleIcon,
  CheckCircleIcon,
  TruckIcon,
  RefreshCwIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { StatsCard } from '../../components/admin/StatsCard';
import { useAdminOrdersStore } from '../../store/adminOrdersStore';
import { adminApi } from '../../utils/adminApi';
import { formatINR } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { AdminOrderListItem } from '../../store/adminOrdersStore';

// ─── Colour tokens (matches your adminSurf / adminBorder theme) ───────────────
const C = {
  primary:   '#2874F0',
  success:   '#22c55e',
  warning:   '#f59e0b',
  danger:    '#ef4444',
  purple:    '#7C3AED',
  cyan:      '#06b6d4',
  pink:      '#ec4899',
  border:    'rgba(255,255,255,0.08)',
  surf:      'rgba(255,255,255,0.04)',
  muted:     '#6b7280',
  text:      '#f9fafb',
  subtext:   '#9ca3af',
};

const STATUS_COLORS: Record<string, string> = {
  placed:           C.primary,
  processing:       C.warning,
  shipped:          C.cyan,
  delivered:        C.success,
  cancelled:        C.danger,
  return_requested: C.pink,
  returned:         C.purple,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToDay(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function last30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function shortDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({
  active,
  payload,
  label,
  currencyKeys = [],
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  currencyKeys?: string[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#1a1f2e',
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
      }}
    >
      {label && (
        <p style={{ color: C.subtext, marginBottom: 6, fontWeight: 600 }}>
          {label}
        </p>
      )}
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: p.color || p.fill,
              display: 'inline-block',
            }}
          />
          <span style={{ color: C.subtext }}>{p.name || p.dataKey}:</span>
          <span style={{ color: C.text, fontWeight: 700 }}>
            {currencyKeys.includes(p.dataKey) ? formatINR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Section shell ────────────────────────────────────────────────────────────

const Section = ({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    style={{
      background: C.surf,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <h2 style={{ fontWeight: 700, fontSize: 15, color: C.text, margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: C.subtext, margin: '2px 0 0' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
    <div style={{ padding: '20px' }}>{children}</div>
  </div>
);

// ─── Metric pill ──────────────────────────────────────────────────────────────

const MetricPill = ({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: React.ReactNode;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      background: `${color}12`,
      border: `1px solid ${color}30`,
      borderRadius: 10,
      flex: 1,
      minWidth: 140,
    }}
  >
    <span style={{ color, display: 'flex' }}>{icon}</span>
    <div>
      <div style={{ fontSize: 11, color: C.subtext, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  </div>
);

// ─── Revenue / Orders tabs ────────────────────────────────────────────────────

type Metric = 'revenue' | 'orders';

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminDashboard() {
  const { orders, stats, loading, fetchOrders, fetchStats } = useAdminOrdersStore();
  const [products, setProducts] = useState<{ id: number; name: string; variants: { price: number; stock: number }[] }[]>([]);
  const [metric, setMetric] = useState<Metric>('revenue');

  useEffect(() => {
    fetchStats();
    fetchOrders(1, 'all');
  adminApi
    .get<{ products: any[] }>('/admin/products?limit=200')
    .then((r) => setProducts(r.data.products ?? []));  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const outOfStockCount = products.filter((p) =>
    p.variants.every((v) => v.stock === 0)
  ).length;

  const recentOrders = orders.slice(0, 5);

  // ── 1. Daily revenue + orders (last 30 days) ──────────────────────────────

  const dailyData = useMemo(() => {
    const days = last30Days();
    const map: Record<string, { revenue: number; orders: number }> = {};
    days.forEach((d) => (map[d] = { revenue: 0, orders: 0 }));

    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const d = isoToDay(o.created_at);
      if (map[d]) {
        map[d].revenue += o.total;
        map[d].orders += 1;
      }
    });

    return days.map((d) => ({
      date: shortDay(d),
      revenue: parseFloat(map[d].revenue.toFixed(2)),
      orders: map[d].orders,
    }));
  }, [orders]);

  // ── 2. Orders by status ───────────────────────────────────────────────────

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  // ── 3. Revenue by payment method ─────────────────────────────────────────

  const paymentData = useMemo(() => {
    let cod = 0, online = 0;
    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      if (o.payment_method === 'cod') cod += o.total;
      else online += o.total;
    });
    return [
      { name: 'COD', value: parseFloat(cod.toFixed(2)), color: C.warning },
      { name: 'Online', value: parseFloat(online.toFixed(2)), color: C.primary },
    ];
  }, [orders]);

  // ── 4. Top products by revenue ────────────────────────────────────────────
  // We build this from products store + order data is not item-level here,
  // so we show products by stock health as proxy + out-of-stock alert

  const stockData = useMemo(() => {
    return products
      .slice(0, 8)
      .map((p) => {
        const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
        const minPrice = Math.min(...p.variants.map((v) => v.price));
        return {
          name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
          stock: totalStock,
          price: minPrice,
        };
      })
      .sort((a, b) => a.stock - b.stock);
  }, [products]);

  // ── 5. Order funnel ───────────────────────────────────────────────────────

  const funnelData = useMemo(() => {
    const total = orders.length;
    const processing = orders.filter((o) =>
      ['processing', 'shipped', 'delivered'].includes(o.status)
    ).length;
    const shipped = orders.filter((o) =>
      ['shipped', 'delivered'].includes(o.status)
    ).length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;

    return [
      { name: 'Placed', value: total,      fill: C.primary },
      { name: 'Processing', value: processing, fill: C.cyan },
      { name: 'Shipped', value: shipped,    fill: C.warning },
      { name: 'Delivered', value: delivered, fill: C.success },
    ];
  }, [orders]);

  // ── 6. KPI calculations ───────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    const returned  = orders.filter((o) => ['return_requested', 'returned'].includes(o.status));
    const convRate  = orders.length > 0
      ? ((delivered.length / orders.length) * 100).toFixed(1)
      : '0.0';
    const cancelRate = orders.length > 0
      ? ((cancelled.length / orders.length) * 100).toFixed(1)
      : '0.0';
    const avgOrder  = delivered.length > 0
      ? delivered.reduce((s, o) => s + o.total, 0) / delivered.length
      : 0;

    return { convRate, cancelRate, returnCount: returned.length, avgOrder };
  }, [orders]);

  // ── 7. Weekly comparison ──────────────────────────────────────────────────

  const weeklyComparison = useMemo(() => {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 6);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 13);
    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - 7);

    let thisRev = 0, lastRev = 0;
    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const d = new Date(o.created_at);
      if (d >= thisWeekStart) thisRev += o.total;
      else if (d >= lastWeekStart && d <= lastWeekEnd) lastRev += o.total;
    });

    const change = lastRev > 0 ? (((thisRev - lastRev) / lastRev) * 100).toFixed(1) : null;
    return { thisRev, lastRev, change };
  }, [orders]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Top Stats ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatsCard
          label="Total Orders"
          value={loading ? '…' : String(stats?.total_orders ?? 0)}
          icon={<ShoppingBagIcon size={20} />}
          iconBg={C.primary}
          subtext="All time"
          subtextColor="muted"
        />
        <StatsCard
          label="Revenue"
          value={loading ? '…' : formatINR(stats?.total_revenue ?? 0)}
          icon={<TrendingUpIcon size={20} />}
          iconBg="#388E3C"
          subtext="Excluding cancelled"
          subtextColor="success"
        />
        <StatsCard
          label="Pending Orders"
          value={loading ? '…' : String(stats?.pending_count ?? 0)}
          icon={<ClockIcon size={20} />}
          iconBg={C.warning}
          subtext="Requires action"
          subtextColor="warning"
          pulseDot={(stats?.pending_count ?? 0) > 0}
        />
        <StatsCard
          label="Total Products"
          value={String(products.length)}
          icon={<PackageIcon size={20} />}
          iconBg={C.purple}
          subtext={`${outOfStockCount} out of stock`}
          subtextColor={outOfStockCount > 0 ? 'danger' : 'muted'}
        />
      </div>

      {/* ── KPI Pills ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricPill
          label="Delivery Rate"
          value={`${kpis.convRate}%`}
          color={C.success}
          icon={<CheckCircleIcon size={16} />}
        />
        <MetricPill
          label="Cancel Rate"
          value={`${kpis.cancelRate}%`}
          color={C.danger}
          icon={<XCircleIcon size={16} />}
        />
        <MetricPill
          label="Returns / RR"
          value={kpis.returnCount}
          color={C.pink}
          icon={<RepeatIcon size={16} />}
        />
        <MetricPill
          label="Avg Order Value"
          value={formatINR(kpis.avgOrder)}
          color={C.cyan}
          icon={<BarChart2Icon size={16} />}
        />
        {weeklyComparison.change !== null && (
          <MetricPill
            label="WoW Revenue"
            value={`${weeklyComparison.change}%`}
            color={parseFloat(weeklyComparison.change) >= 0 ? C.success : C.danger}
            icon={
              parseFloat(weeklyComparison.change) >= 0
                ? <ArrowUpIcon size={16} />
                : <ArrowDownIcon size={16} />
            }
          />
        )}
      </div>

      {/* ── Revenue / Orders Trend ────────────────────────────────────────── */}
      <Section
        title="Trend — Last 30 Days"
        subtitle="Cancelled orders excluded from revenue"
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            {(['revenue', 'orders'] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: metric === m ? C.primary : 'rgba(255,255,255,0.06)',
                  color: metric === m ? '#fff' : C.subtext,
                  transition: 'all .15s',
                }}
              >
                {m === 'revenue' ? 'Revenue' : 'Orders'}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2Icon size={24} className="animate-spin" style={{ color: C.primary }} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOrd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: C.subtext }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.subtext }}
                tickLine={false}
                axisLine={false}
                tickFormatter={metric === 'revenue' ? (v) => `₹${(v / 1000).toFixed(0)}k` : undefined}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    currencyKeys={metric === 'revenue' ? ['revenue'] : []}
                  />
                }
              />
              {metric === 'revenue' ? (
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={C.primary}
                  strokeWidth={2}
                  fill="url(#gradRev)"
                  dot={false}
                  activeDot={{ r: 4, fill: C.primary }}
                />
              ) : (
                <Area
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke={C.cyan}
                  strokeWidth={2}
                  fill="url(#gradOrd)"
                  dot={false}
                  activeDot={{ r: 4, fill: C.cyan }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Orders by Status + Payment Split ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Orders by Status */}
        <Section title="Orders by Status">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2Icon size={24} className="animate-spin" style={{ color: C.primary }} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: C.subtext }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  tick={{ fontSize: 11, fill: C.subtext }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  tickFormatter={(v) => v.replace('_', ' ')}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Orders" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? C.muted}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Payment Method Split */}
        <Section title="Revenue by Payment Method">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2Icon size={24} className="animate-spin" style={{ color: C.primary }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<ChartTooltip currencyKeys={['value']} />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 20 }}>
                {paymentData.map((p) => (
                  <div key={p.name} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: p.color, display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: 12, color: C.subtext }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {formatINR(p.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── Conversion Funnel ─────────────────────────────────────────────── */}
      <Section
        title="Order Conversion Funnel"
        subtitle="How many placed orders reach delivery"
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2Icon size={24} className="animate-spin" style={{ color: C.primary }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {funnelData.map((stage, i) => {
              const pct = funnelData[0].value > 0
                ? ((stage.value / funnelData[0].value) * 100).toFixed(0)
                : '0';
              const isLast = i === funnelData.length - 1;
              return (
                <React.Fragment key={stage.name}>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 110,
                      background: `${stage.fill}18`,
                      border: `1px solid ${stage.fill}40`,
                      borderRadius: 12,
                      padding: '16px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 900, color: stage.fill }}>
                      {stage.value}
                    </div>
                    <div style={{ fontSize: 12, color: C.subtext, marginTop: 2 }}>
                      {stage.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: stage.fill,
                        marginTop: 6,
                        background: `${stage.fill}20`,
                        borderRadius: 20,
                        padding: '2px 8px',
                        display: 'inline-block',
                      }}
                    >
                      {pct}% of total
                    </div>
                  </div>
                  {!isLast && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: C.muted,
                        fontSize: 20,
                        fontWeight: 300,
                        alignSelf: 'center',
                      }}
                    >
                      →
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Stock Health ──────────────────────────────────────────────────── */}
      <Section
        title="Stock Health — Products"
        subtitle="Sorted by lowest stock first — act before you go out of stock"
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stockData} margin={{ top: 4, right: 4, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: C.subtext }}
              tickLine={false}
              axisLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: C.subtext }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="stock" name="Stock Units" radius={[4, 4, 0, 0]}>
              {stockData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.stock === 0 ? C.danger :
                    entry.stock <= 3  ? C.warning :
                    C.success
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {outOfStockCount > 0 && (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: `${C.danger}12`,
              border: `1px solid ${C.danger}30`,
              borderRadius: 8,
              fontSize: 13,
              color: C.danger,
            }}
          >
            <AlertTriangleIcon size={15} />
            <span>
              <strong>{outOfStockCount}</strong> product{outOfStockCount !== 1 ? 's' : ''} are fully out of stock.{' '}
              <Link to="/admin/products" style={{ color: C.danger, textDecoration: 'underline' }}>
                Restock →
              </Link>
            </span>
          </div>
        )}
      </Section>

      {/* ── Recent Orders ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: C.surf,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: 15, color: C.text, margin: 0 }}>
            Recent Orders
          </h2>
          <Link
            to="/admin/orders"
            style={{ fontSize: 13, color: C.primary, fontWeight: 700, textDecoration: 'none' }}
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2Icon size={24} className="animate-spin" style={{ color: C.primary }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Order #', 'Customer', 'Items', 'Total', 'Status', 'Action'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: i === 5 ? 'right' : 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.subtext,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ padding: '40px 16px', textAlign: 'center', color: C.muted, fontSize: 13 }}
                    >
                      No orders yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: C.primary, fontWeight: 700 }}>
                        {o.order_number}
                      </td>
                      <td style={{ padding: '12px 16px', color: C.text }}>
                        {o.address?.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: C.subtext }}>
                        {o.item_count} item{o.item_count !== 1 && 's'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: C.text }}>
                        {formatINR(o.total)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Link
                          to={`/admin/orders/${o.id}`}
                          style={{ fontSize: 12, fontWeight: 700, color: C.primary, textDecoration: 'none' }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}