export function LoopMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d="M52 32a20 20 0 1 1-5.9-14.1" fill="none" stroke="#5B4BFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M46 8v10H36" fill="none" stroke="#5B4BFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 29v6M32 24v16M40 28v8" stroke="#1A1A2E" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function LoopLogo({ className = "", markClassName = "h-7 w-7", textClassName = "text-lg" }: { className?: string; markClassName?: string; textClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid place-items-center rounded-md bg-[#F6F5FF] p-0.5 dark:bg-[#EEEDFF]">
        <LoopMark className={markClassName} />
      </span>
      <span className={`font-display font-bold lowercase leading-none tracking-tight ${textClassName}`}>loop</span>
    </span>
  );
}
