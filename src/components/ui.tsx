import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-sky-600 text-white active:bg-sky-700",
  secondary: "bg-slate-700 text-slate-100 active:bg-slate-600",
  ghost: "bg-transparent text-slate-300 active:bg-slate-800",
  danger: "bg-rose-700 text-white active:bg-rose-800",
};

export function Button({ variant = "secondary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button {...rest}
      className={`min-h-touch rounded-xl px-4 text-base font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${className}`} />
  );
}

export function LinkButton({ href, children, variant = "secondary", className = "" }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <a href={href} className={`flex min-h-touch items-center justify-center rounded-xl px-4 text-base font-semibold ${VARIANTS[variant]} ${className}`}>
      {children}
    </a>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`}>{children}</section>;
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">{children}</h1>
      {right}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange(v: boolean): void; hint?: string }) {
  return (
    <label className="flex min-h-touch items-center justify-between gap-4 py-1">
      <span>
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-[var(--muted)]">{hint}</span>}
      </span>
      <input type="checkbox" className="h-6 w-6 accent-sky-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** − [value] + with a typable middle. */
export function Stepper({ value, step, onChange, label, suffix }: { value: number | undefined; step: number; onChange(v: number): void; label: string; suffix?: string }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center" aria-label={label}>
      <button type="button" aria-label={`${label} minus ${step}`} className="h-12 w-10 rounded-l-lg bg-slate-700 text-xl active:bg-slate-600"
        onClick={() => onChange(Math.max(0, Math.round((v - step) * 10) / 10))}>−</button>
      <input inputMode="decimal" aria-label={label} className="h-12 w-14 bg-slate-800 text-center text-lg font-semibold"
        value={value ?? ""} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); }} />
      <button type="button" aria-label={`${label} plus ${step}`} className="h-12 w-10 rounded-r-lg bg-slate-700 text-xl active:bg-slate-600"
        onClick={() => onChange(Math.round((v + step) * 10) / 10)}>+</button>
      {suffix && <span className="ml-1 text-sm text-[var(--muted)]">{suffix}</span>}
    </div>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange(): void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-2xl font-bold ${checked ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-500 text-transparent"}`}>
      ✓
    </button>
  );
}
