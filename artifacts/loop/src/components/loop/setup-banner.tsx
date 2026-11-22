import { AlertTriangle, RotateCw } from "lucide-react";
import { useGetSetup } from "@workspace/api-client-react";

export function useSetupState() {
  const q = useGetSetup({ query: { refetchInterval: 15000 } });
  const ready = !!q.data && q.data.databaseReady && q.data.encryptionReady;
  return { ...q, ready };
}

export function SetupBanner({ context }: { context: "list" | "connect" }) {
  const q = useSetupState();
  if (q.isLoading) return null;
  if (q.isError) {
    return (
      <div className="rise mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" data-testid="status-setup-error">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-medium">Could not reach the Loop server.</p>
          <p className="text-muted-foreground">Setup status is unknown, so saving is paused.</p>
        </div>
        <button onClick={() => q.refetch()} data-testid="button-retry-setup" className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"><RotateCw className="h-3 w-3" />Retry</button>
      </div>
    );
  }
  if (q.ready || !q.data) return null;
  const d = q.data;
  return (
    <div className="rise mb-6 rounded-lg border border-amber-500/40 bg-amber-500/[.07] p-4 text-sm" data-testid="status-setup-warning">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 space-y-2">
          <p className="font-medium">Saving connections is blocked until setup is complete.</p>
          {d.message && <p className="text-muted-foreground" data-testid="text-setup-message">{d.message}</p>}
          <ul className="flex flex-wrap gap-2 font-mono text-[11px]">
            <li className={`rounded border px-2 py-0.5 ${d.databaseReady ? "border-border text-muted-foreground" : "border-amber-500/50 text-amber-700 dark:text-amber-300"}`}>database {d.databaseReady ? "ready" : "not ready"}</li>
            <li className={`rounded border px-2 py-0.5 ${d.encryptionReady ? "border-border text-muted-foreground" : "border-amber-500/50 text-amber-700 dark:text-amber-300"}`}>encryption {d.encryptionReady ? "ready" : "not configured"}</li>
          </ul>
          {context === "connect" && d.databaseReady && !d.encryptionReady && (
            <p className="text-muted-foreground">You can still load and preview agents. Nothing is stored until encryption is configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}
