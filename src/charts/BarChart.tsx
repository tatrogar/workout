import { useState } from "react";
import { fmtNum, linearScale, niceTicks } from "./scale";

type Props = { label: string; bars: { label: string; value: number; title?: string }[]; unit?: string; height?: number };

const W = 340;
const PAD = { l: 32, r: 8, t: 10, b: 22 };

export function BarChart({ label, bars, unit, height = 150 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const ticks = niceTicks(0, Math.max(1, ...bars.map((b) => b.value)), 3);
  const y = linearScale([0, ticks[ticks.length - 1]], [H - PAD.b, PAD.t]);
  const slot = (W - PAD.l - PAD.r) / Math.max(1, bars.length);
  const bw = Math.max(4, slot - 2); // 2px gap between bars
  const r = Math.min(4, bw / 2);
  const u = unit ? ` ${unit}` : "";
  const hb = hover !== null ? bars[hover] : null;

  const barPath = (x0: number, top: number, bottom: number) => {
    const h = bottom - top;
    if (h <= 0) return "";
    const rr = Math.min(r, h);
    return `M${x0},${bottom}V${top + rr}Q${x0},${top} ${x0 + rr},${top}H${x0 + bw - rr}Q${x0 + bw},${top} ${x0 + bw},${top + rr}V${bottom}Z`;
  };

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm font-medium text-[var(--text)]">{label}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img"
          aria-label={`${label}: ${bars.map((b) => `${b.title ?? b.label} ${fmtNum(b.value)}${u}`).join(", ")}`}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={PAD.l - 5} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">{fmtNum(t)}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x0 = PAD.l + i * slot + 1;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
                <path d={barPath(x0, y(b.value), y(0))} fill="var(--series-1)" opacity={hover === null || hover === i ? 1 : 0.55} />
                {(i === 0 || i === bars.length - 1 || i % 4 === 0) && (
                  <text x={x0 + bw / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--muted)">{b.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        {hb && (
          <div className="pointer-events-none absolute top-0 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs shadow"
            style={{ left: `${((PAD.l + hover! * slot + slot / 2) / W) * 100}%`, transform: `translateX(${hover! > bars.length / 2 ? "-105%" : "5%"})` }}>
            <div className="text-[var(--muted)]">{hb.title ?? hb.label}</div>
            <div className="font-semibold text-[var(--text)]">{fmtNum(hb.value)}{u}</div>
          </div>
        )}
      </div>
    </figure>
  );
}
