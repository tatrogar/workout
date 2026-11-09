import { linearScale } from "./scale";

/** Tiny trend, no axes. Fewer than 2 values renders nothing. */
export function Sparkline({ values, label }: { values: number[]; label?: string }) {
  if (values.length < 2) return null;
  const W = 64, H = 20;
  const x = linearScale([0, values.length - 1], [2, W - 4]);
  const y = linearScale([Math.min(...values), Math.max(...values)], [H - 3, 3]);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? `trend ${values.join(", ")}`}>
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r="2.5" fill="var(--series-1)" />
    </svg>
  );
}
