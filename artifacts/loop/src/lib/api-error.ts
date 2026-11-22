export function errorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err && typeof err === "object" && "data" in err) {
    const d = (err as { data?: { error?: unknown } | null }).data;
    if (d && typeof d.error === "string" && d.error) return d.error;
  }
  return fallback;
}
