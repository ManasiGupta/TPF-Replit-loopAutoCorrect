import { Link } from "wouter";
import { ArrowRight, Wrench } from "lucide-react";
import { useDemo } from "@/lib/demo-store";
import { Empty, Panel, Tag, ago } from "@/components/loop/ui";
import { cn } from "@/lib/utils";

export function FixesTab({ agentId }: { agentId: string }) {
  const { state } = useDemo();
  const fixes = state.fixes.filter((f) => f.agentId === agentId).sort((a, b) => (a.status === "candidate" ? -1 : 1) - (b.status === "candidate" ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));
  if (fixes.length === 0) return <Panel><Empty icon={Wrench} title="No fixes yet" body="Open a failure cluster and choose Fix this to generate a candidate prompt." /></Panel>;
  return (
    <Panel>
      <ul className="divide-y divide-border">
        {fixes.map((f) => {
          const regressions = f.tests.filter((t) => t.current && !t.candidate).length;
          const gains = f.tests.filter((t) => !t.current && t.candidate).length;
          return (
            <li key={f.id}>
              <Link href={`/agents/${agentId}/fixes/${f.id}`} data-testid={`link-fix-${f.id}`} className="group flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.title}</span>
                    <Tag className={cn(f.status === "candidate" && "border-primary/30 bg-accent text-accent-foreground", f.status === "shipped" && "border-pass/30 text-pass", f.status === "rejected" && "line-through")}>{f.status}</Tag>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">from v{f.baseVersion} · {ago(f.createdAt)}</p>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs tabular">
                  <span className="text-pass">+{gains} fixed</span>
                  <span className={regressions ? "text-destructive" : "text-muted-foreground"}>{regressions} regress</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
