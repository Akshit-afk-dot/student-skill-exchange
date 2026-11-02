import { useCallback, useRef, useState } from 'react';
import { plural } from './ui';

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

/**
 * Reports the rendered width of the element it is attached to. The chart is drawn at that
 * exact size, so its labels stay readable instead of shrinking with a scaled viewBox.
 */
function useMeasuredWidth(fallback: number) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);

  // A callback ref rather than an effect: the chart can mount with no data, render
  // nothing, and only later get an element to measure.
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.current.observe(el);
  }, []);

  return [ref, width] as const;
}

export function TrendChart({ points, height = 180 }: { points: TrendPoint[]; height?: number }) {
  const [ref, width] = useMeasuredWidth(640);

  if (points.length === 0) {
    return <div className="empty">No signups in the last 30 days yet.</div>;
  }

  const padding = { top: 12, right: 12, bottom: 24, left: 34 };
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
    <div className="chart-frame" ref={ref}>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
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
        <text className="chart-label" x={4} y={padding.top + 10}>
          {max}
        </text>
        <text className="chart-label" x={4} y={padding.top + plotH}>
          0
        </text>

        {area ? <path className="chart-area" d={area} /> : null}
        <path className="chart-line" d={line} />

        {coords.map((c, i) => (
          <g key={c.date}>
            {/* A wider invisible target so every point can be hovered or tapped. */}
            <circle className="chart-hit" cx={c.x} cy={c.y} r={9}>
              <title>{`${c.date}: ${plural(c.signups, 'signup')}`}</title>
            </circle>
            {i % labelEvery === 0 || i === coords.length - 1 ? (
              <>
                <circle className="chart-dot" cx={c.x} cy={c.y} r={2.5} />
                <text className="chart-label" x={c.x} y={height - 6} textAnchor="middle">
                  {c.date.slice(5)}
                </text>
              </>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
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
