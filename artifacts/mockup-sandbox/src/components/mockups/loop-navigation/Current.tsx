import type { ReactNode, ComponentProps } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./_group.css";
const Link = ({href, ...props}: ComponentProps<"a">) => <a href={href} {...props} onClick={event => event.preventDefault()} />;
const useLocation = (): readonly [string] => ["/agents"];
import { Moon, Sun, Plus, FlaskConical, RotateCcw } from "lucide-react";
function LoopMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d="M52 32a20 20 0 1 1-5.9-14.1" fill="none" stroke="#5B4BFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M46 8v10H36" fill="none" stroke="#5B4BFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 29v6M32 24v16M40 28v8" stroke="#1A1A2E" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function LoopLogo({ className = "", markClassName = "h-7 w-7", textClassName = "text-lg" }: { className?: string; markClassName?: string; textClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid place-items-center rounded-md bg-[#F6F5FF] p-0.5 dark:bg-[#EEEDFF]">
        <LoopMark className={markClassName} />
      </span>
      <span className={`font-display font-bold lowercase leading-none tracking-tight ${textClassName}`}>loop</span>
    </span>
  );
}

const useTheme = () => ({theme: "light", toggle: () => {}});
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
const useDemo = () => ({reset: () => {}});
const useToast = () => ({toast: (_value: unknown) => {}});

function ExtractedShell({ children }: { children?: ReactNode }) {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const { reset } = useDemo();
  const { toast } = useToast();
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link href="/" className="group flex items-center gap-2" data-testid="link-home">
            <LoopLogo />
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/agents" data-testid="link-agents" className={`rounded-md px-3 py-1.5 transition-colors ${location.startsWith("/agents") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Agents</Link>
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

export function Current() { return <TooltipProvider><ExtractedShell /></TooltipProvider>; }
