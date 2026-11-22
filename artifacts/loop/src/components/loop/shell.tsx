import type { ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Moon, Sun, Plus, FlaskConical, RotateCcw, Home, ChevronDown, LogOut, UserRound } from "lucide-react";
import { LoopLogo } from "./mark";
import { useTheme } from "./theme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/demo-store";
import { useToast } from "@/hooks/use-toast";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useListAgents } from "@workspace/api-client-react";

export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const { state, reset } = useDemo();
  const { data: connectedAgents = [] } = useListAgents({ query: { retry: false } });
  const { toast } = useToast();
  const path = location.split("?")[0];
  const routeAgentId = path.match(/^\/(?:agents|sample)\/([^/]+)(?:\/fixes\/[^/]+)?$/)?.[1];
  const sampleContext = path.startsWith("/sample") || (!!routeAgentId && state.agents.some((agent) => agent.id === routeAgentId));
  const agentBase = sampleContext ? "/sample" : "/agents";
  const agentChoices = sampleContext
    ? state.agents.map((agent) => ({ ...agent, label: `${agent.org} / ${agent.name}` }))
    : connectedAgents.map((agent) => ({ ...agent, label: agent.name }));
  const selectedAgent = agentChoices.find((agent) => agent.id === routeAgentId);
  const params = new URLSearchParams(search);
  const currentTab = params.get("tab");
  const switchAgent = (nextId: string) => {
    if (path.includes("/fixes/")) {
      navigate(`${agentBase}/${nextId}?tab=fixes`);
      return;
    }
    const validTab = currentTab && ["calls", "failures", "evals", "fixes", "versions", "settings"].includes(currentTab);
    const tabSuffix = validTab ? `?tab=${currentTab}` : "";
    navigate(`${agentBase}/${nextId}${tabSuffix}`);
  };
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Your account";
  const logout = async () => {
    queryClient.clear();
    await signOut({ redirectUrl: import.meta.env.BASE_URL });
  };
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-5 sm:px-6">
          <Link href="/" aria-label="Home — loop" className="group flex shrink-0 items-center gap-2" data-testid="link-home">
            <LoopLogo />
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-0.5 text-xs sm:gap-1 sm:text-sm">
            <Link href="/" aria-current={path === "/" ? "page" : undefined} data-testid="link-nav-home" className={`inline-flex items-center gap-1 rounded-md px-2 py-2 transition-colors sm:px-3 ${path === "/" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <Home className="h-3.5 w-3.5 sm:hidden" /><span className="hidden sm:inline">Home</span><span className="sr-only sm:hidden">Home</span>
            </Link>
            <Link href="/agents" aria-current={path === "/agents" ? "page" : path.startsWith("/agents/") ? "location" : undefined} data-testid="link-agents" className={`rounded-md px-2 py-2 transition-colors sm:px-3 ${path.startsWith("/agents") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>All agents</Link>
          </nav>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden items-center gap-1.5 rounded-full border border-[#DED9FF] bg-[#F5F3FF] px-2.5 py-1 font-mono text-[10.5px] text-[#5B4BFF] sm:flex" data-testid="status-demo">
                  <FlaskConical className="h-3 w-3" />
                  <span>{sampleContext ? "Sample workspace" : location === "/connect" ? "New connection" : location.startsWith("/agents/") ? "Connected agent" : "Your agents"}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{sampleContext ? "Sample workspace: calls, results, and fixes are synthetic." : location === "/connect" ? "Connect an existing ElevenLabs agent. Nothing changes in ElevenLabs during this flow." : "Your saved ElevenLabs connections are distinct from the sample workspace."}</TooltipContent>
            </Tooltip>
            {sampleContext && <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => { reset(); toast({ title: "Demo data reset", description: "Sample workspace restored." }); }} data-testid="button-reset-demo" aria-label="Reset demo data" className="hidden h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:grid">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset sample data</TooltipContent>
            </Tooltip>}
            <button onClick={toggle} data-testid="button-theme" aria-label="Toggle theme" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {path !== "/connect" && (
              <Link href="/connect" aria-label="Connect an agent" data-testid="link-connect-header" className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-transform active:scale-[.97] sm:px-3 sm:text-sm">
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">Connect agent</span>
              </Link>
            )}
            <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3" title={displayName} aria-label={`Profile: ${displayName}`}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F0EEFF] text-[#5B4BFF]"><UserRound className="h-4 w-4" /></span>
              <span className="hidden max-w-32 truncate text-xs font-medium md:block">{displayName}</span>
            </div>
            <button onClick={logout} data-testid="button-logout" aria-label="Log out" title="Log out" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {selectedAgent && (
          <div className="border-t border-border/60 bg-secondary/35">
            <div className="mx-auto flex h-10 max-w-7xl items-center gap-2 px-4 sm:px-6">
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground sm:text-[10px]">Viewing agent</span>
              <label className="relative min-w-0 flex-1 sm:max-w-sm">
                <span className="sr-only">Switch agent</span>
                <select
                  aria-label="Switch agent"
                  data-testid="select-current-agent"
                  value={selectedAgent.id}
                  onChange={(event) => switchAgent(event.target.value)}
                  className="h-8 w-full appearance-none truncate rounded-md border border-border/80 bg-background pl-2.5 pr-8 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm"
                >
                  {agentChoices.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
              <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:block">{selectedAgent.remoteId}</span>
            </div>
          </div>
        )}
      </header>
      <main key={path} className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}
