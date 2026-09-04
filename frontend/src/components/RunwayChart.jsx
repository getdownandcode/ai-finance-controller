import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  Cell,
} from 'recharts';

const cx = (...c) => c.filter(Boolean).join(' ');

export function formatINRShort(val) {
  if (val === undefined || val === null) return '₹0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(abs >= 100000000 ? 1 : 2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 100000 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

function TrajectoryTooltip({ active, payload, label, formatHeadlineMoney, formatMoney }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const isBase = d.days === 0;
  return (
    <div className="min-w-[210px] rounded-xl border border-border bg-popover px-3.5 py-3 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{d.label}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">T+{d.days}d</span>
      </div>
      <p className="mt-1.5 font-mono text-lg font-bold tabular-nums leading-none text-card-foreground">
        {formatHeadlineMoney(d.cash)}
      </p>
      {isBase ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Starting cash baseline</p>
      ) : (
        <div className="mt-2.5 space-y-1 border-t border-border pt-2 font-mono text-[11px] tabular-nums">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Inflows</span>
            <span className="font-semibold text-chart-2">+{formatMoney(d.inflows)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Outflows</span>
            <span className="font-semibold text-muted-foreground">-{formatMoney(d.outflows)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-border/60 pt-1 font-bold">
            <span className="text-muted-foreground">Net</span>
            <span className={d.net >= 0 ? 'text-chart-2' : 'text-destructive'}>
              {d.net >= 0 ? `+${formatMoney(d.net)}` : formatMoney(d.net)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowTooltip({ active, payload, formatMoney }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="min-w-[190px] rounded-xl border border-border bg-popover px-3.5 py-3 shadow-xl">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{d.label}</p>
      <div className="mt-2 space-y-1 font-mono text-[11px] tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Inflows</span>
          <span className="font-semibold text-chart-2">+{formatMoney(d.inflows)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Outflows</span>
          <span className="font-semibold text-muted-foreground">-{formatMoney(d.outflows)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/60 pt-1 font-bold">
          <span className="text-muted-foreground">Net</span>
          <span className={d.net >= 0 ? 'text-chart-2' : 'text-destructive'}>
            {d.net >= 0 ? `+${formatMoney(d.net)}` : formatMoney(d.net)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Glowing dot for trajectory milestones
function TrajectoryDot(props) {
  const { cx: x, cy: y, index, payload, activeIdx } = props;
  const isLast = index === (props?.total ?? 3);
  const isActive = activeIdx === index;
  const r = isActive ? 6 : isLast ? 5.5 : 4.5;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {isLast && (
        <>
          <circle cx={x} cy={y} r={11} fill="var(--chart-2)" opacity={0.18}>
            <animate attributeName="r" values="9;13;9" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.22;0.08;0.22" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={x} cy={y} r={r + 4} fill="none" stroke="var(--chart-2)" strokeOpacity={0.35} strokeWidth={1.5} />
        </>
      )}
      {isActive && !isLast && (
        <circle cx={x} cy={y} r={r + 5} fill="none" stroke="var(--chart-2)" strokeOpacity={0.4} strokeWidth={1.5} />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="var(--card)"
        stroke="var(--chart-2)"
        strokeWidth={isActive || isLast ? 3 : 2.5}
        style={{ filter: isLast ? 'drop-shadow(0 0 6px var(--chart-2))' : undefined }}
      />
      <circle cx={x} cy={y} r={1.6} fill="var(--chart-2)" />
    </g>
  );
}

export default function RunwayForecasterChart({
  timeline,
  formatHeadlineMoney,
  formatMoney,
  activeIdx,
  onActiveChange,
}) {
  const data = useMemo(() => (timeline || []).map((t) => ({ ...t })), [timeline]);
  const flowData = useMemo(() => data.filter((d) => d.days !== 0), [data]);

  if (!data || data.length === 0) return null;

  const netGrowth = data[data.length - 1].cash - data[0].cash;
  const positive = netGrowth >= 0;

  const yDomain = useMemo(() => {
    const vals = data.map((d) => d.cash);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || Math.max(Math.abs(max) * 0.1, 1000);
    return [Math.max(0, Math.floor(min - span * 0.18)), Math.ceil(max + span * 0.22)];
  }, [data]);

  const lastLabel = data.length >= 4 ? data[2].label : null;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Forward Liquidity Trajectory
          </span>
          <span className="hidden rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-block">
            Actuals → Forecast
          </span>
        </div>
        <span
          className={cx(
            'rounded-full border px-2.5 py-1 font-mono text-xs font-bold tabular-nums',
            positive
              ? 'border-chart-2/30 bg-chart-2/15 text-chart-2'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          {positive ? '+' : ''}
          {formatHeadlineMoney(netGrowth)} Projected Net Growth
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-6 rounded-full" style={{ background: 'var(--chart-2)' }} />
          Projected cash balance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px] border border-dashed"
            style={{ borderColor: 'var(--chart-2)', background: 'color-mix(in srgb, var(--chart-2) 12%, transparent)' }}
          />
          Forecast window (+60 → +90d)
        </span>
        <span className="ml-auto hidden font-mono text-[10px] tabular-nums sm:inline">Y in {formatINRShort(yDomain[1])} scale</span>
      </div>

      {/* Main trajectory */}
      <div className="h-[280px] w-full px-1 pt-1 sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 22, right: 18, bottom: 4, left: 4 }}
            onMouseMove={(s) => {
              const idx = s?.activeTooltipIndex;
              if (idx !== undefined && idx !== activeIdx) onActiveChange?.(idx);
            }}
            onMouseLeave={() => onActiveChange?.(null)}
          >
            <defs>
              <linearGradient id="runway-cash-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.38} />
                <stop offset="45%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="runway-cash-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.75} />
                <stop offset="60%" stopColor="var(--chart-2)" />
                <stop offset="100%" stopColor="var(--chart-2)" />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.55} strokeDasharray="3 6" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)', strokeOpacity: 0.8 }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 700 }}
              tickMargin={10}
              interval={0}
              tickFormatter={(v) => String(v).toUpperCase()}
            />
            <YAxis
              domain={yDomain}
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => formatINRShort(v)}
            />
            <Tooltip
              content={<TrajectoryTooltip formatHeadlineMoney={formatHeadlineMoney} formatMoney={formatMoney} />}
              cursor={{ stroke: 'var(--chart-2)', strokeOpacity: 0.45, strokeDasharray: '4 4', strokeWidth: 1 }}
            />
            {lastLabel && (
              <ReferenceArea
                x1={data[2].label}
                x2={data[data.length - 1].label}
                fill="var(--chart-2)"
                fillOpacity={0.06}
                stroke="var(--chart-2)"
                strokeOpacity={0.3}
                strokeDasharray="5 5"
              />
            )}
            <Area
              type="monotone"
              dataKey="cash"
              name="Cash"
              stroke="url(#runway-cash-stroke)"
              strokeWidth={3}
              fill="url(#runway-cash-fill)"
              dot={(p) => <TrajectoryDot {...p} total={data.length - 1} activeIdx={activeIdx} />}
              activeDot={{ r: 6, fill: 'var(--card)', stroke: 'var(--chart-2)', strokeWidth: 3 }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Inflow / outflow breakdown */}
      <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Expected flows per window
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--chart-2)' }} /> Inflows
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--muted-foreground)', opacity: 0.55 }} /> Outflows
            </span>
          </div>
        </div>
        <div className="h-[132px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={flowData}
              margin={{ top: 12, right: 8, bottom: 0, left: 8 }}
              barCategoryGap="28%"
              barGap={4}
              onMouseMove={(s) => {
                const payload = s?.activeTooltipIndex;
                if (payload !== undefined) {
                  // map flow index -> timeline index (skip Today)
                  const mapped = payload + 1;
                  if (mapped !== activeIdx) onActiveChange?.(mapped);
                }
              }}
              onMouseLeave={() => onActiveChange?.(null)}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--border)', strokeOpacity: 0.8 }}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 700 }}
                tickMargin={8}
                interval={0}
                tickFormatter={(v) => String(v).toUpperCase()}
              />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip content={<FlowTooltip formatMoney={formatMoney} />} cursor={{ fill: 'var(--border)', opacity: 0.18 }} />
              <Bar dataKey="inflows" name="Inflows" radius={[5, 5, 2, 2]} maxBarSize={34} animationDuration={700}>
                {flowData.map((entry, i) => (
                  <Cell
                    key={`in-${i}`}
                    fill="var(--chart-2)"
                    fillOpacity={activeIdx === i + 1 || activeIdx == null ? 0.95 : 0.45}
                  />
                ))}
              </Bar>
              <Bar dataKey="outflows" name="Outflows" radius={[5, 5, 2, 2]} maxBarSize={34} animationDuration={700}>
                {flowData.map((entry, i) => (
                  <Cell
                    key={`out-${i}`}
                    fill="var(--muted-foreground)"
                    fillOpacity={activeIdx === i + 1 || activeIdx == null ? 0.55 : 0.25}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
