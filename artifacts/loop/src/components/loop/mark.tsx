export function LoopMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="56 14" strokeLinecap="round" transform="rotate(-60 16 16)" />
      <circle cx="16" cy="16" r="3.2" className="fill-primary" />
    </svg>
  );
}
