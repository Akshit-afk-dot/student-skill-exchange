/**
 * Small hand-rolled SVG charts.
 *
 * The dashboard needs exactly two shapes — a signup trend and ranked bars — so these
 * are drawn directly rather than pulling in a charting library. They inherit colour
 * from CSS variables, which keeps them correct in both light and dark themes.
 */

export interface TrendPoint {
  date: string;
  signups: number;
}

export function TrendChart({ points, height = 160 }: { points: TrendPoint[]; height?: number }) {
  if (points.length === 0) {
    return <div className="empty">No signups in the last 30 days yet.</div>;
  }

  const width = 640;
  const padding = { top: 12, right: 12, bottom: 24, left: 30 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = Math.max(...points.map((p) => p.signups), 1);
  // A single point has no horizontal span to divide, so pin it to the left edge.
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - (p.signups / max) * plotH,
    ...p,
  }));

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const first = coords[0];
  const last = coords[coords.length - 1];
  const area =
    first && last
      ? `${line} L${last.x.toFixed(1)},${(padding.top + plotH).toFixed(1)} L${first.x.toFixed(1)},${(padding.top + plotH).toFixed(1)} Z`
      : '';

  // At most six date labels, however many points there are.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Signups over the last ${points.length} days, peaking at ${max} in a day`}
    >
      <line
        className="chart-axis"
        x1={padding.left}
        y1={padding.top + plotH}
        x2={width - padding.right}
        y2={padding.top + plotH}
      />
      <text className="chart-label" x={4} y={padding.top + 4}>
        {max}
      </text>
      <text className="chart-label" x={4} y={padding.top + plotH + 4}>
        0
      </text>

      {area ? <path className="chart-area" d={area} /> : null}
      <path className="chart-line" d={line} />

      {coords.map((c, i) =>
        i % labelEvery === 0 || i === coords.length - 1 ? (
          <g key={c.date}>
            <circle className="chart-dot" cx={c.x} cy={c.y} r={2.5} />
            <text className="chart-label" x={c.x} y={height - 8} textAnchor="middle">
              {c.date.slice(5)}
            </text>
          </g>
        ) : null,
      )}
    </svg>
  );
}

export function BarList({
  items,
  emptyLabel = 'Nothing to show yet.',
}: {
  items: Array<{ name: string; count: number }>;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <div className="empty">{emptyLabel}</div>;
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div>
      {items.map((item) => (
        <div className="bar-row" key={item.name}>
          <span className="bar-label" title={item.name}>
            {item.name}
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
          <span className="bar-value">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
