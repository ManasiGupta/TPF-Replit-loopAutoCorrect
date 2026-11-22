import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Moon, Sun, Plus, FlaskConical, RotateCcw } from "lucide-react";
import { LoopMark } from "./mark";
import { useTheme } from "./theme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/demo-store";
import { useToast } from "@/hooks/use-toast";

export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const { reset } = useDemo();
  const { toast } = useToast();
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link href="/" className="group flex items-center gap-2" data-testid="link-home">
            <LoopMark className="h-6 w-6 transition-transform duration-500 group-hover:rotate-[120deg]" />
            <span className="font-display text-lg font-semibold">Loop</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/" data-testid="link-agents" className={`rounded-md px-3 py-1.5 transition-colors ${location === "/" || location.startsWith("/agents") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Agents</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground" data-testid="status-demo">
                  <FlaskConical className="h-3 w-3 text-primary" />
                  <span>Demo<span className="hidden sm:inline"> · sample data</span></span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-60">Interactive prototype. All agents, calls, and results are synthetic. Nothing connects to ElevenLabs and no live agent is modified.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => { reset(); toast({ title: "Demo data reset", description: "Sample workspace restored." }); }} data-testid="button-reset-demo" aria-label="Reset demo data" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset sample data</TooltipContent>
            </Tooltip>
            <button onClick={toggle} data-testid="button-theme" aria-label="Toggle theme" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {location !== "/connect" && (
              <Link href="/connect" data-testid="link-connect-header" className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[.97] sm:px-3">
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">Connect agent</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}
