import type { ReactNode } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

export const fmtDate = (s: string) => format(new Date(s), "MMM d, yyyy");
export const fmtTime = (s: string) => format(new Date(s), "MMM d, HH:mm");
export const ago = (s: string) => formatDistanceToNowStrict(new Date(s), { addSuffix: true });
export const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[11px] uppercase tracking-[.18em] text-primary", className)}>{children}</p>;
}

export function Panel({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone, testId }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "pass" | "fail" | "primary"; testId?: string }) {
  return (
    <div className="p-4">
      <dt className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1.5 font-display text-[28px] font-semibold leading-none tabular", tone === "pass" && "text-pass", tone === "fail" && "text-destructive", tone === "primary" && "text-primary")} data-testid={testId}>{value}</dd>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Verdict({ pass, size = "sm" }: { pass: boolean; size?: "sm" | "xs" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-wide", size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-1.5 py-px text-[10px]", pass ? "bg-pass/12 text-pass" : "bg-destructive/10 text-destructive")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", pass ? "bg-pass" : "bg-destructive")} />
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md border border-border bg-secondary/60 px-1.5 py-px font-mono text-[10.5px] text-muted-foreground", className)}>{children}</span>;
}

export function Empty({ icon: Icon, title, body, children }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-4 grid h-12 w-12 place-items-center rounded-full border border-dashed border-primary/40 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Btn({ variant = "default", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" | "ink" }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-[transform,background-color,border-color,color] active:scale-[.97] disabled:pointer-events-none disabled:opacity-40",
        variant === "default" && "border border-border bg-card hover:border-foreground/25",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "ink" && "bg-foreground text-background hover:bg-foreground/85",
        variant === "ghost" && "text-muted-foreground hover:bg-secondary hover:text-foreground",
        variant === "danger" && "border border-destructive/30 text-destructive hover:bg-destructive/10",
        className,
      )}
    />
  );
}

export function Segmented<T extends string>({ value, onChange, options, testId }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; testId?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          data-testid={`${testId}-${o.value}`}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
