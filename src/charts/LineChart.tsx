import { useState } from "react";
import { fmtDay, fmtNum, linearScale, niceTicks } from "./scale";

export type LinePoint = { x: string; y: number };

type Props = {
  label: string;
  points: LinePoint[];
  unit?: string;
  /** Optional dashed gray reference line on the same axis (e.g. "planned"). */
  reference?: { label: string; points: LinePoint[] };
  height?: number;
  zeroBased?: boolean;
};

const W = 340;
const PAD = { l: 40, r: 12, t: 12, b: 24 };

/** One value axis only. Series color is the accent; text stays in text tokens. */
export function LineChart({ label, points, unit, reference, height = 180, zeroBased = false }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="text-sm text-[var(--muted)]">No sessions yet.</p>;

  const all = [...points, ...(reference?.points ?? [])].map((p) => p.y);
  const ticks = niceTicks(zeroBased ? 0 : Math.min(...all), Math.max(...all));
  const H = height;
  const x = linearScale([0, Math.max(1, points.length - 1)], [PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : 0), W - PAD.r]);
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [H - PAD.b, PAD.t]);
  const path = (ps: LinePoint[]) => ps.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
  const hp = hover !== null ? points[hover] : null;
  const u = unit ? ` ${unit}` : "";

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i; });
    setHover(best);
  };

  return (
    <figure className="m-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <figcaption className="font-medium text-[var(--text)]">{label}</figcaption>
        {reference && (
          <span className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="var(--series-1)" strokeWidth="2" /></svg>done</span>
            <span className="flex items-center gap-1"><svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="var(--muted)" strokeWidth="2" strokeDasharray="3 3" /></svg>{reference.label}</span>
          </span>
        )}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img"
          aria-label={`${label}: ${points.map((p) => `${fmtDay(p.x)} ${fmtNum(p.y)}${u}`).join(", ")}`}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">{fmtNum(t)}</text>
            </g>
          ))}
          <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted)">{fmtDay(points[0].x)}</text>
          {points.length > 1 && <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end" fill="var(--muted)">{fmtDay(points[points.length - 1].x)}</text>}
          {reference && reference.points.length > 1 && (
            <path d={path(reference.points)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 4" />
          )}
          {points.length > 1 && <path d={path(points)} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {hp && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1" />}
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.y)} r={hover === i ? 5 : points.length > 24 ? 0 : 4}
              fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
          ))}
        </svg>
        {hp && (
          <div className="pointer-events-none absolute top-0 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs shadow"
            style={{ left: `${(x(hover!) / W) * 100}%`, transform: `translateX(${hover! > points.length / 2 ? "-105%" : "5%"})` }}>
            <div className="text-[var(--muted)]">{fmtDay(hp.x)}</div>
            <div className="font-semibold text-[var(--text)]">{fmtNum(hp.y)}{u}</div>
            {reference?.points[hover!] && <div className="text-[var(--muted)]">{reference.label} {fmtNum(reference.points[hover!].y)}{u}</div>}
          </div>
        )}
      </div>
    </figure>
  );
}
